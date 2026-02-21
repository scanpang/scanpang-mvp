/**
 * ScanPang 폴백 데이터
 * - generateFallbackData(): building_use 기반 합리적 더미 데이터
 * - 빈 필드 채우기 전용 (전체 더미 프로필 아님)
 * - 포인트 시스템 / 라이브 피드 (UI 테스트용)
 */

// 포인트 시스템 더미 데이터
export const DUMMY_POINTS = {
  totalPoints: 1200,
  pointsPerScan: 50,
  dailyLimit: 500,
  todayEarned: 250,
  scanCount: 5,
};

// 실시간 피드 더미 데이터 (건물별)
export const DUMMY_LIVE_FEEDS = [
  {
    id: 'feed_001',
    buildingId: 'bld_001',
    type: 'event',
    title: '1층 스타벅스 신메뉴 출시',
    description: '시즌 한정 딸기 라떼가 출시되었습니다. 오늘부터 주문 가능!',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    isLive: true,
  },
  {
    id: 'feed_002',
    buildingId: 'bld_001',
    type: 'alert',
    title: '엘리베이터 점검 안내',
    description: '2번 엘리베이터가 오후 2시~4시 점검 예정입니다.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    isLive: false,
  },
];

/**
 * 특정 건물의 라이브 피드를 필터링하는 헬퍼 함수
 * @param {string} buildingId - 건물 ID
 * @returns {Array} 해당 건물의 라이브 피드 목록
 */
export const getLiveFeedsByBuilding = (buildingId) => {
  return DUMMY_LIVE_FEEDS.filter((feed) => feed.buildingId === buildingId);
};

// ===== 건물 용도 분류 =====
function classifyUse(buildingUse) {
  const use = (buildingUse || '').toLowerCase();
  if (use.includes('오피스') || use.includes('업무') || use.includes('사무')) return 'office';
  if (use.includes('상업') || use.includes('상가') || use.includes('retail')) return 'commercial';
  if (use.includes('아파트') || use.includes('주거') || use.includes('residential')) return 'residential';
  if (use.includes('복합') || use.includes('mixed')) return 'mixed';
  if (use.includes('호텔') || use.includes('숙박')) return 'hotel';
  if (use.includes('병원') || use.includes('의료')) return 'hospital';
  if (use.includes('학교') || use.includes('대학')) return 'school';
  return 'generic';
}

// ===== 편의시설 태그 생성 =====
function generateAmenities(type) {
  const data = {
    office: [
      { type: '편의점', location: '1F' },
      { type: '카페', location: '1F 로비' },
      { type: '주차장', location: 'B1-B2' },
      { type: 'ATM', location: '1F' },
    ],
    commercial: [
      { type: '편의점', location: '1F' },
      { type: '에스컬레이터', location: '전층' },
      { type: '주차장', location: 'B1-B3' },
      { type: '물품보관소', location: '1F' },
    ],
    residential: [
      { type: '관리사무소', location: '1F' },
      { type: '주차장', location: 'B1-B3' },
      { type: '경비실', location: '정문' },
      { type: '택배보관함', location: '1F' },
    ],
    mixed: [
      { type: '편의점', location: '1F' },
      { type: '카페', location: '2F' },
      { type: '주차장', location: 'B1-B2' },
      { type: '피트니스', location: '3F' },
    ],
    hotel: [
      { type: '프런트', location: '1F' },
      { type: '레스토랑', location: '2F' },
      { type: '피트니스', location: '5F' },
      { type: '주차장', location: 'B1-B2' },
    ],
    hospital: [
      { type: '약국', location: '1F' },
      { type: '원무과', location: '1F' },
      { type: '주차장', location: 'B1-B3' },
      { type: '편의점', location: '1F' },
    ],
    school: [
      { type: '도서관', location: '별관' },
      { type: '매점', location: '1F' },
      { type: '주차장', location: 'B1' },
    ],
    generic: [
      { type: '편의시설', location: '1F' },
      { type: '주차장', location: 'B1' },
    ],
  };
  return data[type] || data.generic;
}

