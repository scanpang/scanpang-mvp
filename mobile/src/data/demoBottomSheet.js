/**
 * 바텀시트 리뉴얼 더미 데이터
 * - API 연동 전 UI 데모용
 * - 대형 건물 (Grade L) 기준 — 모든 모듈 시연 가능
 * - 페르소나별 카드 순서 지원
 */
import { PersonaType, PERSONA_CONFIGS } from './persona';

// 건물 등급
export const BuildingGrade = { S: 'S', M: 'M', L: 'L' };

// 카드 타입
export const CardTier = { FREE: 'FREE', PREMIUM: 'PREMIUM', AD: 'AD', REWARD: 'REWARD' };

// 모듈 타입
export const ModuleType = {
  FOOD: 'FOOD',
  XRAY: 'XRAY',
  REAL_ESTATE: 'REAL_ESTATE',
  OVERVIEW: 'OVERVIEW',
  BLOG: 'BLOG',
  TOURISM: 'TOURISM',
  REGISTRY: 'REGISTRY',
  COMMERCE: 'COMMERCE',
  SAFETY: 'SAFETY',
  STORY: 'STORY',
  AD: 'AD',
  REWARD: 'REWARD',
};

// ===== 대형 건물 더미 =====
export const demoBuilding = {
  id: 'demo_building_1',
  name: '강남 파이낸스 센터',
  address: '서울 강남구 역삼동 테헤란로 152',
  floors: 32,
  area: 68500.0,
  builtYear: 2001,
  grade: BuildingGrade.L,
  isLandmark: true,
  distance: 25,
};

// 카테고리 필터
export const demoCategoryFilters = [
  { key: 'ALL', label: '전체', emoji: '' },
  { key: 'FOOD', label: '맛집', emoji: '🍽' },
  { key: 'REAL_ESTATE', label: '부동산', emoji: '🏠' },
  { key: 'XRAY', label: 'X-Ray', emoji: '👁' },
  { key: 'COMMERCE', label: '상권', emoji: '📊' },
  { key: 'BLOG', label: '블로그', emoji: '📰' },
];

