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
  ScrollView,
  AppState,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, SPACING, TOUCH } from '../constants/theme';
import { DUMMY_POINTS } from '../constants/dummyData';
import { postScanLog, postScanComplete, getServerTimeContext, analyzeFrame } from '../services/api';
import { buildDummyProfile } from '../constants/dummyData';
import useNearbyBuildings from '../hooks/useNearbyBuildings';
import useBuildingDetail from '../hooks/useBuildingDetail';
import useSensorData from '../hooks/useSensorData';
import { formatDistance } from '../utils/coordinate';
import { rankBuildings } from '../services/detectionEngine';
import { behaviorTracker } from '../services/behaviorTracker';
import BuildingProfileSheet from '../components/BuildingProfileSheet';
import XRayOverlay from '../components/XRayOverlay';

const { width: SW, height: SH } = Dimensions.get('window');
const RECENT_SCANS_KEY = '@scanpang_recent_scans';
const CAMERA_HFOV = 60;
const FOCUS_ANGLE = 20; // 포커스 영역: heading ± 20°
const GAUGE_DURATION = 3000; // 3초
const GAUGE_TICK = 50; // 50ms마다 업데이트

// GPS 캐시 키
const GPS_CACHE_KEY = '@scanpang_last_gps';

const computeHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  return (angle + 360) % 360;
};

