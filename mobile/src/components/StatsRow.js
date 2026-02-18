/**
 * StatsRow - 건물 지표를 원형/카드 형태로 가로 배열
 * - 이모지 → 스타일드 텍스트 아이콘
 * - 숫자 카운트업 애니메이션 (800ms ease-out)
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

/**
 * 지표 타입별 기본 설정 (텍스트 아이콘 + 색상)
 */
const STAT_CONFIG = {
  totalFloors: { icon: 'B', color: '#4A90D9', label: '총층수', suffix: 'F' },
  occupancyRate: { icon: '%', color: '#4CAF50', label: '입주율', suffix: '%' },
  tenantCount: { icon: 'T', color: '#FF9800', label: '테넌트', suffix: '' },
  openNow: { icon: 'ON', color: '#00C853', label: '영업중', suffix: '' },
};

/**
 * 카운트업 애니메이션 훅
 */
const useCountUp = (targetValue, duration = 800) => {
  const animValue = useRef(new Animated.Value(0)).current;
  const displayValue = useRef(0);
  const textRef = useRef(null);

  useEffect(() => {
    animValue.setValue(0);
    Animated.timing(animValue, {
      toValue: targetValue,
      duration,
      useNativeDriver: false,
    }).start();
  }, [targetValue]);

  return animValue;
};

/**
 * 개별 지표 아이템 (카운트업 애니메이션 포함)
 */
const StatItem = ({ icon, iconColor, value, label, suffix = '' }) => {
  const animatedValue = useCountUp(typeof value === 'number' ? value : 0);

  return (
    <View style={styles.item}>
      {/* 원형 아이콘 배경 */}
      <View style={[styles.iconCircle, { backgroundColor: `${iconColor}15` }]}>
        <Text style={[styles.icon, { color: iconColor }]}>{icon}</Text>
      </View>

      {/* 숫자 값 (카운트업 애니메이션) */}
      {typeof value === 'number' ? (
        <AnimatedNumber value={animatedValue} suffix={suffix} />
      ) : (
        <Text style={styles.value}>{value}{suffix}</Text>
      )}

      {/* 라벨 */}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

/**
 * 애니메이션 숫자 표시 컴포넌트
 */
class AnimatedNumber extends React.Component {
  constructor(props) {
    super(props);
    this.state = { display: '0' };
  }

  componentDidMount() {
    this._listenerId = this.props.value.addListener(({ value }) => {
      this.setState({ display: Math.round(value).toLocaleString() });
    });
  }

  componentWillUnmount() {
    this.props.value.removeListener(this._listenerId);
  }

  render() {
    return (
      <Text style={styles.value}>
        {this.state.display}{this.props.suffix}
      </Text>
    );
  }
}

const StatsRow = ({ stats }) => {
  if (!stats) return null;

  // stats 배열 또는 객체 형태 모두 지원
  const statItems = Array.isArray(stats)
    ? stats
    : [
        {
          icon: STAT_CONFIG.totalFloors.icon,
          iconColor: STAT_CONFIG.totalFloors.color,
          value: stats.totalFloors || 0,
          label: STAT_CONFIG.totalFloors.label,
          suffix: STAT_CONFIG.totalFloors.suffix,
        },
        {
          icon: STAT_CONFIG.occupancyRate.icon,
          iconColor: STAT_CONFIG.occupancyRate.color,
          value: stats.occupancyRate || 0,
          label: STAT_CONFIG.occupancyRate.label,
          suffix: STAT_CONFIG.occupancyRate.suffix,
        },
        {
          icon: STAT_CONFIG.tenantCount.icon,
          iconColor: STAT_CONFIG.tenantCount.color,
          value: stats.tenantCount || 0,
          label: STAT_CONFIG.tenantCount.label,
          suffix: STAT_CONFIG.tenantCount.suffix,
        },
        {
          icon: STAT_CONFIG.openNow.icon,
          iconColor: STAT_CONFIG.openNow.color,
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
            iconColor={stat.iconColor || COLORS.blue}
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
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  icon: {
    fontSize: 12,
    fontWeight: '800',
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
