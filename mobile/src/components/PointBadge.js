/**
 * PointBadge - 포인트 표시 뱃지
 * - 별 아이콘 + 숫자 표시
 * - 포인트 증가 시 스케일 애니메이션 (300ms, scale 1.4)
 * - "+N" 플로팅 텍스트 애니메이션
 * - size: 'small' (상단바용) | 'large' (홈화면용)
 */

import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

/**
 * 플로팅 "+N" 텍스트 애니메이션
 */
const FloatingText = ({ amount, onComplete }) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -30,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => onComplete && onComplete());
  }, []);

  return (
    <Animated.Text
      style={[
        styles.floatingText,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      +{amount}
    </Animated.Text>
  );
};

const PointBadge = ({ points = 0, size = 'small' }) => {
  // 포인트 변경 시 스케일 애니메이션
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const prevPoints = useRef(points);
  const [floatingAmount, setFloatingAmount] = useState(null);

  useEffect(() => {
    // 포인트가 증가했을 때만 애니메이션 실행
    if (points > prevPoints.current) {
      const diff = points - prevPoints.current;
      setFloatingAmount(diff);

      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.4,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 120,
          useNativeDriver: true,
        }),
      ]).start();
    }
    prevPoints.current = points;
  }, [points, scaleAnim]);

  const isLarge = size === 'large';

  return (
    <View style={styles.outerWrapper}>
      {/* 플로팅 "+N" 텍스트 */}
      {floatingAmount !== null && (
        <FloatingText
          amount={floatingAmount}
          onComplete={() => setFloatingAmount(null)}
        />
      )}

      <Animated.View
        style={[
          styles.container,
          isLarge ? styles.containerLarge : styles.containerSmall,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* 별 아이콘 (유니코드) */}
        <Text style={[
          styles.icon,
          isLarge ? styles.iconLarge : styles.iconSmall,
        ]}>
          ★
        </Text>

        {/* 포인트 숫자 */}
        <Text style={[
          styles.points,
          isLarge ? styles.pointsLarge : styles.pointsSmall,
        ]}>
          {points.toLocaleString()}
        </Text>

        {/* 'P' 라벨 */}
        <Text style={[
          styles.label,
          isLarge ? styles.labelLarge : styles.labelSmall,
        ]}>
          P
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'relative',
  },

  floatingText: {
    position: 'absolute',
    top: -8,
    right: 0,
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.orange,
    zIndex: 10,
  },

  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
  },

  // small 사이즈 (상단바)
  containerSmall: {
    backgroundColor: 'rgba(255, 140, 0, 0.15)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    gap: 3,
  },

  // large 사이즈 (홈화면)
  containerLarge: {
    backgroundColor: 'rgba(255, 140, 0, 0.2)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    gap: SPACING.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.3)',
  },

  // 별 아이콘
  icon: {
    color: COLORS.orange,
  },
  iconSmall: {
    fontSize: 12,
  },
  iconLarge: {
    fontSize: 20,
  },

  // 포인트 숫자
  points: {
    fontWeight: '700',
    color: COLORS.orange,
  },
  pointsSmall: {
    fontSize: 13,
  },
  pointsLarge: {
    fontSize: 24,
  },

  // P 라벨
  label: {
    fontWeight: '600',
    color: COLORS.orange,
  },
  labelSmall: {
    fontSize: 11,
  },
  labelLarge: {
    fontSize: 16,
  },
});

export default PointBadge;
