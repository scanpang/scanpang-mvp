/**
 * 건물 프로필 통합 서비스 (v2)
 * - 건물 기본정보 + 층별 + 편의시설 + 통계 + 맛집 + 부동산 + 관광 + LIVE 피드 + 프로모션
 * - GET /api/buildings/:id/profile 에서 사용
 */
const db = require('../db');

/**
 * 건물 통합 프로필 조회
 * @param {number} buildingId - 건물 ID
 * @returns {Object|null} 통합 프로필 (없으면 null)
 */
async function getProfile(buildingId) {
  // 9개 테이블 병렬 조회
  const [
    buildingRes,
    floorsRes,
    facilitiesRes,
    statsRes,
    liveFeedsRes,
    amenitiesRes,
    realEstateRes,
    restaurantsRes,
    tourismRes,
    promotionRes,
  ] = await Promise.all([
    // 1. 건물 기본 정보
    db.query(
      `SELECT
        id, name, address,
        ST_X(location::geometry) as lng,
        ST_Y(location::geometry) as lat,
        total_floors, basement_floors, building_use,
        sub_type, description,
        occupancy_rate, total_tenants, operating_tenants,
        parking_info, completion_year, thumbnail_url,
        created_at, updated_at
      FROM buildings WHERE id = $1`,
      [buildingId]
    ),
    // 2. 층별 정보 (floor_order DESC)
    db.query(
      `SELECT
        id, floor_number, floor_order, tenant_name,
        tenant_category, tenant_icon, is_vacant,
        has_reward, reward_points, status
      FROM floors
      WHERE building_id = $1
      ORDER BY floor_order DESC`,
      [buildingId]
    ),
    // 3. 편의시설 (기존 facilities)
    db.query(
      `SELECT
        id, facility_type, location_info,
        is_available, status_text
      FROM facilities
      WHERE building_id = $1
      ORDER BY id`,
      [buildingId]
    ),
    // 4. 건물 통계 (기존 building_stats)
    db.query(
      `SELECT
        id, stat_type, stat_value,
        stat_icon, display_order
      FROM building_stats
      WHERE building_id = $1
      ORDER BY display_order`,
      [buildingId]
    ),
    // 5. LIVE 피드 (만료 안 된 것만, 최근 10개)
    db.query(
      `SELECT
        id, feed_type, title, description,
        icon, icon_color, time_label, created_at
      FROM live_feeds
      WHERE building_id = $1
        AND (is_active = true)
        AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 10`,
      [buildingId]
    ),
    // 6. 편의시설 v2 (amenities)
    db.query(
      `SELECT id, type, label, location, is_free, hours
      FROM amenities
      WHERE building_id = $1
      ORDER BY id`,
      [buildingId]
    ),
    // 7. 부동산 매물
    db.query(
      `SELECT id, listing_type, room_type, unit_number,
        size_pyeong, size_sqm, deposit, monthly_rent,
        sale_price, is_active
      FROM real_estate_listings
      WHERE building_id = $1 AND is_active = true
      ORDER BY updated_at DESC`,
      [buildingId]
    ),
    // 8. 맛집/카페
    db.query(
      `SELECT id, name, category, sub_category,
        signature_menu, price_range, wait_teams,
        rating, review_count, hours, is_open
      FROM restaurants
      WHERE building_id = $1
      ORDER BY rating DESC NULLS LAST`,
      [buildingId]
    ),
    // 9. 관광 정보
    db.query(
      `SELECT id, attraction_name, attraction_name_en,
        category, description, admission_fee,
        hours, congestion, rating, review_count
      FROM tourism_info
      WHERE building_id = $1
      LIMIT 1`,
      [buildingId]
    ),
    // 10. 프로모션 (활성 1개)
    db.query(
      `SELECT id, title, reward_points, condition_text, media_url
      FROM promotions
      WHERE building_id = $1 AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1`,
      [buildingId]
    ),
  ]);

  // 건물 없으면 null
  if (buildingRes.rows.length === 0) {
    return null;
  }

  const b = buildingRes.rows[0];

  // 통계에서 occupancy_rate, tenant_count 등 추출
  const statsMap = {};
  statsRes.rows.forEach((s) => {
    statsMap[s.stat_type] = s.stat_value;
  });

  const hasFloors = floorsRes.rows.length > 0;
  const hasRestaurants = restaurantsRes.rows.length > 0;
  const hasRealEstate = realEstateRes.rows.length > 0;
  const hasTourism = tourismRes.rows.length > 0;

  // dataCompleteness: stats, floors, amenities/facilities, restaurants 중 데이터 있는 비율
  const dataChecks = [
    statsRes.rows.length > 0,
    hasFloors,
    amenitiesRes.rows.length > 0 || facilitiesRes.rows.length > 0,
    hasRestaurants,
  ];
  const dataCompleteness = Math.round(
    (dataChecks.filter(Boolean).length / dataChecks.length) * 100
  );

  // 프로필 조합
  return {
    building: {
      id: b.id,
      name: b.name,
      address: b.address,
      type: b.building_use,
      sub_type: b.sub_type || null,
      total_floors: b.total_floors,
      basement_floors: b.basement_floors,
      built_year: b.completion_year,
      parking_count: b.parking_info,
      description: b.description || null,
      lat: parseFloat(b.lat),
      lng: parseFloat(b.lng),
      thumbnail_url: b.thumbnail_url,
    },

    stats: statsRes.rows.length > 0
      ? {
          occupancy_rate: b.occupancy_rate ? parseFloat(b.occupancy_rate) : null,
          tenant_count: b.total_tenants,
          operating_count: b.operating_tenants,
          resident_count: statsMap.residents || null,
          daily_footfall: statsMap.daily_footfall || null,
          avg_rating: statsMap.avg_rating ? parseFloat(statsMap.avg_rating) : null,
          review_count: statsMap.review_count ? parseInt(statsMap.review_count) : null,
          // 기존 stats 원본도 포함
          raw: statsRes.rows.map((s) => ({
            type: s.stat_type,
            value: s.stat_value,
            icon: s.stat_icon,
            displayOrder: s.display_order,
          })),
        }
      : null,

    floors: floorsRes.rows.map((f) => ({
      floor_number: f.floor_number,
      floor_order: f.floor_order,
      tenant_name: f.tenant_name,
      tenant_type: f.tenant_category,
      is_vacant: f.is_vacant,
      icons: f.tenant_icon,
      has_reward: f.has_reward,
      status: f.status || 'unknown',
    })),

    amenities: amenitiesRes.rows.length > 0
      ? amenitiesRes.rows.map((a) => ({
          type: a.type,
          label: a.label,
          location: a.location,
          is_free: a.is_free,
          hours: a.hours,
        }))
      : facilitiesRes.rows.map((f) => ({
          type: f.facility_type,
          label: f.facility_type,
          location: f.location_info,
          is_free: f.status_text ? f.status_text.includes('무료') : false,
          hours: f.status_text,
        })),

    realEstate: realEstateRes.rows.map((r) => ({
      listing_type: r.listing_type,
      room_type: r.room_type,
      unit_number: r.unit_number,
      size_pyeong: r.size_pyeong ? parseFloat(r.size_pyeong) : null,
      size_sqm: r.size_sqm ? parseFloat(r.size_sqm) : null,
      deposit: r.deposit,
      monthly_rent: r.monthly_rent,
      sale_price: r.sale_price,
      is_active: r.is_active,
    })),

    restaurants: restaurantsRes.rows.map((r) => ({
      name: r.name,
      category: r.category,
      sub_category: r.sub_category,
      signature_menu: r.signature_menu,
      price_range: r.price_range,
      wait_teams: r.wait_teams,
      rating: r.rating ? parseFloat(r.rating) : null,
      review_count: r.review_count,
      is_open: r.is_open,
    })),

    tourism: tourismRes.rows.length > 0
      ? {
          attraction_name: tourismRes.rows[0].attraction_name,
          attraction_name_en: tourismRes.rows[0].attraction_name_en,
          category: tourismRes.rows[0].category,
          description: tourismRes.rows[0].description,
          admission_fee: tourismRes.rows[0].admission_fee,
          hours: tourismRes.rows[0].hours,
          congestion: tourismRes.rows[0].congestion,
          rating: tourismRes.rows[0].rating ? parseFloat(tourismRes.rows[0].rating) : null,
          review_count: tourismRes.rows[0].review_count,
        }
      : null,

    liveFeeds: liveFeedsRes.rows.map((l) => ({
      feed_type: l.feed_type,
      title: l.title,
      subtitle: l.description,
      icon: l.icon,
      created_at: l.created_at,
    })),

    promotion: promotionRes.rows.length > 0
      ? {
          title: promotionRes.rows[0].title,
          reward_points: promotionRes.rows[0].reward_points,
          condition_text: promotionRes.rows[0].condition_text,
        }
      : null,

    meta: {
      hasFloors,
      hasRestaurants,
      hasRealEstate,
      hasTourism,
      dataCompleteness,
    },
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
      f.has_reward, f.reward_points, f.status
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
    status: f.status,
  }));
}

module.exports = {
  getProfile,
  getFloors,
};
