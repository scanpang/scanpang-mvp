/**
 * ScanPang 폴백(더미) 데이터
 * - 목적: 데모 시 앱의 가치를 즉시 체감할 수 있도록 풍부한 정보 표시
 * - 핵심 가치:
 *   1) 파편화된 정보 취합·요약 (건축물대장 + 실거래가 + 리뷰 + 매장정보)
 *   2) 실시간 정보 (주차잔여, 대기팀수, 혼잡도, 택배현황)
 *   3) 웹 검색으로 찾기 힘든 정보 (층별 입점현황, 공실, 내부 편의시설)
 * - 실데이터는 흰색, 더미는 연보라(#c4b5fd)로 UI 구분
 */

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

// ===== 편의시설 태그 =====
// 웹 검색으로 알기 힘든 건물 내부 편의시설 + 실시간 현황
function generateAmenities(type) {
  const data = {
    office: [
      { type: '투썸플레이스', location: '1F · 07:30-21:00' },
      { type: 'GS25', location: 'B1 · 24시간' },
      { type: '지하주차장', location: 'B1-B3 · 잔여 43대' },
      { type: 'KB국민 ATM', location: '1F 로비' },
      { type: '무인택배함', location: '1F 후문 · 24시간' },
      { type: '피트니스센터', location: 'B1 · 06:00-23:00' },
      { type: '공용회의실', location: '9F · 예약제' },
    ],
    commercial: [
      { type: '올리브영', location: '1F · 10:00-22:00' },
      { type: '다이소', location: '2F · 10:00-22:00' },
      { type: '에스컬레이터', location: '전층 운행' },
      { type: '지하주차장', location: 'B1-B3 · 잔여 28대' },
      { type: '물품보관함', location: '1F 입구 · 무료' },
      { type: '유아휴게실', location: '3F · 수유실 포함' },
      { type: '무료 Wi-Fi', location: '전층 · scanpang_free' },
    ],
    residential: [
      { type: '관리사무소', location: '1F · 09:00-18:00' },
      { type: '무인택배함', location: '1F 로비 · 24시간' },
      { type: '지하주차장', location: 'B1-B3 · 잔여 67대' },
      { type: '피트니스센터', location: 'B1 · 06:00-22:00' },
      { type: '어린이놀이터', location: '단지 내 · 상시개방' },
      { type: '경로당', location: '1F · 09:00-17:00' },
      { type: '분리수거장', location: 'B1 · 화/목/토' },
    ],
    mixed: [
      { type: '스타벅스', location: '1F · 07:00-22:00' },
      { type: 'CU편의점', location: 'B1 · 24시간' },
      { type: '지하주차장', location: 'B1-B2 · 잔여 31대' },
      { type: '신한 ATM', location: '1F 로비' },
      { type: '코인세탁소', location: 'B1 · 24시간' },
      { type: '옥상정원', location: 'RF · 09:00-21:00' },
    ],
    hotel: [
      { type: '프런트데스크', location: '1F · 24시간' },
      { type: '뷔페 레스토랑', location: '2F · 06:30-22:00' },
      { type: '루프탑바', location: '22F · 18:00-01:00' },
      { type: '피트니스·수영장', location: '5F · 06:00-22:00' },
      { type: '비즈니스센터', location: '3F · 24시간' },
      { type: '발렛파킹', location: '정문 · 5,000원' },
    ],
    hospital: [
      { type: '온누리약국', location: '1F · 09:00-18:30' },
      { type: '원무과', location: '1F · 접수/수납' },
      { type: '지하주차장', location: 'B1-B3 · 잔여 52대' },
      { type: 'CU편의점', location: '1F · 24시간' },
      { type: '장례식장', location: 'B1 · 24시간' },
      { type: '헬기장', location: 'RF · 응급용' },
    ],
    school: [
      { type: '중앙도서관', location: '별관 · 09:00-22:00' },
      { type: '학생식당', location: '1F · 11:30-13:30' },
      { type: '편의점 CU', location: '1F · 08:00-21:00' },
      { type: '무료 Wi-Fi', location: '전관 · eduroam' },
      { type: '열람실', location: '3F · 24시간' },
    ],
    generic: [
      { type: '편의점', location: '1F · 24시간' },
      { type: '주차장', location: 'B1 · 잔여 15대' },
      { type: 'ATM', location: '1F 로비' },
      { type: '무인택배함', location: '1F' },
    ],
  };
  return data[type] || data.generic;
}