// ===== 전체 인사이트 카드 풀 =====
const ALL_CARDS = {
  [ModuleType.FOOD]: {
    id: 'food_1',
    moduleType: ModuleType.FOOD,
    emoji: '🍽',
    title: '맛집 · 카페',
    highlight: '32개 업체 중 18곳 영업중 · 평균 ⭐ 4.2',
    badge: { text: '⭐ 4.2', color: '#EAB308' },
    tier: CardTier.FREE,
    colorAccent: '#EAB308',
    detailItems: [
      { name: '스타벅스 R 강남파이낸스점', subtitle: '1층 · 커피전문점', rightText: '⭐ 4.3', status: '영업중', statusColor: '#22C55E' },
      { name: '도쿄라멘 역삼점', subtitle: 'B1층 · 일식', rightText: '⭐ 4.5', status: '영업중', statusColor: '#22C55E' },
      { name: '봉추찜닭 강남점', subtitle: 'B1층 · 한식', rightText: '⭐ 4.0', status: '영업중', statusColor: '#22C55E' },
      { name: '써브웨이 강남파이낸스점', subtitle: '1층 · 샌드위치', rightText: '⭐ 3.8', status: '브레이크타임', statusColor: '#F59E0B' },
      { name: '맥도날드 강남파이낸스점', subtitle: 'B1층 · 패스트푸드', rightText: '⭐ 3.5', status: '영업중', statusColor: '#22C55E' },
    ],
  },
  [ModuleType.XRAY]: {
    id: 'xray_1',
    moduleType: ModuleType.XRAY,
    emoji: '👁',
    title: 'X-Ray 투시',
    highlight: 'B2~32F · 금융 40% · F&B 25% · 사무실 30% · 공실 5%',
    badge: { text: 'LIVE', color: '#8B5CF6' },
    tier: CardTier.FREE,
    colorAccent: '#8B5CF6',
    detailItems: [
      { name: 'B2~B1', subtitle: '주차장 · 푸드코트', rightText: 'F&B 12곳', status: '영업중 8', statusColor: '#22C55E' },
      { name: '1F', subtitle: '로비 · 커피숍 · 은행', rightText: '금융 3곳', status: '영업중', statusColor: '#22C55E' },
      { name: '2F', subtitle: '은행 · 증권사', rightText: '금융센터', status: '⭐P', statusColor: '#F59E0B' },
      { name: '3~5F', subtitle: '보험 · 자산운용', rightText: '금융 8곳', status: '영업중', statusColor: '#22C55E' },
      { name: '6~25F', subtitle: '일반 사무실', rightText: 'IT/금융 혼합', status: '입주율 95%', statusColor: '#3B82F6' },
      { name: '26~30F', subtitle: '프리미엄 오피스', rightText: '대형 법무법인', status: '입주율 100%', statusColor: '#22C55E' },
      { name: '31~32F', subtitle: '스카이라운지 · 레스토랑', rightText: 'F&B 2곳', status: '영업중', statusColor: '#22C55E' },
    ],
  },
  [ModuleType.REAL_ESTATE]: {
    id: 'estate_1',
    moduleType: ModuleType.REAL_ESTATE,
    emoji: '🏠',
    title: '부동산 · 시세',
    highlight: '사무실 매물 5건 · 평당 월세 8.2~12만 · 보증금 3억~',
    badge: { text: '매물 5', color: '#22C55E' },
    tier: CardTier.FREE,
    colorAccent: '#22C55E',
    detailItems: [
      { name: '12F 사무실 45평', subtitle: '보증금 3억 / 월 420만', rightText: '평당 9.3만', status: '즉시입주', statusColor: '#22C55E' },
      { name: '18F 사무실 60평', subtitle: '보증금 5억 / 월 600만', rightText: '평당 10만', status: '2월 입주', statusColor: '#3B82F6' },
      { name: '8F 사무실 30평', subtitle: '보증금 2억 / 월 270만', rightText: '평당 9만', status: '즉시입주', statusColor: '#22C55E' },
      { name: 'B1 상가 15평', subtitle: '보증금 1.5억 / 월 180만', rightText: '평당 12만', status: '협의', statusColor: '#F59E0B' },
      { name: '3F 사무실 80평', subtitle: '보증금 7억 / 월 720만', rightText: '평당 9만', status: '3월 입주', statusColor: '#3B82F6' },
    ],
  },
  [ModuleType.REGISTRY]: {
    id: 'registry_1',
    moduleType: ModuleType.REGISTRY,
    emoji: '🔐',
    title: '등기부 · 소유권 분석',
    highlight: '소유자, 근저당, 전세권, 가압류 확인',
    badge: { text: '💎 PRO', color: '#F59E0B' },
    tier: CardTier.PREMIUM,
    colorAccent: '#F59E0B',
    detailItems: [
      { name: '소유자', subtitle: '○○자산운용 (2015년 취득)', rightText: '', status: '확인됨', statusColor: '#22C55E' },
      { name: '근저당', subtitle: '○○은행 350억', rightText: '', status: '설정', statusColor: '#F59E0B' },
    ],
  },
  [ModuleType.COMMERCE]: {
    id: 'commerce_1',
    moduleType: ModuleType.COMMERCE,
    emoji: '📊',
    title: '상권 · 유동인구',
    highlight: '일 유동인구 45,200명 · 점심 피크 12~13시 · 주말 -35%',
    badge: { text: '💎 PRO', color: '#F59E0B' },
    tier: CardTier.PREMIUM,
    colorAccent: '#F59E0B',
    detailItems: [
      { name: '일 평균 유동인구', subtitle: '45,200명', rightText: '역삼동 상위 5%', status: '🔥', statusColor: '#EF4444' },
      { name: '피크 시간대', subtitle: '12:00~13:00', rightText: '점심 직장인 몰림', status: '피크', statusColor: '#F59E0B' },
      { name: '주요 연령대', subtitle: '30~40대', rightText: '직장인 비율 78%', status: '비즈니스', statusColor: '#3B82F6' },
      { name: '주말 대비', subtitle: '-35%', rightText: '평일 중심 상권', status: '평일형', statusColor: '#8B5CF6' },
      { name: 'F&B 포화도', subtitle: '72%', rightText: '신규 진입 주의', status: '⚠️', statusColor: '#F59E0B' },
    ],
  },
  [ModuleType.TOURISM]: {
    id: 'tourism_1',
    moduleType: ModuleType.TOURISM,
    emoji: '✈️',
    title: '관광 · 문화',
    highlight: '강남역 도보 8분 · 테헤란로 IT벨리 · 코엑스 근접',
    badge: { text: '📸', color: '#EC4899' },
    tier: CardTier.FREE,
    colorAccent: '#EC4899',
    detailItems: [
      { name: '강남역', subtitle: '도보 8분', rightText: '2호선/신분당선', status: '🚇', statusColor: '#3B82F6' },
      { name: '코엑스', subtitle: '도보 15분', rightText: '컨벤션/쇼핑', status: '🏬', statusColor: '#8B5CF6' },
      { name: '봉은사', subtitle: '도보 10분', rightText: '전통사찰', status: '🏛️', statusColor: '#22C55E' },
      { name: '테헤란로 IT벨리', subtitle: '현 위치', rightText: '한국 실리콘밸리', status: '💻', statusColor: '#0EA5E9' },
    ],
  },
  [ModuleType.STORY]: {
    id: 'story_1',
    moduleType: ModuleType.STORY,
    emoji: '📖',
    title: '건물 스토리',
    highlight: '2001년 준공 · 강남 금융중심 랜드마크 · 32층 스카이라운지',
    badge: { text: '🔖 Story', color: '#8B5CF6' },
    tier: CardTier.FREE,
    colorAccent: '#8B5CF6',
    detailItems: [
      { name: '2001년', subtitle: '건물 준공 (업무시설)', rightText: '', status: '', statusColor: '' },
      { name: '2010년', subtitle: '테헤란로 IT벨리 중심지로 부상', rightText: '', status: '', statusColor: '' },
      { name: '2017년', subtitle: '리모델링 · 내진 보강 완료', rightText: '', status: '', statusColor: '' },
      { name: '현재', subtitle: '강남 금융중심 랜드마크 · 입주율 95%', rightText: '', status: '', statusColor: '' },
    ],
  },
  [ModuleType.BLOG]: {
    id: 'blog_1',
    moduleType: ModuleType.BLOG,
    emoji: '📰',
    title: '블로그 · 리뷰',
    highlight: '네이버 블로그 187건 · 인스타 #강남파이낸스센터',
    badge: { text: '187건', color: '#3B82F6' },
    tier: CardTier.FREE,
    colorAccent: '#3B82F6',
    detailItems: [
      { name: '강남 파이낸스센터 맛집 투어', subtitle: '네이버 블로그 · 1일 전', rightText: '', status: '조회 5.2K', statusColor: '#3B82F6' },
      { name: '테헤란로 오피스 임대 후기', subtitle: '네이버 블로그 · 3일 전', rightText: '', status: '조회 2.1K', statusColor: '#3B82F6' },
      { name: '#강남파이낸스센터 스카이라운지', subtitle: '인스타그램 · 5일 전', rightText: '', status: '좋아요 340', statusColor: '#EC4899' },
    ],
  },
  [ModuleType.SAFETY]: {
    id: 'safety_1',
    moduleType: ModuleType.SAFETY,
    emoji: '🛡️',
    title: '안전 · 에너지',
    highlight: '내진 1등급 · 에너지효율 B+ · 소방검사 적합',
    badge: { text: '안전', color: '#22C55E' },
    tier: CardTier.FREE,
    colorAccent: '#22C55E',
    detailItems: [
      { name: '내진 설계', subtitle: '1등급', rightText: '2017년 보강 완료', status: '✅', statusColor: '#22C55E' },
      { name: '에너지 효율', subtitle: 'B+ 등급', rightText: '연간 에너지 비용 절감', status: '⚡', statusColor: '#F59E0B' },
      { name: '소방 검사', subtitle: '적합', rightText: '2024년 12월 검사', status: '🔥', statusColor: '#22C55E' },
      { name: '승강기 검사', subtitle: '적합', rightText: '32인승 × 12대', status: '🛗', statusColor: '#22C55E' },
    ],
  },
  [ModuleType.OVERVIEW]: {
    id: 'overview_1',
    moduleType: ModuleType.OVERVIEW,
    emoji: '🏢',
    title: '건물 개요',
    highlight: '32층 · 68,500㎡ · 2001년 · 업무시설 · 주차 820대',
    badge: null,
    tier: CardTier.FREE,
    colorAccent: '#6366F1',
    detailItems: [
      { name: '용도', subtitle: '업무시설 (오피스)', rightText: '근린생활시설 병합', status: '', statusColor: '' },
      { name: '규모', subtitle: '지상 32층 / 지하 7층', rightText: '총 68,500㎡', status: '', statusColor: '' },
      { name: '준공', subtitle: '2001년', rightText: '2017년 리모델링', status: '', statusColor: '' },
      { name: '주차', subtitle: '820대', rightText: '지하 B3~B7', status: '', statusColor: '' },
      { name: '엘리베이터', subtitle: '12대', rightText: '32인승 고속', status: '', statusColor: '' },
    ],
  },
};

