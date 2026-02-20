/**
 * ScanPang 더미 데이터
 * - API 연동 전 UI 개발 및 테스트를 위한 목업 데이터
 */

// 포인트 시스템 더미 데이터
export const DUMMY_POINTS = {
  totalPoints: 1200,      // 현재 누적 포인트
  pointsPerScan: 50,      // 스캔 1회당 획득 포인트
  dailyLimit: 500,         // 일일 포인트 획득 한도
  todayEarned: 250,        // 오늘 획득한 포인트
  scanCount: 5,            // 오늘 스캔 횟수
};

// 건물 더미 데이터 (층별 정보 포함)
export const DUMMY_BUILDINGS = [
  {
    id: 'bld_001',
    name: '강남 파이낸스센터',
    address: '서울특별시 강남구 테헤란로 152',
    latitude: 37.5000,
    longitude: 127.0366,
    distance: 45,           // 사용자와의 거리 (미터)
    totalFloors: 30,
    undergroundFloors: 5,
    yearBuilt: 2001,
    buildingType: 'office',  // office | residential | commercial | mixed
    amenities: ['주차장', '편의점', '카페', 'ATM', '회의실'],
    floors: [
      { floor: 'B5-B1', usage: '주차장', tenants: ['지하 주차장'] },
      { floor: '1F', usage: '로비/상업', tenants: ['스타벅스', 'GS25', '신한은행 ATM'] },
      { floor: '2F-3F', usage: '상업시설', tenants: ['올리브영', '다이소', '서브웨이'] },
      { floor: '4F-15F', usage: '오피스', tenants: ['삼성SDS', '네이버 클라우드'] },
      { floor: '16F-25F', usage: '오피스', tenants: ['카카오엔터프라이즈', 'LINE Plus'] },
      { floor: '26F-30F', usage: '프리미엄 오피스', tenants: ['구글코리아'] },
    ],
    stats: {
      totalScans: 1520,      // 총 스캔 수
      dailyVisitors: 8500,   // 일 평균 방문자
      rating: 4.3,           // 평점
    },
  },
  {
    id: 'bld_002',
    name: '삼성타운',
    address: '서울특별시 서초구 서초대로74길 11',
    latitude: 37.4960,
    longitude: 127.0293,
    distance: 120,
    totalFloors: 44,
    undergroundFloors: 7,
    yearBuilt: 2008,
    buildingType: 'office',
    amenities: ['주차장', '구내식당', '피트니스', '편의점', '은행'],
    floors: [
      { floor: 'B7-B2', usage: '주차장', tenants: ['지하 주차장'] },
      { floor: 'B1', usage: '상업시설', tenants: ['CU', '삼성 스토어'] },
      { floor: '1F', usage: '로비', tenants: ['메인 로비', '안내 데스크'] },
      { floor: '2F-20F', usage: '오피스', tenants: ['삼성전자 무선사업부'] },
      { floor: '21F-35F', usage: '오피스', tenants: ['삼성전자 DS사업부'] },
      { floor: '36F-44F', usage: '임원층/회의실', tenants: ['삼성전자 경영지원'] },
    ],
    stats: {
      totalScans: 2340,
      dailyVisitors: 15000,
      rating: 4.5,
    },
  },
  {
    id: 'bld_003',
    name: '코엑스몰',
    address: '서울특별시 강남구 영동대로 513',
    latitude: 37.5117,
    longitude: 127.0592,
    distance: 230,
    totalFloors: 4,
    undergroundFloors: 3,
    yearBuilt: 2000,
    buildingType: 'commercial',
    amenities: ['주차장', '영화관', '수족관', '서점', '푸드코트', 'ATM'],
    floors: [
      { floor: 'B3-B1', usage: '주차장/상업', tenants: ['메가박스', '별마당 도서관'] },
      { floor: '1F', usage: '쇼핑', tenants: ['나이키', '아디다스', 'H&M', 'ZARA'] },
      { floor: '2F', usage: '쇼핑/레스토랑', tenants: ['애플 스토어', '버거킹', '맘스터치'] },
      { floor: '3F', usage: '엔터테인먼트', tenants: ['코엑스 아쿠아리움', '키즈카페'] },
      { floor: '4F', usage: '푸드코트', tenants: ['다양한 음식점'] },
    ],
    stats: {
      totalScans: 5680,
      dailyVisitors: 45000,
      rating: 4.1,
    },
  },
  {
    id: 'bld_004',
    name: '롯데월드타워',
    address: '서울특별시 송파구 올림픽로 300',
    latitude: 37.5126,
    longitude: 127.1025,
    distance: 580,
    totalFloors: 123,
    undergroundFloors: 6,
    yearBuilt: 2017,
    buildingType: 'mixed',
    amenities: ['주차장', '전망대', '호텔', '쇼핑몰', '오피스', '레지던스'],
    floors: [
      { floor: 'B6-B1', usage: '주차장/상업', tenants: ['롯데마트', '주차장'] },
      { floor: '1F-12F', usage: '롯데월드몰', tenants: ['명품관', '쇼핑몰'] },
      { floor: '13F-38F', usage: '오피스', tenants: ['다수 기업'] },
      { floor: '39F-71F', usage: '오피스 프리미엄', tenants: ['롯데그룹 본사'] },
      { floor: '72F-85F', usage: '레지던스', tenants: ['시그니엘 레지던스'] },
      { floor: '86F-101F', usage: '호텔', tenants: ['시그니엘 서울'] },
      { floor: '117F-123F', usage: '전망대', tenants: ['서울스카이'] },
    ],
    stats: {
      totalScans: 8920,
      dailyVisitors: 35000,
      rating: 4.7,
    },
  },
  {
    id: 'bld_005',
    name: '현대백화점 판교점',
    address: '경기도 성남시 분당구 판교역로146번길 20',
    latitude: 37.3943,
    longitude: 127.1115,
    distance: 350,
    totalFloors: 10,
    undergroundFloors: 5,
    yearBuilt: 2015,
    buildingType: 'commercial',
    amenities: ['주차장', '영화관', '식품관', 'VIP라운지', '문화센터'],
    floors: [
      { floor: 'B5-B2', usage: '주차장', tenants: ['지하 주차장'] },
      { floor: 'B1', usage: '식품관', tenants: ['현대 식품관', '빵집', '델리'] },
      { floor: '1F', usage: '명품/화장품', tenants: ['샤넬', '루이비통', '에르메스'] },
      { floor: '2F-4F', usage: '패션', tenants: ['여성의류', '남성의류', '캐주얼'] },
      { floor: '5F-6F', usage: '리빙/스포츠', tenants: ['가전', '스포츠', '아웃도어'] },
      { floor: '7F-8F', usage: '레스토랑/카페', tenants: ['한식', '양식', '일식'] },
      { floor: '9F-10F', usage: '문화/엔터', tenants: ['CGV', '문화센터'] },
    ],
    stats: {
      totalScans: 3210,
      dailyVisitors: 22000,
      rating: 4.4,
    },
  },
];

