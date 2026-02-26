/**
 * MinimapOverlay - 좌상단 구글 미니맵 (Static Maps API)
 * - 네이티브 SDK 없이 이미지 기반 지도
 * - 유저 위치 (파란점) + heading 방향 (삼각형 오버레이)
 * - 캡쳐: ViewShot으로 base64 → Gemini 건물명 추출용
 */
import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';
import { captureRef } from 'react-native-view-shot';

const MAP_SIZE = 140;
const MAP_ZOOM = 18; // 건물명이 보이는 줌 레벨
const API_KEY = 'AIzaSyCU4jTboGsuPzzSGE-BH-HbPorYLNoVGNE';

/**
 * Google Static Maps URL 생성
 */
function getStaticMapUrl(lat, lng) {
  // 2x 해상도로 선명하게
  return `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=${MAP_ZOOM}&size=${MAP_SIZE * 2}x${MAP_SIZE * 2}&scale=2&maptype=roadmap&style=feature:poi|visibility:on&markers=color:blue|size:small|${lat},${lng}&key=${API_KEY}`;
}

const MinimapOverlay = forwardRef(({
  latitude,
  longitude,
  heading = 0,
  visible = true,
}, ref) => {
  const viewRef = useRef(null);

  // 외부에서 캡쳐 호출 가능
  useImperativeHandle(ref, () => ({
    capture: async () => {
      if (!viewRef.current) return null;
      try {
        const uri = await captureRef(viewRef.current, {
          format: 'jpg',
          quality: 0.8,
          result: 'base64',
        });
        return uri;
      } catch (err) {
        console.warn('[Minimap] 캡쳐 실패:', err.message);
        return null;
      }
    },
  }));

  if (!visible || !latitude || !longitude) return null;

  const mapUrl = getStaticMapUrl(latitude, longitude);

  // heading 방향 삼각형 꼭짓점 (CSS transform 회전)
  const arrowRotation = heading;

  return (
    <View style={styles.container} ref={viewRef} collapsable={false}>
      {/* 구글 Static Map 이미지 */}
      <Image
        source={{ uri: mapUrl }}
        style={styles.map}
        resizeMode="cover"
      />

      {/* heading 방향 표시 (삼각형 오버레이) */}
      <View style={styles.headingOverlay} pointerEvents="none">
        <View
          style={[
            styles.headingArrow,
            { transform: [{ rotate: `${arrowRotation}deg` }] },
          ]}
        >
          {/* 시야각 삼각형 */}
          <View style={styles.fovTriangle} />
          {/* 중심 화살표 선 */}
          <View style={styles.arrowLine} />
        </View>
      </View>

      {/* 유저 위치 파란점 (중앙 고정) */}
      <View style={styles.userDotWrap} pointerEvents="none">
        <View style={styles.userDot}>
          <View style={styles.userDotInner} />
        </View>
      </View>
    </View>
  );
});

MinimapOverlay.displayName = 'MinimapOverlay';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 95,
    left: 12,
    width: MAP_SIZE,
    height: MAP_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    zIndex: 50,
    elevation: 10,
    backgroundColor: '#1a1a2e',
  },
  map: {
    width: MAP_SIZE,
    height: MAP_SIZE,
  },
  // heading 방향 오버레이
  headingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headingArrow: {
    width: MAP_SIZE,
    height: MAP_SIZE,
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  fovTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 24,
    borderRightWidth: 24,
    borderBottomWidth: MAP_SIZE / 2 - 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'rgba(66, 133, 244, 0.2)',
    marginTop: 2,
  },
  arrowLine: {
    position: 'absolute',
    top: 2,
    width: 2,
    height: MAP_SIZE / 2 - 10,
    backgroundColor: 'rgba(66, 133, 244, 0.5)',
    alignSelf: 'center',
  },
  // 유저 위치 (중앙 고정)
  userDotWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(66, 133, 244, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4285F4',
    borderWidth: 2,
    borderColor: '#FFF',
  },
});

export default MinimapOverlay;
