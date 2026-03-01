/**
 * ScanCameraScreen - GPS + YOLO TFLite 기반 건물 스캔
 * - Layer 0: 전체화면 CameraX 프리뷰 (네이티브 ARCameraView)
 * - Layer 1: 건물 바운딩박스 + 방향 라벨
 * - Layer 2: 상단 HUD
 * - Layer 3: 건물 프로필 바텀시트
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Dimensions,
  AppState,
  Linking,
  InteractionManager,
} from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, SPACING, TOUCH } from '../constants/theme';
import { postScanLog, postScanComplete, getServerTimeContext, analyzeFrame } from '../services/api';
import useBuildingDetect from '../hooks/useBuildingDetect';
import useBuildingDetail from '../hooks/useBuildingDetail';
import useSensorData from '../hooks/useSensorData';
import { formatDistance } from '../utils/coordinate';
import { behaviorTracker } from '../services/behaviorTracker';
import BuildingProfileSheet from '../components/BuildingProfileSheet';
import XRayOverlay from '../components/XRayOverlay';
import PersonaSelectModal from '../components/PersonaSelectModal';
import { ARCameraView } from 'scanpang-arcore';
import useLocationTracking from '../hooks/useLocationTracking';
import DetectedBuildingOverlay from '../components/DetectedBuildingOverlay';
import { PersonaType, PERSONA_CONFIGS, loadPersona } from '../data/persona';


const { width: SW, height: SH } = Dimensions.get('window');
const RECENT_SCANS_KEY = '@scanpang_recent_scans';
const SNAP_POINTS = ['1%', '50%', '90%'];

// ===== 포커스 영역 (16:9 세로:가로, 화면 중앙) =====
const FOCUS_W = SW * 0.75;
const FOCUS_H = FOCUS_W * (16 / 9);
const FOCUS_LEFT = (SW - FOCUS_W) / 2;
const FOCUS_TOP = (SH - FOCUS_H) / 2;

// ===== 상단 HUD =====
const CameraHUD = ({ gpsStatus, onBack, debugInfo, persona, onPersonaTap }) => {
  const gpsColor = gpsStatus === 'active' ? Colors.successGreen : gpsStatus === 'error' ? Colors.liveRed : Colors.accentAmber;
  const hAcc = debugInfo?.hAcc != null ? `${debugInfo.hAcc.toFixed(0)}m` : '-';
  const yoloConf = debugInfo?.yoloConf != null ? `${Math.round(debugInfo.yoloConf * 100)}%` : '-';
  const heading = debugInfo?.heading != null ? `${debugInfo.heading.toFixed(0)}°` : '-';

  return (
    <View style={styles.hud}>
      {/* 좌측 그룹: 뒤로가기 + GPS + 정보 */}
      <View style={styles.hudLeftGroup}>
        <TouchableOpacity style={styles.hudBackBtn} onPress={onBack} hitSlop={TOUCH.hitSlop}>
          <Text style={styles.hudBackText}>{'\u2039'}</Text>
        </TouchableOpacity>

        <View style={styles.hudGpsBadge}>
          <Text style={styles.hudGpsLabel}>GPS</Text>
          <View style={[styles.hudGpsDot, { backgroundColor: gpsColor }]} />
        </View>

        {/* 정확도 · YOLO · heading (고정 너비) */}
        <View style={styles.hudInfoPill}>
          <Text style={styles.hudInfoFixed30}>{hAcc}</Text>
          <Text style={styles.hudInfoSep}>·</Text>
          <Text style={styles.hudInfoFixed30}>{yoloConf}</Text>
          <Text style={styles.hudInfoSep}>·</Text>
          <Text style={styles.hudInfoFixed36}>{heading}</Text>
        </View>
      </View>

      {/* 우측 고정: 페르소나 칩 */}
      {persona && PERSONA_CONFIGS[persona] && (
        <TouchableOpacity style={styles.hudPersonaChip} onPress={onPersonaTap} activeOpacity={0.7}>
          <Text style={styles.hudPersonaEmoji}>{PERSONA_CONFIGS[persona].emoji}</Text>
          <Text style={styles.hudPersonaName}>{PERSONA_CONFIGS[persona].nameKo}</Text>
          <Text style={styles.hudPersonaArrow}>▾</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ===== 안내 텍스트 =====
const GuideText = ({ text }) => (
  <View style={styles.guideTextWrap}>
    <Text style={styles.guideText}>{text}</Text>
  </View>
);

// ===== 포커스 영역 오버레이 =====
const CORNER_LEN = 20;
const CORNER_W = 3;
const FocusOverlay = ({ visible, message }) => {
  if (!visible) return null;
  const cornerColor = 'rgba(255,255,255,0.8)';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* 어두운 영역 4개 (포커스 바깥) */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: FOCUS_TOP, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View style={{ position: 'absolute', top: FOCUS_TOP, left: 0, width: FOCUS_LEFT, height: FOCUS_H, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View style={{ position: 'absolute', top: FOCUS_TOP, right: 0, width: FOCUS_LEFT, height: FOCUS_H, backgroundColor: 'rgba(0,0,0,0.45)' }} />
      <View style={{ position: 'absolute', top: FOCUS_TOP + FOCUS_H, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)' }} />

      {/* 코너 브래킷 (좌상) */}
      <View style={{ position: 'absolute', top: FOCUS_TOP, left: FOCUS_LEFT, width: CORNER_LEN, height: CORNER_W, backgroundColor: cornerColor }} />
      <View style={{ position: 'absolute', top: FOCUS_TOP, left: FOCUS_LEFT, width: CORNER_W, height: CORNER_LEN, backgroundColor: cornerColor }} />
      {/* 우상 */}
      <View style={{ position: 'absolute', top: FOCUS_TOP, right: FOCUS_LEFT, width: CORNER_LEN, height: CORNER_W, backgroundColor: cornerColor }} />
      <View style={{ position: 'absolute', top: FOCUS_TOP, right: FOCUS_LEFT, width: CORNER_W, height: CORNER_LEN, backgroundColor: cornerColor }} />
      {/* 좌하 */}
      <View style={{ position: 'absolute', bottom: SH - FOCUS_TOP - FOCUS_H, left: FOCUS_LEFT, width: CORNER_LEN, height: CORNER_W, backgroundColor: cornerColor }} />
      <View style={{ position: 'absolute', bottom: SH - FOCUS_TOP - FOCUS_H, left: FOCUS_LEFT, width: CORNER_W, height: CORNER_LEN, backgroundColor: cornerColor }} />
      {/* 우하 */}
      <View style={{ position: 'absolute', bottom: SH - FOCUS_TOP - FOCUS_H, right: FOCUS_LEFT, width: CORNER_LEN, height: CORNER_W, backgroundColor: cornerColor }} />
      <View style={{ position: 'absolute', bottom: SH - FOCUS_TOP - FOCUS_H, right: FOCUS_LEFT, width: CORNER_W, height: CORNER_LEN, backgroundColor: cornerColor }} />

      {/* 포커스 영역 내 안내 메시지 */}
      {message && (
        <View style={{ position: 'absolute', top: FOCUS_TOP + FOCUS_H / 2 - 12, left: FOCUS_LEFT, width: FOCUS_W, alignItems: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>{message}</Text>
        </View>
      )}
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
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const [timeContext, setTimeContext] = useState(null);
  const [geminiResults, setGeminiResults] = useState(new Map());
  const [profileError, setProfileError] = useState(null);
  const [xrayActive, setXrayActive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [objectDetections, setObjectDetections] = useState([]);
  const [persona, setPersona] = useState(PersonaType.EXPLORER);
  const [showPersonaModal, setShowPersonaModal] = useState(false);

  const bottomSheetRef = useRef(null);
  const cameraRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastHeadingRef = useRef(0);
  const geminiTimerRef = useRef(null);
  const geminiAnalyzingRef = useRef(false);
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const { gyroscope, accelerometer, cameraAngle, isStable, motionState, getSnapshot } = useSensorData({ enabled: gpsStatus === 'active' });

  // GPS + 나침반 위치 추적
  const {
    geoPose, isLocalized, accuracyInfo, gpsError,
  } = useLocationTracking({ enabled: true });

  // stale closure 방지용 ref
  const geoPoseRef = useRef(null);
  useEffect(() => { geoPoseRef.current = geoPose; }, [geoPose]);

  // YOLO가 건물을 감지했는지
  const yoloHasBuilding = useMemo(() => {
    return objectDetections.some(d => d.type === 'building');
  }, [objectDetections]);

  // === 수동 건물 식별 (탭 시 호출) ===
  const { buildings: detectedBuildings, loading: detectLoading, fetchDetect } = useBuildingDetect();

  // 화면 중앙에 가장 가까운 YOLO 건물 바운딩박스 인덱스
  const primaryIndex = useMemo(() => {
    if (!yoloHasBuilding) return null;
    const centerX = 0.5;
    let bestIdx = null;
    let bestDist = Infinity;
    objectDetections.forEach((d, idx) => {
      if (d.type !== 'building') return;
      const boxCenterX = (d.left + d.right) / 2;
      const dist = Math.abs(boxCenterX - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, [objectDetections, yoloHasBuilding]);

  // YOLO 감지 이벤트 핸들러
  const handleObjectDetection = useCallback((event) => {
    const { detections } = event.nativeEvent || event;
    if (detections) {
      // 디버그: 감지 결과 확인
      if (detections.length > 0) {
        console.log(`[ScanCamera] YOLO: ${detections.length}개 감지, types: ${detections.map(d => d.type).join(',')}, first: ${JSON.stringify(detections[0])}`);
      }
      setObjectDetections(detections);
    }
  }, []);

  // ARCameraView 이벤트 핸들러
  const handleReady = useCallback(() => {
    console.log('[ScanCamera] YOLO 모델 로드 완료');
  }, []);

  const handleError = useCallback((event) => {
    const data = event?.nativeEvent || event;
    console.warn('[ScanCamera] 네이티브 에러:', data?.error);
  }, []);

  // 선택된 건물의 메타 정보
  const selectedBuildingMeta = useMemo(() => {
    if (!selectedBuildingId) return null;
    const found = detectedBuildings.find(b => b.id === selectedBuildingId);
    if (!found) return null;
    return {
      lat: found.lat,
      lng: found.lng,
      name: found.name,
      address: found.address || found.roadAddress || '',
      category: found.category || '',
      categoryDetail: found.categoryDetail || '',
    };
  }, [selectedBuildingId, detectedBuildings]);

  const { building: buildingDetail, loading: detailLoading, enriching, fetchLazyTab } = useBuildingDetail(
    selectedBuildingId,
    { buildingMeta: selectedBuildingMeta },
  );

  const selectedBuilding = selectedBuildingId
    ? { ...(detectedBuildings.find(b => b.id === selectedBuildingId) || {}), ...(buildingDetail || {}) }
    : null;

  // geoPose → userLocation/heading 브릿지
  useEffect(() => {
    if (!geoPose) return;
    setUserLocation({ lat: geoPose.latitude, lng: geoPose.longitude });
    if (Math.abs(geoPose.heading - lastHeadingRef.current) >= 3) {
      lastHeadingRef.current = geoPose.heading;
      setHeading(geoPose.heading);
    }
    setGpsStatus('active');
  }, [geoPose]);

  // gpsError → gpsStatus 반영
  useEffect(() => {
    if (gpsError) setGpsStatus('error');
  }, [gpsError]);

  // focusBuildingId로 진입 시 바텀시트 자동 오픈
  useEffect(() => {
    if (focusBuildingId && selectedBuildingId === focusBuildingId && gpsStatus === 'active') {
      setProfileError(null);
      setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 200);
    }
  }, [focusBuildingId, gpsStatus]);

  // 네비게이션 애니메이션 완료 후 카메라 마운트
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => {
      if (isMountedRef.current) setCameraReady(true);
    });
    return () => handle.cancel();
  }, []);

  // 페르소나 로드 (온보딩은 HomeScreen에서 처리)
  useEffect(() => {
    (async () => {
      const saved = await loadPersona();
      if (saved) setPersona(saved);
    })();
  }, []);

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

  // Gemini Vision: 주기적
  useEffect(() => {
    if (!isStable || !selectedBuildingId || !cameraRef.current || sheetOpen) return;
    const run = async () => {
      if (geminiAnalyzingRef.current) return;
      geminiAnalyzingRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3, skipProcessing: true });
        if (!photo?.base64 || !isMountedRef.current) return;
        const b = detectedBuildings.find(x => x.id === selectedBuildingId);
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
  }, [isStable, selectedBuildingId, detectedBuildings, userLocation, heading, sheetOpen]);

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
        timestamp: Date.now(),
      });
      if (scans.length > 20) scans.length = 20;
      await AsyncStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(scans));
    } catch {}
  }, []);

  const triggerGeminiAnalysis = useCallback(async (building) => {
    if (!cameraRef.current) return;
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

  // "건물상세보기" 탭 → 센서 heading 그대로 전송 (Gemini Vision이 방향 판단)
  const handleDetailTap = useCallback(async () => {
    const gp = geoPoseRef.current;
    if (!gp || gp.latitude == null) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProfileError(null);

    const sensorHeading = gp.heading ?? 0;

    const results = await fetchDetect({
      lat: gp.latitude,
      lng: gp.longitude,
      heading: sensorHeading,
      horizontalAccuracy: gp.horizontalAccuracy,
    });

    if (!results || results.length === 0) return;

    const building = results[0];
    setSelectedBuildingId(building.id);
    setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 50);

    // 로깅
    postScanLog({ sessionId: sessionIdRef.current, buildingId: building.id, eventType: 'detail_tap', userLat: gp.latitude, userLng: gp.longitude, deviceHeading: sensorHeading }).catch(() => {});
    behaviorTracker.trackEvent('detail_tap', { buildingId: building.id, buildingName: building.name, metadata: { hAcc: gp.horizontalAccuracy } });

    saveRecentScan(building);
    triggerGeminiAnalysis(building);
  }, [fetchDetect, saveRecentScan, triggerGeminiAnalysis]);

  // 페르소나 선택 완료 (HUD에서 변경)
  const handlePersonaSelect = useCallback((type) => {
    setPersona(type);
    setShowPersonaModal(false);
  }, []);

  // HUD 페르소나 칩 탭 → 변경 모달
  const handlePersonaTap = useCallback(() => {
    setShowPersonaModal(true);
  }, []);

  // 상태 초기화
  const resetScanState = useCallback(() => {
    setSelectedBuildingId(null);
    setProfileError(null);
    setXrayActive(false);
  }, []);

  const handleCloseSheet = useCallback(() => {
    if (selectedBuildingId) behaviorTracker.trackEvent('card_close', { buildingId: selectedBuildingId, buildingName: selectedBuilding?.name });
    resetScanState();
    bottomSheetRef.current?.close();
  }, [selectedBuildingId, resetScanState]);

  const handleXrayToggle = useCallback(() => {
    setXrayActive(prev => {
      if (!prev) {
        bottomSheetRef.current?.snapToIndex(0);
      } else {
        bottomSheetRef.current?.snapToIndex(1);
      }
      return !prev;
    });
  }, []);

  const handleOpenReport = useCallback(() => {
    if (!selectedBuilding) return;
    navigation.navigate('BehaviorReport', { buildingId: selectedBuilding.id, buildingName: selectedBuilding.name });
  }, [selectedBuilding, navigation]);

  // 안내 텍스트 (하단)
  const guideMessage = useMemo(() => {
    if (sheetOpen) return null;
    if (!geoPose) return 'GPS 위치를 잡는 중...';
    if (detectLoading) return '건물 조회 중...';
    return null;
  }, [geoPose, detectLoading, sheetOpen]);

  // 포커스 영역 내 안내 메시지
  const focusMessage = useMemo(() => {
    if (sheetOpen) return null;
    if (!geoPose) return null;
    if (yoloHasBuilding) return null; // YOLO 건물 감지 중
    return '건물을 카메라에 비춰주세요';
  }, [geoPose, yoloHasBuilding, sheetOpen]);

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
          {/* CameraX 네이티브 프리뷰 + YOLO 감지 (항상 렌더) */}
          <ARCameraView
            style={StyleSheet.absoluteFillObject}
            onObjectDetection={handleObjectDetection}
            onReady={handleReady}
            onError={handleError}
          />

          {/* Layer 0.5: 포커스 영역 오버레이 */}
          <FocusOverlay visible={!sheetOpen} message={focusMessage} />

          {/* Layer 1: YOLO 바운딩박스 (테두리만) */}
          <DetectedBuildingOverlay
            detections={objectDetections}
            primaryIndex={primaryIndex}
            visible={!sheetOpen}
          />
        </>
      )}

      {/* 하단 고정 건물상세보기 버튼 */}
      {(primaryIndex != null && !sheetOpen || detectLoading) && (
        <TouchableOpacity
          style={[styles.detailButton, detectLoading && styles.detailButtonLoading]}
          activeOpacity={0.7}
          disabled={detectLoading}
          onPress={handleDetailTap}
        >
          <Text style={styles.detailButtonText}>
            {detectLoading ? '분석 중...' : '건물상세보기'}
          </Text>
        </TouchableOpacity>
      )}

      {/* GPS 에러 배너 */}
      {gpsStatus === 'error' && (
        <View style={styles.gpsErrorBanner}>
          <Text style={styles.gpsErrorText}>GPS 신호를 받을 수 없습니다. 위치 서비스를 확인해주세요.</Text>
        </View>
      )}

      {/* Layer 2: 상단 HUD */}
      <CameraHUD
        gpsStatus={gpsStatus}
        onBack={() => navigation.goBack()}
        persona={persona}
        onPersonaTap={handlePersonaTap}
        debugInfo={{
          hAcc: geoPose?.horizontalAccuracy ?? null,
          yoloConf: objectDetections.filter(d => d.type === 'building').reduce((max, d) => Math.max(max, d.confidence || 0), 0) || null,
          heading: geoPose?.heading ?? null,
        }}
      />

      {/* Layer 2.5: X-Ray 오버레이 */}
      <XRayOverlay
        floors={buildingDetail?.floors || []}
        visible={xrayActive && !!selectedBuildingId}
      />

      {/* 안내 텍스트 */}
      {guideMessage && <GuideText text={guideMessage} />}

      {/* Layer 3: 바텀시트 */}
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
          if (index === -1 && selectedBuildingId) {
            resetScanState();
          }
        }}
      >
        <View style={{ flex: 1 }}>
          {selectedBuildingId ? (
            <BuildingProfileSheet
              buildingProfile={buildingDetail}
              loading={detailLoading && !buildingDetail}
              enriching={enriching}
              error={profileError}
              onClose={handleCloseSheet}
              onXrayToggle={handleXrayToggle}
              xrayActive={xrayActive}
              onLazyLoad={fetchLazyTab}
              persona={persona}
              onRetry={() => {
                setProfileError(null);
              }}
            />
          ) : (
            <View style={styles.bsEmpty}>
              <Text style={styles.bsEmptyText}>건물 라벨을 터치해 정보를 확인하세요</Text>
            </View>
          )}
        </View>
      </BottomSheet>

      {/* 페르소나 선택 모달 */}
      <PersonaSelectModal
        visible={showPersonaModal}
        onSelect={handlePersonaSelect}
        onClose={() => setShowPersonaModal(false)}
      />
    </GestureHandlerRootView>
  );
};

