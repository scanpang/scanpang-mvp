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
  AppState,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, COLORS, SPACING, TOUCH } from '../constants/theme';
import { DUMMY_POINTS, getLiveFeedsByBuilding } from '../constants/dummyData';
import { postScanLog, getServerTimeContext, analyzeFrame } from '../services/api';
import useNearbyBuildings from '../hooks/useNearbyBuildings';
import useBuildingDetail from '../hooks/useBuildingDetail';
import useSensorData from '../hooks/useSensorData';
import { formatDistance } from '../utils/coordinate';
import { rankBuildings } from '../services/detectionEngine';
import { behaviorTracker } from '../services/behaviorTracker';
import GeminiLiveChat from '../components/GeminiLiveChat';

const { width: SW, height: SH } = Dimensions.get('window');
const RECENT_SCANS_KEY = '@scanpang_recent_scans';

// ===== 바텀시트 스켈레톤 로딩 =====
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

const computeHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  return (angle + 360) % 360;
};

// ===== AR 건물 라벨 =====
const ARBuildingLabel = ({ building, isSelected, onPress, x, y, index, labelScale = 1, confidence }) => {
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
    <Animated.View style={[styles.arLabel, { top: y, left: x, opacity: fadeAnim, transform: [{ scale: scaleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, labelScale] }) }] }]}>
      <TouchableOpacity
        style={[styles.arLabelCard, isSelected && styles.arLabelCardSelected]}
        onPress={() => onPress(building)}
        activeOpacity={0.8}
        hitSlop={TOUCH.hitSlop}
      >
        {hasReward && <View style={styles.rewardBadge}><Text style={styles.rewardBadgeText}>+P</Text></View>}
        <Text style={styles.arLabelName} numberOfLines={1}>{building.name}</Text>
        <Text style={styles.arLabelCategory}>{building.buildingUse || building.category || '건물'}</Text>
        <View style={styles.arLabelBottom}>
          <Text style={styles.arLabelDistance}>{formatDistance(building.distance)}</Text>
          {confidence != null && (
            <View style={[styles.confidenceBadge, { backgroundColor: confidence >= 80 ? '#10B98130' : confidence >= 50 ? '#F59E0B30' : '#EF444430' }]}>
              <Text style={[styles.confidenceText, { color: confidence >= 80 ? '#10B981' : confidence >= 50 ? '#F59E0B' : '#EF4444' }]}>
                {confidence}%
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      <View style={[styles.arLabelPin, isSelected && styles.arLabelPinSelected]} />
    </Animated.View>
  );
};