// ===== 스탯 생성 =====
function generateStats(type) {
  const data = {
    office: {
      raw: [
        { type: 'total_floors', value: '12층', displayOrder: 1 },
        { type: 'occupancy', value: '87%', displayOrder: 2 },
        { type: 'tenants', value: '23개', displayOrder: 3 },
        { type: 'operating', value: '19개', displayOrder: 4 },
      ],
    },
    commercial: {
      raw: [
        { type: 'total_floors', value: '8층', displayOrder: 1 },
        { type: 'occupancy', value: '92%', displayOrder: 2 },
        { type: 'tenants', value: '31개', displayOrder: 3 },
        { type: 'operating', value: '28개', displayOrder: 4 },
      ],
    },
    residential: {
      raw: [
        { type: 'total_floors', value: '25층', displayOrder: 1 },
        { type: 'residents', value: '204세대', displayOrder: 2 },
        { type: 'parking_capacity', value: '280대', displayOrder: 3 },
        { type: 'congestion', value: '여유', displayOrder: 4 },
      ],
    },
    mixed: {
      raw: [
        { type: 'total_floors', value: '15층', displayOrder: 1 },
        { type: 'occupancy', value: '85%', displayOrder: 2 },
        { type: 'tenants', value: '18개', displayOrder: 3 },
        { type: 'operating', value: '15개', displayOrder: 4 },
      ],
    },
    hotel: {
      raw: [
        { type: 'total_floors', value: '20층', displayOrder: 1 },
        { type: 'occupancy', value: '76%', displayOrder: 2 },
        { type: 'congestion', value: '보통', displayOrder: 3 },
        { type: 'parking_capacity', value: '120대', displayOrder: 4 },
      ],
    },
    hospital: {
      raw: [
        { type: 'total_floors', value: '10층', displayOrder: 1 },
        { type: 'tenants', value: '15과', displayOrder: 2 },
        { type: 'operating', value: '12과', displayOrder: 3 },
        { type: 'parking_capacity', value: '200대', displayOrder: 4 },
      ],
    },
    school: {
      raw: [
        { type: 'total_floors', value: '5층', displayOrder: 1 },
        { type: 'type', value: '교육시설', displayOrder: 2 },
      ],
    },
    generic: {
      raw: [
        { type: 'total_floors', value: '8층', displayOrder: 1 },
        { type: 'type', value: '건물', displayOrder: 2 },
      ],
    },
  };
  return data[type] || data.generic;
}

