/**
 * HomeScreen - 화이트톤 클린 UI 홈 화면
 * - SCAN/XRAY 모드 통합 → "스캔 시작하기" 하나의 CTA
 * - 블루 그라데이션 StatusCard
 * - 주변 건물 미리보기
 * - 최근 활동
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, SPACING } from '../constants/theme';
import useNearbyBuildings from '../hooks/useNearbyBuildings';

import StatusCard from '../components/home/StatusCard';
import ScanStartCard from '../components/home/ScanStartCard';
import NearbyBuildings from '../components/home/NearbyBuildings';
import RecentActivity from '../components/home/RecentActivity';

const RECENT_SCANS_KEY_HOME = '@scanpang_recent_scans';
const POINTS_PER_SCAN = 50;
const DAILY_LIMIT = 500;

// AsyncStorage에서 오늘 스캔 통계 계산
const getTodayStats = (scans) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  // 오늘 스캔한 항목만 필터
  const todayScans = scans.filter(s => (s.timestamp || 0) >= todayTs);

  // 중복 건물 제거 (같은 날 같은 건물 = 1회)
  const uniqueBuildings = new Set();
  todayScans.forEach(s => {
    const baseId = s.id?.split('_').slice(0, -1).join('_') || s.id; // 타임스탬프 suffix 제거
    uniqueBuildings.add(baseId);
  });

  const scanCount = uniqueBuildings.size;
  const todayEarned = scanCount * POINTS_PER_SCAN;
  const remaining = Math.max(0, DAILY_LIMIT - scanCount);

  return {
    scanCount,
    todayEarned,
    dailyLimit: DAILY_LIMIT,
    remaining,
    totalPoints: scans.length * POINTS_PER_SCAN, // 전체 누적 (간이 계산)
  };
};

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [userLocation, setUserLocation] = useState(null);
  const [locationName, setLocationName] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);
  const [todayStats, setTodayStats] = useState({
    scanCount: 0, todayEarned: 0, dailyLimit: DAILY_LIMIT, remaining: DAILY_LIMIT, totalPoints: 0,
  });

  // 위치 가져오기 + 역지오코딩
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });

          // 역지오코딩으로 동적 위치명
          try {
            const [place] = await Location.reverseGeocodeAsync({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            if (place) {
              const name = place.district || place.subregion || place.city || place.region || '';
              const street = place.street || place.name || '';
              setLocationName(street ? `${name} ${street} 주변` : `${name} 주변`);
            }
          } catch {}
        }
      } catch {}
    })();
  }, []);

  // 최근 스캔 기록 로드 + 오늘 통계 계산
  const loadScanData = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_SCANS_KEY_HOME);
      if (raw) {
        const scans = JSON.parse(raw);
        setRecentActivities(scans.slice(0, 3));
        setTodayStats(getTodayStats(scans));
      }
    } catch {}
  };

  useEffect(() => {
    loadScanData();
  }, []);

  // 화면 포커스 시 데이터 새로고침 (스캔 후 복귀 시)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadScanData();
    });
    return unsubscribe;
  }, [navigation]);

  const { buildings, loading, error: nearbyError, refetch: refetchNearby } = useNearbyBuildings({
    latitude: userLocation?.lat,
    longitude: userLocation?.lng,
    heading: null,
    radius: 500,
    enabled: !!userLocation,
  });

  const handleStartScan = () => {
    navigation.navigate('ScanCamera');
  };

  const handleBuildingPress = (building) => {
    // 바텀시트로 건물 프로필 표시 (NearbyBuildingsScreen에서)
    navigation.navigate('NearbyBuildings', { selectedBuildingId: building.id, buildings });
  };

  const handleBuildingReport = (building) => {
    navigation.navigate('BehaviorReport', {
      buildingId: building.id,
      buildingName: building.name,
    });
  };

  const handleSeeAllBuildings = () => {
    navigation.navigate('NearbyBuildings', { buildings });
  };

  const handleFlywheelDashboard = () => {
    navigation.navigate('FlywheelDashboard');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgWhite} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + SPACING.xxl }]}
      >
        {/* 상단 네비게이션 바 */}
        <View style={styles.navBar}>
          <Text style={styles.logo}>ScanPang</Text>
          <TouchableOpacity style={styles.pointsPill}>
            <Text style={styles.pointsIcon}>P</Text>
            <Text style={styles.pointsText}>{todayStats.totalPoints.toLocaleString()} P</Text>
          </TouchableOpacity>
        </View>

        {/* 인사 + 현황 카드 */}
        <StatusCard
          nearbyCount={buildings.length}
          stats={todayStats}
          locationName={locationName}
        />

        {/* 스캔 시작 CTA */}
        <ScanStartCard onPress={handleStartScan} />

        {/* 주변 건물 미리보기 */}
        <NearbyBuildings
          buildings={buildings}
          loading={loading || !userLocation}
          error={nearbyError}
          onBuildingPress={handleBuildingPress}
          onBuildingLongPress={handleBuildingReport}
          onSeeAll={handleSeeAllBuildings}
          onRetry={refetchNearby}
        />

        {/* 최근 활동 */}
        <RecentActivity activities={recentActivities.length > 0 ? recentActivities : []} onScanPress={handleStartScan} />

        {/* Flywheel 대시보드 */}
        <TouchableOpacity style={styles.flywheelCard} onPress={handleFlywheelDashboard} activeOpacity={0.7}>
          <View style={styles.flywheelLeft}>
            <Text style={styles.flywheelTitle}>Flywheel Dashboard</Text>
            <Text style={styles.flywheelDesc}>자동 DB 구축 현황 보기</Text>
          </View>
          <Text style={styles.flywheelArrow}>{'›'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bgWhite,
  },
  scrollContent: {
    paddingBottom: SPACING.xxl,
  },
  // 네비게이션 바
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  logo: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.primaryBlue,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgWhite,
    borderWidth: 1.5,
    borderColor: Colors.primaryBlue,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 20,
    gap: SPACING.xs,
  },
  pointsIcon: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primaryBlue,
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryBlue,
  },
  // Flywheel 카드
  flywheelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.xl,
    marginTop: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  flywheelLeft: { flex: 1 },
  flywheelTitle: { fontSize: 15, fontWeight: '700', color: Colors.primaryBlue },
  flywheelDesc: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  flywheelArrow: { fontSize: 24, color: Colors.primaryBlue },
});

export default HomeScreen;
