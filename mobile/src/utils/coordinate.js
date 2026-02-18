/**
 * ScanPang 좌표 계산 유틸리티
 * - GPS 좌표 기반 거리, 방위각, 방향 판별 함수
 */

/**
 * Haversine 공식을 이용한 두 좌표 사이의 거리 계산
 * @param {number} lat1 - 시작점 위도
 * @param {number} lng1 - 시작점 경도
 * @param {number} lat2 - 끝점 위도
 * @param {number} lng2 - 끝점 경도
 * @returns {number} 두 좌표 사이의 거리 (미터)
 */
export const calculateDistance = (lat1, lng1, lat2, lng2) => {
  // 지구 반지름 (미터)
  const R = 6371000;

  // 위도/경도를 라디안으로 변환
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);

  // Haversine 공식 적용
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // 거리 계산 (미터)
  const distance = R * c;

  return Math.round(distance);
};

/**
 * 두 좌표 사이의 방위각(bearing) 계산
 * - 북쪽을 0도 기준으로 시계 방향 0~360도 범위
 * @param {number} lat1 - 시작점 위도
 * @param {number} lng1 - 시작점 경도
 * @param {number} lat2 - 목적지 위도
 * @param {number} lng2 - 목적지 경도
 * @returns {number} 방위각 (0~360도)
 */
export const calculateBearing = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const radLat1 = toRad(lat1);
  const radLat2 = toRad(lat2);
  const dLng = toRad(lng2 - lng1);

  // 방위각 계산
  const y = Math.sin(dLng) * Math.cos(radLat2);
  const x =
    Math.cos(radLat1) * Math.sin(radLat2) -
    Math.sin(radLat1) * Math.cos(radLat2) * Math.cos(dLng);

  let bearing = toDeg(Math.atan2(y, x));

  // 0~360 범위로 정규화
  bearing = (bearing + 360) % 360;

  return Math.round(bearing * 10) / 10;
};

/**
 * 사용자가 바라보는 방향(heading)과 건물 방위각(bearing)을 비교하여
 * 건물이 왼쪽/오른쪽/정면 중 어디에 있는지 판별
 * @param {number} userHeading - 사용자가 바라보는 방향 (0~360도, 기기 컴파스 값)
 * @param {number} bearing - 건물까지의 방위각 (0~360도)
 * @returns {'left' | 'right' | 'front'} 건물의 상대적 방향
 */
export const getDirection = (userHeading, bearing) => {
  // 사용자 시야 기준 상대 각도 계산
  // 양수 = 시계 방향(오른쪽), 음수 = 반시계 방향(왼쪽)
  let diff = bearing - userHeading;

  // -180 ~ 180 범위로 정규화
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  // 정면 판정 범위: -30도 ~ +30도
  const FRONT_THRESHOLD = 30;

  if (Math.abs(diff) <= FRONT_THRESHOLD) {
    return 'front';
  } else if (diff > 0) {
    return 'right';
  } else {
    return 'left';
  }
};

/**
 * 방향 텍스트를 한국어로 변환
 * @param {'left' | 'right' | 'front'} direction - 영문 방향
 * @returns {string} 한국어 방향 텍스트
 */
export const getDirectionLabel = (direction) => {
  const labels = {
    left: '좌측',
    right: '우측',
    front: '정면',
  };
  return labels[direction] || direction;
};

/**
 * 거리를 사람이 읽기 쉬운 형식으로 변환
 * @param {number} meters - 거리 (미터)
 * @returns {string} 포맷된 거리 문자열
 */
export const formatDistance = (meters) => {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
};

export default {
  calculateDistance,
  calculateBearing,
  getDirection,
  getDirectionLabel,
  formatDistance,
};
