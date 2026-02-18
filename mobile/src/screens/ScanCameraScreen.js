/**
 * ScanCameraScreen - 전체화면 카메라 + AR 라벨 + 바텀시트
 * - SCAN/XRAY 통합: 하나의 플로우로 외관 + 층별 투시 제공
 * - Layer 0: 전체화면 카메라 프리뷰
 * - Layer 1: 상단 오버레이 바 (반투명 그라데이션)
 * - Layer 2: AR 건물 라벨 (흰 카드형)
 * - Layer 3: 하단 건물 정보 바텀시트 (@gorhom/bottom-sheet)
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
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import BottomSheet from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, COLORS, SPACING, TOUCH } from '../constants/theme';
import { DUMMY_POINTS, getLiveFeedsByBuilding } from '../constants/dummyData';
import { postScanLog } from '../services/api';
import useNearbyBuildings from '../hooks/useNearbyBuildings';
import useBuildingDetail from '../hooks/useBuildingDetail';
import { formatDistance } from '../utils/coordinate';

const { width: SW, height: SH } = Dimensions.get('window');

const computeHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  return (angle + 360) % 360;
};

// ===== AR 건물 라벨 =====
const ARBuildingLabel = ({ building, isSelected, onPress, x, y, index }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = index * 100;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  const hasReward = building.floors?.some(f => f.hasReward || f.has_reward);

  return (
    <Animated.View style={[styles.arLabel, { top: y, left: x, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.arLabelCard, isSelected && styles.arLabelCardSelected]}
        onPress={() => onPress(building)}
        activeOpacity={0.8}
        hitSlop={TOUCH.hitSlop}
      >
        {hasReward && <View style={styles.rewardBadge}><Text style={styles.rewardBadgeText}>+P</Text></View>}
        <Text style={styles.arLabelName} numberOfLines={1}>{building.name}</Text>
        <Text style={styles.arLabelCategory}>{building.buildingUse || building.category || '건물'}</Text>
        <Text style={styles.arLabelDistance}>{formatDistance(building.distance)}</Text>
      </TouchableOpacity>
      <View style={[styles.arLabelPin, isSelected && styles.arLabelPinSelected]} />
    </Animated.View>
  );
};

// ===== 상단 오버레이 바 =====
const CameraOverlayBar = ({ points, gpsStatus, onBack }) => {
  const gpsColor = gpsStatus === 'active' ? Colors.successGreen : gpsStatus === 'error' ? Colors.liveRed : Colors.accentAmber;
  const gpsText = gpsStatus === 'active' ? 'GPS 활성' : gpsStatus === 'error' ? '위치 오류' : '위치 확인중...';

  return (
    <View style={styles.overlayBar}>
      <TouchableOpacity style={styles.overlayBackBtn} onPress={onBack} hitSlop={TOUCH.hitSlop}>
        <Text style={styles.overlayBackText}>{'‹'}</Text>
      </TouchableOpacity>

      <View style={styles.overlayModePill}>
        <View style={[styles.overlayDot, { backgroundColor: Colors.successGreen }]} />
        <Text style={styles.overlayModeText}>일반 모드</Text>
      </View>

      <View style={styles.overlayPointsPill}>
        <Text style={styles.overlayPointsStar}>★</Text>
        <Text style={styles.overlayPointsText}>{points.toLocaleString()}</Text>
      </View>

      <View style={styles.overlayGpsContainer}>
        <View style={[styles.overlayDot, { backgroundColor: gpsColor }]} />
        <Text style={[styles.overlayGpsText, { color: gpsColor }]}>{gpsText}</Text>
      </View>
    </View>
  );
};

// ===== 바텀시트: 건물 헤더 =====
const BuildingHeader = ({ building, onClose }) => (
  <View style={styles.bsHeader}>
    <View style={styles.bsHeaderLeft}>
      <Text style={styles.bsName}>{building.name}</Text>
      <Text style={styles.bsDistance}>{formatDistance(building.distance)}</Text>
    </View>
    <View style={styles.bsHeaderRight}>
      <View style={styles.bsLivePill}>
        <Text style={styles.bsLivePillText}>LIVE 투시</Text>
      </View>
      <TouchableOpacity style={styles.bsCloseBtn} onPress={onClose} hitSlop={TOUCH.hitSlop}>
        <Text style={styles.bsCloseBtnText}>✕</Text>
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

// ===== 바텀시트: 층별 투시 리스트 =====
const FloorList = ({ floors = [], onRewardTap }) => {
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
          <Animated.View key={`${floor}-${i}`}>
            <TouchableOpacity
              style={[styles.floorItem, hasReward && styles.floorItemReward]}
              activeOpacity={0.7}
              onPress={() => hasReward && onRewardTap && onRewardTap(f)}
            >
              <View style={[styles.floorBadge, { backgroundColor: getFloorColor(floor) }]}>
                <Text style={styles.floorBadgeText}>{floor}</Text>
              </View>
              <Text style={[styles.floorTenant, isVacant && styles.floorTenantVacant]} numberOfLines={1}>
                {isVacant ? '공실' : tenantDisplay}
              </Text>
              {hasReward && <View style={styles.floorRewardBadge}><Text style={styles.floorRewardText}>+P</Text></View>}
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </View>
  );
};

// ===== 바텀시트: LIVE 피드 =====
const LiveFeed = ({ feeds = [] }) => {
  if (!feeds.length) return null;
  const FEED_COLORS = { event: '#4CAF50', promo: '#2196F3', alert: '#F44336', news: '#4CAF50', congestion: '#FF9800', promotion: '#2196F3', update: '#F44336' };

  return (
    <View style={styles.liveSection}>
      <View style={styles.liveHeader}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>LIVE</Text>
        </View>
        <Text style={styles.liveTitle}>지금 이 순간</Text>
      </View>
      {feeds.slice(0, 3).map((feed) => {
        const feedType = feed.type || feed.feedType || 'news';
        return (
          <View key={feed.id} style={styles.liveFeedItem}>
            <View style={[styles.liveFeedIcon, { backgroundColor: `${FEED_COLORS[feedType] || Colors.primaryBlue}20` }]}>
              <Text style={[styles.liveFeedIconText, { color: FEED_COLORS[feedType] || Colors.primaryBlue }]}>
                {feedType === 'event' ? 'EVT' : feedType === 'promo' || feedType === 'promotion' ? 'SAL' : 'NEW'}
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

// ===== 핀 위치 계산 =====
const calculatePinPositions = (buildings, screenW, screenH) => {
  const positions = [];
  const occupied = [];
  buildings.slice(0, 5).forEach((building, index) => {
    let x = 20 + (index % 3) * (screenW * 0.28);
    let y = 80 + Math.floor(index / 3) * 90;
    for (const prev of occupied) {
      if (Math.abs(x - prev.x) < 160 && Math.abs(y - prev.y) < 70) y = prev.y + 75;
    }
    x = Math.max(8, Math.min(x, screenW - 170));
    y = Math.max(60, Math.min(y, screenH * 0.45));
    occupied.push({ x, y });
    positions.push({ building, x, y });
  });
  return positions;
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

  const bottomSheetRef = useRef(null);
  const locationSubRef = useRef(null);
  const magnetSubRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastHeadingRef = useRef(0);
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  const snapPoints = useMemo(() => ['1%', '25%', '55%', '90%'], []);

  const { buildings } = useNearbyBuildings({
    latitude: userLocation?.lat, longitude: userLocation?.lng,
    heading, radius: 300, enabled: gpsStatus === 'active',
  });

  const { building: buildingDetail, loading: detailLoading } = useBuildingDetail(selectedBuildingId);

  const selectedBuilding = selectedBuildingId
    ? { ...(buildings.find(b => b.id === selectedBuildingId) || {}), ...(buildingDetail || {}) }
    : null;

  const pinPositions = useMemo(
    () => calculatePinPositions(buildings, SW, SH),
    [buildings]
  );

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
          (loc) => { if (!cancelled && isMountedRef.current) { setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude }); setGpsStatus('active'); } }
        );
        locationSubRef.current = sub;
      } catch { if (!cancelled) setGpsStatus('error'); }
    })();
    return () => { cancelled = true; locationSubRef.current?.remove(); };
  }, []);

  // 나침반
  useEffect(() => {
    Magnetometer.setUpdateInterval(500);
    const sub = Magnetometer.addListener((data) => {
      if (isMountedRef.current && data) {
        const h = computeHeading(data.x, data.y);
        if (Math.abs(h - lastHeadingRef.current) >= 5) { lastHeadingRef.current = h; setHeading(h); }
      }
    });
    magnetSubRef.current = sub;
    return () => magnetSubRef.current?.remove();
  }, []);

  // 자동 선택
  useEffect(() => {
    if (buildings.length > 0 && !selectedBuildingId) setSelectedBuildingId(buildings[0].id);
  }, [buildings, selectedBuildingId]);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  const handleBuildingSelect = useCallback((building) => {
    if (!building) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBuildingId(building.id);
    bottomSheetRef.current?.snapToIndex(1); // peek
    postScanLog({ sessionId: sessionIdRef.current, buildingId: building.id, eventType: 'pin_tapped', userLat: userLocation?.lat, userLng: userLocation?.lng, deviceHeading: heading, metadata: {} }).catch(() => {});
  }, [userLocation, heading]);

  const handleCloseSheet = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(0);
  }, []);

  // 가이드 텍스트
  const guideVisible = buildings.length === 0 && gpsStatus !== 'searching';
  const searchingVisible = gpsStatus === 'searching';
  const guideAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(guideAnim, { toValue: buildings.length > 0 ? 0 : 1, duration: 300, useNativeDriver: true }).start();
  }, [buildings.length]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Layer 0: 전체화면 카메라 */}
      {cameraPermissionDenied ? (
        <View style={styles.permissionView}>
          <Text style={styles.permissionTitle}>카메라 권한 필요</Text>
          <Text style={styles.permissionDesc}>건물을 스캔하려면 카메라 접근 권한이 필요합니다.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={requestCameraPermission}>
            <Text style={styles.permissionBtnText}>권한 다시 요청</Text>
          </TouchableOpacity>
        </View>
      ) : !cameraPermission?.granted ? (
        <View style={styles.loadingView}>
          <ActivityIndicator size="large" color={Colors.primaryBlue} />
          <Text style={styles.loadingText}>카메라 준비 중...</Text>
        </View>
      ) : (
        <CameraView style={styles.camera} facing="back">
          {/* Layer 2: AR 건물 라벨 */}
          {pinPositions.map(({ building, x, y }, index) => (
            <ARBuildingLabel
              key={building.id}
              building={building}
              isSelected={selectedBuildingId === building.id}
              onPress={handleBuildingSelect}
              x={x} y={y} index={index}
            />
          ))}

          {/* 가이드 텍스트 */}
          <Animated.View style={[styles.guideOverlay, { opacity: guideAnim }]} pointerEvents="none">
            <Text style={styles.guideText}>
              {searchingVisible ? '위치를 탐색하고 있습니다...' : '건물을 향해 카메라를 비추세요'}
            </Text>
          </Animated.View>
        </CameraView>
      )}

      {/* Layer 1: 상단 오버레이 바 */}
      <CameraOverlayBar
        points={points}
        gpsStatus={gpsStatus}
        onBack={() => navigation.goBack()}
      />

      {/* Layer 3: 하단 바텀시트 */}
      <BottomSheet
        ref={bottomSheetRef}
        index={selectedBuilding ? 1 : 0}
        snapPoints={snapPoints}
        backgroundStyle={styles.bsBackground}
        handleIndicatorStyle={styles.bsHandle}
        enablePanDownToClose={false}
      >
        {selectedBuilding ? (
          <ScrollView style={styles.bsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <BuildingHeader building={selectedBuilding} onClose={handleCloseSheet} />
            <QuickInfoTags amenities={selectedBuilding.facilities || selectedBuilding.amenities || []} />
            <BuildingStats building={selectedBuilding} />
            <FloorList
              floors={buildingDetail?.floors || selectedBuilding?.floors || []}
              onRewardTap={(floor) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setPoints(p => p + (floor.rewardPoints || 50));
              }}
            />
            <LiveFeed feeds={buildingDetail?.liveFeeds || getLiveFeedsByBuilding(selectedBuilding.id)} />
            <View style={{ height: 40 }} />
          </ScrollView>
        ) : (
          <View style={styles.bsEmpty}>
            <Text style={styles.bsEmptyText}>
              {gpsStatus === 'searching' ? '주변 건물을 탐색 중...' : '건물을 선택해주세요'}
            </Text>
          </View>
        )}
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },

  // 카메라 권한/로딩
  permissionView: { flex: 1, backgroundColor: '#0D1230', justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  permissionTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginBottom: SPACING.sm },
  permissionDesc: { fontSize: 14, color: '#B0B0B0', textAlign: 'center', marginBottom: SPACING.xl },
  permissionBtn: { backgroundColor: Colors.primaryBlue, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: 12 },
  permissionBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  loadingView: { flex: 1, backgroundColor: '#0D1230', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 14, color: '#B0B0B0', marginTop: SPACING.md },

  // 가이드
  guideOverlay: { position: 'absolute', bottom: '30%', left: 0, right: 0, alignItems: 'center' },
  guideText: { fontSize: 14, color: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: 20, overflow: 'hidden' },

  // ===== AR 라벨 =====
  arLabel: { position: 'absolute', alignItems: 'center' },
  arLabelCard: {
    backgroundColor: '#FFF', borderRadius: 12, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
    minWidth: 120,
  },
  arLabelCardSelected: { borderWidth: 2, borderColor: Colors.accentAmber },
  arLabelName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  arLabelCategory: { fontSize: 12, color: Colors.textSecondary },
  arLabelDistance: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  rewardBadge: { position: 'absolute', top: -6, right: -6, backgroundColor: Colors.accentAmber, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  rewardBadgeText: { fontSize: 9, fontWeight: '800', color: '#FFF' },
  arLabelPin: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFF', borderWidth: 2, borderColor: Colors.textTertiary, marginTop: -1 },
  arLabelPinSelected: { backgroundColor: Colors.accentAmber, borderColor: Colors.accentAmber },

  // ===== 상단 오버레이 =====
  overlayBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 50, paddingBottom: SPACING.md, paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: SPACING.sm,
  },
  overlayBackBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  overlayBackText: { fontSize: 22, color: '#FFF', marginTop: -2 },
  overlayModePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 1, borderRadius: 16, gap: SPACING.xs },
  overlayDot: { width: 6, height: 6, borderRadius: 3 },
  overlayModeText: { fontSize: 13, fontWeight: '600', color: '#FFF' },
  overlayPointsPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: SPACING.sm + 2, paddingVertical: SPACING.xs + 1, borderRadius: 16, gap: 3 },
  overlayPointsStar: { fontSize: 12, color: Colors.accentAmber },
  overlayPointsText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  overlayGpsContainer: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  overlayGpsText: { fontSize: 11, fontWeight: '500' },

  // ===== 바텀시트 =====
  bsBackground: { backgroundColor: Colors.darkBg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  bsHandle: { backgroundColor: 'rgba(255,255,255,0.3)', width: 40 },
  bsScroll: { paddingHorizontal: SPACING.lg },
  bsEmpty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  bsEmptyText: { fontSize: 15, color: Colors.darkTextSecondary },

  // 바텀시트: 헤더
  bsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.lg },
  bsHeaderLeft: { flex: 1 },
  bsName: { fontSize: 22, fontWeight: '700', color: '#FFF', marginBottom: 4 },
  bsDistance: { fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  bsHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
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
