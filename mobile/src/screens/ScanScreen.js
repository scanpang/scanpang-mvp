/**
 * ScanScreen - 메인 스캔 화면 (레퍼런스 UI 기준 리디자인)
 *
 * 레퍼런스 기준:
 * - 상단 바: < 일반모드 | ★포인트 | 위치확인중 | 그리드
 * - 카메라 전체 화면 + 건물 핀 오버레이
 * - 건물 선택 시: 우측에 층별 오버레이 (반투명)
 * - 하단: 건물 정보 카드 (기본 펼침)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';

import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';

import { COLORS, TYPOGRAPHY, SPACING, CARD_STYLE } from '../constants/theme';
import { DUMMY_POINTS, getLiveFeedsByBuilding } from '../constants/dummyData';
import { postScanLog } from '../services/api';
import BuildingCard from '../components/BuildingCard';
import BuildingPin from '../components/BuildingPin';
import FloorOverlay from '../components/FloorOverlay';
import PointBadge from '../components/PointBadge';
import useNearbyBuildings from '../hooks/useNearbyBuildings';
import useBuildingDetail from '../hooks/useBuildingDetail';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const computeHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  angle = (angle + 360) % 360;
  return Math.round(angle * 10) / 10;
};

/**
 * 건물 핀 위치 계산 (겹침 방지)
 * heading과 건물 방향을 기반으로 화면 위치 결정
 */
const calculatePinPositions = (buildings, selectedId, screenWidth, screenHeight) => {
  const positions = [];
  const occupied = []; // 이미 차지한 영역

  buildings.slice(0, 5).forEach((building, index) => {
    let x = 20 + (index % 3) * (screenWidth * 0.3);
    let y = 80 + Math.floor(index / 3) * 70;

    // 겹침 방지: 기존 위치와 겹치면 오프셋
    for (const prev of occupied) {
      const dx = Math.abs(x - prev.x);
      const dy = Math.abs(y - prev.y);
      if (dx < 140 && dy < 50) {
        y = prev.y + 55;
      }
    }

    // 화면 범위 제한
    x = Math.max(8, Math.min(x, screenWidth - 160));
    y = Math.max(50, Math.min(y, screenHeight * 0.5));

    occupied.push({ x, y });
    positions.push({ building, x, y });
  });

  return positions;
};

