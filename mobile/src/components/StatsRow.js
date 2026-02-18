/**
 * StatsRow - 건물 지표를 원형/카드 형태로 가로 배열
 * - 4개 지표: 총층수, 입주율, 테넌트수, 영업중
 * - 각 지표: 아이콘 + 숫자 + 라벨
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

/**
 * 지표 타입별 기본 설정
 */
const STAT_CONFIG = {
  totalFloors: { icon: '🏢', label: '총층수', suffix: 'F' },
  occupancyRate: { icon: '📊', label: '입주율', suffix: '%' },
  tenantCount: { icon: '🏬', label: '테넌트', suffix: '' },
  openNow: { icon: '🟢', label: '영업중', suffix: '' },
};

/**
 * 개별 지표 아이템
 */
const StatItem = ({ icon, value, label, suffix = '' }) => (
  <View style={styles.item}>
    {/* 원형 아이콘 배경 */}
    <View style={styles.iconCircle}>
      <Text style={styles.icon}>{icon}</Text>
    </View>

    {/* 숫자 값 */}
    <Text style={styles.value}>
      {typeof value === 'number' ? value.toLocaleString() : value}
      {suffix}
    </Text>

    {/* 라벨 */}
    <Text style={styles.label}>{label}</Text>
  </View>
);

const StatsRow = ({ stats }) => {
  if (!stats) return null;

  // stats 배열 또는 객체 형태 모두 지원
  const statItems = Array.isArray(stats)
    ? stats
    : [
        {
          icon: STAT_CONFIG.totalFloors.icon,
          value: stats.totalFloors || 0,
          label: STAT_CONFIG.totalFloors.label,
          suffix: STAT_CONFIG.totalFloors.suffix,
        },
        {
          icon: STAT_CONFIG.occupancyRate.icon,
          value: stats.occupancyRate || 0,
          label: STAT_CONFIG.occupancyRate.label,
          suffix: STAT_CONFIG.occupancyRate.suffix,
        },
        {
          icon: STAT_CONFIG.tenantCount.icon,
          value: stats.tenantCount || 0,
          label: STAT_CONFIG.tenantCount.label,
          suffix: STAT_CONFIG.tenantCount.suffix,
        },
        {
          icon: STAT_CONFIG.openNow.icon,
          value: stats.openNow || 0,
          label: STAT_CONFIG.openNow.label,
          suffix: STAT_CONFIG.openNow.suffix,
        },
      ];

  return (
    <View style={styles.container}>
      {statItems.map((stat, index) => (
        <React.Fragment key={index}>
          <StatItem
            icon={stat.icon}
            value={stat.value}
            label={stat.label}
            suffix={stat.suffix}
          />
          {/* 마지막 아이템 뒤에는 구분선 없음 */}
          {index < statItems.length - 1 && (
            <View style={styles.divider} />
          )}
        </React.Fragment>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  // 개별 아이템
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },

  // 원형 아이콘 배경
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  icon: {
    fontSize: 14,
  },

  // 숫자 값
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // 라벨
  label: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textMuted,
  },

  // 구분선
  divider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
});

export default StatsRow;