// AD 카드 2개 (맛집 프로모션 + 중개사)
const AD_CARD_1 = {
  id: 'ad_1',
  moduleType: ModuleType.AD,
  emoji: '🔥',
  title: '📢 오늘의 프로모션',
  highlight: '도쿄라멘 · 스캔 고객 15% 할인 + 음료 무료',
  badge: { text: 'AD', color: '#F59E0B' },
  tier: CardTier.AD,
  colorAccent: '#F59E0B',
  ctaText: '⭐ 쿠폰 받기 +50P',
  detailItems: [
    { name: '도쿄라멘 역삼점', subtitle: '스캔 고객 전용 15% 할인 + 음료 무료', rightText: '', status: '쿠폰 사용 가능', statusColor: '#F59E0B' },
  ],
};

const AD_CARD_2 = {
  id: 'ad_2',
  moduleType: ModuleType.AD,
  emoji: '🏠',
  title: '📢 강남 전문 중개사',
  highlight: '역삼동 한빛공인중개사 · 파이낸스센터 전문 · 즉시 상담',
  badge: { text: 'AD', color: '#F59E0B' },
  tier: CardTier.AD,
  colorAccent: '#F59E0B',
  ctaText: '📞 상담 요청',
  detailItems: [
    { name: '한빛공인중개사', subtitle: '역삼동 15년 · 파이낸스센터 전문', rightText: '', status: '즉시 상담 가능', statusColor: '#22C55E' },
  ],
};

