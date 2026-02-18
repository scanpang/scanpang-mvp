/**
 * ScanStartCard - 스캔 시작 CTA 카드
 * - 좌측 파란색 accent bar
 * - 카메라 아이콘 + 스캔 시작하기 + 설명
 * - 우하단: "시작 →"
 * - press scale(0.98) 애니메이션
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Colors, CardShadow, SPACING } from '../../constants/theme';

const ScanStartCard = ({ onPress }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.98, friction: 8, tension: 100, useNativeDriver: true }).start();
  };
  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 100, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
      >
        {/* 좌측 파란 accent bar */}
        <View style={styles.accentBar} />

        <View style={styles.content}>
          <View style={styles.topRow}>
            {/* 카메라 아이콘 */}
            <View style={styles.iconContainer}>
              <Text style={styles.iconText}>SCAN</Text>
            </View>
          </View>

          <Text style={styles.title}>스캔 시작하기</Text>
          <Text style={styles.description}>
            카메라를 건물에 비추면 내부 정보까지{'\n'}한번에 확인할 수 있어요
          </Text>

          <Text style={styles.startBtn}>시작 →</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: SPACING.xl, marginTop: SPACING.lg },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.bgWhite,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...CardShadow,
  },
  accentBar: {
    width: 4,
    backgroundColor: Colors.primaryBlue,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  topRow: { marginBottom: SPACING.md },
  iconContainer: {
    width: 40, height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryBlueLight,
    justifyContent: 'center', alignItems: 'center',
  },
  iconText: {
    fontSize: 10, fontWeight: '900', color: Colors.primaryBlue, letterSpacing: 0.5,
  },
  title: {
    fontSize: 18, fontWeight: '700', color: Colors.textPrimary, marginBottom: SPACING.xs,
  },
  description: {
    fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: SPACING.md,
  },
  startBtn: {
    alignSelf: 'flex-end',
    fontSize: 15, fontWeight: '700', color: Colors.primaryBlue,
  },
});

export default ScanStartCard;