// ===== 스탯 그리드 (4개 핵심 수치) =====
// 파편화된 정보를 한눈에 요약
function generateStats(type) {
  const data = {
    office: {
      raw: [
        { type: 'total_floors', value: '18층', displayOrder: 1 },
        { type: 'occupancy', value: '91%', displayOrder: 2 },
        { type: 'tenants', value: '34개', displayOrder: 3 },
        { type: 'operating', value: '28개', displayOrder: 4 },
      ],
    },
    commercial: {
      raw: [
        { type: 'total_floors', value: '10층', displayOrder: 1 },
        { type: 'occupancy', value: '95%', displayOrder: 2 },
        { type: 'tenants', value: '42개', displayOrder: 3 },
        { type: 'operating', value: '38개', displayOrder: 4 },
      ],
    },
    residential: {
      raw: [
        { type: 'total_floors', value: '28층', displayOrder: 1 },
        { type: 'residents', value: '312세대', displayOrder: 2 },
        { type: 'parking_capacity', value: '380대', displayOrder: 3 },
        { type: 'congestion', value: '여유', displayOrder: 4 },
      ],
    },
    mixed: {
      raw: [
        { type: 'total_floors', value: '22층', displayOrder: 1 },
        { type: 'occupancy', value: '88%', displayOrder: 2 },
        { type: 'tenants', value: '51개', displayOrder: 3 },
        { type: 'operating', value: '43개', displayOrder: 4 },
      ],
    },
    hotel: {
      raw: [
        { type: 'total_floors', value: '22층', displayOrder: 1 },
        { type: 'occupancy', value: '78%', displayOrder: 2 },
        { type: 'congestion', value: '보통', displayOrder: 3 },
        { type: 'parking_capacity', value: '120대', displayOrder: 4 },
      ],
    },
    hospital: {
      raw: [
        { type: 'total_floors', value: '12층', displayOrder: 1 },
        { type: 'tenants', value: '18과', displayOrder: 2 },
        { type: 'operating', value: '15과', displayOrder: 3 },
        { type: 'parking_capacity', value: '230대', displayOrder: 4 },
      ],
    },
    school: {
      raw: [
        { type: 'total_floors', value: '6층', displayOrder: 1 },
        { type: 'type', value: '교육시설', displayOrder: 2 },
        { type: 'congestion', value: '보통', displayOrder: 3 },
        { type: 'parking_capacity', value: '80대', displayOrder: 4 },
      ],
    },
    generic: {
      raw: [
        { type: 'total_floors', value: '8층', displayOrder: 1 },
        { type: 'occupancy', value: '82%', displayOrder: 2 },
        { type: 'tenants', value: '12개', displayOrder: 3 },
        { type: 'operating', value: '9개', displayOrder: 4 },
      ],
    },
  };
  return data[type] || data.generic;
}