const ScanScreen = ({ route, navigation }) => {
  const { mode = 'normal' } = route?.params || {};
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [userLocation, setUserLocation] = useState(null);
  const [heading, setHeading] = useState(0);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('searching');
  const [points, setPoints] = useState(DUMMY_POINTS.totalPoints);
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [showFloorOverlay, setShowFloorOverlay] = useState(false);

  const {
    buildings: nearbyBuildings,
    loading: isLoading,
  } = useNearbyBuildings({
    latitude: userLocation?.lat,
    longitude: userLocation?.lng,
    heading,
    radius: 300,
    enabled: gpsStatus === 'active',
  });

  const {
    building: buildingDetail,
    loading: detailLoading,
  } = useBuildingDetail(selectedBuildingId);

  const selectedBuilding = selectedBuildingId
    ? {
        ...(nearbyBuildings.find((b) => b.id === selectedBuildingId) || {}),
        ...(buildingDetail || {}),
      }
    : null;

  const locationSubscriptionRef = useRef(null);
  const magnetometerSubscriptionRef = useRef(null);
  const isMountedRef = useRef(true);

  const modeName = mode === 'xray' ? '투시 모드' : '일반 모드';
  const modeColor = mode === 'xray' ? COLORS.orange : COLORS.blue;

  // 카메라 권한
  useEffect(() => {
    const initCamera = async () => {
      if (!cameraPermission) return;
      if (!cameraPermission.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) setCameraPermissionDenied(true);
      }
    };
    initCamera();
  }, [cameraPermission]);

  // 위치 추적
  useEffect(() => {
    let isCancelled = false;
    const initLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!isCancelled && isMountedRef.current) {
            setLocationPermissionDenied(true);
            setGpsStatus('error');
          }
          return;
        }
        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
          (location) => {
            if (!isCancelled && isMountedRef.current) {
              const { latitude, longitude } = location.coords;
              setUserLocation({ lat: latitude, lng: longitude });
              setGpsStatus('active');
            }
          }
        );
        locationSubscriptionRef.current = subscription;
      } catch (error) {
        if (!isCancelled && isMountedRef.current) setGpsStatus('error');
      }
    };
    initLocation();
    return () => {
      isCancelled = true;
      locationSubscriptionRef.current?.remove();
    };
  }, []);

  // 나침반
  useEffect(() => {
    Magnetometer.setUpdateInterval(200);
    const sub = Magnetometer.addListener((data) => {
      if (isMountedRef.current && data) setHeading(computeHeading(data.x, data.y));
    });
    magnetometerSubscriptionRef.current = sub;
    return () => magnetometerSubscriptionRef.current?.remove();
  }, []);

  // 첫 번째 건물 자동 선택
  useEffect(() => {
    if (nearbyBuildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(nearbyBuildings[0].id);
    }
  }, [nearbyBuildings, selectedBuildingId]);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  const handleBuildingSelect = useCallback((building) => {
    if (!building) return;
    setSelectedBuildingId(building.id);
    setShowFloorOverlay(false);
    sendScanLog('pin_tapped', building.id, userLocation?.lat, userLocation?.lng, heading);
  }, [userLocation, heading]);

  const toggleFloorOverlay = useCallback(() => {
    setShowFloorOverlay((prev) => !prev);
  }, []);

  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const sendScanLog = useCallback(async (eventType, buildingId, lat, lng, currentHeading) => {
    try {
      await postScanLog({
        sessionId: sessionIdRef.current,
        buildingId: buildingId || null,
        eventType,
        userLat: lat || null,
        userLng: lng || null,
        deviceHeading: currentHeading || null,
        metadata: { scanMode: mode },
      });
    } catch {
      // 무시 - api.js에서 큐 처리
    }
  }, [mode]);

  const getLocationInfo = () => {
    switch (gpsStatus) {
      case 'searching': return { text: '위치 확인중...', color: COLORS.orange };
      case 'active': return { text: 'GPS 활성', color: COLORS.green };
      case 'error': return { text: '위치 오류', color: COLORS.red };
      default: return { text: '', color: COLORS.textSecondary };
    }
  };
  const locationInfo = getLocationInfo();

  // 핀 위치 계산 (겹침 방지)
  const pinPositions = calculatePinPositions(
    nearbyBuildings, selectedBuildingId, SCREEN_WIDTH - 32, SCREEN_HEIGHT * 0.55
  );

  // ===== 카메라 뷰 렌더링 =====
  const renderCameraArea = () => {
    if (cameraPermissionDenied) {
      return (
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionIcon}>📷</Text>
          <Text style={styles.permissionTitle}>카메라 권한 필요</Text>
          <Text style={styles.permissionDesc}>
            건물을 스캔하려면 카메라 접근 권한이 필요합니다.
          </Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
            <Text style={styles.permissionButtonText}>권한 다시 요청</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (!cameraPermission || !cameraPermission.granted) {
      return (
        <View style={styles.cameraLoadingContainer}>
          <ActivityIndicator size="large" color={COLORS.blue} />
          <Text style={styles.cameraLoadingText}>카메라 준비 중...</Text>
        </View>
      );
    }

    return (
      <CameraView style={styles.cameraView} facing="back">
        {/* Bug #3: 건물 감지되면 가이드 텍스트 변경 */}
        {nearbyBuildings.length === 0 && gpsStatus !== 'searching' && (
          <View style={styles.guideOverlay}>
            <Text style={styles.cameraGuideText}>건물을 향해 카메라를 비추세요</Text>
          </View>
        )}
        {gpsStatus === 'searching' && (
          <View style={styles.guideOverlay}>
            <Text style={styles.cameraGuideText}>위치를 탐색하고 있습니다...</Text>
          </View>
        )}

        {/* 건물 핀 오버레이 - Bug #6: 겹침 방지 적용 */}
        {pinPositions.map(({ building, x, y }) => (
          <BuildingPin
            key={building.id}
            building={building}
            isSelected={selectedBuildingId === building.id}
            onPress={() => handleBuildingSelect(building)}
            style={{
              position: 'absolute',
              top: y,
              left: x,
            }}
          />
        ))}

        {/* 층별 보기 토글 버튼 */}
        {selectedBuilding && (
          <TouchableOpacity
            style={styles.floorToggleBtn}
            onPress={toggleFloorOverlay}
            activeOpacity={0.7}
          >
            <Text style={styles.floorToggleBtnText}>
              {showFloorOverlay ? '✕' : '층별 보기'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Bug #5: 층별 오버레이 (바텀시트 스타일, 최대 50% 높이) */}
        <FloorOverlay
          floors={buildingDetail?.floors || selectedBuilding?.floors || []}
          loading={detailLoading}
          onFloorTap={(floor) => console.log('층 탭:', floor)}
          onRewardTap={(floor) => setPoints((prev) => prev + (floor.rewardPoints || 50))}
          visible={showFloorOverlay}
        />
      </CameraView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* 상단 바 */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>{'‹'}</Text>
        </TouchableOpacity>

        <View style={[styles.modeBadge, { backgroundColor: `${modeColor}20` }]}>
          <View style={[styles.modeDot, { backgroundColor: modeColor }]} />
          <Text style={[styles.modeText, { color: modeColor }]}>{modeName}</Text>
        </View>

        <View style={styles.topBarRight}>
          <PointBadge points={points} size="small" />
          <View style={styles.locationBadge}>
            <View style={[styles.locationDot, { backgroundColor: locationInfo.color }]} />
            <Text style={[styles.locationText, { color: locationInfo.color }]}>
              {locationInfo.text}
            </Text>
          </View>
        </View>
      </View>

      {/* 위치 권한 거부 배너 */}
      {locationPermissionDenied && (
        <View style={styles.locationDeniedBanner}>
          <Text style={styles.locationDeniedText}>
            위치 권한이 거부되어 더미 데이터를 표시합니다.
          </Text>
        </View>
      )}

      {/* 카메라 뷰 영역 (화면의 약 55%) */}
      <View style={styles.cameraContainer}>{renderCameraArea()}</View>

      {/* 하단 건물 정보 영역 */}
      <View style={styles.bottomSection}>
        {/* 건물 선택 탭 */}
        {nearbyBuildings.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.buildingTabs}
            contentContainerStyle={styles.buildingTabsContent}
          >
            {nearbyBuildings.map((building) => (
              <TouchableOpacity
                key={building.id}
                style={[
                  styles.buildingTab,
                  selectedBuilding?.id === building.id && styles.buildingTabActive,
                ]}
                onPress={() => handleBuildingSelect(building)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buildingTabText,
                    selectedBuilding?.id === building.id && styles.buildingTabTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {building.name}
                </Text>
                <Text style={styles.buildingTabDistance}>
                  {building.distance != null ? `${building.distance}m` : ''}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 건물 카드 (기본 펼침) */}
        {selectedBuilding ? (
          <BuildingCard
            building={selectedBuilding}
            liveFeeds={getLiveFeedsByBuilding(selectedBuilding.id)}
            initialExpanded={true}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {gpsStatus === 'searching'
                ? '주변 건물을 탐색하고 있습니다...'
                : nearbyBuildings.length === 0
                  ? '주변에 건물이 감지되지 않았습니다'
                  : '건물을 선택해주세요'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // 상단 바
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.sm,
  },
  backButtonText: { fontSize: 22, fontWeight: '400', color: COLORS.textPrimary },
  modeBadge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    borderRadius: 12,
  },
  modeDot: { width: 6, height: 6, borderRadius: 3, marginRight: SPACING.xs },
  modeText: { fontSize: 13, fontWeight: '600' },
  topBarRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  locationBadge: { flexDirection: 'row', alignItems: 'center' },
  locationDot: { width: 6, height: 6, borderRadius: 3, marginRight: SPACING.xs },
  locationText: { fontSize: 11, fontWeight: '500' },

  // 위치 거부 배너
  locationDeniedBanner: {
    backgroundColor: 'rgba(255,82,82,0.15)',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.lg, borderRadius: 8, marginBottom: SPACING.xs,
  },
  locationDeniedText: { fontSize: 12, fontWeight: '500', color: COLORS.red, textAlign: 'center' },

  // 카메라 영역
  cameraContainer: {
    height: SCREEN_HEIGHT * 0.55,
    margin: SPACING.lg, marginTop: SPACING.sm,
    borderRadius: 20, overflow: 'hidden',
    borderWidth: 1, borderColor: COLORS.border,
  },
  cameraView: { flex: 1 },

  // 가이드 오버레이
  guideOverlay: {
    position: 'absolute', bottom: 60, left: 0, right: 0,
    alignItems: 'center',
  },
  cameraGuideText: {
    ...TYPOGRAPHY.bodySmall,
    color: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(10,14,39,0.5)',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: 16, overflow: 'hidden',
  },

  // 층별 보기 버튼
  floorToggleBtn: {
    position: 'absolute', bottom: SPACING.lg, right: SPACING.lg,
    backgroundColor: 'rgba(74,144,217,0.85)',
    paddingHorizontal: SPACING.md + 2, paddingVertical: SPACING.sm,
    borderRadius: 12, zIndex: 10,
  },
  floorToggleBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },

  // 카메라 로딩
  cameraLoadingContainer: {
    flex: 1, backgroundColor: '#0D1230',
    justifyContent: 'center', alignItems: 'center',
  },
  cameraLoadingText: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, marginTop: SPACING.md },

  // 카메라 권한 거부
  permissionContainer: {
    flex: 1, backgroundColor: '#0D1230',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.xl,
  },
  permissionIcon: { fontSize: 48, marginBottom: SPACING.lg },
  permissionTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  permissionDesc: { ...TYPOGRAPHY.bodySmall, color: COLORS.textSecondary, textAlign: 'center', marginBottom: SPACING.xl },
  permissionButton: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: 12,
  },
  permissionButtonText: { ...TYPOGRAPHY.button, color: COLORS.textPrimary, fontSize: 14 },

  // 하단 섹션
  bottomSection: { flex: 1, paddingBottom: SPACING.sm },
  buildingTabs: { maxHeight: 40, marginBottom: SPACING.sm },
  buildingTabsContent: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  buildingTab: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    borderRadius: 10, backgroundColor: COLORS.cardBackground,
    borderWidth: 1, borderColor: 'transparent',
  },
  buildingTabActive: { borderColor: COLORS.blue, backgroundColor: 'rgba(74,144,217,0.1)' },
  buildingTabText: { fontSize: 13, fontWeight: '500', color: COLORS.textSecondary, marginRight: SPACING.xs },
  buildingTabTextActive: { color: COLORS.blue, fontWeight: '600' },
  buildingTabDistance: { fontSize: 11, color: COLORS.textMuted },
  emptyCard: {
    ...CARD_STYLE, marginHorizontal: SPACING.lg,
    padding: SPACING.xxl, alignItems: 'center',
  },
  emptyText: { ...TYPOGRAPHY.bodySmall, textAlign: 'center' },
});

export default ScanScreen;
