/**
 * useBearingProjection - VPS + heading → 건물 스크린 좌표 투영 훅
 *
 * 별자리 앱과 같은 원리:
 * 1. VPS geoPose로 내 정밀 위치(lat/lng) + heading 확보
 * 2. 각 건물까지의 bearing 계산 (Haversine 방위각)
 * 3. heading과 bearing 차이 → FOV 내 스크린 X 위치
 * 4. 거리 기반 → 스크린 Y 위치
 *
 * @param {Object} options
 * @param {Object} options.geoPose - { latitude, longitude, heading }
 * @param {Array} options.buildings - detect API 건물 배열
 * @param {number} options.fov - 카메라 수평 FOV (도, 기본 60)
 * @param {number} options.maxDistance - 표시 최대 거리 (미터, 기본 200)
 * @returns {Array} projectedBuildings - { id, name, screenX, screenY, distance, bearing, angleDiff, inFOV }
 */
import { useMemo } from 'react';
import { Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * 두 좌표 간 bearing 계산 (도)
 * 반환: 0~360 (북=0, 동=90, 남=180, 서=270)
 */
const computeBearing = (lat1, lng1, lat2, lng2) => {
  const dLng = (lng2 - lng1) * DEG2RAD;
  const uLat = lat1 * DEG2RAD;
  const bLat = lat2 * DEG2RAD;

  const x = Math.sin(dLng) * Math.cos(bLat);
  const y = Math.cos(uLat) * Math.sin(bLat) - Math.sin(uLat) * Math.cos(bLat) * Math.cos(dLng);
  const bearing = Math.atan2(x, y) * RAD2DEG;
  return (bearing + 360) % 360;
};

/**
 * 각도 차이를 -180 ~ +180 범위로 정규화
 */
const normalizeAngleDiff = (diff) => {
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
};

/**
 * 거리 기반 Y 좌표 계산
 * 가까운 건물: 화면 중앙~하단 (건물이 눈높이)
 * 먼 건물: 화면 상단 (수평선 가까이)
 *
 * Y 범위: HUD 아래 ~ 화면 60% 사이
 */
const computeScreenY = (distance, maxDistance) => {
  // 거리 비율 (0=가까움, 1=멀리)
  const ratio = Math.min(distance / maxDistance, 1);
  // 가까울수록 아래, 멀수록 위
  const minY = SH * 0.15; // HUD 아래
  const maxY = SH * 0.55; // 화면 중간
  return minY + (1 - ratio) * (maxY - minY);
};

const useBearingProjection = ({
  geoPose = null,
  buildings = [],
  fov = 60,
  maxDistance = 200,
} = {}) => {

  const projectedBuildings = useMemo(() => {
    if (!geoPose || !buildings.length) return [];

    const { latitude: uLat, longitude: uLng, heading } = geoPose;
    if (uLat == null || uLng == null || heading == null) return [];

    const halfFov = fov / 2;
    // 확장 FOV: 화면 가장자리 힌트용 (FOV + 30도)
    const extendedHalfFov = halfFov + 15;

    return buildings
      .filter(b => {
        const bLat = b.lat || b.latitude;
        const bLng = b.lng || b.longitude;
        return bLat && bLng && b.distance != null && b.distance <= maxDistance;
      })
      .map(b => {
        const bLat = b.lat || b.latitude;
        const bLng = b.lng || b.longitude;

        // bearing 계산
        const bearing = computeBearing(uLat, uLng, bLat, bLng);
        // heading과의 각도 차이 (-180 ~ +180)
        const angleDiff = normalizeAngleDiff(bearing - heading);

        // FOV 내 여부
        const inFOV = Math.abs(angleDiff) <= halfFov;
        // 확장 FOV 내 여부 (가장자리 힌트)
        const inExtendedFOV = Math.abs(angleDiff) <= extendedHalfFov;

        if (!inExtendedFOV) return null;

        // 스크린 X: 각도 비율 → 화면 폭
        const screenX = SW / 2 + (angleDiff / halfFov) * (SW / 2);
        // 스크린 Y: 거리 기반
        const screenY = computeScreenY(b.distance, maxDistance);

        return {
          id: b.id,
          name: b.name || b.address || '건물',
          distance: b.distance,
          bearing,
          angleDiff,
          screenX: Math.round(screenX),
          screenY: Math.round(screenY),
          inFOV,
          // 화면 밖 방향 힌트 (FOV 밖이면 왼쪽/오른쪽 표시)
          edgeHint: !inFOV ? (angleDiff < 0 ? 'left' : 'right') : null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance);
  }, [geoPose?.latitude, geoPose?.longitude, geoPose?.heading, buildings, fov, maxDistance]);

  return projectedBuildings;
};

export default useBearingProjection;
