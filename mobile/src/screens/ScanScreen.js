/**
 * ScanScreen - 메인 스캔 화면 (MVP 핵심 화면)
 *
 * 기능:
 * - expo-camera: CameraView로 후면 카메라 실시간 미리보기
 * - expo-location: watchPositionAsync로 실시간 GPS 추적
 * - expo-sensors: Magnetometer로 디바이스 나침반(heading) 측정
 * - Backend API 연동: 주변 건물 조회, 건물 프로필, 스캔 로그
 * - 에러 처리: 권한 거부 안내, API 실패 시 더미 데이터 폴백
 *
 * 레이아웃:
 * - 상단 바: 뒤로가기, 모드 배지, GPS 상태, 포인트
 * - 중앙(60%): CameraView + 크로스헤어 오버레이
 * - 건물 탭: 감지된 건물 가로 스크롤
 * - 하단: BuildingCard 컴포넌트
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
  Platform,
  Alert,
} from 'react-native';

// expo 패키지
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';

// 프로젝트 모듈
import { COLORS, TYPOGRAPHY, SPACING, CARD_STYLE } from '../constants/theme';
import {
  DUMMY_POINTS,
  getLiveFeedsByBuilding,
} from '../constants/dummyData';
import { postScanLog } from '../services/api';
import BuildingCard from '../components/BuildingCard';
import BuildingPin from '../components/BuildingPin';
import FloorOverlay from '../components/FloorOverlay';
import PointBadge from '../components/PointBadge';
import useNearbyBuildings from '../hooks/useNearbyBuildings';
import useBuildingDetail from '../hooks/useBuildingDetail';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 카메라 영역 높이 비율 (화면의 약 60%)
const CAMERA_HEIGHT_RATIO = 0.6;

/**
 * Magnetometer 데이터(x, y)로부터 heading(0~360도) 계산
 * @param {number} x - 자력계 x축 값
 * @param {number} y - 자력계 y축 값
 * @returns {number} heading (0: 북, 90: 동, 180: 남, 270: 서)
 */
const computeHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  // atan2 결과를 0~360 범위로 변환
  // 기기 좌표계에서 북쪽 기준으로 보정
  angle = (angle + 360) % 360;
  // 반올림하여 소수점 1자리까지
  return Math.round(angle * 10) / 10;
};

