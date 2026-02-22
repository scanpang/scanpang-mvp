/**
 * ScanCameraScreen - 포커스 가이드 기반 1건물 스캔 방식
 * - Layer 0: 전체화면 카메라 프리뷰
 * - Layer 1: 포커스 가이드 (중앙 사각형 + 디밍)
 * - Layer 2: 포커스된 건물 1개 라벨 + 게이지 바
 * - Layer 3: 상단 HUD
 * - Layer 4: 건물 프로필 바텀시트
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Animated,
  Dimensions,
  AppState,
  Linking,
  InteractionManager,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, SPACING, TOUCH } from '../constants/theme';
import { postScanLog, postScanComplete, getServerTimeContext, analyzeFrame } from '../services/api';
import useNearbyBuildings from '../hooks/useNearbyBuildings';
import useBuildingDetail from '../hooks/useBuildingDetail';
import useSensorData from '../hooks/useSensorData';
import { formatDistance } from '../utils/coordinate';
import { rankBuildings } from '../services/detectionEngine';
import { matchBuildings as matchBuildingsGeo, GEO_PARAMS } from '../services/geospatialEngine';
import { behaviorTracker } from '../services/behaviorTracker';
import BuildingProfileSheet from '../components/BuildingProfileSheet';
import XRayOverlay from '../components/XRayOverlay';
import { ARCameraView } from 'scanpang-arcore';
import useGeospatialTracking from '../hooks/useGeospatialTracking';
import useGeospatialAnchors from '../hooks/useGeospatialAnchors';

const { width: SW, height: SH } = Dimensions.get('window');
const RECENT_SCANS_KEY = '@scanpang_recent_scans';
const CAMERA_HFOV = 60;
const FOCUS_ANGLE = 35; // 도심 밀집 지역 대응: ±35° (기존 ±19°)
const GAUGE_DURATION = 3000; // 3초
const GAUGE_TICK = 50; // 50ms마다 업데이트
const FOCUS_RESET_THRESHOLD = 8; // 연속 8틱(400ms) 벗어나야 게이지 리셋
const STICKINESS_BONUS = 5; // 현재 포커스 건물에 5° 보너스 (방위각 비교 시)
const SWITCH_THRESHOLD = 3; // 새 건물이 3° 이상 더 가까워야 전환
const SWITCH_CONFIRM_THRESHOLD = 5; // 5틱 연속 같은 새 건물이어야 전환
const SNAP_POINTS = ['1%', '50%', '90%'];

// GPS 캐시 키
const GPS_CACHE_KEY = '@scanpang_last_gps';

const computeHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  return (angle + 360) % 360;
};

// ===== 포커스 가이드 프레임 (QR 스캐너 스타일) =====
const GUIDE_WIDTH = SW * 0.65;
const GUIDE_HEIGHT = GUIDE_WIDTH * (4 / 3); // 3:4 비율 (가로:세로)
const GUIDE_TOP = SH * 0.18;
const CORNER_LEN = 28;
const CORNER_W = 3;

const FocusGuide = ({ isActive, buildingCount }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {/* 디밍 오버레이 (포커스 영역 바깥) */}
    <View style={styles.dimTop} />
    <View style={styles.dimRow}>
      <View style={styles.dimSide} />
      <View style={styles.guideHole}>
        {/* 코너 라인 4개 */}
        <View style={[styles.corner, styles.cornerTL, isActive && styles.cornerActive]} />
        <View style={[styles.corner, styles.cornerTR, isActive && styles.cornerActive]} />
        <View style={[styles.corner, styles.cornerBL, isActive && styles.cornerActive]} />
        <View style={[styles.corner, styles.cornerBR, isActive && styles.cornerActive]} />
      </View>
      <View style={styles.dimSide} />
    </View>
    <View style={styles.dimBottom}>
      <Text style={styles.nearbyCountText}>
        {isActive ? '' : '건물에 카메라를 맞춰 스캔하세요'}
      </Text>
    </View>
  </View>
);

