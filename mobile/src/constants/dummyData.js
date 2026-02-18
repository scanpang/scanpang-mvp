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

export default {
  DUMMY_POINTS,
  DUMMY_BUILDINGS,
  DUMMY_LIVE_FEEDS,
  getLiveFeedsByBuilding,
  getBuildingsSortedByDistance,
};
