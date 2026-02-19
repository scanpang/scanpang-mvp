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
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors, SPACING } from '../constants/theme';
import { DUMMY_POINTS } from '../constants/dummyData';
import useNearbyBuildings from '../hooks/useNearbyBuildings';

import StatusCard from '../components/home/StatusCard';
import ScanStartCard from '../components/home/ScanStartCard';
import NearbyBuildings from '../components/home/NearbyBuildings';
import RecentActivity from '../components/home/RecentActivity';

const RECENT_SCANS_KEY = '@scanpang_recent_scans';

const HomeScreen = ({ navigation }) => {
  const [userLocation, setUserLocation] = useState(null);
  const [locationName, setLocationName] = useState(null);
  const [recentActivities, setRecentActivities] = useState([]);

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

  // 최근 스캔 기록 로드
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_SCANS_KEY);
        if (raw) {
          const scans = JSON.parse(raw);
          setRecentActivities(scans.slice(0, 3));
        }
      } catch {}
    })();
  }, []);

  const { buildings, loading } = useNearbyBuildings({
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
    navigation.navigate('ScanCamera', { focusBuildingId: building.id });
  };

  const handleBuildingReport = (building) => {
    navigation.navigate('BehaviorReport', {
      buildingId: building.id,
      buildingName: building.name,
    });
  };

  const handleFlywheelDashboard = () => {
    navigation.navigate('FlywheelDashboard');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgWhite} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 상단 네비게이션 바 */}
        <View style={styles.navBar}>
          <Text style={styles.logo}>ScanPang</Text>
          <TouchableOpacity style={styles.pointsPill}>
            <Text style={styles.pointsIcon}>P</Text>
            <Text style={styles.pointsText}>{DUMMY_POINTS.totalPoints.toLocaleString()} P</Text>
          </TouchableOpacity>
        </View>

        {/* 인사 + 현황 카드 */}
        <StatusCard
          nearbyCount={buildings.length}
          stats={DUMMY_POINTS}
          locationName={locationName}
        />

        {/* 스캔 시작 CTA */}
        <ScanStartCard onPress={handleStartScan} />

        {/* 주변 건물 미리보기 */}
        <NearbyBuildings
          buildings={buildings}
          loading={loading}
          onBuildingPress={handleBuildingPress}
          onBuildingLongPress={handleBuildingReport}
          onSeeAll={handleStartScan}
        />

        {/* 최근 활동 */}
        <RecentActivity activities={recentActivities.length > 0 ? recentActivities : undefined} onScanPress={handleStartScan} />

        {/* Flywheel 대시보드 */}
        <TouchableOpacity style={styles.flywheelCard} onPress={handleFlywheelDashboard} activeOpacity={0.7}>
          <View style={styles.flywheelLeft}>
            <Text style={styles.flywheelTitle}>Flywheel Dashboard</Text>
            <Text style={styles.flywheelDesc}>자동 DB 구축 현황 보기</Text>
          </View>
          <Text style={styles.flywheelArrow}>{'›'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
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
