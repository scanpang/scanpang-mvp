/**
 * 건물 프로필 조합 서비스
 * - 건물 기본정보 + 층별 정보 + 편의시설 + 통계 + LIVE 피드를 한 번에 조회
 */
const db = require('../db');

/**
 * 건물 프로필 전체 조회
 * @param {number} buildingId - 건물 ID
 * @returns {Object|null} 건물 프로필 (없으면 null)
 */
async function getProfile(buildingId) {
  // 병렬로 모든 데이터 조회 (성능 최적화)
  const [buildingRes, floorsRes, facilitiesRes, statsRes, liveFeedsRes] = await Promise.all([
    // 건물 기본 정보
    db.query(
      `SELECT
        id, name, address,
        ST_X(location::geometry) as lng,
        ST_Y(location::geometry) as lat,
        total_floors, basement_floors, building_use,
        occupancy_rate, total_tenants, operating_tenants,
        parking_info, completion_year, thumbnail_url,
        created_at, updated_at
      FROM buildings WHERE id = $1`,
      [buildingId]
    ),
    // 층별 정보 (정렬순)
    db.query(
      `SELECT
        id, floor_number, floor_order, tenant_name,
        tenant_category, tenant_icon, is_vacant,
        has_reward, reward_points
      FROM floors
      WHERE building_id = $1
      ORDER BY floor_order DESC`,
      [buildingId]
    ),
    // 편의시설
    db.query(
      `SELECT
        id, facility_type, location_info,
        is_available, status_text
      FROM facilities
      WHERE building_id = $1
      ORDER BY id`,
      [buildingId]
    ),
    // 건물 통계
    db.query(
      `SELECT
        id, stat_type, stat_value,
        stat_icon, display_order
      FROM building_stats
      WHERE building_id = $1
      ORDER BY display_order`,
      [buildingId]
    ),
    // LIVE 피드 (활성 피드만, 최신순)
    db.query(
      `SELECT
        id, feed_type, title, description,
        icon, icon_color, time_label, created_at
      FROM live_feeds
      WHERE building_id = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 10`,
      [buildingId]
    ),
  ]);

  // 건물이 없으면 null 반환
  if (buildingRes.rows.length === 0) {
    return null;
  }

  const building = buildingRes.rows[0];

  // 프로필 조합
  return {
    id: building.id,
    name: building.name,
    address: building.address,
    lat: parseFloat(building.lat),
    lng: parseFloat(building.lng),
    totalFloors: building.total_floors,
    basementFloors: building.basement_floors,
    buildingUse: building.building_use,
    occupancyRate: building.occupancy_rate ? parseFloat(building.occupancy_rate) : null,
    totalTenants: building.total_tenants,
    operatingTenants: building.operating_tenants,
    parkingInfo: building.parking_info,
    completionYear: building.completion_year,
    thumbnailUrl: building.thumbnail_url,

    // 층별 정보
    floors: floorsRes.rows.map((f) => ({
      id: f.id,
      floorNumber: f.floor_number,
      floorOrder: f.floor_order,
      tenantName: f.tenant_name,
      tenantCategory: f.tenant_category,
      tenantIcon: f.tenant_icon,
      isVacant: f.is_vacant,
      hasReward: f.has_reward,
      rewardPoints: f.reward_points,
    })),

    // 편의시설
    facilities: facilitiesRes.rows.map((f) => ({
      id: f.id,
      type: f.facility_type,
      locationInfo: f.location_info,
      isAvailable: f.is_available,
      statusText: f.status_text,
    })),

    // 통계
    stats: statsRes.rows.map((s) => ({
      id: s.id,
      type: s.stat_type,
      value: s.stat_value,
      icon: s.stat_icon,
      displayOrder: s.display_order,
    })),

    // LIVE 피드
    liveFeeds: liveFeedsRes.rows.map((l) => ({
      id: l.id,
      feedType: l.feed_type,
      title: l.title,
      description: l.description,
      icon: l.icon,
      iconColor: l.icon_color,
      timeLabel: l.time_label,
      createdAt: l.created_at,
    })),
  };
}

/**
 * 건물 층별 정보만 조회
 * @param {number} buildingId - 건물 ID
 * @returns {Array} 층별 정보 배열
 */
async function getFloors(buildingId) {
  const result = await db.query(
    `SELECT
      f.id, f.floor_number, f.floor_order, f.tenant_name,
      f.tenant_category, f.tenant_icon, f.is_vacant,
      f.has_reward, f.reward_points
    FROM floors f
    WHERE f.building_id = $1
    ORDER BY f.floor_order DESC`,
    [buildingId]
  );

  return result.rows.map((f) => ({
    id: f.id,
    floorNumber: f.floor_number,
    floorOrder: f.floor_order,
    tenantName: f.tenant_name,
    tenantCategory: f.tenant_category,
    tenantIcon: f.tenant_icon,
    isVacant: f.is_vacant,
    hasReward: f.has_reward,
    rewardPoints: f.reward_points,
  }));
}

module.exports = {
  getProfile,
  getFloors,
};