const REWARD_CARD = {
  id: 'reward_1',
  moduleType: ModuleType.REWARD,
  emoji: '🎁',
  title: '스캔 완료! +100P',
  highlight: '▶ 광고 보고 추가 50P 받기',
  badge: { text: '+P', color: '#6366F1' },
  tier: CardTier.REWARD,
  colorAccent: '#6366F1',
  ctaText: '▶ 광고 보고 50P 받기',
  detailItems: [],
};

// ===== 페르소나별 카드 목록 생성 =====
export const getDemoCards = (persona) => {
  const config = PERSONA_CONFIGS[persona] || PERSONA_CONFIGS[PersonaType.EXPLORER];
  const ordered = [];

  // 페르소나 카드 순서대로 추가
  for (const moduleType of config.cardOrder) {
    const card = ALL_CARDS[moduleType];
    if (card) ordered.push(card);
  }

  // 나머지 카드도 추가 (중복 제거)
  const addedTypes = new Set(ordered.map(c => c.moduleType));
  for (const [type, card] of Object.entries(ALL_CARDS)) {
    if (!addedTypes.has(type)) ordered.push(card);
  }

  // AD 카드 1: 2번째 뒤에 삽입
  const ad1Idx = Math.min(2, ordered.length);
  ordered.splice(ad1Idx, 0, AD_CARD_1);

  // AD 카드 2: 6번째 뒤에 삽입 (1피드 최대 2광고)
  const ad2Idx = Math.min(6, ordered.length);
  ordered.splice(ad2Idx, 0, AD_CARD_2);

  // REWARD 카드: 마지막
  ordered.push(REWARD_CARD);

  return ordered;
};