// ===== 스타일 =====
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


  loadingView: { flex: 1, backgroundColor: '#0D1230', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#B0B0B0', marginTop: SPACING.md },

  // ===== HUD =====
  hud: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 50, paddingBottom: SPACING.md, paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  hudLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  hudBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  hudBackText: { fontSize: 22, color: '#FFF', marginTop: -2 },
  hudGpsBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 5 },
  hudGpsLabel: { fontSize: 11, fontWeight: '900', color: '#FFF' },
  hudInfoPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 2 },
  hudInfoFixed30: { width: 30, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textAlign: 'right' },
  hudInfoFixed36: { width: 36, fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', textAlign: 'right' },
  hudInfoSep: { fontSize: 11, color: 'rgba(255,255,255,0.3)' },
  hudPersonaChip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(139,92,246,0.2)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.35)',
    gap: 4,
  },
  hudPersonaEmoji: { fontSize: 12 },
  hudPersonaName: { fontSize: 11, fontWeight: '700', color: '#F1F5F9' },
  hudPersonaArrow: { fontSize: 8, color: 'rgba(255,255,255,0.4)' },
  hudGpsDot: { width: 8, height: 8, borderRadius: 4 },

  // 하단 고정 건물상세보기 버튼
  detailButton: {
    position: 'absolute',
    bottom: 120,
    alignSelf: 'center',
    left: '50%',
    transform: [{ translateX: -80 }],
    width: 160,
    backgroundColor: 'rgba(0, 230, 118, 0.9)',
    paddingVertical: 14,
    borderRadius: 30,
    alignItems: 'center',
    zIndex: 50,
  },
  detailButtonLoading: {
    backgroundColor: 'rgba(0, 230, 118, 0.5)',
  },
  detailButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },

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
