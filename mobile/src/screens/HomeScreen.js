/**
 * HomeScreen - 모드 선택 화면
 * - 사용자가 "일반 모드" 또는 "투시 모드"를 선택하는 메인 화면
 * - 다크 테마 기반 카드 UI
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, CARD_STYLE, SHADOW } from '../constants/theme';
import { DUMMY_POINTS } from '../constants/dummyData';

const HomeScreen = ({ navigation }) => {
  // 스캔 모드 선택 후 ScanScreen으로 이동
  const handleModeSelect = (mode) => {
    navigation.navigate('Scan', { mode });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* 상단 헤더 */}
      <View style={styles.header}>
        <Text style={styles.logo}>ScanPang</Text>
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsIcon}>P</Text>
          <Text style={styles.pointsText}>{DUMMY_POINTS.totalPoints.toLocaleString()}</Text>
        </View>
      </View>

      {/* 환영 메시지 */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeTitle}>건물을 스캔하세요</Text>
        <Text style={styles.welcomeSubtitle}>
          카메라를 건물에 비추면{'\n'}내부 정보를 확인할 수 있습니다
        </Text>
      </View>

      {/* 모드 선택 카드 */}
      <View style={styles.modeSection}>
        {/* 일반 모드 카드 */}
        <TouchableOpacity
          style={styles.modeCard}
          onPress={() => handleModeSelect('normal')}
          activeOpacity={0.7}
        >
          <View style={[styles.modeIconContainer, { backgroundColor: 'rgba(74,144,217,0.15)' }]}>
            <Text style={[styles.modeIcon, { color: COLORS.blue }]}>📷</Text>
          </View>
          <Text style={styles.modeTitle}>일반 모드</Text>
          <Text style={styles.modeDescription}>
            건물을 스캔하여 기본 정보를{'\n'}확인합니다
          </Text>
          <View style={[styles.modeTag, { backgroundColor: 'rgba(74,144,217,0.15)' }]}>
            <Text style={[styles.modeTagText, { color: COLORS.blue }]}>기본</Text>
          </View>
        </TouchableOpacity>

        {/* 투시 모드 카드 */}
        <TouchableOpacity
          style={styles.modeCard}
          onPress={() => handleModeSelect('xray')}
          activeOpacity={0.7}
        >
          <View style={[styles.modeIconContainer, { backgroundColor: 'rgba(255,140,0,0.15)' }]}>
            <Text style={[styles.modeIcon, { color: COLORS.orange }]}>🔍</Text>
          </View>
          <Text style={styles.modeTitle}>투시 모드</Text>
          <Text style={styles.modeDescription}>
            건물 내부 층별 상세 정보를{'\n'}AR로 확인합니다
          </Text>
          <View style={[styles.modeTag, { backgroundColor: 'rgba(255,140,0,0.15)' }]}>
            <Text style={[styles.modeTagText, { color: COLORS.orange }]}>프리미엄</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 오늘의 통계 */}
      <View style={styles.statsSection}>
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{DUMMY_POINTS.scanCount}</Text>
              <Text style={styles.statsLabel}>오늘 스캔</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{DUMMY_POINTS.todayEarned}</Text>
              <Text style={styles.statsLabel}>획득 포인트</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{DUMMY_POINTS.dailyLimit - DUMMY_POINTS.todayEarned}</Text>
              <Text style={styles.statsLabel}>남은 한도</Text>
            </View>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // 헤더 영역
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  logo: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,140,0,0.15)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: 20,
  },
  pointsIcon: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.orange,
    marginRight: SPACING.xs,
  },
  pointsText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.orange,
  },
  // 환영 메시지
  welcomeSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxl,
    paddingBottom: SPACING.lg,
  },
  welcomeTitle: {
    ...TYPOGRAPHY.h1,
    marginBottom: SPACING.sm,
  },
  welcomeSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    lineHeight: 24,
  },
  // 모드 선택 카드
  modeSection: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.md,
  },
  modeCard: {
    flex: 1,
    ...CARD_STYLE,
    padding: SPACING.lg,
    ...SHADOW.medium,
  },
  modeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modeIcon: {
    fontSize: 24,
  },
  modeTitle: {
    ...TYPOGRAPHY.h3,
    marginBottom: SPACING.xs,
  },
  modeDescription: {
    ...TYPOGRAPHY.bodySmall,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  modeTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  modeTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // 오늘의 통계
  statsSection: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    marginTop: 'auto',
    paddingBottom: SPACING.xxl,
  },
  statsCard: {
    ...CARD_STYLE,
    padding: SPACING.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  statsLabel: {
    ...TYPOGRAPHY.caption,
  },
  statsDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
});

export default HomeScreen;
