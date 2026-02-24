/**
 * ScanCameraScreen - VPS + Bearing 투영 기반 건물 스캔
 * - Layer 0: 전체화면 AR 카메라 프리뷰
 * - Layer 1: 방향 지시자 라벨 (bearing 투영, 터치 가능)
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
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
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
import { ARCameraView } from 'scanpang-arcore';
import useGeospatialTracking from '../hooks/useGeospatialTracking';
import useBearingProjection from '../hooks/useBearingProjection';
import BearingLabels from '../components/BearingLabels';


const { width: SW, height: SH } = Dimensions.get('window');
const RECENT_SCANS_KEY = '@scanpang_recent_scans';
const SNAP_POINTS = ['1%', '50%', '90%'];

const computeHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  return (angle + 360) % 360;
};

// ===== 상단 HUD =====
const CameraHUD = ({ gpsStatus, onBack, accuracyInfo, debugInfo, arError, detectStatus }) => {
  const gpsColor = gpsStatus === 'active' ? Colors.successGreen : gpsStatus === 'error' ? Colors.liveRed : Colors.accentAmber;
  const hAcc = debugInfo?.hAcc != null ? `${debugInfo.hAcc.toFixed(0)}m` : '-';
  const hdAcc = debugInfo?.hdAcc != null ? `${debugInfo.hdAcc.toFixed(0)}°` : '-';

  // 모드 배지 색상: VPS=초록, OFF=회색
  const badgeColor = detectStatus === 'inactive' ? '#888' : '#00C853';
  const badgeLabel = detectStatus === 'inactive' ? 'OFF' : 'VPS';

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

      {/* arError 표시 */}
      {arError && (
        <View style={styles.hudErrorBadge}>
          <Text style={styles.hudErrorText}>{arError}</Text>
        </View>
      )}

      {/* 정확도 + 건물수 */}
      <View style={styles.hudInfoPill}>
        <Text style={styles.hudInfoText}>{hAcc}</Text>
        <Text style={styles.hudInfoSep}>·</Text>
        <Text style={styles.hudInfoText}>{hdAcc}</Text>
        <Text style={styles.hudInfoSep}>·</Text>
        <Text style={styles.hudInfoText}>건물{debugInfo?.buildingCount || 0}</Text>
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

  const bottomSheetRef = useRef(null);
  const cameraRef = useRef(null);
  const magnetSubRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastHeadingRef = useRef(0);
  const geminiTimerRef = useRef(null);
  const geminiAnalyzingRef = useRef(false);
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const { gyroscope, accelerometer, cameraAngle, isStable, motionState, getSnapshot } = useSensorData({ enabled: gpsStatus === 'active' });

  // ARCore Geospatial 추적
  const {
    geoPose, vpsAvailable, trackingState, isLocalized, isARMode, accuracyInfo, arError,
    handlePoseUpdate, handleTrackingStateChanged, handleReady, handleError,
  } = useGeospatialTracking({ enabled: true });

  // stale closure 방지용 ref
  const geoPoseRef = useRef(null);
  useEffect(() => { geoPoseRef.current = geoPose; }, [geoPose]);

  // === 메인 감지: VPS 전용 ===
  const { buildings: detectedBuildings, loading: detectLoading, status: detectStatus } = useBuildingDetect({
    geoPose,
    geoPoseRef,
    enabled: !sheetOpen,
  });

  // === bearing 스크린 투영 ===
  const projectedBuildings = useBearingProjection({
    geoPose,
    buildings: detectedBuildings,
  });

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

  // 위치 권한 요청
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { if (!cancelled) setGpsStatus('error'); }
      } catch { if (!cancelled) setGpsStatus('error'); }
    })();
    return () => { cancelled = true; };
  }, []);

  // 나침반 (geoPose 없을 때 폴백)
  useEffect(() => {
    Magnetometer.setUpdateInterval(200);
    const sub = Magnetometer.addListener((data) => {
      if (isMountedRef.current && data) {
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

  // 라벨 탭 → 바텀시트 열기
  const handleLabelSelect = useCallback((projected) => {
    if (!projected) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const building = detectedBuildings.find(b => b.id === projected.id);
    setSelectedBuildingId(projected.id);
    setProfileError(null);

    setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 50);

    // 로깅
    postScanLog({ sessionId: sessionIdRef.current, buildingId: projected.id, eventType: 'label_tap', userLat: userLocation?.lat, userLng: userLocation?.lng, deviceHeading: heading, metadata: { bearing: projected.bearing, angleDiff: projected.angleDiff } }).catch(() => {});
    behaviorTracker.trackEvent('label_tap', { buildingId: projected.id, buildingName: projected.name, metadata: { mode: accuracyInfo?.modeLabel, hAcc: accuracyInfo?.hAcc, distance: projected.distance } });

    if (building) {
      saveRecentScan(building);
      triggerGeminiAnalysis(building);
    }
  }, [detectedBuildings, userLocation, heading, accuracyInfo, saveRecentScan, triggerGeminiAnalysis]);

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

  // 안내 텍스트
  const guideMessage = useMemo(() => {
    if (sheetOpen) return null;
    if (!geoPose) return 'VPS 위치를 잡는 중...';
    if (detectLoading) return '건물 탐색 중...';
    if (detectedBuildings.length === 0) return '주변에 건물이 없습니다';
    return null; // 건물 감지 완료
  }, [geoPose, detectLoading, detectedBuildings.length, sheetOpen]);

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
              onReady={handleReady}
              onError={handleError}
            />
          ) : (
            <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />
          )}

          {/* Layer 1: 방향 지시자 라벨 (bearing 투영) */}
          <BearingLabels
            projectedBuildings={projectedBuildings}
            onSelect={handleLabelSelect}
            visible={isLocalized && !sheetOpen && projectedBuildings.length > 0}
          />
        </>
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
        accuracyInfo={accuracyInfo}
        arError={arError}
        detectStatus={detectStatus}
        debugInfo={{
          hAcc: geoPose?.horizontalAccuracy ?? null,
          hdAcc: geoPose?.headingAccuracy ?? null,
          buildingCount: detectedBuildings.length,
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
              <Text style={styles.bsEmptyText}>건물 라벨을 터치해 정보를 확인하세요</Text>
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
