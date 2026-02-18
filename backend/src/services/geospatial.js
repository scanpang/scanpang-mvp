/**
 * 좌표 기반 건물 매칭 서비스
 * - PostGIS를 사용한 공간 쿼리
 * - 반경 내 건물 조회, 거리/방향 계산
 */
const db = require('../db');

/**
 * 주변 건물 검색
 * @param {number} lat - 사용자 위도
 * @param {number} lng - 사용자 경도
 * @param {number} radius - 검색 반경 (미터, 기본 200m)
 * @param {number|null} heading - 디바이스 방향 (0-360도, null이면 전방위)
 * @returns {Array} 건물 목록 (거리순 정렬)
 */
async function findNearbyBuildings(lat, lng, radius = 200, heading = null) {
  // PostGIS ST_DWithin으로 반경 내 건물 조회
  // ST_Distance로 거리 계산 (미터 단위)
  // ST_Azimuth로 사용자→건물 방위각 계산
  const query = `
    SELECT
      b.id,
      b.name,
      b.address,
      b.total_floors,
      b.basement_floors,
      b.building_use,
      b.occupancy_rate,
      b.total_tenants,
      b.operating_tenants,
      b.parking_info,
      b.completion_year,
      b.thumbnail_url,
      ST_X(b.location::geometry) as lng,
      ST_Y(b.location::geometry) as lat,
      -- 거리 계산 (미터)
      ST_Distance(
        b.location::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as distance_meters,
      -- 사용자 → 건물 방위각 (도)
      degrees(ST_Azimuth(
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        b.location::geography
      )) as bearing
    FROM buildings b
    WHERE ST_DWithin(
      b.location::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
      $3
    )
    ORDER BY distance_meters ASC
    LIMIT 20;
  `;

  const result = await db.query(query, [lat, lng, radius]);
  let buildings = result.rows;

  // heading이 주어지면 전방 +-60도 범위로 필터링 (AR 카메라 시야)
  if (heading !== null && heading !== undefined) {
    buildings = buildings.filter((b) => {
      const diff = angleDifference(heading, b.bearing);
      return diff <= 60; // 전방 120도 시야 (좌우 60도)
    });
  }

  // 응답 데이터 정리
  return buildings.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address,
    lat: parseFloat(b.lat),
    lng: parseFloat(b.lng),
    distanceMeters: Math.round(parseFloat(b.distance_meters)),
    bearing: Math.round(parseFloat(b.bearing)),
    totalFloors: b.total_floors,
    basementFloors: b.basement_floors,
    buildingUse: b.building_use,
    occupancyRate: b.occupancy_rate ? parseFloat(b.occupancy_rate) : null,
    totalTenants: b.total_tenants,
    operatingTenants: b.operating_tenants,
    parkingInfo: b.parking_info,
    completionYear: b.completion_year,
    thumbnailUrl: b.thumbnail_url,
  }));
}

/**
 * 두 각도 사이의 최소 차이 계산
 * @param {number} angle1 - 각도1 (0-360)
 * @param {number} angle2 - 각도2 (0-360)
 * @returns {number} 최소 각도 차이 (0-180)
 */
function angleDifference(angle1, angle2) {
  let diff = Math.abs(angle1 - angle2) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

module.exports = {
  findNearbyBuildings,
  angleDifference,
};
