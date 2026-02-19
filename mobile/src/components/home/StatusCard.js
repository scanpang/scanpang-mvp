/**
 * StatusCard - 블루 그라데이션 인사 + 현황 카드
 * - GPS 기반 위치명
 * - 시간대별 인사
 * - 주변 건물 수
 * - 3칸 스탯 (오늘 스캔, 획득 포인트, 남은 한도)
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, SPACING } from '../../constants/theme';
import { getGreeting } from '../../utils/greeting';

const StatusCard = ({ nearbyCount = 0, stats, locationName }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const limitProgress = stats ? stats.todayEarned / stats.dailyLimit : 0;

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.gradient}>
        <Text style={styles.location}>{locationName || '내 주변'}</Text>
        <Text style={styles.greeting}>{getGreeting()}</Text>
        <Text style={styles.subtitle}>
          주변에 스캔 가능한 건물 {nearbyCount}개
        </Text>

        {/* 3칸 스탯 */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.scanCount}</Text>
              <Text style={styles.statLabel}>오늘 스캔</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.todayEarned}</Text>
              <Text style={styles.statLabel}>획득 포인트</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{stats.todayEarned}/{stats.dailyLimit}</Text>
              <Text style={styles.statLabel}>남은 한도</Text>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${Math.min(limitProgress * 100, 100)}%` }]} />
              </View>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACING.xl, marginTop: SPACING.lg },
  gradient: {
    backgroundColor: Colors.bgBlueGradientStart,
    borderRadius: 20,
    padding: SPACING.xl,
  },
  location: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: SPACING.xs },
  greeting: { fontSize: 22, fontWeight: '700', color: Colors.textWhite, marginBottom: SPACING.xs },
  subtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginBottom: SPACING.lg },
  statsRow: { flexDirection: 'row', gap: SPACING.sm },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: SPACING.md,
    alignItems: 'center',
  },
  statValue: { fontSize: 18, fontWeight: '700', color: Colors.textWhite, marginBottom: 2 },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  progressBg: {
    width: '100%', height: 3, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: SPACING.xs,
  },
  progressFill: {
    height: 3, borderRadius: 2,
    backgroundColor: Colors.textWhite,
  },
});

export default StatusCard;
