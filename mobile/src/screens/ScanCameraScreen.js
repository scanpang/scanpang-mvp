/**
 * ScanCameraScreen - GPS + YOLO TFLite + 미니맵 Gemini 건물 식별
 * - Layer 0: 전체화면 CameraX 프리뷰 (네이티브 ARCameraView)
 * - Layer 1: 건물 바운딩박스 + Gemini 건물명 라벨
 * - Layer 1.5: 좌상단 구글 미니맵 (파란점 + heading 방향)
 * - Layer 2: 상단 HUD
 * - Layer 3: 건물 프로필 바텀시트
 *
 * 건물 식별 흐름:
 * YOLO 건물 감지 → 미니맵 캡쳐 → Gemini가 지도에서 건물명 읽기 → 바운딩박스에 표시
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
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, SPACING, TOUCH } from '../constants/theme';
import { postScanLog, getServerTimeContext, analyzeFrame, analyzeMinimapFrame } from '../services/api';
import useBuildingDetail from '../hooks/useBuildingDetail';
import useSensorData from '../hooks/useSensorData';
import { behaviorTracker } from '../services/behaviorTracker';
import BuildingProfileSheet from '../components/BuildingProfileSheet';
import XRayOverlay from '../components/XRayOverlay';
import { ARCameraView } from 'scanpang-arcore';
import useLocationTracking from '../hooks/useLocationTracking';
import DetectedBuildingOverlay from '../components/DetectedBuildingOverlay';
import MinimapOverlay from '../components/MinimapOverlay';


const { width: SW, height: SH } = Dimensions.get('window');
const RECENT_SCANS_KEY = '@scanpang_recent_scans';
const SNAP_POINTS = ['1%', '50%', '90%'];

// 미니맵 Gemini 호출 쿨다운 (중복 호출 방지)
const MINIMAP_COOLDOWN = 3000; // 3초

// ===== 상단 HUD =====
const CameraHUD = ({ gpsStatus, onBack, debugInfo, detectStatus }) => {
  const gpsColor = gpsStatus === 'active' ? Colors.successGreen : gpsStatus === 'error' ? Colors.liveRed : Colors.accentAmber;
  const hAcc = debugInfo?.hAcc != null ? `${debugInfo.hAcc.toFixed(0)}m` : '-';
  const hdAcc = debugInfo?.hdAcc != null ? `${debugInfo.hdAcc.toFixed(0)}°` : '-';

  const badgeColor = detectStatus === 'idle' ? '#888' : detectStatus === 'analyzing' ? '#FF9800' : '#00C853';
  const badgeLabel = detectStatus === 'idle' ? 'IDLE' : detectStatus === 'analyzing' ? 'AI' : 'GPS';

  return (
    <View style={styles.hud}>
      <TouchableOpacity style={styles.hudBackBtn} onPress={onBack} hitSlop={TOUCH.hitSlop}>
        <Text style={styles.hudBackText}>{'\u2039'}</Text>
      </TouchableOpacity>

      {/* 모드 배지 */}
      <View
        style={[styles.hudModeBadge, { backgroundColor: badgeColor }]}
        pointerEvents="none"
      >
        <Text style={styles.hudModeText}>{badgeLabel}</Text>
      </View>

      {/* 정확도 */}
      <View style={styles.hudInfoPill}>
        <Text style={styles.hudInfoText}>{hAcc}</Text>
        <Text style={styles.hudInfoSep}>·</Text>
        <Text style={styles.hudInfoText}>{hdAcc}</Text>
      </View>

      {/* GPS 상태 점 */}
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
  const [cameraReady, setCameraReady] = useState(false);

  const [timeContext, setTimeContext] = useState(null);
  const [geminiResults, setGeminiResults] = useState(new Map());
  const [profileError, setProfileError] = useState(null);
  const [xrayActive, setXrayActive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [objectDetections, setObjectDetections] = useState([]);

  // 미니맵 Gemini 건물명 상태
  const [minimapBuildingName, setMinimapBuildingName] = useState(null);
  const [minimapAnalyzing, setMinimapAnalyzing] = useState(false);
  const minimapRef = useRef(null);
  const minimapCooldownRef = useRef(0);
  const minimapAnalyzingRef = useRef(false);

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
  const headingRef = useRef(0);
  useEffect(() => { headingRef.current = heading; }, [heading]);

  // ===== 미니맵 Gemini 건물명 추출 =====
  const analyzeMinimapBuilding = useCallback(async () => {
    // 쿨다운 체크
    if (Date.now() - minimapCooldownRef.current < MINIMAP_COOLDOWN) return;
    if (minimapAnalyzingRef.current) return;
    if (!minimapRef.current) return;

    const gp = geoPoseRef.current;
    if (!gp) return;

    minimapAnalyzingRef.current = true;
    minimapCooldownRef.current = Date.now();
    setMinimapAnalyzing(true);

    try {
      // 미니맵 캡쳐
      const base64 = await minimapRef.current.capture();
      if (!base64 || !isMountedRef.current) return;

      console.log(`[Minimap→Gemini] 캡쳐 완료, heading=${Math.round(headingRef.current)}°, 분석 요청...`);

      // Gemini에 미니맵 분석 요청
      const res = await analyzeMinimapFrame(base64, {
        lat: gp.latitude,
        lng: gp.longitude,
        heading: headingRef.current,
      });

      if (!isMountedRef.current) return;

      const data = res?.data;
      if (data?.buildingName && data.buildingName !== 'unknown') {
        console.log(`[Minimap→Gemini] 건물명 추출: "${data.buildingName}" (conf=${data.confidence})`);
        setMinimapBuildingName(data.buildingName);
      } else {
        console.log('[Minimap→Gemini] 건물명 추출 실패');
        setMinimapBuildingName(null);
      }
    } catch (err) {
      console.warn('[Minimap→Gemini] 분석 실패:', err.message);
    } finally {
      minimapAnalyzingRef.current = false;
      if (isMountedRef.current) setMinimapAnalyzing(false);
    }
  }, []);

  // ===== YOLO 건물 감지 시 미니맵 분석 트리거 =====
  const buildingDetectedRef = useRef(false);

  // YOLO 감지 → 건물이 감지되면 미니맵 Gemini 호출
  useEffect(() => {
    const hasBuildingDetection = objectDetections.some(d => d.type === 'building');

    if (hasBuildingDetection && !buildingDetectedRef.current) {
      // 건물 처음 감지됨 → 미니맵 분석
      buildingDetectedRef.current = true;
      analyzeMinimapBuilding();
    } else if (!hasBuildingDetection) {
      buildingDetectedRef.current = false;
      // 건물 감지 해제 시 건물명 초기화
      setMinimapBuildingName(null);
    }
  }, [objectDetections, analyzeMinimapBuilding]);

  // ===== 바운딩박스에 표시할 매칭 결과 생성 =====
  const displayResults = useMemo(() => {
    const buildingDetections = objectDetections.filter(d => d.type === 'building');
    const cupDetections = objectDetections.filter(d => d.type === 'cup');

    if (buildingDetections.length === 0 && cupDetections.length === 0) {
      return { matched: [], unmatched: [], cups: [] };
    }

    // 화면 영역으로 클램핑
    const clampBox = (d) => ({
      left: Math.max(0, d.left * SW),
      top: Math.max(0, d.top * SH),
      right: Math.min(SW, d.right * SW),
      bottom: Math.min(SH, d.bottom * SH),
      confidence: d.confidence,
    });

    // 컵
    const cups = cupDetections.map(d => ({
      detection: clampBox(d),
      label: 'Cup',
    }));

    // 건물: Gemini 건물명이 있으면 가장 큰 바운딩박스에 매칭
    const matched = [];
    const unmatched = [];

    if (buildingDetections.length > 0) {
      // 면적 기준 정렬 (큰 건물 = 정면 건물)
      const sorted = [...buildingDetections]
        .map(d => {
          const area = (d.right - d.left) * (d.bottom - d.top);
          return { ...d, area };
        })
        .sort((a, b) => b.area - a.area);

      sorted.forEach((det, idx) => {
        const screenBox = clampBox(det);

        // 첫 번째(가장 큰) 건물에 Gemini 건물명 매칭
        if (idx === 0 && minimapBuildingName) {
          matched.push({
            building: {
              id: `minimap_${Date.now()}`,
              name: minimapBuildingName,
              nameSource: 'gemini_minimap',
            },
            detection: screenBox,
            matchScore: 0.8,
          });
        } else {
          unmatched.push({ detection: screenBox });
        }
      });
    }

    return { matched, unmatched, cups };
  }, [objectDetections, minimapBuildingName]);

  // YOLO 감지 이벤트 핸들러
  const handleObjectDetection = useCallback((event) => {
    const { detections } = event.nativeEvent || event;
    if (detections) {
      if (detections.length > 0) {
        console.log(`[ScanCamera] YOLO: ${detections.length}개 감지, types: ${detections.map(d => d.type).join(',')}`);
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

  // 선택된 건물의 메타 정보 (Gemini 건물명 기반)
  const selectedBuildingMeta = useMemo(() => {
    if (!selectedBuildingId) return null;
    return {
      lat: geoPose?.latitude,
      lng: geoPose?.longitude,
      name: minimapBuildingName || '건물',
      address: '',
      category: '',
      categoryDetail: '',
    };
  }, [selectedBuildingId, geoPose, minimapBuildingName]);

  const { building: buildingDetail, loading: detailLoading, enriching, fetchLazyTab } = useBuildingDetail(
    selectedBuildingId,
    { buildingMeta: selectedBuildingMeta },
  );

  const selectedBuilding = selectedBuildingId
    ? { id: selectedBuildingId, name: minimapBuildingName || '건물', ...(buildingDetail || {}) }
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
  const saveRecentScan = useCallback(async (buildingName) => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SCANS_KEY);
      const scans = raw ? JSON.parse(raw) : [];
      scans.unshift({
        id: `minimap_${Date.now()}`,
        buildingName: buildingName || '건물',
        name: buildingName || null,
        address: null,
        points: 50, timeAgo: '방금 전', timestamp: Date.now(),
      });
      if (scans.length > 20) scans.length = 20;
      await AsyncStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(scans));
    } catch {}
  }, []);

  // 라벨 탭 → 바텀시트 열기
  const handleLabelSelect = useCallback((building) => {
    if (!building) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setSelectedBuildingId(building.id);
    setProfileError(null);

    setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 50);

    // 로깅
    postScanLog({
      sessionId: sessionIdRef.current,
      buildingId: building.id,
      eventType: 'label_tap',
      userLat: userLocation?.lat,
      userLng: userLocation?.lng,
      deviceHeading: heading,
      metadata: { buildingName: building.name, source: 'gemini_minimap' },
    }).catch(() => {});
    behaviorTracker.trackEvent('label_tap', {
      buildingId: building.id,
      buildingName: building.name,
      metadata: { source: 'gemini_minimap' },
    });

    if (building.name) saveRecentScan(building.name);
  }, [userLocation, heading, saveRecentScan]);

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

  // 감지 상태 텍스트
  const detectStatusText = minimapAnalyzing ? 'analyzing' : gpsStatus === 'active' ? 'ready' : 'idle';

  // 안내 텍스트
  const guideMessage = useMemo(() => {
    if (sheetOpen) return null;
    if (!geoPose) return 'GPS 위치를 잡는 중...';
    if (minimapAnalyzing) return '건물 식별 중...';
    return null;
  }, [geoPose, minimapAnalyzing, sheetOpen]);

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
          {/* CameraX 네이티브 프리뷰 + YOLO 감지 */}
          <ARCameraView
            style={StyleSheet.absoluteFillObject}
            onObjectDetection={handleObjectDetection}
            onReady={handleReady}
            onError={handleError}
          />

          {/* Layer 1: 건물 바운딩박스 + Gemini 건물명 라벨 */}
          <DetectedBuildingOverlay
            matchedBuildings={displayResults.matched}
            unmatchedRegions={displayResults.unmatched}
            cupRegions={displayResults.cups}
            onSelect={handleLabelSelect}
            visible={!sheetOpen}
          />
        </>
      )}

      {/* GPS 에러 배너 */}
      {gpsStatus === 'error' && (
        <View style={styles.gpsErrorBanner}>
          <Text style={styles.gpsErrorText}>GPS 신호를 받을 수 없습니다. 위치 서비스를 확인해주세요.</Text>
        </View>
      )}

      {/* Layer 1.5: 좌상단 미니맵 (GPS 잡히면 항상 표시) */}
      <MinimapOverlay
        ref={minimapRef}
        latitude={geoPose?.latitude}
        longitude={geoPose?.longitude}
        heading={heading}
        visible={!!geoPose?.latitude}
      />

      {/* Layer 2: 상단 HUD */}
      <CameraHUD
        gpsStatus={gpsStatus}
        onBack={() => navigation.goBack()}
        detectStatus={detectStatusText}
        debugInfo={{
          hAcc: geoPose?.horizontalAccuracy ?? null,
          hdAcc: geoPose?.headingAccuracy ?? null,
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
        <BottomSheetView style={{ flex: 1 }}>
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
              onRetry={() => {
                setProfileError(null);
              }}
            />
          ) : (
            <View style={styles.bsEmpty}>
              <Text style={styles.bsEmptyText}>건물을 비추면 자동으로 식별합니다</Text>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
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
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 50, paddingBottom: SPACING.md, paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: SPACING.sm,
  },
  hudBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  hudBackText: { fontSize: 22, color: '#FFF', marginTop: -2 },
  hudModeBadge: { backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  hudModeText: { fontSize: 11, fontWeight: '900', color: '#FFF' },
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