// ===== 상단 오버레이 바 =====
const CameraOverlayBar = ({ points, gpsStatus, onBack, motionState, isStable }) => {
  const gpsColor = gpsStatus === 'active' ? Colors.successGreen : gpsStatus === 'error' ? Colors.liveRed : Colors.accentAmber;
  const gpsText = gpsStatus === 'active' ? 'GPS 활성' : gpsStatus === 'error' ? '위치 오류' : '위치 확인중...';

  return (
    <View style={styles.overlayBar}>
      <TouchableOpacity style={styles.overlayBackBtn} onPress={onBack} hitSlop={TOUCH.hitSlop}>
        <Text style={styles.overlayBackText}>{'‹'}</Text>
      </TouchableOpacity>

      <View style={styles.overlayModePill}>
        <View style={[styles.overlayDot, { backgroundColor: isStable ? Colors.successGreen : Colors.accentAmber }]} />
        <Text style={styles.overlayModeText}>{isStable ? '7-Factor' : motionState === 'walking' ? '이동중' : '스캔'}</Text>
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
          <Animated.View key={`${floor}-${i}`}>
            <TouchableOpacity
              style={[styles.floorItem, hasReward && styles.floorItemReward]}
              activeOpacity={0.7}
              onPress={() => { onFloorTap && onFloorTap(f); hasReward && onRewardTap && onRewardTap(f); }}
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

// ===== AR 위치 계산 (방위각 기반) =====
const CAMERA_HFOV = 60; // 카메라 수평 시야각 (도)

const calculateARPositions = (buildings, heading, screenW, screenH) => {
  if (!buildings.length) return [];

  const positions = [];
  const occupied = [];

  buildings.slice(0, 10).forEach((building) => {
    const bearing = building.bearing ?? 0;
    const distance = building.distance || building.distanceMeters || 200;

    // 디바이스 방향 기준 상대 방위각
    let relBearing = bearing - heading;
    if (relBearing > 180) relBearing -= 360;
    if (relBearing < -180) relBearing += 360;

    // 시야 밖이면 스킵 (FOV + 10° 여유)
    if (Math.abs(relBearing) > CAMERA_HFOV / 2 + 10) return;

    // X: 방위각 → 화면 좌표 (중앙 = 정면)
    const labelW = 130;
    let x = (screenW / 2) + (relBearing / (CAMERA_HFOV / 2)) * (screenW / 2) - labelW / 2;

    // Y: 거리 기반 (가까우면 아래, 멀면 위 = 수평선 쪽)
    const normDist = Math.min(distance / 500, 1);
    let y = screenH * (0.52 - normDist * 0.28);

    // 스케일: 가까우면 크게, 멀면 작게
    const scale = Math.max(0.65, 1.1 - normDist * 0.45);

    // 화면 경계 클램프
    x = Math.max(4, Math.min(x, screenW - labelW));
    y = Math.max(70, Math.min(y, screenH * 0.55));

    // 겹침 방지
    for (const prev of occupied) {
      if (Math.abs(x - prev.x) < labelW && Math.abs(y - prev.y) < 55) {
        y = prev.y + 60;
      }
    }

    occupied.push({ x, y });
    positions.push({ building, x, y, scale });
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

  const [timeContext, setTimeContext] = useState(null);
  const [geminiResults, setGeminiResults] = useState(new Map());

  const bottomSheetRef = useRef(null);
  const cameraRef = useRef(null);
  const locationSubRef = useRef(null);
  const magnetSubRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastHeadingRef = useRef(0);
  const geminiTimerRef = useRef(null);
  const geminiAnalyzingRef = useRef(false);
  const sessionIdRef = useRef(`session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  // 7-Factor: 센서 데이터 수집 (자이로, 가속도계, 카메라 각도)
  const { gyroscope, accelerometer, cameraAngle, isStable, motionState, getSnapshot } = useSensorData({ enabled: gpsStatus === 'active' });

  const snapPoints = useMemo(() => ['1%', '25%', '55%', '90%'], []);

  const { buildings } = useNearbyBuildings({
    latitude: userLocation?.lat, longitude: userLocation?.lng,
    heading, radius: 300, enabled: gpsStatus === 'active',
  });

  const { building: buildingDetail, loading: detailLoading } = useBuildingDetail(selectedBuildingId);

  const selectedBuilding = selectedBuildingId
    ? { ...(buildings.find(b => b.id === selectedBuildingId) || {}), ...(buildingDetail || {}) }
    : null;

  // 7-Factor: 건물별 confidence 계산 + 정렬 (Gemini 결과 포함)
  const rankedBuildings = useMemo(() => {
    if (!buildings.length) return [];
    const sensorData = { heading, gyroscope, accelerometer, cameraAngle };
    return rankBuildings(buildings, sensorData, timeContext, geminiResults);
  }, [buildings, heading, gyroscope, accelerometer, cameraAngle, timeContext, geminiResults]);

  const pinPositions = useMemo(
    () => calculateARPositions(rankedBuildings, heading, SW, SH),
    [rankedBuildings, heading]
  );

  // BehaviorTracker 세션 + 서버 시각
  useEffect(() => {
    // 세션 시작
    behaviorTracker.startSession({
      startLat: userLocation?.lat,
      startLng: userLocation?.lng,
    });

    // 서버 시각 컨텍스트 fetch (1회)
    getServerTimeContext(userLocation?.lat || 37.4979, userLocation?.lng || 127.0276)
      .then(res => { if (res?.data) setTimeContext(res.data.context); })
      .catch(() => {});

    return () => { behaviorTracker.endSession(); };
  }, []);

  // BehaviorTracker에 위치/센서 업데이트
  useEffect(() => {
    if (userLocation) behaviorTracker.updateLocation(userLocation.lat, userLocation.lng);
  }, [userLocation]);

  useEffect(() => {
    behaviorTracker.updateSensorData({ heading, ...getSnapshot() });
  }, [heading, gyroscope, accelerometer]);

  // 화면에 보이는 건물 추적
  useEffect(() => {
    const visibleIds = pinPositions.map(p => p.building.id);
    behaviorTracker.updateVisibleBuildings(visibleIds);
  }, [pinPositions]);

  // Gemini Vision: 주기적 프레임 분석 (15초 간격, 안정 시에만)
  useEffect(() => {
    if (!isStable || !selectedBuildingId || !cameraRef.current) return;

    const runAnalysis = async () => {
      if (geminiAnalyzingRef.current) return;
      geminiAnalyzingRef.current = true;
      try {
        const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.3, skipProcessing: true });
        if (!photo?.base64 || !isMountedRef.current) return;

        const building = buildings.find(b => b.id === selectedBuildingId);
        const res = await analyzeFrame(photo.base64, {
          buildingId: selectedBuildingId,
          buildingName: building?.name,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
          heading,
          sessionId: sessionIdRef.current,
        });

        if (res?.data?.analysis && isMountedRef.current) {
          setGeminiResults(prev => {
            const next = new Map(prev);
            next.set(selectedBuildingId, res.data.analysis);
            return next;
          });
        }
      } catch {
        // Gemini 분석 실패는 무시 (6개 factor로 계속 작동)
      } finally {
        geminiAnalyzingRef.current = false;
      }
    };

    geminiTimerRef.current = setInterval(runAnalysis, 15000);
    // 최초 1회 즉시 실행 (3초 딜레이)
    const initTimer = setTimeout(runAnalysis, 3000);

    return () => {
      clearInterval(geminiTimerRef.current);
      clearTimeout(initTimer);
    };
  }, [isStable, selectedBuildingId, buildings, userLocation, heading]);

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

  // 나침반 (200ms 간격, 2° 변화 감지)
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

  // 자동 선택 (confidence 최고 건물)
  useEffect(() => {
    if (rankedBuildings.length > 0 && !selectedBuildingId) setSelectedBuildingId(rankedBuildings[0].id);
  }, [rankedBuildings, selectedBuildingId]);

  // AppState: 백그라운드 전환 시 배치 flush, 포그라운드 복귀 시 저장된 이벤트 재전송
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/active/) && nextState === 'background') {
        behaviorTracker.flush();
      }
      if (appStateRef.current.match(/background/) && nextState === 'active') {
        behaviorTracker.flushStoredEvents();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  useEffect(() => () => { isMountedRef.current = false; }, []);

  const handleBuildingSelect = useCallback((building) => {
    if (!building) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedBuildingId(building.id);
    bottomSheetRef.current?.snapToIndex(1);
    // 기존 scan log + 새 behavior tracker
    postScanLog({ sessionId: sessionIdRef.current, buildingId: building.id, eventType: 'pin_tapped', userLat: userLocation?.lat, userLng: userLocation?.lng, deviceHeading: heading, metadata: { confidence: building.confidence } }).catch(() => {});
    behaviorTracker.trackEvent('pin_click', { buildingId: building.id, metadata: { confidence: building.confidence } });

    // AsyncStorage에 최근 스캔 기록 저장
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_SCANS_KEY);
        const scans = raw ? JSON.parse(raw) : [];
        const newScan = {
          id: `${building.id}_${Date.now()}`,
          buildingName: building.name,
          points: 50,
          timeAgo: '방금 전',
          timestamp: Date.now(),
        };
        scans.unshift(newScan);
        if (scans.length > 20) scans.length = 20;
        await AsyncStorage.setItem(RECENT_SCANS_KEY, JSON.stringify(scans));
      } catch {}
    })();
  }, [userLocation, heading]);

  const handleCloseSheet = useCallback(() => {
    if (selectedBuildingId) {
      behaviorTracker.trackEvent('card_close', { buildingId: selectedBuildingId });
    }
    bottomSheetRef.current?.snapToIndex(0);
  }, [selectedBuildingId]);

  const handleOpenReport = useCallback(() => {
    if (!selectedBuilding) return;
    navigation.navigate('BehaviorReport', {
      buildingId: selectedBuilding.id,
      buildingName: selectedBuilding.name,
    });
  }, [selectedBuilding, navigation]);

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
          <Text style={styles.permissionIcon}>📷</Text>
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
        <CameraView ref={cameraRef} style={styles.camera} facing="back">
          {/* Layer 2: AR 건물 라벨 */}
          {pinPositions.map(({ building, x, y, scale }, index) => (
            <ARBuildingLabel
              key={building.id}
              building={building}
              isSelected={selectedBuildingId === building.id}
              onPress={handleBuildingSelect}
              x={x} y={y} index={index} labelScale={scale || 1}
              confidence={building.confidencePercent}
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

      {/* GPS 에러 배너 */}
      {gpsStatus === 'error' && (
        <View style={styles.gpsErrorBanner}>
          <Text style={styles.gpsErrorText}>GPS 신호를 받을 수 없습니다. 위치 서비스를 확인해주세요.</Text>
        </View>
      )}

      {/* Layer 1: 상단 오버레이 바 */}
      <CameraOverlayBar
        points={points}
        gpsStatus={gpsStatus}
        onBack={() => navigation.goBack()}
        motionState={motionState}
        isStable={isStable}
      />

      {/* Layer 3: 하단 바텀시트 */}
      <BottomSheet
        ref={bottomSheetRef}
        index={selectedBuilding ? 1 : 0}
        snapPoints={snapPoints}
        backgroundStyle={styles.bsBackground}
        handleIndicatorStyle={styles.bsHandle}
        enablePanDownToClose={false}
        onChange={(index) => {
          if (selectedBuildingId && index >= 2) {
            behaviorTracker.trackEvent('card_open', { buildingId: selectedBuildingId });
          }
        }}
      >
        {selectedBuilding && detailLoading ? (
          <View style={styles.bsScroll}>
            <BuildingHeader building={selectedBuilding} onClose={handleCloseSheet} onReport={handleOpenReport} />
            <BottomSheetSkeleton />
          </View>
        ) : selectedBuilding ? (
          <ScrollView style={styles.bsScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            <BuildingHeader building={selectedBuilding} onClose={handleCloseSheet} onReport={handleOpenReport} />
            <QuickInfoTags amenities={selectedBuilding.facilities || selectedBuilding.amenities || []} />
            <BuildingStats building={selectedBuilding} />
            <FloorList
              floors={buildingDetail?.floors || selectedBuilding?.floors || []}
              onFloorTap={(floor) => {
                behaviorTracker.trackEvent('card_open', {
                  buildingId: selectedBuildingId,
                  metadata: { floor: floor.floor || floor.floorNumber },
                });
              }}
              onRewardTap={(floor) => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setPoints(p => p + (floor.rewardPoints || 50));
                behaviorTracker.trackEvent('ar_interaction', {
                  buildingId: selectedBuildingId,
                  metadata: { type: 'reward', floor: floor.floor || floor.floorNumber, points: floor.rewardPoints || 50 },
                });
              }}
            />
            <LiveFeed feeds={buildingDetail?.liveFeeds || getLiveFeedsByBuilding(selectedBuilding.id)} />
            <GeminiLiveChat
              buildingId={selectedBuilding.id}
              buildingName={selectedBuilding.name}
              lat={userLocation?.lat}
              lng={userLocation?.lng}
            />
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
  permissionIcon: { fontSize: 48, marginBottom: SPACING.lg },
  permissionTitle: { fontSize: 18, fontWeight: '600', color: '#FFF', marginBottom: SPACING.sm },
  permissionDesc: { fontSize: 14, color: '#B0B0B0', textAlign: 'center', marginBottom: SPACING.xl, lineHeight: 22 },
  permissionBtn: { backgroundColor: Colors.primaryBlue, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: 12 },
  permissionBtnText: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  permissionSettingsBtn: { marginTop: SPACING.md, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm },
  permissionSettingsBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primaryBlue, textDecorationLine: 'underline' },

  // GPS 에러 배너
  gpsErrorBanner: { position: 'absolute', top: 100, left: SPACING.lg, right: SPACING.lg, backgroundColor: 'rgba(239,68,68,0.9)', borderRadius: 12, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, zIndex: 100 },
  gpsErrorText: { fontSize: 13, fontWeight: '600', color: '#FFF', textAlign: 'center' },

  // 바텀시트 스켈레톤
  skeletonContainer: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  skeletonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skeletonBlock: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8 },
  skeletonStatsRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  skeletonStatBox: { flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, paddingVertical: SPACING.md },
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
  arLabelBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  arLabelDistance: { fontSize: 12, color: Colors.textSecondary },
  confidenceBadge: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  confidenceText: { fontSize: 10, fontWeight: '700' },
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
