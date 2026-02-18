/**
 * BuildingPin - 카메라 뷰 위에 표시되는 건물 이름 태그
 * - 건물명 + 거리(m) 표시
 * - 선택/미선택 상태에 따른 스타일 변경
 * - 입장 stagger 애니메이션 (index * 80ms)
 * - 선택 시 glow shadow 효과
 */

import React, { useRef, useEffect } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  View,
} from 'react-native';
import { COLORS, SPACING, ANIMATION, TOUCH } from '../constants/theme';
import { formatDistance } from '../utils/coordinate';

const BuildingPin = ({ building, isSelected = false, onPress, style, index = 0 }) => {
  // 선택 시 스케일 애니메이션 (1.2/0.85)
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const entranceAnim = useRef(new Animated.Value(0)).current;

  // 입장 stagger 애니메이션
  useEffect(() => {
    const delay = index * ANIMATION.stagger.normal;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.spring(entranceAnim, {
          toValue: 1,
          friction: 8,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: isSelected ? 1.2 : 0.85,
        friction: 8,
        tension: 100,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: isSelected ? 1 : 0.55,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isSelected, scaleAnim, opacityAnim]);

  if (!building) return null;

  const combinedScale = Animated.multiply(entranceAnim, scaleAnim);

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ scale: combinedScale }],
          opacity: Animated.multiply(entranceAnim, opacityAnim),
        },
        isSelected && styles.wrapperGlow,
        style,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.container,
          isSelected ? styles.containerSelected : styles.containerDefault,
        ]}
        onPress={() => onPress && onPress(building)}
        activeOpacity={0.7}
        hitSlop={TOUCH.hitSlop}
      >
        {/* 건물명 */}
        <Text
          style={[
            styles.name,
            isSelected && styles.nameSelected,
          ]}
          numberOfLines={1}
        >
          {building.name}
        </Text>

        {/* 거리 표시 */}
        <View style={[
          styles.distanceBadge,
          isSelected && styles.distanceBadgeSelected,
        ]}>
          <Text style={[
            styles.distanceText,
            isSelected && styles.distanceTextSelected,
          ]}>
            {formatDistance(building.distance)}
          </Text>
        </View>
      </TouchableOpacity>

      {/* 하단 꼬리표 삼각형 */}
      <View style={[
        styles.arrow,
        isSelected ? styles.arrowSelected : styles.arrowDefault,
      ]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  wrapperGlow: {
    shadowColor: COLORS.blue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },

  // 컨테이너 기본 스타일
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    gap: SPACING.xs + 2,
  },

  // 미선택 상태: 반투명 배경
  containerDefault: {
    backgroundColor: 'rgba(10, 14, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },

  // 선택 상태: 블루 하이라이트
  containerSelected: {
    backgroundColor: 'rgba(74, 144, 217, 0.85)',
    borderWidth: 1.5,
    borderColor: COLORS.blue,
  },

  // 건물명
  name: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    maxWidth: 120,
  },
  nameSelected: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // 거리 배지
  distanceBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 2,
    borderRadius: 8,
  },
  distanceBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  distanceTextSelected: {
    color: COLORS.textPrimary,
  },

  // 하단 화살표 (삼각형)
  arrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDefault: {
    borderTopColor: 'rgba(10, 14, 39, 0.7)',
  },
  arrowSelected: {
    borderTopColor: 'rgba(74, 144, 217, 0.85)',
  },
});

export default BuildingPin;