// ===== 층별 정보 =====
// 웹 검색으로 절대 알 수 없는 건물 내부 정보
function generateFloors(type) {
  const data = {
    office: [
      { floor_number: 'RF', tenant_name: '옥상정원 · 휴게공간', icons: '🌿' },
      { floor_number: '18F', tenant_name: '(주)넥스트테크 본사', icons: '💼' },
      { floor_number: '17F', tenant_name: '(주)넥스트테크', icons: '💻' },
      { floor_number: '16F', tenant_name: '삼일회계법인', icons: '📊' },
      { floor_number: '15F', tenant_name: '김앤장 법률사무소', icons: '⚖️', has_reward: true },
      { floor_number: '14F', tenant_name: '메리츠화재', icons: '🏦' },
      { floor_number: '13F', tenant_name: '디블렌트 마케팅', icons: '📢' },
      { floor_number: '12F', tenant_name: 'UI/UX 디자인랩', icons: '🎨' },
      { floor_number: '11F', tenant_name: '한화손해보험', icons: '🏦' },
      { floor_number: '10F', tenant_name: '세무법인 다솔', icons: '📋' },
      { floor_number: '9F', tenant_name: '위워크 공유오피스', icons: '🏢', has_reward: true },
      { floor_number: '8F', tenant_name: '위워크 공유오피스', icons: '🏢' },
      { floor_number: '7F', tenant_name: '메가스터디 학원', icons: '📚' },
      { floor_number: '6F', tenant_name: '영어마을 어학원', icons: '🌍' },
      { floor_number: '5F', tenant_name: '연세내과의원', icons: '🏥' },
      { floor_number: '4F', tenant_name: '미소치과 · 뷰티피부과', icons: '🦷' },
      { floor_number: '3F', tenant_name: '공실', is_vacant: true },
      { floor_number: '2F', tenant_name: '헤어비스 미용실 · 네일아트', icons: '💇' },
      { floor_number: '1F', tenant_name: '투썸플레이스 · GS25', icons: '☕🏪' },
      { floor_number: 'B1', tenant_name: '피트니스센터 · 주차장', icons: '🏋️🅿️' },
      { floor_number: 'B2', tenant_name: '주차장', icons: '🅿️' },
      { floor_number: 'B3', tenant_name: '주차장 · 기계실', icons: '🅿️' },
    ],
    commercial: [
      { floor_number: '10F', tenant_name: '정앤김 법률사무소', icons: '⚖️' },
      { floor_number: '9F', tenant_name: '대성학원 · 수학전문', icons: '📚' },
      { floor_number: '8F', tenant_name: '영어마을 어학원', icons: '🌍' },
      { floor_number: '7F', tenant_name: '애니타임피트니스 · 요가', icons: '🏋️', has_reward: true },
      { floor_number: '6F', tenant_name: '뷰티샵 · 네일 · 속눈썹', icons: '💅' },
      { floor_number: '5F', tenant_name: 'ABC마트 · 슈즈', icons: '👟', has_reward: true },
      { floor_number: '4F', tenant_name: 'ZARA · H&M 의류', icons: '👗' },
      { floor_number: '3F', tenant_name: '푸드코트 · 음식점 5곳', icons: '🍽️' },
      { floor_number: '2F', tenant_name: '다이소 · 생활용품', icons: '🛒' },
      { floor_number: '1F', tenant_name: '올리브영 · 스타벅스', icons: '💄☕' },
      { floor_number: 'B1', tenant_name: 'GS25 · 주차장', icons: '🏪🅿️' },
      { floor_number: 'B2', tenant_name: '주차장', icons: '🅿️' },
      { floor_number: 'B3', tenant_name: '주차장', icons: '🅿️' },
    ],
    residential: [
      { floor_number: '28F', tenant_name: '펜트하우스 (112평)', icons: '🏠' },
      { floor_number: '25F', tenant_name: '주거 (34평형)', icons: '🏠' },
      { floor_number: '20F', tenant_name: '주거 (34평형)', icons: '🏠' },
      { floor_number: '15F', tenant_name: '주거 (24평형)', icons: '🏠' },
      { floor_number: '10F', tenant_name: '주거 (24평형)', icons: '🏠' },
      { floor_number: '5F', tenant_name: '주거 (24평형)', icons: '🏠' },
      { floor_number: '2F', tenant_name: '주거 (34평형)', icons: '🏠' },
      { floor_number: '1F', tenant_name: '관리사무소 · 경비실 · 상가', icons: '🏬' },
      { floor_number: 'B1', tenant_name: '피트니스 · 주차장', icons: '🏋️🅿️' },
      { floor_number: 'B2', tenant_name: '주차장', icons: '🅿️' },
      { floor_number: 'B3', tenant_name: '주차장 · 기계실', icons: '🅿️' },
    ],
    mixed: [
      { floor_number: 'RF', tenant_name: '옥상정원 · 루프탑카페', icons: '🌿☕' },
      { floor_number: '22F', tenant_name: '스카이라운지', icons: '🍸' },
      { floor_number: '20F', tenant_name: '레지던스 (주거)', icons: '🏠' },
      { floor_number: '18F', tenant_name: '레지던스 (주거)', icons: '🏠' },
      { floor_number: '15F', tenant_name: 'AI스타트업 오피스', icons: '💻', has_reward: true },
      { floor_number: '13F', tenant_name: '핀테크기업', icons: '📱' },
      { floor_number: '11F', tenant_name: '공유오피스 패스트파이브', icons: '🏢' },
      { floor_number: '9F', tenant_name: '어학원 · 학원가', icons: '📚' },
      { floor_number: '7F', tenant_name: '피트니스 · 필라테스', icons: '🏋️' },
      { floor_number: '5F', tenant_name: '피부과 · 치과', icons: '🏥' },
      { floor_number: '3F', tenant_name: '음식점거리 · 맛집 4곳', icons: '🍽️' },
      { floor_number: '2F', tenant_name: '의류 · 잡화 편집숍', icons: '👗' },
      { floor_number: '1F', tenant_name: '스타벅스 · CU · 은행', icons: '☕🏪🏦' },
      { floor_number: 'B1', tenant_name: '코인세탁 · 주차장', icons: '🧺🅿️' },
      { floor_number: 'B2', tenant_name: '주차장', icons: '🅿️' },
    ],
    hotel: [
      { floor_number: '22F', tenant_name: '루프탑바 · 시그니처뷰', icons: '🍸🌃' },
      { floor_number: '20F', tenant_name: '스위트룸 (프리미엄)', icons: '🛏️' },
      { floor_number: '15F', tenant_name: '디럭스룸', icons: '🛏️' },
      { floor_number: '10F', tenant_name: '스탠다드룸', icons: '🛏️' },
      { floor_number: '5F', tenant_name: '피트니스 · 수영장 · 스파', icons: '🏊🧖' },
      { floor_number: '3F', tenant_name: '연회장 · 웨딩홀', icons: '🎉' },
      { floor_number: '2F', tenant_name: '뷔페레스토랑 · 일식당', icons: '🍽️🍣' },
      { floor_number: '1F', tenant_name: '프런트 · 로비라운지 · 컨시어지', icons: '🛎️' },
      { floor_number: 'B1', tenant_name: '비즈니스센터 · 주차장', icons: '💼🅿️' },
      { floor_number: 'B2', tenant_name: '주차장', icons: '🅿️' },
    ],
    hospital: [
      { floor_number: '12F', tenant_name: '특실병동 · VIP', icons: '🛏️' },
      { floor_number: '11F', tenant_name: '일반병동', icons: '🛏️' },
      { floor_number: '10F', tenant_name: '일반병동', icons: '🛏️' },
      { floor_number: '9F', tenant_name: '수술실 · 중환자실', icons: '🏥' },
      { floor_number: '8F', tenant_name: '산부인과 · 소아과', icons: '👶' },
      { floor_number: '7F', tenant_name: '정형외과 · 재활의학과', icons: '🦴' },
      { floor_number: '6F', tenant_name: '내과 · 심장내과', icons: '❤️' },
      { floor_number: '5F', tenant_name: '건강검진센터', icons: '🔬', has_reward: true },
      { floor_number: '4F', tenant_name: '영상의학과 · MRI', icons: '📡' },
      { floor_number: '3F', tenant_name: '외래진료 · 채혈실', icons: '💉' },
      { floor_number: '2F', tenant_name: '응급실 · 외래접수', icons: '🚑' },
      { floor_number: '1F', tenant_name: '원무과 · 온누리약국 · CU', icons: '💊🏪' },
      { floor_number: 'B1', tenant_name: '장례식장 · 주차장', icons: '🅿️' },
      { floor_number: 'B2', tenant_name: '주차장', icons: '🅿️' },
      { floor_number: 'B3', tenant_name: '주차장 · 기계실', icons: '🅿️' },
    ],
    school: [
      { floor_number: '6F', tenant_name: '교수연구실 · 세미나실', icons: '📖' },
      { floor_number: '5F', tenant_name: '강의실 501-510', icons: '🎓' },
      { floor_number: '4F', tenant_name: '강의실 401-410 · 컴퓨터실', icons: '💻' },
      { floor_number: '3F', tenant_name: '열람실 · 24시간 개방', icons: '📚' },
      { floor_number: '2F', tenant_name: '학과사무실 · 상담실', icons: '📋' },
      { floor_number: '1F', tenant_name: '학생식당 · CU · 매점', icons: '🍽️🏪' },
      { floor_number: 'B1', tenant_name: '동아리방 · 주차장', icons: '🎵🅿️' },
    ],
    generic: [
      { floor_number: '8F', tenant_name: '사무실', icons: '💼' },
      { floor_number: '7F', tenant_name: '사무실', icons: '💼' },
      { floor_number: '6F', tenant_name: '학원', icons: '📚' },
      { floor_number: '5F', tenant_name: '의원', icons: '🏥' },
      { floor_number: '4F', tenant_name: '공실', is_vacant: true },
      { floor_number: '3F', tenant_name: '음식점', icons: '🍽️' },
      { floor_number: '2F', tenant_name: '카페 · 미용실', icons: '☕💇' },
      { floor_number: '1F', tenant_name: '편의점 · 약국', icons: '🏪💊' },
      { floor_number: 'B1', tenant_name: '주차장', icons: '🅿️' },
    ],
  };
  return data[type] || data.generic;
}