// ===== 페르소나별 AI 요약 (대형 건물 기준) =====
export const getDemoAiSummary = (persona, building) => {
  const name = building?.name || '강남 파이낸스 센터';
  switch (persona) {
    case PersonaType.TOURIST:
      return `Gangnam Finance Center — 32F landmark, restaurants in B1, Starbucks on 1F, 8min walk to Gangnam Stn`;
    case PersonaType.FOODIE:
      return `B1 도쿄라멘 평점 4.5 — 영업중, 1층 스타벅스R · 점심 피크 12~13시`;
    case PersonaType.INVESTOR:
      return `사무실 매물 5건 · 평당 월세 8.2~12만 · 입주율 95% · 등기부 확인 가능`;
    case PersonaType.ENTREPRENEUR:
      return `역삼동 상권 A · F&B 포화도 72% · 일 유동인구 45,200 · B1 상가 평당 12만`;
    case PersonaType.EXPLORER:
      return `2001년 준공 강남 금융 랜드마크 · 32층 스카이라운지 · 테헤란로 IT벨리의 상징`;
    case PersonaType.ANALYST:
      return `역삼동 상권 A등급 · 일 유동인구 45,200명 · 직장인 78% · F&B 포화도 72%`;
    default:
      return `2001년 준공 강남 금융 랜드마크 · 32층 스카이라운지`;
  }
};

// ===== 페르소나별 퀵 칩 (대형 건물 기준) =====
export const getDemoQuickChips = (persona) => {
  switch (persona) {
    case PersonaType.TOURIST:
      return [
        { icon: '🟢', label: 'Open 18', key: 'open' },
        { icon: '⭐', label: '4.2', key: 'rating' },
        { icon: '🅿️', label: '820', key: 'parking' },
        { icon: '🎫', label: 'Coupon', key: 'coupon' },
        { icon: '🚇', label: '8min', key: 'station' },
      ];
    case PersonaType.FOODIE:
      return [
        { icon: '🟢', label: '영업중 18', key: 'open' },
        { icon: '⭐', label: '4.2', key: 'rating' },
        { icon: '🎫', label: '쿠폰', key: 'coupon' },
        { icon: '🅿️', label: '820대', key: 'parking' },
        { icon: '🍽️', label: '32곳', key: 'restaurants' },
      ];
    case PersonaType.INVESTOR:
      return [
        { icon: '💰', label: '평당8.2~12만', key: 'rent' },
        { icon: '📈', label: '매물 5', key: 'listing' },
        { icon: '🏗️', label: '2001년', key: 'builtYear' },
        { icon: '🔒', label: '등기부', key: 'registry' },
        { icon: '📊', label: '입주율95%', key: 'occupancy' },
      ];
    case PersonaType.ENTREPRENEUR:
      return [
        { icon: '📊', label: '상권 A', key: 'commerce' },
        { icon: '👥', label: '유동 45.2K', key: 'footTraffic' },
        { icon: '🍽', label: '포화 72%', key: 'competition' },
        { icon: '💰', label: '상가 12만/평', key: 'rent' },
        { icon: '🏠', label: 'B1 공실', key: 'vacancy' },
      ];
    case PersonaType.EXPLORER:
      return [
        { icon: '🏗️', label: '2001년', key: 'builtYear' },
        { icon: '📐', label: '68,500㎡', key: 'area' },
        { icon: '🏢', label: '32층', key: 'floors' },
        { icon: '📰', label: '블로그 187', key: 'blogCount' },
        { icon: '🏛️', label: '랜드마크', key: 'landmark' },
      ];
    case PersonaType.ANALYST:
      return [
        { icon: '📊', label: '상권 A', key: 'commerce' },
        { icon: '👥', label: '유동 45.2K', key: 'footTraffic' },
        { icon: '📈', label: '포화 72%', key: 'saturation' },
        { icon: '💰', label: '평당8.2~12만', key: 'rent' },
        { icon: '👔', label: '직장인 78%', key: 'workers' },
      ];
    default:
      return [
        { icon: '🏗️', label: '2001년', key: 'builtYear' },
        { icon: '📐', label: '68,500㎡', key: 'area' },
        { icon: '🏢', label: '32층', key: 'floors' },
        { icon: '📰', label: '블로그 187', key: 'blogCount' },
      ];
  }
};

// 하위 호환
export const demoAiSummary = getDemoAiSummary(PersonaType.EXPLORER, demoBuilding);
export const demoQuickChips = getDemoQuickChips(PersonaType.EXPLORER);
export const demoCards = getDemoCards(PersonaType.EXPLORER);