const ScanScreen = ({ route, navigation }) => {
  // ===== 네비게이션 파라미터 =====
  const { mode = 'normal' } = route?.params || {};

  // ===== 카메라 권한 =====
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  // ===== State 관리 =====
  const [userLocation, setUserLocation] = useState(null); // { lat, lng }
  const [heading, setHeading] = useState(0); // 나침반 heading (0~360)
  const [selectedBuildingId, setSelectedBuildingId] = useState(null); // 선택된 건물 ID
  const [gpsStatus, setGpsStatus] = useState('searching'); // 'searching' | 'active' | 'error'
  const [points, setPoints] = useState(DUMMY_POINTS.totalPoints); // 포인트 (더미)
  const [locationPermissionDenied, setLocationPermissionDenied] = useState(false);
  const [cameraPermissionDenied, setCameraPermissionDenied] = useState(false);
  const [showFloorOverlay, setShowFloorOverlay] = useState(false); // 층별 오버레이 표시

  // ===== 커스텀 훅 =====
  const {
    buildings: nearbyBuildings,
    loading: isLoading,
    error: nearbyError,
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

  // 선택된 건물 (nearbyBuildings에서 기본 정보 + buildingDetail에서 상세 정보 병합)
  const selectedBuilding = selectedBuildingId
    ? {
        ...(nearbyBuildings.find((b) => b.id === selectedBuildingId) || {}),
        ...(buildingDetail || {}),
      }
    : null;

  // ===== Refs =====
  const locationSubscriptionRef = useRef(null); // 위치 구독 해제용
  const magnetometerSubscriptionRef = useRef(null); // 자력계 구독 해제용
  const isMountedRef = useRef(true); // 컴포넌트 마운트 상태 추적

  // 모드 표시 정보
  const modeName = mode === 'xray' ? '투시 모드' : '일반 모드';
  const modeColor = mode === 'xray' ? COLORS.orange : COLORS.blue;

  // ===================================================================
  // 카메라 권한 요청
  // ===================================================================
  useEffect(() => {
    const initCamera = async () => {
      if (!cameraPermission) return; // 아직 로딩 중

      if (!cameraPermission.granted) {
        const result = await requestCameraPermission();
        if (!result.granted) {
          setCameraPermissionDenied(true);
          console.warn('[ScanScreen] 카메라 권한이 거부되었습니다.');
        }
      }
    };

    initCamera();
  }, [cameraPermission]);

  // ===================================================================
  // 위치 권한 요청 및 실시간 위치 추적
  // ===================================================================
  useEffect(() => {
    let isCancelled = false;

    const initLocation = async () => {
      try {
        // 위치 권한 요청
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          if (!isCancelled && isMountedRef.current) {
            setLocationPermissionDenied(true);
            setGpsStatus('error');
            console.warn('[ScanScreen] 위치 권한이 거부되었습니다.');
            // useNearbyBuildings 훅이 더미 데이터로 자동 폴백
          }
          return;
        }

        // 실시간 위치 추적 시작 (watchPositionAsync)
        const subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 3000, // 최소 3초 간격
            distanceInterval: 5, // 최소 5미터 이동 시
          },
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
        console.error('[ScanScreen] 위치 초기화 실패:', error);
        if (!isCancelled && isMountedRef.current) {
          setGpsStatus('error');
          // useNearbyBuildings 훅이 더미 데이터로 자동 폴백
        }
      }
    };

    initLocation();

    return () => {
      isCancelled = true;
      // 위치 구독 해제
      if (locationSubscriptionRef.current) {
        locationSubscriptionRef.current.remove();
        locationSubscriptionRef.current = null;
      }
    };
  }, []);

  // ===================================================================
  // Magnetometer (나침반) 구독
  // ===================================================================
  useEffect(() => {
    // Magnetometer 업데이트 주기 설정 (200ms)
    Magnetometer.setUpdateInterval(200);

    const subscription = Magnetometer.addListener((data) => {
      if (isMountedRef.current && data) {
        const newHeading = computeHeading(data.x, data.y);
        setHeading(newHeading);
      }
    });

    magnetometerSubscriptionRef.current = subscription;

    return () => {
      // 자력계 구독 해제
      if (magnetometerSubscriptionRef.current) {
        magnetometerSubscriptionRef.current.remove();
        magnetometerSubscriptionRef.current = null;
      }
    };
  }, []);

  // ===================================================================
  // 주변 건물 목록 변경 시 첫 번째 건물 자동 선택
  // ===================================================================
  useEffect(() => {
    if (nearbyBuildings.length > 0 && !selectedBuildingId) {
      setSelectedBuildingId(nearbyBuildings[0].id);
    }
  }, [nearbyBuildings, selectedBuildingId]);

  // ===================================================================
  // 건물 탭 선택 핸들러 (useBuildingDetail 훅이 상세 조회 처리)
  // ===================================================================
  const handleBuildingSelect = useCallback(
    (building) => {
      if (!building) return;

      setSelectedBuildingId(building.id);
      setShowFloorOverlay(false); // 건물 변경 시 층별 오버레이 닫기

      // 스캔 로그 전송 (건물 탭 이벤트)
      sendScanLog(
        'pin_tapped',
        building.id,
        userLocation?.lat,
        userLocation?.lng,
        heading
      );
    },
    [userLocation, heading]
  );

  // ===================================================================
  // 층별 오버레이 토글
  // ===================================================================
  const toggleFloorOverlay = useCallback(() => {
    setShowFloorOverlay((prev) => !prev);
  }, []);

  // ===================================================================
  // 스캔 로그 전송 (에러 무시 - fire and forget)
  // ===================================================================
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const sendScanLog = useCallback(
    async (eventType, buildingId, lat, lng, currentHeading) => {
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
      } catch (error) {
        // 스캔 로그 전송 실패는 사용자 경험에 영향 없음 - 무시
        console.warn('[ScanScreen] 스캔 로그 전송 실패 (무시됨):', error.message);
      }
    },
    [mode]
  );

  // ===================================================================
  // 컴포넌트 언마운트 시 정리
  // ===================================================================
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ===================================================================
  // GPS 상태에 따른 텍스트/색상
  // ===================================================================
  const getLocationInfo = () => {
    switch (gpsStatus) {
      case 'searching':
        return { text: '위치 확인 중...', color: COLORS.orange };
      case 'active':
        return { text: 'GPS 활성', color: COLORS.green };
      case 'error':
        return { text: '위치 오류', color: COLORS.red };
      default:
        return { text: '알 수 없음', color: COLORS.textSecondary };
    }
  };

  const locationInfo = getLocationInfo();

  // ===================================================================
  // 카메라 권한 거부 시 안내 화면
  // ===================================================================
  const renderCameraPermissionDenied = () => (
    <View style={styles.permissionContainer}>
      <Text style={styles.permissionIcon}>📷</Text>
      <Text style={styles.permissionTitle}>카메라 권한 필요</Text>
      <Text style={styles.permissionDesc}>
        건물을 스캔하려면 카메라 접근 권한이 필요합니다.{'\n'}
        설정에서 카메라 권한을 허용해주세요.
      </Text>
      <TouchableOpacity
        style={styles.permissionButton}
        onPress={requestCameraPermission}
        activeOpacity={0.7}
      >
        <Text style={styles.permissionButtonText}>권한 다시 요청</Text>
      </TouchableOpacity>
    </View>
  );

  // ===================================================================
  // 위치 권한 거부 시 안내 배너
  // ===================================================================
  const renderLocationDeniedBanner = () => (
    <View style={styles.locationDeniedBanner}>
      <Text style={styles.locationDeniedText}>
        위치 권한이 거부되어 더미 데이터를 표시합니다.
      </Text>
    </View>
  );

  // ===================================================================
  // 카메라 뷰 또는 대체 UI 렌더링
  // ===================================================================
  const renderCameraArea = () => {
    // 카메라 권한이 거부된 경우
    if (cameraPermissionDenied) {
      return renderCameraPermissionDenied();
    }

    // 카메라 권한이 아직 확인되지 않은 경우 (로딩)
    if (!cameraPermission || !cameraPermission.granted) {
      return (
        <View style={styles.cameraLoadingContainer}>
          <ActivityIndicator size="large" color={COLORS.blue} />
          <Text style={styles.cameraLoadingText}>카메라 준비 중...</Text>
        </View>
      );
    }

    // 카메라 권한이 있는 경우 - CameraView 렌더링
    return (
      <CameraView style={styles.cameraView} facing="back">
        {/* 크로스헤어 오버레이 */}
        <View style={styles.cameraOverlay}>
          <View style={styles.crosshair}>
            {/* 상단 좌측 모서리 */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            {/* 상단 우측 모서리 */}
            <View style={[styles.corner, styles.cornerTopRight]} />
            {/* 하단 좌측 모서리 */}
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            {/* 하단 우측 모서리 */}
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>

          {/* 안내 텍스트 */}
          <Text style={styles.cameraGuideText}>
            {gpsStatus === 'searching'
              ? '위치를 탐색하고 있습니다...'
              : '건물을 향해 카메라를 비추세요'}
          </Text>
        </View>

        {/* 감지된 건물 수 표시 배지 */}
        {nearbyBuildings.length > 0 && (
          <View style={styles.detectedBadge}>
            <Text style={styles.detectedText}>
              {nearbyBuildings.length}개 건물 감지됨
            </Text>
          </View>
        )}

        {/* 나침반 방향 표시 */}
        <View style={styles.headingBadge}>
          <Text style={styles.headingText}>
            {Math.round(heading)}°
          </Text>
        </View>

        {/* 건물 핀 오버레이 (카메라 위에 건물명 태그) */}
        {nearbyBuildings.length > 0 && (
          <View style={styles.buildingPinsContainer}>
            {nearbyBuildings.slice(0, 5).map((building, index) => (
              <BuildingPin
                key={building.id}
                building={building}
                isSelected={selectedBuildingId === building.id}
                onPress={() => handleBuildingSelect(building)}
                style={{
                  position: 'absolute',
                  top: 60 + index * 50,
                  left: 12 + (index % 3) * 80,
                }}
              />
            ))}
          </View>
        )}

        {/* 층별 보기 버튼 (건물 선택 시 표시) */}
        {selectedBuilding && (
          <TouchableOpacity
            style={styles.floorToggleBtn}
            onPress={toggleFloorOverlay}
            activeOpacity={0.7}
          >
            <Text style={styles.floorToggleBtnText}>
              {showFloorOverlay ? '닫기' : '층별 보기'}
            </Text>
          </TouchableOpacity>
        )}

        {/* 층별 오버레이 (투시 모드 또는 버튼 탭 시) */}
        <FloorOverlay
          floors={buildingDetail?.floors || selectedBuilding?.floors || []}
          onFloorTap={(floor) => console.log('층 탭:', floor)}
          onRewardTap={(floor) => {
            setPoints((prev) => prev + (floor.rewardPoints || 50));
          }}
          visible={showFloorOverlay}
        />

        {/* 로딩 인디케이터 (API 호출 중) */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={COLORS.blue} />
          </View>
        )}
      </CameraView>
    );
  };

  // ===================================================================
  // 메인 렌더링
  // ===================================================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* ===== 상단 바 ===== */}
      <View style={styles.topBar}>
        {/* 뒤로가기 버튼 */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>

        {/* 모드 배지 (일반=블루, 투시=오렌지) */}
        <View style={[styles.modeBadge, { backgroundColor: `${modeColor}20` }]}>
          <View style={[styles.modeDot, { backgroundColor: modeColor }]} />
          <Text style={[styles.modeText, { color: modeColor }]}>
            {modeName}
          </Text>
        </View>

        {/* 우측 정보 영역 */}
        <View style={styles.topBarRight}>
          {/* GPS 상태 표시 */}
          <View style={styles.locationBadge}>
            <View
              style={[styles.locationDot, { backgroundColor: locationInfo.color }]}
            />
            <Text style={[styles.locationText, { color: locationInfo.color }]}>
              {locationInfo.text}
            </Text>
          </View>

          {/* 포인트 배지 */}
          <PointBadge points={points} size="small" />
        </View>
      </View>

      {/* 위치 권한 거부 시 안내 배너 */}
      {locationPermissionDenied && renderLocationDeniedBanner()}

      {/* ===== 카메라 뷰 영역 (화면 상단 약 60%) ===== */}
      <View style={styles.cameraContainer}>{renderCameraArea()}</View>

      {/* ===== 하단 건물 정보 영역 ===== */}
      <View style={styles.bottomSection}>
        {/* 건물 선택 탭 (가로 스크롤) */}
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
                  selectedBuilding?.id === building.id &&
                    styles.buildingTabActive,
                ]}
                onPress={() => handleBuildingSelect(building)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buildingTabText,
                    selectedBuilding?.id === building.id &&
                      styles.buildingTabTextActive,
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

        {/* 건물 정보 카드 (BuildingCard 컴포넌트) */}
        {selectedBuilding ? (
          <BuildingCard
            building={selectedBuilding}
            liveFeeds={getLiveFeedsByBuilding(selectedBuilding.id)}
          />
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {gpsStatus === 'searching'
                ? '주변 건물을 탐색하고 있습니다...'
                : nearbyBuildings.length === 0
                  ? '감지된 건물이 없습니다'
                  : '건물을 선택해주세요'}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

// ===================================================================
// 스타일 정의
// ===================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // ===== 상단 바 =====
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 12,
  },
  modeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  topBarRight: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: SPACING.xs,
  },
  locationText: {
    fontSize: 11,
    fontWeight: '500',
  },
  // (PointBadge 컴포넌트로 대체됨)

  // ===== 위치 권한 거부 배너 =====
  locationDeniedBanner: {
    backgroundColor: 'rgba(255,82,82,0.15)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    marginHorizontal: SPACING.lg,
    borderRadius: 8,
    marginBottom: SPACING.xs,
  },
  locationDeniedText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.red,
    textAlign: 'center',
  },

  // ===== 카메라 뷰 =====
  cameraContainer: {
    height: SCREEN_HEIGHT * CAMERA_HEIGHT_RATIO,
    margin: SPACING.lg,
    marginTop: SPACING.sm,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cameraView: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 스캔 크로스헤어 (사각 프레임)
  crosshair: {
    width: 200,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: COLORS.blue,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  cameraGuideText: {
    ...TYPOGRAPHY.bodySmall,
    color: 'rgba(255,255,255,0.7)',
    marginTop: SPACING.xl,
    textAlign: 'center',
  },

  // 감지된 건물 수 배지
  detectedBadge: {
    position: 'absolute',
    top: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: 'rgba(0,200,83,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 10,
  },
  detectedText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.green,
  },

  // 나침반 방향 배지
  headingBadge: {
    position: 'absolute',
    top: SPACING.lg,
    left: SPACING.lg,
    backgroundColor: 'rgba(74,144,217,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 10,
  },
  headingText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.blue,
  },

  // 건물 핀 오버레이 컨테이너
  buildingPinsContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // 층별 보기 토글 버튼
  floorToggleBtn: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    backgroundColor: 'rgba(74,144,217,0.85)',
    paddingHorizontal: SPACING.md + 2,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
  },
  floorToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // API 로딩 오버레이
  loadingOverlay: {
    position: 'absolute',
    bottom: SPACING.lg,
    alignSelf: 'center',
    backgroundColor: 'rgba(10,14,39,0.7)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 16,
  },

  // 카메라 로딩 (권한 대기 중)
  cameraLoadingContainer: {
    flex: 1,
    backgroundColor: '#0D1230',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraLoadingText: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },

  // ===== 카메라 권한 거부 안내 =====
  permissionContainer: {
    flex: 1,
    backgroundColor: '#0D1230',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  permissionIcon: {
    fontSize: 48,
    marginBottom: SPACING.lg,
  },
  permissionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  permissionDesc: {
    ...TYPOGRAPHY.bodySmall,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: SPACING.xl,
  },
  permissionButton: {
    backgroundColor: COLORS.blue,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 12,
  },
  permissionButtonText: {
    ...TYPOGRAPHY.button,
    color: COLORS.textPrimary,
    fontSize: 14,
  },

  // ===== 하단 건물 정보 =====
  bottomSection: {
    flex: 1,
    paddingBottom: SPACING.lg,
  },
  // 건물 선택 탭
  buildingTabs: {
    maxHeight: 40,
    marginBottom: SPACING.sm,
  },
  buildingTabsContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  buildingTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 10,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buildingTabActive: {
    borderColor: COLORS.blue,
    backgroundColor: 'rgba(74,144,217,0.1)',
  },
  buildingTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  buildingTabTextActive: {
    color: COLORS.blue,
    fontWeight: '600',
  },
  buildingTabDistance: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  // 빈 상태 카드
  emptyCard: {
    ...CARD_STYLE,
    marginHorizontal: SPACING.lg,
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
  },
});

export default ScanScreen;