// ===== 맛집 데이터 =====
// 실시간 대기팀수 + 대표메뉴/가격 = 웹에서 한번에 못 보는 정보
function generateRestaurants(type) {
  const data = {
    office: [
      {
        name: '투썸플레이스',
        category: '카페',
        sub_category: '커피전문점',
        rating: 4.3,
        review_count: 2134,
        signature_menu: '아이스아메리카노',
        signature_price: '4,500원',
        is_open: true,
        wait_teams: 0,
      },
      {
        name: '명동칼국수',
        category: '한식',
        sub_category: '칼국수·수제비',
        rating: 4.5,
        review_count: 892,
        signature_menu: '바지락칼국수',
        signature_price: '8,000원',
        is_open: true,
        wait_teams: 5,
      },
      {
        name: '맘스터치',
        category: '양식',
        sub_category: '버거·치킨',
        rating: 4.1,
        review_count: 1567,
        signature_menu: '싸이버거',
        signature_price: '5,900원',
        is_open: true,
        wait_teams: 3,
      },
      {
        name: '본죽&비빔밥',
        category: '한식',
        sub_category: '죽·비빔밥',
        rating: 4.2,
        review_count: 445,
        signature_menu: '전복죽',
        signature_price: '9,000원',
        is_open: true,
        wait_teams: 0,
      },
      {
        name: '서브웨이',
        category: '양식',
        sub_category: '샌드위치',
        rating: 3.9,
        review_count: 723,
        signature_menu: '이탈리안BMT',
        signature_price: '6,900원',
        is_open: true,
        wait_teams: 1,
      },
    ],
    commercial: [
      {
        name: '교동짬뽕',
        category: '중식',
        sub_category: '짬뽕전문',
        rating: 4.4,
        review_count: 1892,
        signature_menu: '교동짬뽕',
        signature_price: '8,500원',
        is_open: true,
        wait_teams: 7,
      },
      {
        name: '스타벅스',
        category: '카페',
        sub_category: '커피전문점',
        rating: 4.2,
        review_count: 3456,
        signature_menu: '카페라떼',
        signature_price: '5,500원',
        is_open: true,
        wait_teams: 2,
      },
      {
        name: '홍콩반점0410',
        category: '중식',
        sub_category: '짜장·짬뽕',
        rating: 4.0,
        review_count: 678,
        signature_menu: '짜장면',
        signature_price: '7,000원',
        is_open: true,
        wait_teams: 4,
      },
      {
        name: '파리바게뜨',
        category: '베이커리',
        sub_category: '빵·케이크',
        rating: 4.1,
        review_count: 234,
        signature_menu: '소보로빵',
        signature_price: '2,500원',
        is_open: true,
        wait_teams: 0,
      },
      {
        name: 'BBQ치킨',
        category: '한식',
        sub_category: '치킨',
        rating: 4.3,
        review_count: 1123,
        signature_menu: '황금올리브',
        signature_price: '18,000원',
        is_open: true,
        wait_teams: 0,
      },
    ],
    residential: [
      {
        name: '파리바게뜨',
        category: '베이커리',
        sub_category: '빵·케이크',
        rating: 4.2,
        review_count: 567,
        signature_menu: '식빵',
        signature_price: '3,800원',
        is_open: true,
        wait_teams: 0,
      },
      {
        name: '김밥천국',
        category: '한식',
        sub_category: '분식',
        rating: 3.9,
        review_count: 312,
        signature_menu: '참치김밥',
        signature_price: '4,000원',
        is_open: true,
        wait_teams: 2,
      },
      {
        name: '이디야커피',
        category: '카페',
        sub_category: '커피전문점',
        rating: 4.0,
        review_count: 189,
        signature_menu: '아메리카노',
        signature_price: '3,200원',
        is_open: true,
        wait_teams: 0,
      },
      {
        name: '굽네치킨',
        category: '한식',
        sub_category: '치킨',
        rating: 4.4,
        review_count: 876,
        signature_menu: '고추바사삭',
        signature_price: '17,000원',
        is_open: true,
        wait_teams: 0,
      },
    ],
    mixed: [
      {
        name: '스타벅스 리저브',
        category: '카페',
        sub_category: '스페셜티커피',
        rating: 4.5,
        review_count: 2891,
        signature_menu: '리저브 라떼',
        signature_price: '6,500원',
        is_open: true,
        wait_teams: 4,
      },
      {
        name: '을지로골뱅이',
        category: '한식',
        sub_category: '골뱅이무침',
        rating: 4.6,
        review_count: 1203,
        signature_menu: '골뱅이소면',
        signature_price: '12,000원',
        is_open: true,
        wait_teams: 8,
      },
      {
        name: '오사카규카츠',
        category: '일식',
        sub_category: '돈카츠',
        rating: 4.3,
        review_count: 567,
        signature_menu: '로스카츠정식',
        signature_price: '13,500원',
        is_open: true,
        wait_teams: 6,
      },
      {
        name: '써브웨이',
        category: '양식',
        sub_category: '샌드위치',
        rating: 3.9,
        review_count: 445,
        signature_menu: '에그마요',
        signature_price: '5,900원',
        is_open: true,
        wait_teams: 0,
      },
      {
        name: '공차',
        category: '카페',
        sub_category: '버블티',
        rating: 4.1,
        review_count: 1678,
        signature_menu: '타로밀크티',
        signature_price: '4,900원',
        is_open: true,
        wait_teams: 1,
      },
    ],
    hotel: [
      {
        name: '더 라운지 (호텔 뷔페)',
        category: '양식',
        sub_category: '뷔페',
        rating: 4.4,
        review_count: 2345,
        signature_menu: '런치뷔페',
        signature_price: '65,000원',
        is_open: true,
        wait_teams: 12,
      },
      {
        name: '스시오마카세',
        category: '일식',
        sub_category: '오마카세',
        rating: 4.7,
        review_count: 456,
        signature_menu: '런치 오마카세',
        signature_price: '55,000원',
        is_open: true,
        wait_teams: 3,
      },
      {
        name: '루프탑바 스카이',
        category: '주점',
        sub_category: '칵테일바',
        rating: 4.3,
        review_count: 891,
        signature_menu: '시그니처 칵테일',
        signature_price: '18,000원',
        is_open: false,
        wait_teams: 0,
      },
    ],
    hospital: [
      {
        name: '병원 구내식당',
        category: '한식',
        sub_category: '구내식당',
        rating: 3.7,
        review_count: 234,
        signature_menu: '정식백반',
        signature_price: '6,500원',
        is_open: true,
        wait_teams: 8,
      },
      {
        name: 'CU 편의점',
        category: '편의점',
        sub_category: '편의점',
        rating: 3.8,
        review_count: 67,
        is_open: true,
        wait_teams: 0,
      },
      {
        name: '할리스커피',
        category: '카페',
        sub_category: '커피전문점',
        rating: 4.0,
        review_count: 345,
        signature_menu: '아메리카노',
        signature_price: '4,500원',
        is_open: true,
        wait_teams: 1,
      },
    ],
    school: [
      {
        name: '학생식당',
        category: '한식',
        sub_category: '구내식당',
        rating: 3.5,
        review_count: 567,
        signature_menu: '오늘의 정식',
        signature_price: '4,500원',
        is_open: true,
        wait_teams: 15,
      },
      {
        name: '교직원식당',
        category: '한식',
        sub_category: '구내식당',
        rating: 3.9,
        review_count: 123,
        signature_menu: '교직원 정식',
        signature_price: '6,000원',
        is_open: true,
        wait_teams: 3,
      },
      {
        name: 'CU 편의점',
        category: '편의점',
        sub_category: '편의점',
        rating: 3.8,
        review_count: 89,
        is_open: true,
        wait_teams: 0,
      },
    ],
    generic: [
      {
        name: '맘스터치',
        category: '양식',
        sub_category: '버거',
        rating: 4.1,
        review_count: 892,
        signature_menu: '싸이버거',
        signature_price: '5,900원',
        is_open: true,
        wait_teams: 2,
      },
      {
        name: '이디야커피',
        category: '카페',
        sub_category: '커피전문점',
        rating: 4.0,
        review_count: 345,
        signature_menu: '아메리카노',
        signature_price: '3,200원',
        is_open: true,
        wait_teams: 0,
      },
      {
        name: 'GS25',
        category: '편의점',
        sub_category: '편의점',
        rating: 3.8,
        review_count: 78,
        is_open: true,
        wait_teams: 0,
      },
    ],
  };
  return data[type] || data.generic;
}