// ===== 층별 정보 생성 =====
function generateFloors(type) {
  const data = {
    office: [
      { floor_number: '12F', tenant_name: '대회의실' },
      { floor_number: '11F', tenant_name: '세무법인' },
      { floor_number: '10F', tenant_name: 'IT기업' },
      { floor_number: '9F', tenant_name: '디자인 스튜디오' },
      { floor_number: '8F', tenant_name: '공유오피스' },
      { floor_number: '7F', tenant_name: '법률사무소' },
      { floor_number: '6F', tenant_name: '마케팅 에이전시' },
      { floor_number: '5F', tenant_name: '보험사' },
      { floor_number: '4F', tenant_name: '학원' },
      { floor_number: '3F', tenant_name: '내과의원' },
      { floor_number: '2F', tenant_name: '피부과' },
      { floor_number: '1F', tenant_name: '편의점 \u00B7 카페' },
      { floor_number: 'B1', tenant_name: '주차장' },
      { floor_number: 'B2', tenant_name: '주차장' },
    ],
    commercial: [
      { floor_number: '8F', tenant_name: '사무실' },
      { floor_number: '7F', tenant_name: '학원' },
      { floor_number: '6F', tenant_name: '피트니스' },
      { floor_number: '5F', tenant_name: '뷰티샵' },
      { floor_number: '4F', tenant_name: '의류매장' },
      { floor_number: '3F', tenant_name: '음식점' },
      { floor_number: '2F', tenant_name: '카페 \u00B7 디저트' },
      { floor_number: '1F', tenant_name: '편의점 \u00B7 약국' },
      { floor_number: 'B1', tenant_name: '주차장' },
    ],
    residential: [
      { floor_number: '25F', tenant_name: '주거' },
      { floor_number: '20F', tenant_name: '주거' },
      { floor_number: '15F', tenant_name: '주거' },
      { floor_number: '10F', tenant_name: '주거' },
      { floor_number: '5F', tenant_name: '주거' },
      { floor_number: '1F', tenant_name: '관리사무소 \u00B7 상가' },
      { floor_number: 'B1', tenant_name: '주차장' },
      { floor_number: 'B2', tenant_name: '주차장' },
      { floor_number: 'B3', tenant_name: '주차장' },
    ],
    mixed: [
      { floor_number: '15F', tenant_name: '사무실' },
      { floor_number: '12F', tenant_name: '공유오피스' },
      { floor_number: '10F', tenant_name: '사무실' },
      { floor_number: '8F', tenant_name: '학원' },
      { floor_number: '5F', tenant_name: '피트니스' },
      { floor_number: '3F', tenant_name: '음식점 \u00B7 카페' },
      { floor_number: '2F', tenant_name: '의류매장' },
      { floor_number: '1F', tenant_name: '편의점 \u00B7 로비' },
      { floor_number: 'B1', tenant_name: '주차장' },
      { floor_number: 'B2', tenant_name: '주차장' },
    ],
    hotel: [
      { floor_number: '20F', tenant_name: '스카이라운지' },
      { floor_number: '15F', tenant_name: '객실' },
      { floor_number: '10F', tenant_name: '객실' },
      { floor_number: '5F', tenant_name: '피트니스 \u00B7 수영장' },
      { floor_number: '3F', tenant_name: '연회장' },
      { floor_number: '2F', tenant_name: '레스토랑' },
      { floor_number: '1F', tenant_name: '프런트 \u00B7 로비' },
      { floor_number: 'B1', tenant_name: '주차장' },
    ],
    hospital: [
      { floor_number: '10F', tenant_name: '병동' },
      { floor_number: '8F', tenant_name: '수술실' },
      { floor_number: '6F', tenant_name: '검사실' },
      { floor_number: '4F', tenant_name: '외래진료' },
      { floor_number: '3F', tenant_name: '외래진료' },
      { floor_number: '2F', tenant_name: '영상의학과' },
      { floor_number: '1F', tenant_name: '원무과 \u00B7 약국' },
      { floor_number: 'B1', tenant_name: '주차장' },
    ],
    school: [
      { floor_number: '5F', tenant_name: '강의실' },
      { floor_number: '4F', tenant_name: '강의실' },
      { floor_number: '3F', tenant_name: '실습실' },
      { floor_number: '2F', tenant_name: '행정실' },
      { floor_number: '1F', tenant_name: '로비 \u00B7 매점' },
    ],
    generic: [
      { floor_number: '8F', tenant_name: '사무실' },
      { floor_number: '5F', tenant_name: '사무실' },
      { floor_number: '3F', tenant_name: '상가' },
      { floor_number: '1F', tenant_name: '로비' },
      { floor_number: 'B1', tenant_name: '주차장' },
    ],
  };
  return data[type] || data.generic;
}

