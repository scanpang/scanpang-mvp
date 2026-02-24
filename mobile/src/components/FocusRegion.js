/**
 * FocusRegion - 포커스 영역 코너 라인 UI
 *
 * 화면 중앙 60%x50% 영역에 코너 라인 4개 표시
 * 건물 감지 시 흰 → 초록 색상 전환 + 펄스 애니메이션
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// 포커스 영역 (정규화 좌표와 동일)
const FOCUS = {
  x: 0.2,
  y: 0.25,
  width: 0.6,
  height: 0.5,
};

const CORNER_SIZE = 20;  // 코너 라인 길이
const CORNER_WIDTH = 3;  // 코너 라인 두께

const FocusRegion = ({ detected = false, visible = true }) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 감지 시 펄스 애니메이션
  useEffect(() => {
    if (detected) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [detected]);

  if (!visible) return null;

  const color = detected ? '#00E676' : 'rgba(255, 255, 255, 0.6)';
  const left = SW * FOCUS.x;
  const top = SH * FOCUS.y;
  const width = SW * FOCUS.width;
  const height = SH * FOCUS.height;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          left, top, width, height,
          transform: [{ scale: pulseAnim }],
        },
      ]}
      pointerEvents="none"
    >
      {/* 좌상단 */}
      <View style={[styles.cornerTL, { borderColor: color }]} />
      {/* 우상단 */}
      <View style={[styles.cornerTR, { borderColor: color }]} />
      {/* 좌하단 */}
      <View style={[styles.cornerBL, { borderColor: color }]} />
      {/* 우하단 */}
      <View style={[styles.cornerBR, { borderColor: color }]} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 5,
  },
  cornerTL: {
    position: 'absolute',
    top: 0, left: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 4,
  },
  cornerTR: {
    position: 'absolute',
    top: 0, right: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 4,
  },
  cornerBL: {
    position: 'absolute',
    bottom: 0, left: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 4,
  },
  cornerBR: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: CORNER_SIZE, height: CORNER_SIZE,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 4,
  },
});

export default FocusRegion;