// ===== 부동산 매물 =====
// 여러 부동산 사이트 정보를 한 화면에 취합
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
        unit_number: '11층',
      },
      {
        listing_type: '월세',
        room_type: '오피스',
        deposit: 5000,
        monthly_rent: 220,
        size_pyeong: 42,
        size_sqm: 138.8,
        unit_number: '15층',
      },
      {
        listing_type: '월세',
        room_type: '상가',
        deposit: 8000,
        monthly_rent: 350,
        size_pyeong: 18,
        size_sqm: 59.5,
        unit_number: '1층',
      },
    ],
    commercial: [
      {
        listing_type: '월세',
        room_type: '상가',
        deposit: 10000,
        monthly_rent: 400,
        size_pyeong: 22,
        size_sqm: 72.7,
        unit_number: '1층',
      },
      {
        listing_type: '월세',
        room_type: '상가',
        deposit: 5000,
        monthly_rent: 250,
        size_pyeong: 15,
        size_sqm: 49.6,
        unit_number: '3층',
      },
      {
        listing_type: '월세',
        room_type: '오피스',
        deposit: 3000,
        monthly_rent: 120,
        size_pyeong: 30,
        size_sqm: 99.2,
        unit_number: '9층',
      },
    ],
    residential: [
      {
        listing_type: '전세',
        room_type: '쓰리룸',
        deposit: 42000,
        size_pyeong: 34,
        size_sqm: 112.4,
        unit_number: '15층',
      },
      {
        listing_type: '월세',
        room_type: '투룸',
        deposit: 5000,
        monthly_rent: 70,
        size_pyeong: 24,
        size_sqm: 79.3,
        unit_number: '8층',
      },
      {
        listing_type: '매매',
        room_type: '쓰리룸',
        sale_price: 85000,
        size_pyeong: 34,
        size_sqm: 112.4,
        unit_number: '22층',
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
        unit_number: '11층',
      },
      {
        listing_type: '월세',
        room_type: '상가',
        deposit: 7000,
        monthly_rent: 300,
        size_pyeong: 16,
        size_sqm: 52.9,
        unit_number: '2층',
      },
      {
        listing_type: '전세',
        room_type: '투룸',
        deposit: 32000,
        size_pyeong: 22,
        size_sqm: 72.7,
        unit_number: '18층',
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
        unit_number: '4층',
      },
      {
        listing_type: '월세',
        room_type: '오피스',
        deposit: 3000,
        monthly_rent: 130,
        size_pyeong: 22,
        size_sqm: 72.7,
        unit_number: '6층',
      },
    ],
  };
  return data[type] || data.generic;
}

