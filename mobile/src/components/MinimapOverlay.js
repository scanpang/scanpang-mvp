/**
 * MinimapOverlay - 좌상단 구글 미니맵
 * - 유저 위치 (파란점) + heading 방향 (시야각 삼각형)
 * - takeSnapshot()으로 캡쳐 → Gemini 건물명 추출용
 * - UI에 항상 표시
 */
import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';

const MAP_SIZE = 120;
const ZOOM_DELTA = 0.002; // 약 200m 범위

/**
 * heading 방향으로 시야각(FOV) 삼각형 좌표 계산
 * @param {number} lat - 유저 위도
 * @param {number} lng - 유저 경도
 * @param {number} heading - 방위각 (0=북)
 * @param {number} fov - 시야각 (도)
 * @param {number} distance - 삼각형 길이 (위도 단위)
 */
function computeFovTriangle(lat, lng, heading, fov = 60, distance = 0.001) {
  const toRad = d => d * Math.PI / 180;
  const leftAngle = toRad(heading - fov / 2);
  const rightAngle = toRad(heading + fov / 2);
  // 경도 보정 (위도에 따른 경도 길이 차이)
  const lngRatio = 1 / Math.cos(toRad(lat));

  return [
    { latitude: lat, longitude: lng }, // 유저 위치
    {
      latitude: lat + distance * Math.cos(leftAngle),
      longitude: lng + distance * Math.sin(leftAngle) * lngRatio,
    },
    {
      latitude: lat + distance * Math.cos(rightAngle),
      longitude: lng + distance * Math.sin(rightAngle) * lngRatio,
    },
  ];
}

const MinimapOverlay = forwardRef(({
  latitude,
  longitude,
  heading = 0,
  visible = true,
}, ref) => {
  const mapRef = useRef(null);

  // 외부에서 캡쳐 호출 가능
  useImperativeHandle(ref, () => ({
    capture: async () => {
      if (!mapRef.current) return null;
      try {
        const snapshot = await mapRef.current.takeSnapshot({
          format: 'jpg',
          quality: 0.8,
          result: 'base64',
        });
        return snapshot;
      } catch (err) {
        console.warn('[Minimap] 캡쳐 실패:', err.message);
        return null;
      }
    },
  }));

  // 위치 변경 시 지도 이동
  useEffect(() => {
    if (mapRef.current && latitude && longitude) {
      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: ZOOM_DELTA,
        longitudeDelta: ZOOM_DELTA,
      }, 300);
    }
  }, [latitude, longitude]);

  if (!visible || !latitude || !longitude) return null;

  const fovTriangle = computeFovTriangle(latitude, longitude, heading);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude,
          longitude,
          latitudeDelta: ZOOM_DELTA,
          longitudeDelta: ZOOM_DELTA,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsIndoors={false}
        toolbarEnabled={false}
        zoomEnabled={false}
        scrollEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        liteMode={false}
        mapType="normal"
      >
        {/* 시야각 삼각형 (반투명 파랑) */}
        <Polygon
          coordinates={fovTriangle}
          fillColor="rgba(66, 133, 244, 0.25)"
          strokeColor="rgba(66, 133, 244, 0.6)"
          strokeWidth={1}
        />

        {/* 유저 위치 파란점 */}
        <Marker
          coordinate={{ latitude, longitude }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.userDot}>
            <View style={styles.userDotInner} />
          </View>
        </Marker>
      </MapView>
    </View>
  );
});

MinimapOverlay.displayName = 'MinimapOverlay';

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 95, // HUD 아래
    left: 12,
    width: MAP_SIZE,
    height: MAP_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 50,
    elevation: 10,
  },
  map: {
    width: MAP_SIZE,
    height: MAP_SIZE,
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
