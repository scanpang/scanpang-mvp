/**
 * RewardButton - "포인트 받기" 버튼
 * - 오렌지 그라데이션 배경
 * - 탭 시 "+50P" 플로팅 애니메이션
 * - disabled 상태 (하루 한도 도달 시)
 */

import React, { useRef, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Animated,
} from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

const RewardButton = ({ points = 50, onPress, disabled = false }) => {
  // 플로팅 텍스트 애니메이션 값
  const floatAnim = useRef(new Animated.Value(0)).current;
  const floatOpacity = useRef(new Animated.Value(0)).current;
  const [showFloat, setShowFloat] = useState(false);

  // 버튼 스케일 애니메이션
  const scaleAnim = useRef(new Animated.Value(1)).current;

  /**
   * 버튼 탭 핸들러
   * - 스케일 바운스 + 플로팅 텍스트 애니메이션 실행
   */
  const handlePress = () => {
    if (disabled) return;

    // 플로팅 텍스트 표시
    setShowFloat(true);
    floatAnim.setValue(0);
    floatOpacity.setValue(1);

    // 버튼 바운스 애니메이션
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();

    // 플로팅 텍스트: 위로 올라가며 사라짐
    Animated.parallel([
      Animated.timing(floatAnim, {
        toValue: -60,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(floatOpacity, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowFloat(false);
    });

    // 콜백 호출
    onPress && onPress();
  };

  return (
    <View style={styles.wrapper}>
      {/* 플로팅 "+50P" 텍스트 */}
      {showFloat && (
        <Animated.Text
          style={[
            styles.floatingText,
            {
              transform: [{ translateY: floatAnim }],
              opacity: floatOpacity,
            },
          ]}
        >
          +{points}P
        </Animated.Text>
      )}

      {/* 메인 버튼 */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={[
            styles.button,
            disabled && styles.buttonDisabled,
          ]}
          onPress={handlePress}
          activeOpacity={disabled ? 1 : 0.8}
          disabled={disabled}
        >
          {/* 오렌지 그라데이션 효과 (레이어 조합) */}
          <View style={[
            styles.gradientLayer,
            disabled && styles.gradientLayerDisabled,
          ]} />

          {/* 버튼 텍스트 */}
          <Text style={[
            styles.buttonText,
            disabled && styles.buttonTextDisabled,
          ]}>
            {disabled ? '오늘 한도 도달' : `▶ 포인트 받기 (+${points}P)`}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    position: 'relative',
  },

  // 플로팅 텍스트
  floatingText: {
    position: 'absolute',
    top: -10,
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.orange,
    zIndex: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // 버튼 컨테이너
  button: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md + 2,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 오렌지 그라데이션 레이어 (상단 밝은 오렌지 → 하단 진한 오렌지)
  gradientLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.orange,
    opacity: 0.9,
  },

  // disabled 상태 그라데이션
  gradientLayerDisabled: {
    backgroundColor: '#555',
    opacity: 0.5,
  },

  buttonDisabled: {
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },

  // 버튼 텍스트
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    zIndex: 1,
    letterSpacing: 0.3,
  },

  buttonTextDisabled: {
    color: COLORS.textMuted,
  },
});

export default RewardButton;