// ===== LIVE 피드 — 핵심 차별화 포인트 =====
// 실시간 정보: 주차잔여, 대기인원, 혼잡도, 이벤트, 시설현황
// 이 데이터가 "앱 설치 + 건물 스캔" 허들을 넘게 하는 결정적 가치
function generateLiveFeeds(type, buildingName) {
  const data = {
    office: [
      {
        feed_type: 'update',
        title: '🅿️ B2 주차장 잔여 43/180대',
        subtitle: '여유 — B1 만차, B3 잔여 12대',
        time_label: '방금 전',
      },
      {
        feed_type: 'congestion',
        title: '☕ 1F 투썸플레이스 대기 없음',
        subtitle: '평일 오후 한산 · 좌석 여유',
        time_label: '2분 전',
      },
      {
        feed_type: 'congestion',
        title: '👥 현재 혼잡도: 보통',
        subtitle: '평소 대비 -12% · 엘리베이터 대기 약 1분',
        time_label: '5분 전',
      },
      {
        feed_type: 'promotion',
        title: '🎁 9F 위워크 1일 무료체험',
        subtitle: '이번 주 한정 · 데이패스 0원 이벤트',
        time_label: '15분 전',
      },
      {
        feed_type: 'update',
        title: '📦 1F 무인택배함 미수령 12건',
        subtitle: '잔여 보관함 8칸 · 48시간 초과 2건',
        time_label: '1시간 전',
      },
    ],
    commercial: [
      {
        feed_type: 'promotion',
        title: '🛍️ 1F 올리브영 전품목 1+1',
        subtitle: '오늘 22시까지 · 일부 브랜드 제외',
        time_label: '방금 전',
      },
      {
        feed_type: 'update',
        title: '🅿️ B1 주차장 잔여 28/150대',
        subtitle: '보통 — 주말 혼잡 예상, B2 잔여 45대',
        time_label: '3분 전',
      },
      {
        feed_type: 'congestion',
        title: '🍽️ 3F 푸드코트 평균 대기 8분',
        subtitle: '교동짬뽕 7팀 · 홍콩반점 4팀 대기중',
        time_label: '5분 전',
      },
      {
        feed_type: 'congestion',
        title: '👥 현재 혼잡도: 혼잡',
        subtitle: '주말 평균 대비 +31% · 에스컬레이터 혼잡',
        time_label: '10분 전',
      },
      {
        feed_type: 'promotion',
        title: '👟 5F ABC마트 시즌오프 최대 70%',
        subtitle: '나이키·아디다스·뉴발란스 대상',
        time_label: '1시간 전',
      },
    ],
    residential: [
      {
        feed_type: 'update',
        title: '📦 무인택배함 잔여 7칸',
        subtitle: '미수령 23건 · 48시간 초과 5건 반송 예정',
        time_label: '방금 전',
      },
      {
        feed_type: 'update',
        title: '🅿️ B1 주차장 잔여 67/380대',
        subtitle: '여유 — 외부차량 B3 안내중',
        time_label: '3분 전',
      },
      {
        feed_type: 'event',
        title: '🔧 2호 엘리베이터 점검 예정',
        subtitle: '14:00-16:00 · 1호/3호 정상운행',
        time_label: '30분 전',
      },
      {
        feed_type: 'update',
        title: '💰 1월 관리비 고지 (평균 18.2만원)',
        subtitle: '전월 대비 +8% · 난방비 증가',
        time_label: '2시간 전',
      },
      {
        feed_type: 'event',
        title: '🚧 단지 내 도로 보수공사',
        subtitle: '2/22~2/25 · 정문 우회 안내',
        time_label: '오늘',
      },
    ],
    mixed: [
      {
        feed_type: 'update',
        title: '🅿️ B1 주차장 잔여 31/120대',
        subtitle: '보통 — 3시간 무료주차 (매장 이용 시)',
        time_label: '방금 전',
      },
      {
        feed_type: 'congestion',
        title: '🍽️ 3F 을지로골뱅이 대기 8팀',
        subtitle: '예상 대기시간 약 25분',
        time_label: '3분 전',
      },
      {
        feed_type: 'congestion',
        title: '👥 현재 혼잡도: 보통',
        subtitle: '평소 대비 +5% · 1F 로비 다소 혼잡',
        time_label: '5분 전',
      },
      {
        feed_type: 'promotion',
        title: '☕ 1F 스타벅스 해피아워',
        subtitle: '14-17시 음료 사이즈업 무료',
        time_label: '30분 전',
      },
      {
        feed_type: 'event',
        title: '🌿 RF 옥상정원 일몰뷰 추천',
        subtitle: '오늘 일몰 18:12 · 현재 개방중',
        time_label: '1시간 전',
      },
    ],
    hotel: [
      {
        feed_type: 'congestion',
        title: '🛎️ 체크인 대기 약 5분',
        subtitle: '프런트 3개 창구 운영중',
        time_label: '방금 전',
      },
      {
        feed_type: 'promotion',
        title: '🍽️ 2F 런치뷔페 잔여석 12석',
        subtitle: '11:30-14:00 · 65,000원/성인',
        time_label: '10분 전',
      },
      {
        feed_type: 'event',
        title: '🍸 22F 루프탑바 오늘 18시 오픈',
        subtitle: '해피아워 18-20시 칵테일 30% 할인',
        time_label: '30분 전',
      },
      {
        feed_type: 'update',
        title: '🏊 5F 수영장 현재 이용 12/30명',
        subtitle: '여유 · 스파 16시부터 점검',
        time_label: '1시간 전',
      },
      {
        feed_type: 'update',
        title: '🅿️ 발렛파킹 잔여 18대',
        subtitle: '일반주차 B1 잔여 23대',
        time_label: '2시간 전',
      },
    ],
    hospital: [
      {
        feed_type: 'congestion',
        title: '🏥 외래 접수 대기 약 15분',
        subtitle: '내과 23명 · 정형외과 12명 대기중',
        time_label: '방금 전',
      },
      {
        feed_type: 'update',
        title: '🅿️ B1 주차장 잔여 52/230대',
        subtitle: '보통 — 응급실 전용 B1-A구역',
        time_label: '5분 전',
      },
      {
        feed_type: 'event',
        title: '🔬 5F 건강검진센터 예약 가능',
        subtitle: '2월 잔여 슬롯 7건 · 당일 접수 불가',
        time_label: '30분 전',
      },
      {
        feed_type: 'update',
        title: '💊 1F 온누리약국 현재 대기 3명',
        subtitle: '처방전 조제 평균 10분',
        time_label: '1시간 전',
      },
      {
        feed_type: 'congestion',
        title: '🚑 응급실 현재 혼잡',
        subtitle: '경증환자 대기 약 40분 · 중증 즉시',
        time_label: '2시간 전',
      },
    ],
    school: [
      {
        feed_type: 'congestion',
        title: '🍽️ 학생식당 현재 대기 15팀',
        subtitle: '11:30-12:30 피크타임 · 교직원식당 3팀',
        time_label: '방금 전',
      },
      {
        feed_type: 'update',
        title: '📚 3F 열람실 잔여석 23/120석',
        subtitle: '시험기간 혼잡 · 24시간 개방중',
        time_label: '10분 전',
      },
      {
        feed_type: 'event',
        title: '📢 중간고사 일정 공지',
        subtitle: '3/10~3/14 · 시간표 학과사무실 확인',
        time_label: '1시간 전',
      },
      {
        feed_type: 'update',
        title: '🅿️ B1 주차장 잔여 15/80대',
        subtitle: '혼잡 — 정문 임시주차 안내중',
        time_label: '2시간 전',
      },
    ],
    generic: [
      {
        feed_type: 'update',
        title: '🅿️ B1 주차장 잔여 15/60대',
        subtitle: '보통 — 1시간 무료주차',
        time_label: '방금 전',
      },
      {
        feed_type: 'congestion',
        title: '👥 현재 혼잡도: 여유',
        subtitle: '평소 대비 -18%',
        time_label: '5분 전',
      },
      {
        feed_type: 'event',
        title: '🏪 1F 편의점 도시락 할인 중',
        subtitle: '12-14시 한정 · 전 품목 10% 할인',
        time_label: '15분 전',
      },
      {
        feed_type: 'update',
        title: '📦 무인택배함 잔여 3칸',
        subtitle: '미수령 8건 · 24시간 보관',
        time_label: '1시간 전',
      },
    ],
  };
  return data[type] || data.generic;
}