// ===== 포커스된 건물 라벨 + 게이지 =====
const FocusedLabel = ({ building, confidence, gaugeProgress, onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 10, tension: 100, useNativeDriver: true }),
    ]).start();
  }, [building?.id]);

  if (!building) return null;

  const gaugeColor = gaugeProgress >= 1 ? Colors.successGreen : Colors.accentAmber;
  const gaugeWidth = `${Math.min(gaugeProgress * 100, 100)}%`;

  return (
    <Animated.View style={[styles.focusedLabelWrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={styles.focusedCard} onPress={() => onPress(building)} activeOpacity={0.85}>
        {/* 건물명 + 타입 */}
        <Text style={styles.focusedName} numberOfLines={1}>{building.name}</Text>
        <Text style={styles.focusedType} numberOfLines={1}>
          {building.buildingUse || building.category || ''}
        </Text>

        {/* 거리 + confidence */}
        <View style={styles.focusedMetaRow}>
          <Text style={styles.focusedDistance}>{formatDistance(building.distance || 0)}</Text>
          {confidence != null && (
            <View style={[styles.focusedConfBadge, {
              backgroundColor: confidence >= 70 ? '#10B98125' : confidence >= 40 ? '#F59E0B25' : '#EF444425'
            }]}>
              <Text style={[styles.focusedConfText, {
                color: confidence >= 70 ? '#10B981' : confidence >= 40 ? '#F59E0B' : '#EF4444'
              }]}>{confidence}%</Text>
            </View>
          )}
        </View>

        {/* 게이지 바 */}
        <View style={styles.gaugeBarBg}>
          <View style={[styles.gaugeBarFill, { width: gaugeWidth, backgroundColor: gaugeColor }]} />
        </View>
      </TouchableOpacity>

      {/* 핀 아이콘 */}
      <View style={styles.focusedPin}>
        <View style={styles.pinOuter}>
          <View style={styles.pinInner} />
        </View>
        <View style={styles.pinTail} />
      </View>
    </Animated.View>
  );
};

// ===== 상단 HUD =====
// 모드 순환: auto(null) → VPS* → AR* → GPS* → auto(null)
const FORCE_MODE_CYCLE = ['VPS', 'GPS'];

const CameraHUD = ({ gpsStatus, onBack, buildingCount, factorScore, accuracyInfo, debugInfo, arError, forceMode, onForceMode }) => {
  const gpsColor = gpsStatus === 'active' ? Colors.successGreen : gpsStatus === 'error' ? Colors.liveRed : Colors.accentAmber;
  const hAcc = debugInfo?.hAcc != null ? `${debugInfo.hAcc.toFixed(0)}m` : '-';
  const hdAcc = debugInfo?.hdAcc != null ? `${debugInfo.hdAcc.toFixed(0)}°` : '-';

  // 모드 배지 탭 → 다음 모드로 순환
  const handleModeTap = () => {
    const currentIdx = FORCE_MODE_CYCLE.indexOf(forceMode);
    const nextIdx = (currentIdx + 1) % FORCE_MODE_CYCLE.length;
    onForceMode?.(FORCE_MODE_CYCLE[nextIdx]);
  };

  return (
    <View style={styles.hud}>
      <TouchableOpacity style={styles.hudBackBtn} onPress={onBack} hitSlop={TOUCH.hitSlop}>
        <Text style={styles.hudBackText}>{'\u2039'}</Text>
      </TouchableOpacity>

      {/* 모드 배지 (탭하면 강제 모드 순환) */}
      <TouchableOpacity
        style={[styles.hudModeBadge, { backgroundColor: accuracyInfo?.modeColor || '#888' }]}
        onPress={handleModeTap}
        activeOpacity={0.7}
      >
        <Text style={styles.hudModeText}>
          {accuracyInfo?.modeLabel || 'GPS'}{accuracyInfo?.hasVPS && !forceMode ? ' \u2713' : ''}
        </Text>
      </TouchableOpacity>

      {/* arError 표시 (있을 때만) */}
      {arError && (
        <View style={styles.hudErrorBadge}>
          <Text style={styles.hudErrorText}>{arError}</Text>
        </View>
      )}

      {/* 정확도 + FOV + depth + 건물수 압축 표시 */}
      <View style={styles.hudInfoPill}>
        <Text style={styles.hudInfoText}>{hAcc}</Text>
        <Text style={styles.hudInfoSep}>·</Text>
        <Text style={styles.hudInfoText}>{hdAcc}</Text>
        <Text style={styles.hudInfoSep}>·</Text>
        <Text style={styles.hudInfoText}>±{debugInfo?.fov || 35}°</Text>
        <Text style={styles.hudInfoSep}>·</Text>
        <Text style={styles.hudInfoText}>건물{debugInfo?.buildingCount || 0}</Text>
      </View>

      {/* GPS 상태 (색상 점만) */}
      <View style={styles.hudGps}>
        <View style={[styles.hudGpsDot, { backgroundColor: gpsColor }]} />
      </View>
    </View>
  );
};

// ===== 안내 텍스트 =====
const GuideText = ({ text }) => (
  <View style={styles.guideTextWrap}>
    <Text style={styles.guideText}>{text}</Text>
  </View>
);

// ===== 메인 화면 =====
const ScanCameraScreen = ({ route, navigation }) => {
  const { focusBuildingId } = route?.params || {};
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState(focusBuildingId || null);
  const [gpsStatus, setGpsStatus] = useState('searching');
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false); // 네비게이션 애니메이션 완료 후 카메라 마운트
  const [gpsAccuracy, setGpsAccuracy] = useState(null); // GPS 폴백 모드 수평 정확도(m)

  const [timeContext, setTimeContext] = useState(null);
  const [geminiResults, setGeminiResults] = useState(new Map());
  const [gaugeProgress, setGaugeProgress] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanCompleteMessage, setScanCompleteMessage] = useState(null); // 0.5초 표시 후 소멸
  const [profileData, setProfileData] = useState(null); // scan-complete API 응답
  const [profileError, setProfileError] = useState(null);
  const [xrayActive, setXrayActive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const bottomSheetRef = useRef(null);
  const cameraRef = useRef(null);
  const locationSubRef = useRef(null);
  const magnetSubRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastHeadingRef = useRef(0);
  const geminiTimerRef = useRef(null);
  const geminiAnalyzingRef = useRef(false);
  const gaugeTimerRef = useRef(null);
  const focusedIdRef = useRef(null);
  const outOfFocusCountRef = useRef(0);
  const focusedBuildingRef = useRef(null); // scanComplete 시점의 건물 캡처용
  const pendingSwitchRef = useRef(null);
  const switchCountRef = useRef(0);
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const { gyroscope, accelerometer, cameraAngle, isStable, motionState, getSnapshot } = useSensorData({ enabled: gpsStatus === 'active' });

  // ARCore Geospatial 추적 (단일 정확도 시스템)
  const {
    geoPose, vpsAvailable, trackingState, isLocalized, isARMode, accuracyInfo, arError,
    forceMode, setForceMode,
    handlePoseUpdate, handleTrackingStateChanged, handleReady, handleError,
  } = useGeospatialTracking({ enabled: true });

  // geoPose stale closure 방지용 ref
  const geoPoseRef = useRef(null);
  useEffect(() => { geoPoseRef.current = geoPose; }, [geoPose]);

  // VPS/GPS 분기: VPS면 OSM primary(좁은 반경), GPS면 기존 200m
  const isVpsActive = accuracyInfo?.hasVPS === true;
  const nearbyRadius = isVpsActive
    ? (geoPose?.horizontalAccuracy < 5 ? 50 : 100)
    : 200;
  const nearbySource = isVpsActive ? 'osm_vps' : 'auto';

  const { buildings, loading: nearbyLoading } = useNearbyBuildings({
    latitude: userLocation?.lat, longitude: userLocation?.lng,
    heading, radius: nearbyRadius,
    source: nearbySource,
    enabled: gpsStatus === 'active' && !sheetOpen,
  });

  // AR 앵커 관리 (Geospatial localized + 바텀시트 닫혀있을 때)
  const { anchors: arAnchors, handleAnchorPositionsUpdate } = useGeospatialAnchors({
    buildings,
    isLocalized,
    enabled: isARMode && isLocalized && !sheetOpen,
  });

  // 선택된 건물의 메타 정보 (nearby에서 전달 → profile 쿼리 파라미터용)
  const selectedBuildingMeta = useMemo(() => {
    if (!selectedBuildingId) return null;
    const found = buildings.find(b => b.id === selectedBuildingId);
    if (!found) return null;
    return {
      lat: found.lat,
      lng: found.lng,
      name: found.name,
      address: found.address || found.roadAddress || '',
      category: found.category || '',
      categoryDetail: found.categoryDetail || '',
    };
  }, [selectedBuildingId, buildings]);

  const { building: buildingDetail, loading: detailLoading, enriching, fetchLazyTab } = useBuildingDetail(
    selectedBuildingId,
    { buildingMeta: selectedBuildingMeta },
  );

  const selectedBuilding = selectedBuildingId
    ? { ...(buildings.find(b => b.id === selectedBuildingId) || {}), ...(buildingDetail || {}) }
    : null;

  // 건물별 confidence 계산 + 정렬 (VPS: Geospatial 엔진 / GPS: 7-Factor)
  const rankedBuildings = useMemo(() => {
    if (!buildings.length) return [];
    if (isVpsActive && geoPose) {
      // VPS: Geospatial 엔진 — ARCore 위치/heading 기반
      return matchBuildingsGeo(geoPose, buildings, timeContext, geminiResults);
    }
    // GPS: 7-Factor 폴백 — 기존 센서 기반
    const sensorData = { heading, gyroscope, accelerometer, cameraAngle };
    return rankBuildings(buildings, sensorData, timeContext, geminiResults);
  }, [buildings, heading, gyroscope, accelerometer, cameraAngle, timeContext, geminiResults, isVpsActive, geoPose]);

  // 포커스 영역 내 중심에 가장 가까운 건물 1개 계산 (바텀시트 열리면 중단)
  // horizontalAccuracy 기반 FOV 자동 계산: 정확도 좋으면 좁게(25°), 나쁘면 넓게(35°)
  // forceMode 시 고정 FOV: VPS*=25°, AR*=30°, GPS*=35°
  const currentAccuracy = geoPose?.horizontalAccuracy ?? gpsAccuracy ?? 999;
  const focusAngle = forceMode === 'VPS' ? 25
    : forceMode === 'GPS' ? 35
    : isVpsActive ? Math.min(30, Math.max(25, 25 + (currentAccuracy - 2) * 0.556))
    : 35;
  const highAccuracy = currentAccuracy < 10;
  const stickinessBonus = highAccuracy ? GEO_PARAMS.STICKINESS_BONUS : STICKINESS_BONUS;
  const switchThreshold = highAccuracy ? GEO_PARAMS.SWITCH_THRESHOLD : SWITCH_THRESHOLD;

  const focusedBuilding = useMemo(() => {
    if (sheetOpen) return null; // 바텀시트 열려있으면 감지 중단
    if (!rankedBuildings.length) return null;
    // heading ± focusAngle 범위 내 건물만 필터
    const inFocus = rankedBuildings.filter(b => {
      const bearing = b.bearing ?? 0;
      let diff = bearing - heading;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return Math.abs(diff) <= focusAngle;
    });
    if (!inFocus.length) return null;

    const currentFocusedId = focusedIdRef.current;

    const scored = inFocus.map(b => {
      const bearingDiff = Math.abs(((b.bearing ?? 0) - heading + 540) % 360 - 180);
      const isCurrentFocus = b.id === currentFocusedId;
      const adjustedDiff = isCurrentFocus ? Math.max(0, bearingDiff - stickinessBonus) : bearingDiff;
      return { building: b, bearingDiff, adjustedDiff };
    });

    scored.sort((a, b) => a.adjustedDiff - b.adjustedDiff);
    const best = scored[0]?.building ?? null;

    // 현재 포커스 건물이 아직 inFocus 안에 있으면, 새 건물이 switchThreshold 이상 더 가까울 때만 전환
    if (currentFocusedId && best?.id !== currentFocusedId) {
      const currentInList = scored.find(s => s.building.id === currentFocusedId);
      if (currentInList) {
        const bestRaw = scored.find(s => s.building.id === best?.id);
        if (bestRaw && currentInList.bearingDiff - bestRaw.bearingDiff < switchThreshold) {
          return currentInList.building;
        }
      }
    }

    return best;
  }, [rankedBuildings, heading, sheetOpen, focusAngle, stickinessBonus, switchThreshold]);

  // focusedBuilding이 유효할 때 ref에 캡처 (scanComplete effect에서 안전하게 참조)
  useEffect(() => {
    if (focusedBuilding) focusedBuildingRef.current = focusedBuilding;
  }, [focusedBuilding]);

  // ===== 게이지 시스템 (디바운스 리셋) =====
  // 높은 정확도: 더 빠른 전환/리셋
  const focusResetThreshold = highAccuracy ? GEO_PARAMS.FOCUS_RESET : FOCUS_RESET_THRESHOLD;
  const switchConfirmThreshold = highAccuracy ? GEO_PARAMS.SWITCH_CONFIRM : SWITCH_CONFIRM_THRESHOLD;

  useEffect(() => {
    const newId = focusedBuilding?.id || null;

    // 포커스 건물 변경 감지
    if (newId !== focusedIdRef.current) {
      if (newId === null) {
        // 포커스 잃음 → 카운터 증가, 임계값 도달 시에만 리셋
        outOfFocusCountRef.current += 1;
        pendingSwitchRef.current = null;
        switchCountRef.current = 0;
        if (outOfFocusCountRef.current >= focusResetThreshold) {
          focusedIdRef.current = null;
          outOfFocusCountRef.current = 0;
          setGaugeProgress(0);
          setScanComplete(false);
          setScanCompleteMessage(null);
          if (gaugeTimerRef.current) clearInterval(gaugeTimerRef.current);
          gaugeTimerRef.current = null;
        }
        // 임계값 미달 → 기존 게이지 유지 (일시적 흔들림 무시)
        return;
      } else if (focusedIdRef.current && newId !== focusedIdRef.current) {
        // 다른 건물로 전환 → 즉시 게이지 리셋 + 디바운스 확정
        if (gaugeTimerRef.current) clearInterval(gaugeTimerRef.current);
        gaugeTimerRef.current = null;
        setGaugeProgress(0);
        setScanComplete(false);
        setScanCompleteMessage(null);

        if (pendingSwitchRef.current === newId) {
          switchCountRef.current++;
          if (switchCountRef.current >= switchConfirmThreshold) {
            // 전환 확정
            focusedIdRef.current = newId;
            outOfFocusCountRef.current = 0;
            pendingSwitchRef.current = null;
            switchCountRef.current = 0;
          }
        } else {
          // 새로운 후보 건물 등장 → 카운트 시작
          pendingSwitchRef.current = newId;
          switchCountRef.current = 1;
        }
      } else {
        // null → 새 건물 (첫 포커스)
        focusedIdRef.current = newId;
        outOfFocusCountRef.current = 0;
        pendingSwitchRef.current = null;
        switchCountRef.current = 0;
      }
    } else {
      // 같은 건물 유지 → 카운터 리셋
      outOfFocusCountRef.current = 0;
      pendingSwitchRef.current = null;
      switchCountRef.current = 0;
    }

    // 포커스 건물 있으면 게이지 시작 (바텀시트 열려있으면 중단)
    if (focusedIdRef.current && !scanComplete && !sheetOpen) {
      gaugeTimerRef.current = setInterval(() => {
        setGaugeProgress(prev => {
          const next = prev + (GAUGE_TICK / GAUGE_DURATION);
          if (next >= 1) {
            clearInterval(gaugeTimerRef.current);
            gaugeTimerRef.current = null;
            setScanComplete(true);
            return 1;
          }
          return next;
        });
      }, GAUGE_TICK);
    }

    return () => {
      if (gaugeTimerRef.current) clearInterval(gaugeTimerRef.current);
    };
  }, [focusedBuilding?.id, scanComplete, sheetOpen]);

  // 게이지 완료 시 → 햅틱 + 0.5초 메시지 + scan-complete API + 바텀시트
  // 충돌2 수정: focusedBuildingRef 사용하여 sheetOpen→null 타이밍 이슈 방지
  useEffect(() => {
    // focusedBuilding이 이미 null(sheetOpen)일 수 있으므로 ref에서 가져옴
    const building = focusedBuilding || focusedBuildingRef.current;
    if (!scanComplete || !building) return;

    // 1. 햅틱 피드백
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // 2. "스캔 완료!" 0.5초 표시 후 소멸
    setScanCompleteMessage(`${building.name} 스캔 완료!`);
    const msgTimer = setTimeout(() => setScanCompleteMessage(null), 500);

    // 3. 바텀시트 즉시 열기 (스켈레톤 표시 → useBuildingDetail이 프로필 로드)
    setSelectedBuildingId(building.id);
    setProfileError(null);
    setProfileData(null); // 스켈레톤 표시

    setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 50);

    // 백그라운드에서 scan-complete API 호출 (DB 건물만)
    const buildingId = building.id;
    if (!buildingId.startsWith('kakao_') && !buildingId.startsWith('osm_')) {
      postScanComplete(buildingId, {
        confidence: building.confidencePercent || building.confidence || 50,
        sensorData: {
          gps: { lat: userLocation?.lat, lng: userLocation?.lng, accuracy: 10 },
          compass: { heading },
        },
      }).catch(() => {});
    }

    // scan log + behavior
    postScanLog({ sessionId: sessionIdRef.current, buildingId, eventType: 'gaze_scan', userLat: userLocation?.lat, userLng: userLocation?.lng, deviceHeading: heading, metadata: { confidence: building.confidence } }).catch(() => {});
    behaviorTracker.trackEvent('gaze_scan', { buildingId, buildingName: building.name, metadata: { confidence: building.confidence, mode: accuracyInfo?.modeLabel, hAcc: accuracyInfo?.hAcc } });

    saveRecentScan(building);
    triggerGeminiAnalysis(building);

    return () => clearTimeout(msgTimer);
  }, [scanComplete]);

  // geoPose → userLocation/heading 브릿지 (geoPose 도착 시 자동 덮어쓰기)
  useEffect(() => {
    if (!geoPose) return;
    setUserLocation({ lat: geoPose.latitude, lng: geoPose.longitude });
    if (Math.abs(geoPose.heading - lastHeadingRef.current) >= 3) {
      lastHeadingRef.current = geoPose.heading;
      setHeading(geoPose.heading);
    }
    // geoPose가 있으면 위치 확보된 것이므로 active 전환
    setGpsStatus('active');
  }, [geoPose]);

  // ===== focusBuildingId로 진입 시 바텀시트 자동 오픈 =====
  useEffect(() => {
    if (focusBuildingId && selectedBuildingId === focusBuildingId && gpsStatus === 'active') {
      setScanComplete(true);
      setProfileError(null);
      setProfileData(null);
      setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 200);
    }
  }, [focusBuildingId, gpsStatus]);

  // ===== 네비게이션 애니메이션 완료 후 카메라 마운트 =====
  // Cold start 시 Surface 레이아웃 전에 세션이 시작되는 문제 방지
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      if (isMountedRef.current) setCameraReady(true);
    });
    return () => handle.cancel();
  }, []);

  // ===== GPS 캐시 → 빠른 초기 위치 + 상태 전환 =====
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(GPS_CACHE_KEY);
        if (cached) {
          const { lat, lng } = JSON.parse(cached);
          if (lat && lng && !userLocation) {
            setUserLocation({ lat, lng });
            setGpsStatus('active'); // 캐시 위치로도 즉시 건물 탐색 시작
          }
        }
      } catch {}
    })();
  }, []);

  // GPS 위치 변경 시 캐시 저장
  useEffect(() => {
    if (userLocation) {
      AsyncStorage.setItem(GPS_CACHE_KEY, JSON.stringify(userLocation)).catch(() => {});
    }
  }, [userLocation]);

  // BehaviorTracker 세션 + 서버 시각
  useEffect(() => {
    behaviorTracker.startSession({ startLat: userLocation?.lat, startLng: userLocation?.lng });
    getServerTimeContext(userLocation?.lat || 37.4979, userLocation?.lng || 127.0276)
      .then(res => { if (res?.data) setTimeContext(res.data.context); })
      .catch(() => {});
    return () => { behaviorTracker.endSession(); };
  }, []);

  useEffect(() => {
    if (userLocation) behaviorTracker.updateLocation(userLocation.lat, userLocation.lng);
  }, [userLocation]);

  useEffect(() => {
    behaviorTracker.updateSensorData({ heading, ...getSnapshot() });
  }, [heading, gyroscope, accelerometer]);

  useEffect(() => {
    const visible = focusedBuilding ? [{ id: focusedBuilding.id, name: focusedBuilding.name }] : [];
    behaviorTracker.updateVisibleBuildings(visible);
  }, [focusedBuilding]);

  // Gemini Vision: 주기적 (안정 + 선택 건물, 바텀시트 열려있으면 중단)
  useEffect(() => {
    if (!isStable || !selectedBuildingId || !cameraRef.current || sheetOpen) return;
    const run = async () => {
      if (geminiAnalyzingRef.current) return;
      geminiAnalyzingRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3, skipProcessing: true });
        if (!photo?.base64 || !isMountedRef.current) return;
        const b = buildings.find(x => x.id === selectedBuildingId);
        const res = await analyzeFrame(photo.base64, {
          buildingId: selectedBuildingId, buildingName: b?.name,
          lat: userLocation?.lat, lng: userLocation?.lng, heading,
          sessionId: sessionIdRef.current,
        });
        if (res?.data?.analysis && isMountedRef.current) {
          setGeminiResults(prev => { const n = new Map(prev); n.set(selectedBuildingId, res.data.analysis); return n; });
        }
      } catch {} finally { geminiAnalyzingRef.current = false; }
    };
    geminiTimerRef.current = setInterval(run, 15000);
    const init = setTimeout(run, 3000);
    return () => { clearInterval(geminiTimerRef.current); clearTimeout(init); };
  }, [isStable, selectedBuildingId, buildings, userLocation, heading, sheetOpen]);

  // 카메라 권한
  useEffect(() => {
    (async () => {
      if (!cameraPermission) return;
      if (!cameraPermission.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) setCameraPermissionDenied(true);
      }
    })();
  }, [cameraPermission]);

  // 위치 추적 (항상 실행, geoPose 없을 때만 갱신)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { if (!cancelled) setGpsStatus('error'); return; }
        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          (loc) => {
            if (!cancelled && isMountedRef.current) {
              // geoPose가 없을 때만 GPS 위치 사용 (geoPose 우선)
              if (!geoPoseRef.current) {
                setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
                setGpsStatus('active');
              }
              if (loc.coords.accuracy != null) setGpsAccuracy(loc.coords.accuracy);
            }
          }
        );
        locationSubRef.current = sub;
      } catch { if (!cancelled) setGpsStatus('error'); }
    })();
    return () => { cancelled = true; locationSubRef.current?.remove(); };
  }, []);

  // 나침반 (항상 실행, geoPose 없을 때만 갱신)
  useEffect(() => {
    Magnetometer.setUpdateInterval(200);
    const sub = Magnetometer.addListener((data) => {
      if (isMountedRef.current && data) {
        // geoPose가 없을 때만 나침반 heading 사용 (geoPose.heading 우선)
        if (!geoPoseRef.current) {
          const h = computeHeading(data.x, data.y);
          if (Math.abs(h - lastHeadingRef.current) >= 5) { lastHeadingRef.current = h; setHeading(h); }
        }
      }
    });
    magnetSubRef.current = sub;
    return () => magnetSubRef.current?.remove();
  }, []);

  // AppState
  useEffect(() => {
    const ref = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (next) => {
      if (ref.current.match(/active/) && next === 'background') behaviorTracker.flush();
      if (ref.current.match(/background/) && next === 'active') behaviorTracker.flushStoredEvents();
      ref.current = next;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  // ===== 헬퍼 함수 =====
  const saveRecentScan = useCallback(async (building) => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SCANS_KEY);
      const scans = raw ? JSON.parse(raw) : [];
      scans.unshift({
        id: `${building.id}_${Date.now()}`,
        buildingName: building.name || building.address || '건물',
        name: building.name || null,
        address: building.address || null,
        points: 50, timeAgo: '방금 전', timestamp: Date.now(),
      });
      if (scans.length > 20) scans.length = 20;
      await AsyncStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(scans));
    } catch {}
  }, []);

  const triggerGeminiAnalysis = useCallback(async (building) => {
    if (!cameraRef.current || String(building.id).startsWith('osm_')) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3, skipProcessing: true });
      if (!photo?.base64 || !isMountedRef.current) return;
      const res = await analyzeFrame(photo.base64, {
        buildingId: building.id, buildingName: building.name,
        lat: userLocation?.lat, lng: userLocation?.lng, heading,
        sessionId: sessionIdRef.current,
      });
      if (res?.data?.analysis && isMountedRef.current) {
        setGeminiResults(prev => { const n = new Map(prev); n.set(building.id, res.data.analysis); return n; });
      }
    } catch {}
  }, [userLocation, heading]);

  const handleLabelPress = useCallback((building) => {
    if (!building) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBuildingId(building.id);
    setScanComplete(true);
    setProfileError(null);
    setProfileData(null); // 스켈레톤 표시

    // 바텀시트 즉시 열기
    setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 50);

    postScanLog({ sessionId: sessionIdRef.current, buildingId: building.id, eventType: 'pin_tapped', userLat: userLocation?.lat, userLng: userLocation?.lng, deviceHeading: heading, metadata: { confidence: building.confidence } }).catch(() => {});
    behaviorTracker.trackEvent('pin_click', { buildingId: building.id, buildingName: building.name, metadata: { confidence: building.confidence, mode: accuracyInfo?.modeLabel, hAcc: accuracyInfo?.hAcc } });
    saveRecentScan(building);
    triggerGeminiAnalysis(building);
  }, [userLocation, heading, accuracyInfo, saveRecentScan, triggerGeminiAnalysis]);

  // 스캔 상태 초기화 (바텀시트 닫기, 드래그 닫기 공용)
  const resetScanState = useCallback(() => {
    setSelectedBuildingId(null);
    setScanComplete(false);
    setGaugeProgress(0);
    setProfileData(null);
    setProfileError(null);
    setScanCompleteMessage(null);
    setXrayActive(false);
    focusedIdRef.current = null;
    outOfFocusCountRef.current = 0;
    focusedBuildingRef.current = null;
    pendingSwitchRef.current = null;
    switchCountRef.current = 0;
  }, []);

  const handleCloseSheet = useCallback(() => {
    if (selectedBuildingId) behaviorTracker.trackEvent('card_close', { buildingId: selectedBuildingId, buildingName: selectedBuilding?.name });
    resetScanState();
    bottomSheetRef.current?.close();
  }, [selectedBuildingId, resetScanState]);

  const handleXrayToggle = useCallback(() => {
    setXrayActive(prev => {
      if (!prev) {
        // 열기: 바텀시트 축소
        bottomSheetRef.current?.snapToIndex(0);
      } else {
        // 닫기: 바텀시트 복원
        bottomSheetRef.current?.snapToIndex(1);
      }
      return !prev;
    });
  }, []);

  const handleOpenReport = useCallback(() => {
    if (!selectedBuilding) return;
    navigation.navigate('BehaviorReport', { buildingId: selectedBuilding.id, buildingName: selectedBuilding.name });
  }, [selectedBuilding, navigation]);

  // 안내 텍스트 결정 (nearbyLoading 기반)
  const guideMessage = useMemo(() => {
    if (sheetOpen || scanComplete) return scanCompleteMessage || null;
    if (scanCompleteMessage) return scanCompleteMessage;
    if (gpsStatus === 'searching') return '위치를 탐색하고 있습니다...';
    if (nearbyLoading) return '주변 건물 탐색 중...';
    if (buildings.length === 0) return '건물이 감지되지 않았습니다';
    if (!focusedBuilding) return '건물에 카메라를 맞춰주세요';
    return `${focusedBuilding.name} 스캔 중...`;
  }, [gpsStatus, nearbyLoading, buildings.length, focusedBuilding, scanComplete, scanCompleteMessage, sheetOpen]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Layer 0: 카메라 */}
      {cameraPermissionDenied ? (
        <View style={styles.permissionView}>
          <Text style={styles.permissionIcon}>{'\uD83D\uDCF7'}</Text>
          <Text style={styles.permissionTitle}>카메라 권한 필요</Text>
          <Text style={styles.permissionDesc}>건물을 스캔하려면 카메라 접근 권한이 필요합니다.{'\n'}설정에서 카메라 권한을 허용해주세요.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
            <Text style={styles.permissionBtnText}>권한 다시 요청</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.permissionSettingsBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permissionSettingsBtnText}>설정 열기</Text>
          </TouchableOpacity>
        </View>
      ) : !cameraPermission?.granted || !cameraReady ? (
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color={Colors.primaryBlue} />
          <Text style={styles.loadingText}>카메라 준비 중...</Text>
        </View>
      ) : (
        <>
          {isARMode ? (
            <ARCameraView
              style={StyleSheet.absoluteFillObject}
              onGeospatialPoseUpdate={handlePoseUpdate}
              onTrackingStateChanged={handleTrackingStateChanged}
              onAnchorPositionsUpdate={handleAnchorPositionsUpdate}
              onReady={handleReady}
              onError={handleError}
            />
          ) : (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
          )}

          {/* Layer 1: 포커스 가이드 */}
          <FocusGuide isActive={!!focusedBuilding} buildingCount={buildings.length} />

          {/* Layer 1.5: AR 앵커 라벨 (Geospatial 모드) */}
          {isARMode && isLocalized && !sheetOpen && arAnchors.length > 0 && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {arAnchors.map(anchor => {
                const isFocused = focusedBuilding?.id === anchor.buildingId;
                return (
                  <View
                    key={anchor.buildingId}
                    style={[
                      styles.arLabel,
                      { left: anchor.screenX - 60, top: anchor.screenY - 20 },
                      isFocused && styles.arLabelFocused,
                    ]}
                    pointerEvents="none"
                  >
                    <Text style={[styles.arLabelName, isFocused && styles.arLabelNameFocused]} numberOfLines={1}>
                      {anchor.buildingName || '건물'}
                    </Text>
                    <Text style={styles.arLabelDist}>{formatDistance(anchor.distance || 0)}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Layer 2: 포커스된 건물 라벨 (바텀시트 열리면 숨김) */}
          {focusedBuilding && !sheetOpen && (
            <View style={styles.focusedLabelContainer} pointerEvents="box-none">
              <FocusedLabel
                building={focusedBuilding}
                confidence={focusedBuilding.confidencePercent}
                gaugeProgress={gaugeProgress}
                onPress={handleLabelPress}
              />
            </View>
          )}
        </>
      )}

      {/* GPS 에러 배너 */}
      {gpsStatus === 'error' && (
        <View style={styles.gpsErrorBanner}>
          <Text style={styles.gpsErrorText}>GPS 신호를 받을 수 없습니다. 위치 서비스를 확인해주세요.</Text>
        </View>
      )}

      {/* Layer 3: 상단 HUD */}
      <CameraHUD
        gpsStatus={gpsStatus}
        onBack={() => navigation.goBack()}
        buildingCount={buildings.length}
        factorScore={rankedBuildings[0]?.confidencePercent || 0}
        accuracyInfo={accuracyInfo}
        arError={arError}
        forceMode={forceMode}
        onForceMode={setForceMode}
        debugInfo={{
          hAcc: geoPose?.horizontalAccuracy ?? gpsAccuracy ?? null,
          hdAcc: geoPose?.headingAccuracy ?? null,
          fov: Math.round(focusAngle),
          buildingCount: buildings.length,
        }}
      />

      {/* Layer 3.5: X-Ray 오버레이 */}
      <XRayOverlay
        floors={(profileData || buildingDetail)?.floors || []}
        visible={xrayActive && !!selectedBuildingId}
      />

      {/* 안내 텍스트 (null이면 숨김) */}
      {guideMessage && <GuideText text={guideMessage} />}

      {/* Layer 4: 바텀시트 */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={SNAP_POINTS}
        backgroundStyle={styles.bsBackground}
        handleIndicatorStyle={styles.bsHandle}
        enablePanDownToClose={true}
        onChange={(index) => {
          const isOpen = index >= 1;
          setSheetOpen(isOpen);
          if (selectedBuildingId && isOpen) {
            behaviorTracker.trackEvent('card_open', { buildingId: selectedBuildingId, buildingName: selectedBuilding?.name });
          }
          // 드래그로 완전히 닫힌 경우 상태 정리
          if (index === -1 && selectedBuildingId) {
            resetScanState();
          }
        }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          {selectedBuildingId ? (
            <BuildingProfileSheet
              buildingProfile={profileData || buildingDetail}
              loading={detailLoading && !profileData && !buildingDetail}
              enriching={enriching}
              error={profileError}
              onClose={handleCloseSheet}
              onXrayToggle={handleXrayToggle}
              xrayActive={xrayActive}
              onLazyLoad={fetchLazyTab}
              onRetry={() => {
                setProfileError(null);
                if (selectedBuildingId) {
                  setProfileData(null);
                  // refetch는 useBuildingDetail이 처리
                }
              }}
            />
          ) : (
            <View style={styles.bsEmpty}>
              <Text style={styles.bsEmptyText}>
                {gpsStatus === 'searching' ? '주변 건물을 탐색 중...' : '건물에 카메라를 맞춰 스캔해보세요'}
              </Text>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

// ===== 스타일 =====
const GUIDE_LEFT = (SW - GUIDE_WIDTH) / 2;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  // 카메라 권한/로딩
  permissionView: { flex: 1, backgroundColor: '#0D1230', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  permissionIcon: { fontSize: 48, marginBottom: SPACING.lg },
  permissionTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginBottom: SPACING.sm },
  permissionDesc: { fontSize: 14, color: '#B0B0B0', textAlign: 'center', marginBottom: SPACING.xl, lineHeight: 22 },
  permissionBtn: { backgroundColor: Colors.primaryBlue, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: 12 },
  permissionBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  permissionSettingsBtn: { marginTop: SPACING.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
  permissionSettingsBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primaryBlue, textDecorationLine: 'underline' },

  // GPS 에러
  gpsErrorBanner: { position: 'absolute', top: 100, left: SPACING.lg, right: SPACING.lg, backgroundColor: 'rgba(239,68,68,0.9)', borderRadius: 12, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, zIndex: 100 },
  gpsErrorText: { fontSize: 13, fontWeight: '600', color: '#FFF', textAlign: 'center' },

  // AR 앵커 라벨
  arLabel: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', minWidth: 80 },
  arLabelFocused: { backgroundColor: 'rgba(59,130,246,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  arLabelName: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  arLabelNameFocused: { color: '#FFF', fontWeight: '700' },
  arLabelDist: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 1 },

  loadingView: { flex: 1, backgroundColor: '#0D1230', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#B0B0B0', marginTop: SPACING.md },

  // ===== 포커스 가이드 =====
  dimTop: { width: SW, height: GUIDE_TOP, backgroundColor: 'rgba(0,0,0,0.4)' },
  dimRow: { flexDirection: 'row', height: GUIDE_HEIGHT },
  dimSide: { width: GUIDE_LEFT, backgroundColor: 'rgba(0,0,0,0.4)' },
  guideHole: { width: GUIDE_WIDTH, height: GUIDE_HEIGHT },
  dimBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', paddingTop: SPACING.md },
  nearbyCountText: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.6)' },

  // 코너 라인
  corner: { position: 'absolute', width: CORNER_LEN, height: CORNER_LEN },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W, borderColor: 'rgba(255,255,255,0.7)', borderTopLeftRadius: 4 },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W, borderColor: 'rgba(255,255,255,0.7)', borderTopRightRadius: 4 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W, borderColor: 'rgba(255,255,255,0.7)', borderBottomLeftRadius: 4 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W, borderColor: 'rgba(255,255,255,0.7)', borderBottomRightRadius: 4 },
  cornerActive: { borderColor: Colors.accentAmber },

  // ===== 포커스 라벨 =====
  focusedLabelContainer: {
    position: 'absolute',
    left: 0, right: 0,
    top: GUIDE_TOP + GUIDE_HEIGHT + 12,
    alignItems: 'center', zIndex: 10,
  },
  focusedLabelWrap: { alignItems: 'center' },
  focusedCard: {
    backgroundColor: '#FFF', borderRadius: 14,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
    minWidth: 200, maxWidth: SW * 0.75,
  },
  focusedName: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  focusedType: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  focusedMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  focusedDistance: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  focusedConfBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  focusedConfText: { fontSize: 12, fontWeight: '700' },
  gaugeBarBg: { height: 5, backgroundColor: '#E5E7EB', borderRadius: 3, overflow: 'hidden' },
  gaugeBarFill: { height: 5, borderRadius: 3 },

  // 핀
  focusedPin: { alignItems: 'center', marginTop: -2 },
  pinOuter: { width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accentAmber, justifyContent: 'center', alignItems: 'center' },
  pinInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFF' },
  pinTail: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: Colors.accentAmber, marginTop: -2 },

  // ===== HUD =====
  hud: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 50, paddingBottom: SPACING.md, paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: SPACING.sm,
  },
  hudBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  hudBackText: { fontSize: 22, color: '#FFF', marginTop: -2 },
  hudModeBadge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  hudModeText: { fontSize: 11, fontWeight: '900', color: '#FFF' },
  hudErrorBadge: { backgroundColor: 'rgba(239,68,68,0.8)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  hudErrorText: { fontSize: 9, fontWeight: '700', color: '#FFF' },
  hudInfoPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 2 },
  hudInfoText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)' },
  hudInfoSep: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  hudGps: { marginLeft: 'auto' },
  hudGpsDot: { width: 8, height: 8, borderRadius: 4 },

  // 안내 텍스트
  guideTextWrap: { position: 'absolute', bottom: SH * 0.14, left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  guideText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: 20, overflow: 'hidden' },

  // ===== 바텀시트 =====
  bsBackground: { backgroundColor: '#141428', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  bsHandle: { backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 4, borderRadius: 2 },
  bsEmpty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  bsEmptyText: { fontSize: 15, color: '#B0B0B0' },

});

export default ScanCameraScreen;