// ===== 맛집 데이터 생성 =====
function generateRestaurants(type) {
  const common = [
    {
      name: '맛나분식',
      category: '한식',
      sub_category: '분식',
      rating: 4.2,
      review_count: 128,
      signature_menu: '떡볶이',
      signature_price: '5,000원',
      is_open: true,
      wait_teams: 0,
    },
    {
      name: '커피베이',
      category: '카페',
      sub_category: '커피전문점',
      rating: 4.0,
      review_count: 87,
      signature_menu: '아메리카노',
      signature_price: '3,500원',
      is_open: true,
      wait_teams: 0,
    },
    {
      name: 'GS25',
      category: '편의점',
      sub_category: '편의점',
      rating: 3.8,
      review_count: 45,
      is_open: true,
      wait_teams: 0,
    },
  ];

  const officeExtra = {
    name: '한솥도시락',
    category: '한식',
    sub_category: '도시락',
    rating: 4.1,
    review_count: 203,
    signature_menu: '치킨마요',
    signature_price: '5,500원',
    is_open: true,
    wait_teams: 2,
  };

  if (type === 'office' || type === 'commercial' || type === 'mixed') {
    return [...common, officeExtra].slice(0, 3);
  }
  return common.slice(0, 2);
}

// ===== 부동산 데이터 생성 =====
function generateRealEstate(type) {
  const data = {
    office: [
      {
        listing_type: '월세',
        room_type: '오피스',
        deposit: 3000,
        monthly_rent: 150,
        size_pyeong: 25,
        size_sqm: 82.6,
        unit_number: '7층',
      },
      {
        listing_type: '월세',
        room_type: '오피스',
        deposit: 5000,
        monthly_rent: 200,
        size_pyeong: 40,
        size_sqm: 132.2,
        unit_number: '10층',
      },
    ],
    commercial: [
      {
        listing_type: '월세',
        room_type: '상가',
        deposit: 5000,
        monthly_rent: 250,
        size_pyeong: 15,
        size_sqm: 49.6,
        unit_number: '1층',
      },
    ],
    residential: [
      {
        listing_type: '전세',
        room_type: '투룸',
        deposit: 28000,
        size_pyeong: 24,
        size_sqm: 79.3,
        unit_number: '12층',
      },
      {
        listing_type: '월세',
        room_type: '원룸',
        deposit: 1000,
        monthly_rent: 60,
        size_pyeong: 8,
        size_sqm: 26.4,
        unit_number: '5층',
      },
    ],
    mixed: [
      {
        listing_type: '월세',
        room_type: '오피스',
        deposit: 2000,
        monthly_rent: 120,
        size_pyeong: 20,
        size_sqm: 66.1,
        unit_number: '8층',
      },
    ],
    hotel: [],
    hospital: [],
    school: [],
    generic: [
      {
        listing_type: '월세',
        room_type: '기타',
        deposit: 2000,
        monthly_rent: 100,
        size_pyeong: 15,
        size_sqm: 49.6,
      },
    ],
  };
  return data[type] || data.generic;
}

// ===== 관광 데이터 생성 =====
function generateTourism(type, buildingName) {
  return {
    attraction_name: buildingName,
    rating: 3.8,
    review_count: 52,
    congestion: '보통',
    hours: '09:00 - 18:00',
    description: `${buildingName} 주변 지역의 관광 정보입니다. 주변 편의시설과 교통 정보를 확인해보세요.`,
  };
}

/**
 * building_use 기반 합리적 폴백 데이터 생성
 * 빈 필드만 채우는 용도 (전체 더미 프로필 아님)
 * @param {string} buildingUse - 건물 용도 (오피스, 상업, 주거, 아파트 등)
 * @param {string} buildingName - 건물명
 * @returns {Object} 탭별 폴백 데이터
 */
export function generateFallbackData(buildingUse = '', buildingName = '건물') {
  const type = classifyUse(buildingUse);
  return {
    amenities: generateAmenities(type),
    stats: generateStats(type),
    floors: generateFloors(type),
    restaurants: generateRestaurants(type),
    realEstate: generateRealEstate(type),
    tourism: generateTourism(type, buildingName),
  };
}

export default {
  DUMMY_POINTS,
  DUMMY_LIVE_FEEDS,
  getLiveFeedsByBuilding,
  generateFallbackData,
};