// 실시간 피드 더미 데이터 (건물별 2~3개)
export const DUMMY_LIVE_FEEDS = [
  // 강남 파이낸스센터 피드
  {
    id: 'feed_001',
    buildingId: 'bld_001',
    type: 'event',          // event | promo | alert | news
    title: '1층 스타벅스 신메뉴 출시',
    description: '시즌 한정 딸기 라떼가 출시되었습니다. 오늘부터 주문 가능!',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30분 전
    isLive: true,
  },
  {
    id: 'feed_002',
    buildingId: 'bld_001',
    type: 'alert',
    title: '엘리베이터 점검 안내',
    description: '2번 엘리베이터가 오후 2시~4시 점검 예정입니다.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
    isLive: false,
  },
  // 삼성타운 피드
  {
    id: 'feed_003',
    buildingId: 'bld_002',
    type: 'news',
    title: '삼성전자 신제품 발표회',
    description: '갤럭시 신제품 발표회가 1층 컨벤션홀에서 진행 중입니다.',
    timestamp: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10분 전
    isLive: true,
  },
  {
    id: 'feed_004',
    buildingId: 'bld_002',
    type: 'promo',
    title: 'B1 CU 할인 이벤트',
    description: '도시락 전 품목 20% 할인 중! (오늘 한정)',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45분 전
    isLive: true,
  },
  {
    id: 'feed_005',
    buildingId: 'bld_002',
    type: 'alert',
    title: '주차장 혼잡 안내',
    description: 'B3~B5 주차장이 만차입니다. B6, B7을 이용해주세요.',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15분 전
    isLive: true,
  },
  // 코엑스몰 피드
  {
    id: 'feed_006',
    buildingId: 'bld_003',
    type: 'event',
    title: '별마당 도서관 저자 사인회',
    description: '베스트셀러 작가 특별 사인회가 오후 3시에 시작됩니다.',
    timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1시간 전
    isLive: true,
  },
  {
    id: 'feed_007',
    buildingId: 'bld_003',
    type: 'promo',
    title: '푸드코트 런치 특가',
    description: '점심시간(11:30~13:30) 전 메뉴 15% 할인!',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3시간 전
    isLive: false,
  },
  // 롯데월드타워 피드
  {
    id: 'feed_008',
    buildingId: 'bld_004',
    type: 'event',
    title: '서울스카이 야경 이벤트',
    description: '오늘 밤 10시까지 연장 운영! 특별 조명쇼가 진행됩니다.',
    timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20분 전
    isLive: true,
  },
  {
    id: 'feed_009',
    buildingId: 'bld_004',
    type: 'promo',
    title: '시그니엘 호텔 특가',
    description: '이번 주말 숙박 30% 할인 프로모션 진행 중.',
    timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5시간 전
    isLive: false,
  },
  {
    id: 'feed_010',
    buildingId: 'bld_004',
    type: 'news',
    title: '롯데월드몰 브랜드 입점',
    description: '새로운 글로벌 브랜드 3개가 이번 달 오픈 예정입니다.',
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8시간 전
    isLive: false,
  },
  // 현대백화점 판교점 피드
  {
    id: 'feed_011',
    buildingId: 'bld_005',
    type: 'promo',
    title: '식품관 주말 특가',
    description: '신선식품 코너에서 제철 딸기 50% 할인 판매 중!',
    timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40분 전
    isLive: true,
  },
  {
    id: 'feed_012',
    buildingId: 'bld_005',
    type: 'event',
    title: 'VIP 문화센터 특강',
    description: '유명 셰프의 쿠킹 클래스가 10층 문화센터에서 진행됩니다.',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2시간 전
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

/**
 * 거리순으로 정렬된 건물 목록을 반환하는 헬퍼 함수
 * @returns {Array} 거리순 정렬된 건물 목록
 */
export const getBuildingsSortedByDistance = () => {
  return [...DUMMY_BUILDINGS].sort((a, b) => a.distance - b.distance);
};

// ===== 더미 프로필 빌더 (BuildingProfileSheet 호환 형식) =====

const DUMMY_RESTAURANTS_MAP = {
  bld_001: [
    { name: '어니언 카페', category: '카페', sub_category: '베이커리 카페', signature_menu: '팡도르', signature_price: '5,000', wait_teams: 0, is_open: true, rating: 4.6, review_count: 234, hours: '08:00-22:00' },
    { name: '소문난 감자탕', category: '한식', sub_category: '한식당', signature_menu: '감자탕(중)', signature_price: '30,000', wait_teams: 12, is_open: true, rating: 4.2, review_count: 512, hours: '11:00-22:00' },
    { name: '서브웨이', category: '양식', sub_category: '샌드위치', signature_menu: 'BMT', signature_price: '6,900', wait_teams: 0, is_open: true, rating: 3.8, review_count: 189, hours: '08:00-21:00' },
  ],
  bld_002: [
    { name: '삼성 구내식당', category: '한식', sub_category: '구내식당', signature_menu: '오늘의 정식', signature_price: '6,000', wait_teams: 5, is_open: true, rating: 4.0, review_count: 1024, hours: '11:30-13:30' },
    { name: 'CU 델리', category: '편의점', sub_category: '간편식', signature_menu: '도시락', signature_price: '4,500', wait_teams: 0, is_open: true, rating: 3.5, review_count: 67, hours: '24시간' },
  ],
  bld_003: [
    { name: '맘스터치', category: '양식', sub_category: '버거', signature_menu: '싸이버거', signature_price: '5,200', wait_teams: 3, is_open: true, rating: 4.1, review_count: 342, hours: '10:00-22:00' },
    { name: '재즈 라운지', category: '주점', sub_category: '요리주점', signature_menu: '칵테일', signature_price: '15,000', wait_teams: 0, is_open: false, rating: 4.5, review_count: 156, hours: '18:00-02:00' },
    { name: '코엑스 푸드코트', category: '한식', sub_category: '푸드코트', signature_menu: '비빔밥', signature_price: '9,000', wait_teams: 8, is_open: true, rating: 3.9, review_count: 891, hours: '10:30-21:30' },
  ],
  bld_004: [
    { name: '한우리', category: '한식', sub_category: '한우전문', signature_menu: '한우등심세트', signature_price: '89,000', wait_teams: 15, is_open: true, rating: 4.7, review_count: 723, hours: '11:30-22:00' },
    { name: '스시 오마카세 히든', category: '일식', sub_category: '오마카세', signature_menu: '런치 코스', signature_price: '65,000', wait_teams: 8, is_open: true, rating: 4.8, review_count: 412, hours: '12:00-21:30' },
    { name: '빕스 프리미어', category: '양식', sub_category: '뷔페', signature_menu: '프리미엄 뷔페', signature_price: '45,900', wait_teams: 6, is_open: true, rating: 4.2, review_count: 567, hours: '11:00-22:00' },
  ],
  bld_005: [
    { name: '더현대 푸드홀', category: '한식', sub_category: '푸드홀', signature_menu: '한우 덮밥', signature_price: '18,000', wait_teams: 10, is_open: true, rating: 4.4, review_count: 945, hours: '10:30-20:00' },
    { name: '폴 바셋', category: '카페', sub_category: '스페셜티 카페', signature_menu: '플랫 화이트', signature_price: '6,500', wait_teams: 2, is_open: true, rating: 4.5, review_count: 378, hours: '10:00-21:00' },
    { name: '치폴레', category: '양식', sub_category: '멕시칸', signature_menu: '부리또 볼', signature_price: '12,500', wait_teams: 0, is_open: true, rating: 4.0, review_count: 213, hours: '11:00-21:00' },
  ],
};

const DUMMY_REALESTATE_MAP = {
  bld_001: [
    { listing_type: 'monthly_rent', room_type: 'office', deposit: 5000, monthly_rent: 150, unit_number: '1201호', size_pyeong: 25, size_sqm: 82.6 },
    { listing_type: 'monthly_rent', room_type: 'office', deposit: 3000, monthly_rent: 80, unit_number: '803호', size_pyeong: 12, size_sqm: 39.6 },
    { listing_type: 'sale', room_type: 'office', deposit: null, monthly_rent: null, sale_price: 85000, unit_number: '2001호', size_pyeong: 45, size_sqm: 148.7 },
  ],
  bld_002: [
    { listing_type: 'monthly_rent', room_type: 'office', deposit: 10000, monthly_rent: 300, unit_number: '1505호', size_pyeong: 40, size_sqm: 132.2 },
    { listing_type: 'monthly_rent', room_type: 'office', deposit: 7000, monthly_rent: 200, unit_number: '1002호', size_pyeong: 30, size_sqm: 99.2 },
    { listing_type: 'sale', room_type: 'office', deposit: null, monthly_rent: null, sale_price: 120000, unit_number: '3201호', size_pyeong: 55, size_sqm: 181.8 },
  ],
  bld_003: [
    { listing_type: 'monthly_rent', room_type: 'retail', deposit: 15000, monthly_rent: 500, unit_number: '1F-A08호', size_pyeong: 22, size_sqm: 72.7 },
    { listing_type: 'monthly_rent', room_type: 'retail', deposit: 8000, monthly_rent: 250, unit_number: '2F-B03호', size_pyeong: 15, size_sqm: 49.6 },
    { listing_type: 'jeonse', room_type: 'retail', deposit: 35000, monthly_rent: null, unit_number: '3F-D02호', size_pyeong: 28, size_sqm: 92.5 },
  ],
  bld_004: [
    { listing_type: 'monthly_rent', room_type: 'office', deposit: 20000, monthly_rent: 600, unit_number: '4502호', size_pyeong: 55, size_sqm: 181.8 },
    { listing_type: 'jeonse', room_type: 'three_room', deposit: 150000, monthly_rent: null, unit_number: '7801호', size_pyeong: 62, size_sqm: 204.9 },
    { listing_type: 'monthly_rent', room_type: 'retail', deposit: 30000, monthly_rent: 800, unit_number: '3F-C12호', size_pyeong: 35, size_sqm: 115.7 },
    { listing_type: 'sale', room_type: 'three_room', deposit: null, monthly_rent: null, sale_price: 250000, unit_number: '8502호', size_pyeong: 72, size_sqm: 237.9 },
  ],
  bld_005: [
    { listing_type: 'monthly_rent', room_type: 'retail', deposit: 10000, monthly_rent: 350, unit_number: 'B1-12호', size_pyeong: 18, size_sqm: 59.5 },
    { listing_type: 'jeonse', room_type: 'retail', deposit: 25000, monthly_rent: null, unit_number: '2F-05호', size_pyeong: 30, size_sqm: 99.2 },
    { listing_type: 'sale', room_type: 'retail', deposit: null, monthly_rent: null, sale_price: 52000, unit_number: '1F-03호', size_pyeong: 20, size_sqm: 66.1 },
  ],
};

const DUMMY_TOURISM_MAP = {
  bld_001: {
    attraction_name: '강남 금융 역사관',
    attraction_name_en: 'Gangnam Finance Museum',
    category: '박물관',
    rating: 4.0,
    review_count: 1250,
    congestion: '여유로움',
    hours: '09:00 - 18:00',
    admission_fee: '무료',
    description: '대한민국 금융 산업의 발전사를 한눈에 볼 수 있는 전시관. 인터랙티브 체험존과 금융 시뮬레이션 코너가 인기입니다.',
  },
  bld_002: {
    attraction_name: '삼성 이노베이션 뮤지엄',
    attraction_name_en: 'Samsung Innovation Museum',
    category: '전시관',
    rating: 4.5,
    review_count: 6340,
    congestion: '보통',
    hours: '10:00 - 18:00',
    admission_fee: '무료 (사전 예약 필수)',
    description: '반도체, 디스플레이, 모바일의 과거·현재·미래를 체험할 수 있는 삼성전자 기업 박물관. VR 체험존, 미래 기술 전시관이 하이라이트.',
  },
  bld_003: {
    attraction_name: '코엑스 아쿠아리움',
    attraction_name_en: 'COEX Aquarium',
    category: '수족관',
    rating: 4.3,
    review_count: 8420,
    congestion: '보통',
    hours: '10:00 - 20:00',
    admission_fee: '성인 33,000원 / 어린이 29,000원',
    description: '650여 종 4만여 마리의 해양생물을 만날 수 있는 도심 속 수족관. 오션킹덤, 심해왕국 등 다양한 테마존으로 구성되어 있습니다.',
  },
  bld_004: {
    attraction_name: '서울스카이',
    attraction_name_en: 'Seoul Sky Observatory',
    category: '전망대',
    rating: 4.8,
    review_count: 15230,
    congestion: '여유로움',
    hours: '10:30 - 22:00',
    admission_fee: '성인 29,000원 / 어린이 25,000원',
    description: '555m 높이의 대한민국 최고 전망대. 117~123층에서 서울 시내를 360도 파노라마로 감상할 수 있습니다. 스카이데크 투명 유리 바닥 체험 가능.',
  },
  bld_005: {
    attraction_name: '현대 어린이책 미술관',
    attraction_name_en: 'Hyundai Kids Book Museum',
    category: '미술관',
    rating: 4.6,
    review_count: 3870,
    congestion: '혼잡',
    hours: '10:30 - 19:00',
    admission_fee: '성인 8,000원 / 어린이 6,000원',
    description: '그림책과 예술이 만나는 복합 문화 공간. 몰입형 미디어아트 전시와 어린이 창작 워크숍이 상시 운영됩니다.',
  },
};

const DUMMY_PROMOTIONS_MAP = {
  bld_001: { title: '첫 스캔 보너스 이벤트', reward_points: 500, condition_text: '이 건물 첫 스캔 시 보너스 포인트 지급' },
  bld_002: { title: '삼성타운 출근길 스캔', reward_points: 300, condition_text: '평일 오전 7~9시 스캔 시 추가 포인트' },
  bld_003: { title: '코엑스 스캔 챌린지', reward_points: 1000, condition_text: '코엑스 내 3개 층 이상 스캔 시 보너스' },
  bld_004: { title: '랜드마크 스캔 리워드', reward_points: 800, condition_text: '롯데월드타워 스캔 완료 시 특별 리워드' },
  bld_005: { title: '판교 쇼핑 스캔 이벤트', reward_points: 600, condition_text: '현대백화점 스캔 후 매장 방문 시 쿠폰 지급' },
};

// ===== 매칭 안 되는 건물용 제네릭 폴백 데이터 =====
// md 스펙: "이매동 C동 주상복합" 스타일의 현실적인 주상복합 데이터

const FALLBACK_FLOORS = [
  { floor_number: 'B2', tenant_name: '주차장 · 기계실', is_vacant: false, has_reward: false, icons: '🅿️ ⚙️' },
  { floor_number: 'B1', tenant_name: '주차장 (60대)', is_vacant: false, has_reward: false, icons: '🅿️' },
  { floor_number: '1F', tenant_name: '로비 · 관리사무소 · 택배함', is_vacant: false, has_reward: false, icons: '🏛️ 📦' },
  { floor_number: '2F', tenant_name: '편의점CU · 세탁소', is_vacant: false, has_reward: true, icons: '🏪 👕' },
  { floor_number: '3F', tenant_name: '부동산 · 학원', is_vacant: false, has_reward: false, icons: '🏪 📝' },
  { floor_number: '4F', tenant_name: '내과 · 치과', is_vacant: false, has_reward: false, icons: '🏥 💊' },
  { floor_number: '5F', tenant_name: '필라테스 · 헬스', is_vacant: false, has_reward: true, icons: '💪 🏋️' },
  { floor_number: '6F', tenant_name: '스터디카페', is_vacant: false, has_reward: false, icons: '📚 ☕' },
  { floor_number: '7F', tenant_name: '공실', is_vacant: true, has_reward: false, icons: '' },
  { floor_number: '8F', tenant_name: '주거 세대', is_vacant: false, has_reward: false, icons: '🏠' },
  { floor_number: '9F', tenant_name: '주거 세대', is_vacant: false, has_reward: false, icons: '🏠' },
  { floor_number: '10F', tenant_name: '주거 세대', is_vacant: false, has_reward: false, icons: '🏠' },
  { floor_number: '11F', tenant_name: '주거 세대', is_vacant: false, has_reward: false, icons: '🏠' },
  { floor_number: '12F', tenant_name: '주거 세대', is_vacant: false, has_reward: false, icons: '🏠' },
  { floor_number: '13F', tenant_name: '주거 세대', is_vacant: false, has_reward: false, icons: '🏠' },
  { floor_number: '14F', tenant_name: '주거 세대', is_vacant: false, has_reward: false, icons: '🏠' },
  { floor_number: '15F', tenant_name: '펜트하우스', is_vacant: false, has_reward: false, icons: '🏠' },
  { floor_number: 'RF', tenant_name: '옥상 정원 & 휴게공간', is_vacant: false, has_reward: false, icons: '🌿 ☀️' },
];

const FALLBACK_RESTAURANTS = [
  { name: '카페 모먼트', category: '카페', sub_category: '로스터리 카페', signature_menu: '아인슈페너', signature_price: '6,500', wait_teams: 0, is_open: true, rating: 4.5, review_count: 156, hours: '08:00-22:00' },
  { name: '이매정 순두부', category: '한식', sub_category: '한식 · 순두부', signature_menu: '순두부찌개', signature_price: '9,000', wait_teams: 3, is_open: true, rating: 4.3, review_count: 312, hours: '11:00-21:00' },
  { name: '맘스터치', category: '양식', sub_category: '패스트푸드', signature_menu: '싸이버거', signature_price: '5,900', wait_teams: 0, is_open: true, rating: 4.1, review_count: 287, hours: '10:00-22:00' },
  { name: 'CU 편의점', category: '편의점', sub_category: '편의점', signature_menu: '삼각김밥', signature_price: '1,200', wait_teams: 0, is_open: true, rating: 3.5, review_count: 89, hours: '24시간' },
];

const FALLBACK_REALESTATE = [
  { listing_type: 'monthly_rent', room_type: 'one_room', deposit: 500, monthly_rent: 55, unit_number: '301호', size_pyeong: 8, size_sqm: 26.4 },
  { listing_type: 'monthly_rent', room_type: 'two_room', deposit: 1000, monthly_rent: 80, unit_number: '502호', size_pyeong: 15, size_sqm: 49.5 },
  { listing_type: 'jeonse', room_type: 'two_room', deposit: 22000, monthly_rent: null, unit_number: '801호', size_pyeong: 18, size_sqm: 59.4 },
  { listing_type: 'sale', room_type: 'three_room', deposit: null, monthly_rent: null, sale_price: 42000, unit_number: '1201호', size_pyeong: 32, size_sqm: 105.6 },
];

const FALLBACK_TOURISM = {
  attraction_name: '둘레길 산책코스',
  attraction_name_en: 'Neighborhood Trail',
  category: '산책로',
  rating: 4.0,
  review_count: 230,
  congestion: '여유로움',
  hours: '24시간 개방',
  admission_fee: '무료',
  description: '인근 하천과 연결되는 둘레길 코스. 주변 공원과 산책로를 따라 자연을 즐길 수 있는 도심 속 휴식 공간입니다.',
};

const FALLBACK_FEEDS = [
  { feed_type: 'update', title: '2F 편의점 24시간 영업중', subtitle: '간편식/도시락/음료 구비', time_label: '방금' },
  { feed_type: 'event', title: '5F 필라테스 무료체험 이벤트', subtitle: '신규 등록 시 1개월 무료', time_label: '1시간 전' },
  { feed_type: 'congestion', title: '엘리베이터 1호기 점검', subtitle: '14:00-16:00 사용 불가', time_label: '2시간 전' },
];

const FALLBACK_AMENITIES = ['주차장', '편의점', '카페', '세탁소', '피트니스'];

const FALLBACK_PROMOTION = { title: '건물 첫 스캔 보너스', reward_points: 200, condition_text: '이 건물을 처음 스캔하면 200P 적립!' };

/**
 * 건물 객체를 BuildingProfileSheet 호환 프로필로 변환
 * - ID 매칭되는 건물: DUMMY_*_MAP에서 데이터 사용
 * - ID 매칭 안 되는 건물 (실제 AR 감지): 제네릭 폴백 데이터 사용
 * @param {Object} building - DUMMY_BUILDINGS 항목 또는 API nearby 건물
 * @returns {Object} BuildingProfileSheet 호환 프로필
 */
export const buildDummyProfile = (building) => {
  if (!building) return null;
  const id = building.id;
  const isKnown = DUMMY_RESTAURANTS_MAP[id] || DUMMY_REALESTATE_MAP[id] || DUMMY_TOURISM_MAP[id];

  // 층별 정보 변환
  let floors = [];
  if (building.floors && building.floors.length > 0) {
    building.floors.forEach(f => {
      const floorLabel = f.floor || f.floor_number || '';
      const tenants = f.tenants || [];
      const rangeMatch = floorLabel.match(/^([B]?\d+)[F]?\s*[-~]\s*([B]?\d+)[F]?$/i);
      if (rangeMatch) {
        const isBasement = floorLabel.startsWith('B');
        const start = parseInt(rangeMatch[1].replace('B', ''));
        const end = parseInt(rangeMatch[2].replace('B', ''));
        const [lo, hi] = start <= end ? [start, end] : [end, start];
        for (let n = hi; n >= lo; n--) {
          floors.push({
            floor_number: isBasement ? `B${n}` : `${n}F`,
            tenant_name: f.usage || tenants[0] || '',
            is_vacant: false, has_reward: false, icons: '',
          });
        }
      } else {
        floors.push({
          floor_number: floorLabel,
          tenant_name: tenants.join(', ') || f.usage || '',
          is_vacant: false, has_reward: floorLabel === '1F', icons: '',
        });
      }
    });
  }
  // 층 정보 없으면 폴백 사용
  if (floors.length === 0) {
    floors = [...FALLBACK_FLOORS];
  }

  // 편의시설
  const amenityIcons = { '주차장': '🅿️', '편의점': '🏪', '카페': '☕', 'ATM': '🏧', '회의실': '📋', '구내식당': '🍱', '피트니스': '🏋️', '은행': '🏦', '영화관': '🎬', '수족관': '🐠', '서점': '📚', '푸드코트': '🍽️', '전망대': '🔭', '호텔': '🏨', '쇼핑몰': '🛍️', '오피스': '💼', '레지던스': '🏠', '식품관': '🥖', 'VIP라운지': '👑', '문화센터': '🎨', '세탁소': '👕' };
  const amenityList = (building.amenities && building.amenities.length > 0)
    ? building.amenities
    : FALLBACK_AMENITIES;
  const amenities = amenityList.map(a => ({
    type: `${amenityIcons[a] || '🏢'} ${a}`,
    location: '',
    hours: '',
  }));

  // 스탯
  const totalFloors = building.totalFloors || building.total_floors || floors.length;
  const statsRaw = [
    { type: 'total_floors', value: `${totalFloors}층` },
    { type: 'occupancy', value: `${building.occupancy_rate || Math.round(85 + Math.random() * 10)}%` },
    { type: 'tenants', value: `${building.total_tenants || Math.max(floors.length, 3)}개` },
    { type: 'operating', value: `${building.open_tenants || Math.max(floors.length - 1, 2)}개` },
  ];

  // LIVE 피드
  const rawFeeds = getLiveFeedsByBuilding(id);
  let liveFeeds;
  if (rawFeeds.length > 0) {
    const feedTypeMap = { event: 'event', promo: 'promotion', alert: 'congestion', news: 'update' };
    liveFeeds = rawFeeds.map(f => ({
      feed_type: feedTypeMap[f.type] || 'update',
      title: f.title,
      subtitle: f.description?.slice(0, 40) || '',
      time_label: f.isLive ? '방금' : '이전',
    }));
  } else {
    liveFeeds = [...FALLBACK_FEEDS];
  }

  // 탭 데이터: ID 매칭 우선, 없으면 폴백
  const restaurants = DUMMY_RESTAURANTS_MAP[id] || (isKnown ? [] : FALLBACK_RESTAURANTS);
  const realEstate = DUMMY_REALESTATE_MAP[id] || (isKnown ? [] : FALLBACK_REALESTATE);
  const tourism = DUMMY_TOURISM_MAP[id] || (isKnown ? null : FALLBACK_TOURISM);
  const promotion = DUMMY_PROMOTIONS_MAP[id] || (isKnown ? null : FALLBACK_PROMOTION);

  return {
    building: {
      id: building.id,
      name: building.name,
      address: building.address,
      lat: building.latitude || building.lat,
      lng: building.longitude || building.lng,
      distance: building.distance || 0,
      building_use: building.buildingType || building.building_use || building.sub_type || '주상복합',
      completion_year: building.yearBuilt || building.built_year,
    },
    stats: { raw: statsRaw },
    floors,
    amenities,
    realEstate,
    restaurants,
    tourism,
    liveFeeds,
    promotion,
    meta: {
      hasFloors: floors.length > 0,
      hasRestaurants: restaurants.length > 0,
      hasRealEstate: realEstate.length > 0,
      hasTourism: !!tourism,
      dataCompleteness: 75,
    },
  };
};

export default {
  DUMMY_POINTS,
  DUMMY_BUILDINGS,
  DUMMY_LIVE_FEEDS,
  getLiveFeedsByBuilding,
  getBuildingsSortedByDistance,
  buildDummyProfile,
};
