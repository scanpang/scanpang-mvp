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

import { Colors, SPACING } from '../constants/theme';
import { DUMMY_POINTS } from '../constants/dummyData';
import useNearbyBuildings from '../hooks/useNearbyBuildings';

import StatusCard from '../components/home/StatusCard';
import ScanStartCard from '../components/home/ScanStartCard';
import NearbyBuildings from '../components/home/NearbyBuildings';
import RecentActivity from '../components/home/RecentActivity';

const HomeScreen = ({ navigation }) => {
  const [userLocation, setUserLocation] = useState(null);

  // 위치 가져오기 (홈에서 미리)
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch {}
    })();
  }, []);

  const { buildings, loading } = useNearbyBuildings({
    latitude: userLocation?.lat,
    longitude: userLocation?.lng,
    heading: 0,
    radius: 500,
    enabled: !!userLocation,
  });

  const handleStartScan = () => {
    navigation.navigate('ScanCamera');
  };

  const handleBuildingPress = (building) => {
    navigation.navigate('ScanCamera', { focusBuildingId: building.id });
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
        />

        {/* 스캔 시작 CTA */}
        <ScanStartCard onPress={handleStartScan} />

        {/* 주변 건물 미리보기 */}
        <NearbyBuildings
          buildings={buildings}
          loading={loading}
          onBuildingPress={handleBuildingPress}
        />

        {/* 최근 활동 */}
        <RecentActivity onScanPress={handleStartScan} />
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
});

export default HomeScreen;