// ===== 프로모션 배너 =====
function generatePromotion(type, buildingName) {
  const promos = {
    office: {
      title: `${buildingName} 첫 스캔 보너스 + 투썸 제휴`,
      reward_points: 150,
      condition_text: '첫 스캔 100P + 1F 투썸플레이스 아메리카노 30% 할인 쿠폰',
    },
    commercial: {
      title: '이 건물 매장 리뷰 이벤트',
      reward_points: 300,
      condition_text: '매장 3곳 리뷰 작성 시 포인트 3배 적립 + 올리브영 5,000원 할인권',
    },
    residential: {
      title: '우리 동네 스캔 챌린지',
      reward_points: 200,
      condition_text: '주변 건물 5곳 스캔 완료 시 보너스 + 배달의민족 3,000원 쿠폰',
    },
    mixed: {
      title: `${buildingName} 탐험 보너스`,
      reward_points: 250,
      condition_text: '모든 탭 확인 시 추가 포인트 + 1F 스타벅스 사이즈업 쿠폰',
    },
    hotel: {
      title: '호텔 투숙객 전용 혜택',
      reward_points: 500,
      condition_text: '스캔 시 2F 뷔페 10% 할인 + 5F 스파 무료 이용권(1회)',
    },
    hospital: {
      title: '건강검진 예약 혜택',
      reward_points: 200,
      condition_text: '스캔 후 5F 건강검진센터 예약 시 10% 할인',
    },
    school: {
      title: '캠퍼스 탐방 보너스',
      reward_points: 100,
      condition_text: '학교 건물 3곳 스캔 시 학생식당 무료 식권 1매',
    },
    generic: {
      title: `${buildingName} 스캔 보너스!`,
      reward_points: 100,
      condition_text: '이 건물을 스캔하고 포인트를 받으세요 · 주변 맛집 할인 쿠폰 증정',
    },
  };
  return promos[type] || promos.generic;
}