// ===== 포커스 가이드 프레임 (QR 스캐너 스타일) =====
const GUIDE_SIZE = SW * 0.65;
const GUIDE_TOP = SH * 0.22;
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
        {buildingCount > 0 ? `주변 ${buildingCount}개 건물 감지` : ''}
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
const CameraHUD = ({ points, gpsStatus, onBack, buildingCount, factorScore }) => {
  const gpsColor = gpsStatus === 'active' ? Colors.successGreen : gpsStatus === 'error' ? Colors.liveRed : Colors.accentAmber;
  const gpsLabel = gpsStatus === 'active' ? 'GPS 활성' : gpsStatus === 'error' ? '위치 오류' : 'GPS...';

  return (
    <View style={styles.hud}>
      <TouchableOpacity style={styles.hudBackBtn} onPress={onBack} hitSlop={TOUCH.hitSlop}>
        <Text style={styles.hudBackText}>{'\u2039'}</Text>
      </TouchableOpacity>

      <View style={styles.hudModePill}>
        <View style={[styles.hudDot, { backgroundColor: Colors.successGreen }]} />
        <Text style={styles.hudModeText}>일반 모드</Text>
      </View>

      {factorScore > 0 && (
        <View style={styles.hudFactorPill}>
          <Text style={styles.hudFactorText}>{factorScore}</Text>
        </View>
      )}

      <View style={styles.hudPointsPill}>
        <Text style={styles.hudPointsStar}>{'\u2605'}</Text>
        <Text style={styles.hudPointsText}>{points.toLocaleString()}</Text>
      </View>

      <View style={styles.hudGps}>
        <View style={[styles.hudDot, { backgroundColor: gpsColor }]} />
        <Text style={[styles.hudGpsText, { color: gpsColor }]}>{gpsLabel}</Text>
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

// ===== 바텀시트 스켈레톤 =====
const BottomSheetSkeleton = () => (
  <View style={styles.skeletonContainer}>
    <View style={styles.skeletonRow}>
      <View style={[styles.skeletonBlock, { width: '60%', height: 22 }]} />
      <View style={[styles.skeletonBlock, { width: 60, height: 28, borderRadius: 14 }]} />
    </View>
    <View style={[styles.skeletonBlock, { width: '40%', height: 14, marginTop: 8 }]} />
    <View style={styles.skeletonStatsRow}>
      {[1, 2, 3, 4].map(i => (
        <View key={i} style={styles.skeletonStatBox}>
          <View style={[styles.skeletonBlock, { width: 32, height: 32, borderRadius: 16 }]} />
          <View style={[styles.skeletonBlock, { width: '80%', height: 10, marginTop: 6 }]} />
          <View style={[styles.skeletonBlock, { width: '60%', height: 14, marginTop: 4 }]} />
        </View>
      ))}
    </View>
  </View>
);

// ===== 바텀시트: 건물 헤더 =====
const BuildingHeader = ({ building, onClose, onReport }) => (
  <View style={styles.bsHeader}>
    <View style={styles.bsHeaderLeft}>
      <Text style={styles.bsName}>{building.name}</Text>
      <Text style={styles.bsDistance}>{formatDistance(building.distance)}</Text>
    </View>
    <View style={styles.bsHeaderRight}>
      <TouchableOpacity style={styles.bsReportPill} onPress={onReport}>
        <Text style={styles.bsReportPillText}>리포트</Text>
      </TouchableOpacity>
      <View style={styles.bsLivePill}>
        <Text style={styles.bsLivePillText}>LIVE 투시</Text>
      </View>
      <TouchableOpacity style={styles.bsCloseBtn} onPress={onClose} hitSlop={TOUCH.hitSlop}>
        <Text style={styles.bsCloseBtnText}>{'\u2715'}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ===== 바텀시트: 편의시설 태그 =====
const QuickInfoTags = ({ amenities = [] }) => {
  if (!amenities.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagsScroll} contentContainerStyle={styles.tagsContent}>
      {amenities.map((item, i) => {
        const name = typeof item === 'string' ? item.split(' ')[0] : (item.name || item.type || '');
        const detail = typeof item === 'string' ? item.split(' ').slice(1).join(' ') : (item.detail || item.statusText || item.locationInfo || '');
        return (
          <View key={i} style={styles.tagPill}>
            <View style={[styles.tagDot, { backgroundColor: Colors.successGreen }]} />
            <Text style={styles.tagName}>{name}</Text>
            {detail ? <Text style={styles.tagDetail}>{detail}</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  );
};

// ===== 바텀시트: 건물 스탯 =====
const BuildingStats = ({ building }) => {
  const floorCount = building.floors?.length || 0;
  const occupiedCount = building.floors ? building.floors.filter(f => !f.isVacant && !f.is_vacant).length : 0;
  const occupancyRate = building.occupancyRate || (floorCount > 0 ? Math.round((occupiedCount / floorCount) * 100) : 85);
  const tenantCount = building.totalTenants || floorCount;
  const operatingCount = building.operatingTenants || occupiedCount;
  const stats = [
    { icon: 'B', label: '총 층수', value: `${building.totalFloors || floorCount}층`, color: Colors.primaryBlue },
    { icon: '%', label: '입주율', value: `${occupancyRate}%`, color: Colors.successGreen },
    { icon: 'T', label: '테넌트', value: `${tenantCount}개`, color: Colors.accentAmber },
    { icon: 'ON', label: '영업중', value: `${operatingCount}개`, color: Colors.successGreen },
  ];
  return (
    <View style={styles.statsGrid}>
      {stats.map((s, i) => (
        <View key={i} style={styles.statBox}>
          <View style={[styles.statIconCircle, { backgroundColor: `${s.color}20` }]}>
            <Text style={[styles.statIcon, { color: s.color }]}>{s.icon}</Text>
          </View>
          <Text style={styles.statLabel}>{s.label}</Text>
          <Text style={styles.statValue}>{s.value}</Text>
        </View>
      ))}
    </View>
  );
};

// ===== 바텀시트: 층별 리스트 =====
const FloorList = ({ floors = [], onFloorTap, onRewardTap }) => {
  if (!floors.length) return null;
  const getFloorColor = (floor) => {
    const num = parseInt(floor);
    if (floor === 'RF') return Colors.liveRed;
    if (num >= 10) return Colors.accentAmber;
    if (num >= 5) return Colors.primaryBlue;
    return '#1E3A5F';
  };
  return (
    <View style={styles.floorSection}>
      <Text style={styles.floorSectionTitle}>층별 투시</Text>
      {floors.map((f, i) => {
        const floor = f.floor || f.floorNumber || '';
        const tenants = f.tenants || [];
        const isVacant = f.isVacant || f.is_vacant;
        const hasReward = f.hasReward || f.has_reward;
        const tenantDisplay = tenants.length > 0
          ? tenants.slice(0, 2).join(', ') + (tenants.length > 2 ? ` +${tenants.length - 2}` : '')
          : f.tenantName || f.usage || f.tenantCategory || '정보 없음';
        return (
          <TouchableOpacity
            key={`${floor}-${i}`}
            style={[styles.floorItem, hasReward && styles.floorItemReward]}
            activeOpacity={0.7}
            onPress={() => { onFloorTap?.(f); hasReward && onRewardTap?.(f); }}
          >
            <View style={[styles.floorBadge, { backgroundColor: getFloorColor(floor) }]}>
              <Text style={styles.floorBadgeText}>{floor}</Text>
            </View>
            <Text style={[styles.floorTenant, isVacant && styles.floorTenantVacant]} numberOfLines={1}>
              {isVacant ? '공실' : tenantDisplay}
            </Text>
            {hasReward && <View style={styles.floorRewardBadge}><Text style={styles.floorRewardText}>+P</Text></View>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ===== 바텀시트: LIVE 피드 =====
const LiveFeed = ({ feeds = [] }) => {
  if (!feeds.length) return null;
  const FC = { event: '#4CAF50', promo: '#2196F3', alert: '#F44336', news: '#4CAF50', congestion: '#FF9800', promotion: '#2196F3', update: '#F44336' };
  return (
    <View style={styles.liveSection}>
      <View style={styles.liveHeader}>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveBadgeText}>LIVE</Text></View>
        <Text style={styles.liveTitle}>지금 이 순간</Text>
      </View>
      {feeds.slice(0, 3).map((feed) => {
        const ft = feed.type || feed.feedType || 'news';
        return (
          <View key={feed.id} style={styles.liveFeedItem}>
            <View style={[styles.liveFeedIcon, { backgroundColor: `${FC[ft] || Colors.primaryBlue}20` }]}>
              <Text style={[styles.liveFeedIconText, { color: FC[ft] || Colors.primaryBlue }]}>
                {ft === 'event' ? 'EVT' : ft === 'promo' || ft === 'promotion' ? 'SAL' : 'NEW'}
              </Text>
            </View>
            <View style={styles.liveFeedContent}>
              <Text style={styles.liveFeedTitle} numberOfLines={1}>{feed.title}</Text>
              {feed.description && <Text style={styles.liveFeedDesc} numberOfLines={1}>{feed.description}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ===== 메인 화면 =====
const ScanCameraScreen = ({ route, navigation }) => {
  const { focusBuildingId } = route?.params || {};
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState(focusBuildingId || null);
  const [gpsStatus, setGpsStatus] = useState('searching');
  const [points, setPoints] = useState(DUMMY_POINTS.totalPoints);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);

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
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const { gyroscope, accelerometer, cameraAngle, isStable, motionState, getSnapshot } = useSensorData({ enabled: gpsStatus === 'active' });
  const snapPoints = useMemo(() => ['1%', '50%', '90%'], []);

  const { buildings } = useNearbyBuildings({
    latitude: userLocation?.lat, longitude: userLocation?.lng,
    heading, radius: 300, enabled: gpsStatus === 'active',
  });

  const { building: buildingDetail, loading: detailLoading } = useBuildingDetail(selectedBuildingId);

  const selectedBuilding = selectedBuildingId
    ? { ...(buildings.find(b => b.id === selectedBuildingId) || {}), ...(buildingDetail || {}) }
    : null;

  // 7-Factor: 건물별 confidence 계산 + 정렬
  const rankedBuildings = useMemo(() => {
    if (!buildings.length) return [];
    const sensorData = { heading, gyroscope, accelerometer, cameraAngle };
    return rankBuildings(buildings, sensorData, timeContext, geminiResults);
  }, [buildings, heading, gyroscope, accelerometer, cameraAngle, timeContext, geminiResults]);

  // 포커스 영역 내 가장 가까운 건물 1개 계산 (바텀시트 열리면 중단)
  const focusedBuilding = useMemo(() => {
    if (sheetOpen) return null; // 바텀시트 열려있으면 감지 중단
    if (!rankedBuildings.length) return null;
    // heading ± FOCUS_ANGLE 범위 내 건물만 필터
    const inFocus = rankedBuildings.filter(b => {
      const bearing = b.bearing ?? 0;
      let diff = bearing - heading;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return Math.abs(diff) <= FOCUS_ANGLE;
    });
    // 거리순 → 가장 가까운 1개
    if (!inFocus.length) return null;
    return inFocus.sort((a, b) => (a.distance || 999) - (b.distance || 999))[0];
  }, [rankedBuildings, heading, sheetOpen]);

  // ===== 게이지 시스템 =====
  useEffect(() => {
    const newId = focusedBuilding?.id || null;

    // 포커스 건물 변경 시 게이지 + 이전 상태 전부 클리어
    if (newId !== focusedIdRef.current) {
      focusedIdRef.current = newId;
      setGaugeProgress(0);
      setScanComplete(false);
      setScanCompleteMessage(null);
      if (gaugeTimerRef.current) clearInterval(gaugeTimerRef.current);
      gaugeTimerRef.current = null;
    }

    // 포커스 건물 있으면 게이지 시작 (바텀시트 열려있으면 중단)
    if (newId && !scanComplete && !sheetOpen) {
      gaugeTimerRef.current = setInterval(() => {
        setGaugeProgress(prev => {
          const next = prev + (GAUGE_TICK / GAUGE_DURATION);
          if (next >= 1) {
            clearInterval(gaugeTimerRef.current);
            gaugeTimerRef.current = null;
            // 게이지 완료 → 자동 스캔
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
  useEffect(() => {
    console.log('[DEBUG] scanComplete effect:', { scanComplete, focusedBuilding: focusedBuilding?.id });
    if (scanComplete && focusedBuilding) {
      // 1. 햅틱 피드백
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // 2. "스캔 완료!" 0.5초 표시 후 소멸
      setScanCompleteMessage(`${focusedBuilding.name} 스캔 완료!`);
      const msgTimer = setTimeout(() => setScanCompleteMessage(null), 500);

      // 3. 바텀시트 즉시 열기 + 더미 프로필 즉시 세팅
      setSelectedBuildingId(focusedBuilding.id);
      setProfileError(null);

      // 더미 프로필 즉시 세팅 (API 응답 대기 없이)
      const dummyProfile = buildDummyProfile(focusedBuilding);
      if (dummyProfile) setProfileData(dummyProfile);

      // 바텀시트 열기
      setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 50);

      // 백그라운드에서 API 호출 (성공 시 덮어쓰기)
      const buildingId = focusedBuilding.id;
      postScanComplete(buildingId, {
        confidence: focusedBuilding.confidencePercent || focusedBuilding.confidence || 50,
        sensorData: {
          gps: { lat: userLocation?.lat, lng: userLocation?.lng, accuracy: 10 },
          compass: { heading },
        },
      }).then(res => {
        const data = res?.data || res;
        if (data) setProfileData(data);
      }).catch(() => {
        // 이미 더미 데이터 표시 중이므로 무시
      });

      // scan log + behavior
      postScanLog({ sessionId: sessionIdRef.current, buildingId, eventType: 'gaze_scan', userLat: userLocation?.lat, userLng: userLocation?.lng, deviceHeading: heading, metadata: { confidence: focusedBuilding.confidence } }).catch(() => {});
      behaviorTracker.trackEvent('gaze_scan', { buildingId, metadata: { confidence: focusedBuilding.confidence } });

      // 최근 스캔 저장
      saveRecentScan(focusedBuilding);

      // Gemini 분석 트리거
      triggerGeminiAnalysis(focusedBuilding);

      return () => clearTimeout(msgTimer);
    }
  }, [scanComplete]);

  // ===== GPS 캐시 → 빠른 초기 위치 =====
  useEffect(() => {
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(GPS_CACHE_KEY);
        if (cached) {
          const { lat, lng } = JSON.parse(cached);
          if (lat && lng && !userLocation) {
            setUserLocation({ lat, lng });
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
    const ids = focusedBuilding ? [focusedBuilding.id] : [];
    behaviorTracker.updateVisibleBuildings(ids);
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

  // 위치 추적
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
              setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
              setGpsStatus('active');
            }
          }
        );
        locationSubRef.current = sub;
      } catch { if (!cancelled) setGpsStatus('error'); }
    })();
    return () => { cancelled = true; locationSubRef.current?.remove(); };
  }, []);

  // 나침반
  useEffect(() => {
    Magnetometer.setUpdateInterval(200);
    const sub = Magnetometer.addListener((data) => {
      if (isMountedRef.current && data) {
        const h = computeHeading(data.x, data.y);
        if (Math.abs(h - lastHeadingRef.current) >= 2) { lastHeadingRef.current = h; setHeading(h); }
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

    // 더미 프로필 즉시 세팅
    const dummyProfile = buildDummyProfile(building);
    if (dummyProfile) setProfileData(dummyProfile);

    // 바텀시트 즉시 열기
    setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 50);

    postScanLog({ sessionId: sessionIdRef.current, buildingId: building.id, eventType: 'pin_tapped', userLat: userLocation?.lat, userLng: userLocation?.lng, deviceHeading: heading, metadata: { confidence: building.confidence } }).catch(() => {});
    behaviorTracker.trackEvent('pin_click', { buildingId: building.id, metadata: { confidence: building.confidence } });
    saveRecentScan(building);
    triggerGeminiAnalysis(building);
  }, [userLocation, heading, saveRecentScan, triggerGeminiAnalysis]);

  const handleCloseSheet = useCallback(() => {
    if (selectedBuildingId) behaviorTracker.trackEvent('card_close', { buildingId: selectedBuildingId });
    setSelectedBuildingId(null);
    setScanComplete(false);
    setGaugeProgress(0);
    setProfileData(null);
    setProfileError(null);
    setScanCompleteMessage(null);
    setXrayActive(false);
    focusedIdRef.current = null;
    bottomSheetRef.current?.snapToIndex(0);
  }, [selectedBuildingId]);

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

  // 안내 텍스트 결정 (scanCompleteMessage는 0.5초 후 자동 소멸)
  const guideMessage = useMemo(() => {
    if (scanCompleteMessage) return scanCompleteMessage;
    if (gpsStatus === 'searching') return '위치를 탐색하고 있습니다...';
    if (!buildings.length) return '건물을 향해 카메라를 비추세요';
    if (!focusedBuilding) return '건물에 카메라를 맞춰주세요';
    if (scanComplete) return null; // 바텀시트가 올라왔으므로 숨김
    return `${focusedBuilding.name} 스캔 중...`;
  }, [gpsStatus, buildings.length, focusedBuilding, scanComplete, scanCompleteMessage]);

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
      ) : !cameraPermission?.granted ? (
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color={Colors.primaryBlue} />
          <Text style={styles.loadingText}>카메라 준비 중...</Text>
        </View>
      ) : (
        <>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

          {/* Layer 1: 포커스 가이드 */}
          <FocusGuide isActive={!!focusedBuilding} buildingCount={buildings.length} />

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
        points={points}
        gpsStatus={gpsStatus}
        onBack={() => navigation.goBack()}
        buildingCount={buildings.length}
        factorScore={rankedBuildings[0]?.confidencePercent || 0}
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
        index={0}
        snapPoints={snapPoints}
        backgroundStyle={styles.bsBackground}
        handleIndicatorStyle={styles.bsHandle}
        enablePanDownToClose={false}
        onChange={(index) => {
          setSheetOpen(index >= 1);
          if (selectedBuildingId && index >= 1) {
            behaviorTracker.trackEvent('card_open', { buildingId: selectedBuildingId });
          }
        }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          {selectedBuildingId ? (
            <BuildingProfileSheet
              buildingProfile={profileData || buildingDetail}
              loading={detailLoading && !profileData}
              error={profileError}
              onClose={handleCloseSheet}
              onXrayToggle={handleXrayToggle}
              xrayActive={xrayActive}
              onRetry={() => {
                setProfileError(null);
                if (selectedBuildingId) {
                  postScanComplete(selectedBuildingId, {
                    confidence: 50,
                    sensorData: { gps: { lat: userLocation?.lat, lng: userLocation?.lng }, compass: { heading } },
                  }).then(res => {
                    const data = res?.data || res;
                    if (data) setProfileData(data);
                  }).catch(() => setProfileError(true));
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
const GUIDE_LEFT = (SW - GUIDE_SIZE) / 2;

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

  // 스켈레톤
  skeletonContainer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  skeletonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skeletonBlock: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8 },
  skeletonStatsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  skeletonStatBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: SPACING.md },
  loadingView: { flex: 1, backgroundColor: '#0D1230', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#B0B0B0', marginTop: SPACING.md },

  // ===== 포커스 가이드 =====
  dimTop: { width: SW, height: GUIDE_TOP, backgroundColor: 'rgba(0,0,0,0.4)' },
  dimRow: { flexDirection: 'row', height: GUIDE_SIZE },
  dimSide: { width: GUIDE_LEFT, backgroundColor: 'rgba(0,0,0,0.4)' },
  guideHole: { width: GUIDE_SIZE, height: GUIDE_SIZE },
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
    top: GUIDE_TOP + GUIDE_SIZE + 12,
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
  hudModePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 1, borderRadius: 16, gap: SPACING.xs },
  hudDot: { width: 6, height: 6, borderRadius: 3 },
  hudModeText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  hudFactorPill: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  hudFactorText: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  hudPointsPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs + 1, borderRadius: 16, gap: 3 },
  hudPointsStar: { fontSize: 12, color: Colors.accentAmber },
  hudPointsText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  hudGps: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  hudGpsText: { fontSize: 11, fontWeight: '500' },

  // 안내 텍스트
  guideTextWrap: { position: 'absolute', bottom: SH * 0.14, left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  guideText: { fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: 20, overflow: 'hidden' },

  // ===== 바텀시트 =====
  bsBackground: { backgroundColor: '#141428', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  bsHandle: { backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 4, borderRadius: 2 },
  bsScroll: { paddingHorizontal: SPACING.lg },
  bsEmpty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  bsEmptyText: { fontSize: 15, color: '#B0B0B0' },

  // 바텀시트: 헤더
  bsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  bsHeaderLeft: { flex: 1 },
  bsName: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  bsDistance: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  bsHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  bsReportPill: { backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  bsReportPillText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  bsLivePill: { backgroundColor: Colors.primaryBlue, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: 20 },
  bsLivePillText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  bsCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  bsCloseBtnText: { fontSize: 16, color: 'rgba(255,255,255,0.7)' },

  // 바텀시트: 태그
  tagsScroll: { marginBottom: SPACING.md },
  tagsContent: { gap: SPACING.sm },
  tagPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: 12, gap: SPACING.xs },
  tagDot: { width: 6, height: 6, borderRadius: 3 },
  tagName: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  tagDetail: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  // 바텀시트: 스탯
  statsGrid: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: SPACING.md, gap: 4 },
  statIconCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statIcon: { fontSize: 12, fontWeight: '800' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  // 바텀시트: 층별
  floorSection: { marginBottom: SPACING.lg },
  floorSectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: SPACING.md },
  floorItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm + 2, paddingHorizontal: SPACING.sm, borderRadius: 10, marginBottom: SPACING.xs, backgroundColor: 'rgba(255,255,255,0.04)', gap: SPACING.md },
  floorItemReward: { backgroundColor: 'rgba(245,158,11,0.12)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  floorBadge: { width: 40, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  floorBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  floorTenant: { flex: 1, fontSize: 15, fontWeight: '600', color: '#FFF' },
  floorTenantVacant: { color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' },
  floorRewardBadge: { backgroundColor: Colors.accentAmber, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  floorRewardText: { fontSize: 11, fontWeight: '800', color: '#FFF' },

  // 바텀시트: LIVE
  liveSection: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)', paddingTop: SPACING.lg },
  liveHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  liveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: 8, gap: SPACING.xs },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.liveRed },
  liveBadgeText: { fontSize: 11, fontWeight: '800', color: Colors.liveRed, letterSpacing: 1 },
  liveTitle: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  liveFeedItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.sm, gap: SPACING.md },
  liveFeedIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  liveFeedIconText: { fontSize: 10, fontWeight: '800' },
  liveFeedContent: { flex: 1, gap: 2 },
  liveFeedTitle: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  liveFeedDesc: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
});

export default ScanCameraScreen;
