/**
 * 건물 프로필 통합 서비스 (v2)
 * - 건물 기본정보 + 층별 + 편의시설 + 통계 + 맛집 + 부동산 + 관광 + LIVE 피드 + 프로모션
 * - GET /api/buildings/:id/profile 에서 사용
 */
const db = require('../db');

/**
 * building_use 기반 폴백 더미 데이터 생성
 * DB 테이블이 비어있을 때 바텀시트에 표시할 기본 데이터
 */
function generateFallbackData(buildingUse, totalFloors, basementFloors, buildingName) {
  // 건물 용도별 층별 테넌트 매핑
  const tenantsByUse = {
    '오피스': { low: '사무실', mid: '사무실', high: '임원실', ground: '로비/편의점' },
    '상업시설': { low: '매장', mid: '매장', high: '레스토랑', ground: '편의점/카페' },
    '상가': { low: '매장', mid: '사무실', high: '학원', ground: '편의점' },
    '병원': { low: '외래진료', mid: '병동', high: '특수병동', ground: '접수/약국' },
    '호텔': { low: '레스토랑/연회장', mid: '객실', high: '스위트', ground: '로비/프론트' },
    '주거': { low: '세대', mid: '세대', high: '세대', ground: '관리사무소' },
    '아파트': { low: '세대', mid: '세대', high: '세대', ground: '관리사무소' },
  };
  const tenants = tenantsByUse[buildingUse] || tenantsByUse['오피스'];

  // 층별 정보 생성
  const floors = [];
  for (let i = basementFloors; i >= 1; i--) {
    floors.push({
      floor_number: `B${i}`,
      floor_order: -i,
      tenant_name: i === 1 ? '주차장/편의시설' : '주차장',
      tenant_type: i === 1 ? '편의시설' : '주차',
      is_vacant: false,
      icons: i === 1 ? 'store' : 'local_parking',
      has_reward: i === 1,
      status: 'active',
    });
  }
  floors.push({
    floor_number: '1F',
    floor_order: 1,
    tenant_name: tenants.ground,
    tenant_type: '로비',
    is_vacant: false,
    icons: 'business',
    has_reward: false,
    status: 'active',
  });
  for (let i = 2; i <= totalFloors; i++) {
    const section = i <= Math.floor(totalFloors * 0.3) ? 'low' : i <= Math.floor(totalFloors * 0.7) ? 'mid' : 'high';
    floors.push({
      floor_number: `${i}F`,
      floor_order: i,
      tenant_name: tenants[section],
      tenant_type: buildingUse || '오피스',
      is_vacant: i % 7 === 0, // ~14% 공실
      icons: 'business',
      has_reward: i % 5 === 0,
      status: 'active',
    });
  }
  // floor_order DESC 정렬
  floors.sort((a, b) => b.floor_order - a.floor_order);

  // 편의시설
  const amenities = [
    { type: '주차장', label: '주차장', location: 'B1-B' + basementFloors, is_free: false, hours: '24시간' },
    { type: '편의점', label: '편의점', location: '1F', is_free: true, hours: '07:00-23:00' },
    { type: '엘리베이터', label: '엘리베이터', location: '전층', is_free: true, hours: '24시간' },
    { type: '화장실', label: '화장실', location: '각 층', is_free: true, hours: '24시간' },
  ];

  // 맛집/카페
  const restaurantsByUse = {
    '오피스': [
      { name: '수제버거하우스', category: '양식', sub_category: '버거', signature_menu: '트러플 치즈버거', price_range: '12,000~18,000', wait_teams: 3, rating: 4.3, review_count: 128, is_open: true },
      { name: '맛찬들 순두부', category: '한식', sub_category: '찌개', signature_menu: '해물순두부찌개', price_range: '8,000~12,000', wait_teams: 0, rating: 4.1, review_count: 89, is_open: true },
      { name: 'MOCA 커피', category: '카페', sub_category: '커피', signature_menu: '아이스 아메리카노', price_range: '4,500~7,000', wait_teams: 0, rating: 4.5, review_count: 256, is_open: true },
    ],
    '상업시설': [
      { name: '본가 갈비', category: '한식', sub_category: '고기', signature_menu: 'LA갈비', price_range: '25,000~45,000', wait_teams: 5, rating: 4.6, review_count: 312, is_open: true },
      { name: '스시 오마카세', category: '일식', sub_category: '스시', signature_menu: '런치 오마카세', price_range: '35,000~80,000', wait_teams: 2, rating: 4.7, review_count: 178, is_open: true },
    ],
  };
  const restaurants = restaurantsByUse[buildingUse] || restaurantsByUse['오피스'];

  // 부동산 매물
  const realEstate = [
    { listing_type: '임대', room_type: '사무실', unit_number: `${Math.floor(totalFloors / 2)}01호`, size_pyeong: 15, size_sqm: 49.6, deposit: 3000, monthly_rent: 150, sale_price: null, is_active: true },
    { listing_type: '임대', room_type: '사무실', unit_number: `${Math.floor(totalFloors / 3)}02호`, size_pyeong: 25, size_sqm: 82.6, deposit: 5000, monthly_rent: 250, sale_price: null, is_active: true },
  ];

  // 관광 (특정 용도만)
  const tourismUses = ['호텔', '관광', '문화시설'];
  const tourism = tourismUses.includes(buildingUse)
    ? { attraction_name: buildingName, attraction_name_en: null, category: buildingUse, description: `${buildingName} 관광 정보`, admission_fee: null, hours: '09:00-18:00', congestion: '보통', rating: 4.0, review_count: 50 }
    : null;

  // LIVE 피드
  const liveFeeds = [
    { feed_type: 'update', title: `${buildingName} 정보 업데이트`, subtitle: '건물 정보가 곧 업데이트됩니다', icon: 'info', created_at: new Date().toISOString() },
    { feed_type: 'event', title: '주변 할인 이벤트', subtitle: '1층 편의점 할인 행사 진행 중', icon: 'local_offer', created_at: new Date().toISOString() },
  ];

  // 프로모션
  const promotion = {
    title: `${buildingName} 첫 스캔 보너스`,
    reward_points: 100,
    condition_text: '건물 스캔 완료 시 지급',
  };

  // 스탯
  const occupiedFloors = floors.filter(f => !f.is_vacant && f.floor_order > 0).length;
  const totalAboveGround = floors.filter(f => f.floor_order > 0).length;
  const occupancyRate = totalAboveGround > 0 ? Math.round((occupiedFloors / totalAboveGround) * 100) : 85;
  const stats = {
    occupancy_rate: occupancyRate,
    tenant_count: totalAboveGround,
    operating_count: occupiedFloors,
    resident_count: null,
    daily_footfall: `${Math.round(totalFloors * 120)}`,
    avg_rating: 4.2,
    review_count: Math.round(totalFloors * 15),
    raw: [
      { type: 'total_floors', value: `지상${totalFloors}층/지하${basementFloors}층`, icon: 'layers', displayOrder: 1 },
      { type: 'occupancy', value: `${occupancyRate}%`, icon: 'pie_chart', displayOrder: 2 },
      { type: 'tenants', value: `${totalAboveGround}개`, icon: 'store', displayOrder: 3 },
    ],
  };

  return { floors, amenities, restaurants, realEstate, tourism, liveFeeds, promotion, stats };
}

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

  // ===== 실제 DB 데이터 매핑 =====
  const dbFloors = floorsRes.rows.map((f) => ({
    floor_number: f.floor_number,
    floor_order: f.floor_order,
    tenant_name: f.tenant_name,
    tenant_type: f.tenant_category,
    is_vacant: f.is_vacant,
    icons: f.tenant_icon,
    has_reward: f.has_reward,
    status: f.status || 'unknown',
  }));

  const dbAmenities = amenitiesRes.rows.length > 0
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
      }));

  const dbRestaurants = restaurantsRes.rows.map((r) => ({
    name: r.name,
    category: r.category,
    sub_category: r.sub_category,
    signature_menu: r.signature_menu,
    price_range: r.price_range,
    wait_teams: r.wait_teams,
    rating: r.rating ? parseFloat(r.rating) : null,
    review_count: r.review_count,
    is_open: r.is_open,
  }));

  const dbRealEstate = realEstateRes.rows.map((r) => ({
    listing_type: r.listing_type,
    room_type: r.room_type,
    unit_number: r.unit_number,
    size_pyeong: r.size_pyeong ? parseFloat(r.size_pyeong) : null,
    size_sqm: r.size_sqm ? parseFloat(r.size_sqm) : null,
    deposit: r.deposit,
    monthly_rent: r.monthly_rent,
    sale_price: r.sale_price,
    is_active: r.is_active,
  }));

  const dbTourism = tourismRes.rows.length > 0
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
    : null;

  const dbLiveFeeds = liveFeedsRes.rows.map((l) => ({
    feed_type: l.feed_type,
    title: l.title,
    subtitle: l.description,
    icon: l.icon,
    created_at: l.created_at,
  }));

  const dbPromotion = promotionRes.rows.length > 0
    ? {
        title: promotionRes.rows[0].title,
        reward_points: promotionRes.rows[0].reward_points,
        condition_text: promotionRes.rows[0].condition_text,
      }
    : null;

  const dbStats = statsRes.rows.length > 0
    ? {
        occupancy_rate: b.occupancy_rate ? parseFloat(b.occupancy_rate) : null,
        tenant_count: b.total_tenants,
        operating_count: b.operating_tenants,
        resident_count: statsMap.residents || null,
        daily_footfall: statsMap.daily_footfall || null,
        avg_rating: statsMap.avg_rating ? parseFloat(statsMap.avg_rating) : null,
        review_count: statsMap.review_count ? parseInt(statsMap.review_count) : null,
        raw: statsRes.rows.map((s) => ({
          type: s.stat_type,
          value: s.stat_value,
          icon: s.stat_icon,
          displayOrder: s.display_order,
        })),
      }
    : null;

  // ===== 폴백 더미 데이터: 빈 테이블 감지 시 building_use 기반 생성 =====
  const buildingUse = b.building_use || '오피스';
  const totalFloors = b.total_floors || 10;
  const basementFloors = b.basement_floors || Math.min(3, Math.max(1, Math.floor(totalFloors / 5)));
  const fallback = generateFallbackData(buildingUse, totalFloors, basementFloors, b.name);

  const floors = dbFloors.length > 0 ? dbFloors : fallback.floors;
  const amenities = dbAmenities.length > 0 ? dbAmenities : fallback.amenities;
  const restaurants = dbRestaurants.length > 0 ? dbRestaurants : fallback.restaurants;
  const realEstate = dbRealEstate.length > 0 ? dbRealEstate : fallback.realEstate;
  const tourism = dbTourism || fallback.tourism;
  const liveFeeds = dbLiveFeeds.length > 0 ? dbLiveFeeds : fallback.liveFeeds;
  const promotion = dbPromotion || fallback.promotion;
  const stats = dbStats || fallback.stats;

  // meta: 폴백 포함 실제 데이터 기준으로 계산
  const hasFloors = floors.length > 0;
  const hasRestaurants = restaurants.length > 0;
  const hasRealEstate = realEstate.length > 0;
  const hasTourism = tourism !== null;

  const dataChecks = [
    stats !== null,
    hasFloors,
    amenities.length > 0,
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
    stats,
    floors,
    amenities,
    realEstate,
    restaurants,
    tourism,
    liveFeeds,
    promotion,
    meta: {
      hasFloors,
      hasRestaurants,
      hasRealEstate,
      hasTourism,
      dataCompleteness,
      isFallback: dbFloors.length === 0 && dbRestaurants.length === 0,
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
  generateFallbackData,
};