// ===== 관광 정보 =====
function generateTourism(type, buildingName) {
  const data = {
    hotel: {
      attraction_name: buildingName,
      attraction_name_en: 'Premium Hotel & Resort',
      rating: 4.4,
      review_count: 2891,
      congestion: '보통',
      hours: '체크인 15:00 / 체크아웃 11:00',
      admission_fee: '스탠다드룸 189,000원~',
      description: `${buildingName}은 도심 속 프리미엄 호텔로, 루프탑바와 뷔페 레스토랑이 유명합니다. 22층 스카이라운지에서 도시 야경을 감상할 수 있으며, 5층 피트니스·수영장은 투숙객 무료 이용 가능합니다.`,
    },
    hospital: {
      attraction_name: buildingName,
      rating: 4.1,
      review_count: 1234,
      congestion: '혼잡',
      hours: '평일 09:00-17:30 / 토 09:00-12:00',
      description: `${buildingName}은 내과, 정형외과, 산부인과 등 18개 진료과를 운영하는 종합병원입니다. 5층 건강검진센터와 24시간 응급실을 갖추고 있습니다.`,
    },
    school: {
      attraction_name: buildingName,
      attraction_name_en: 'University Campus',
      rating: 4.0,
      review_count: 567,
      congestion: '보통',
      hours: '개방시간 06:00-22:00',
      description: `${buildingName} 캠퍼스는 도심형 대학으로, 중앙도서관과 학생 편의시설이 잘 갖추어져 있습니다. 일반인도 학생식당 이용이 가능합니다.`,
    },
    generic: {
      attraction_name: buildingName,
      rating: 3.9,
      review_count: 234,
      congestion: '여유',
      hours: '09:00 - 22:00',
      description: `${buildingName} 주변은 다양한 편의시설과 음식점이 밀집한 지역입니다. 대중교통 접근성이 좋으며, 도보 5분 거리에 지하철역이 위치해 있습니다.`,
    },
  };
  // office/commercial/residential/mixed 등은 generic 사용
  return data[type] || data.generic;
}

/**
 * building_use 기반 합리적 폴백 데이터 생성
 * @param {string} buildingUse - 건물 용도
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
    liveFeeds: generateLiveFeeds(type, buildingName),
    promotion: generatePromotion(type, buildingName),
  };
}

export default { generateFallbackData };
