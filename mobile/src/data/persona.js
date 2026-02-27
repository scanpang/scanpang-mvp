/**
 * 페르소나 시스템 — 타입 정의 + 설정 데이터 + 저장 유틸
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERSONA_KEY = '@scanpang_persona';

// ===== 페르소나 타입 =====
export const PersonaType = {
  TOURIST: 'TOURIST',
  FOODIE: 'FOODIE',
  INVESTOR: 'INVESTOR',
  ENTREPRENEUR: 'ENTREPRENEUR',
  EXPLORER: 'EXPLORER',
  ANALYST: 'ANALYST',
};

// ===== 모듈 타입 (바텀시트 카드용) =====
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

// ===== 6개 페르소나 설정 =====
export const PERSONA_CONFIGS = {
  [PersonaType.TOURIST]: {
    type: PersonaType.TOURIST,
    emoji: '🌏',
    nameKo: '외국인 관광객',
    nameEn: 'Tourist',
    cardOrder: [ModuleType.TOURISM, ModuleType.FOOD, ModuleType.OVERVIEW, ModuleType.XRAY],
    chipPriority: ['open', 'rating', 'parking', 'coupon'],
    aiTone: 'tourist',
  },
  [PersonaType.FOODIE]: {
    type: PersonaType.FOODIE,
    emoji: '🍔',
    nameKo: '맛집 탐색러',
    nameEn: 'Foodie',
    cardOrder: [ModuleType.FOOD, ModuleType.XRAY, ModuleType.BLOG, ModuleType.OVERVIEW],
    chipPriority: ['open', 'rating', 'coupon', 'parking'],
    aiTone: 'foodie',
  },
  [PersonaType.INVESTOR]: {
    type: PersonaType.INVESTOR,
    emoji: '💰',
    nameKo: '부동산 탐색자',
    nameEn: 'Investor',
    cardOrder: [ModuleType.REAL_ESTATE, ModuleType.REGISTRY, ModuleType.OVERVIEW, ModuleType.XRAY],
    chipPriority: ['yield', 'listing', 'builtYear', 'registry'],
    aiTone: 'investor',
  },
  [PersonaType.ENTREPRENEUR]: {
    type: PersonaType.ENTREPRENEUR,
    emoji: '🏪',
    nameKo: '자영업자·예비창업',
    nameEn: 'Entrepreneur',
    cardOrder: [ModuleType.COMMERCE, ModuleType.REAL_ESTATE, ModuleType.XRAY, ModuleType.SAFETY],
    chipPriority: ['commerce', 'footTraffic', 'competition', 'rent'],
    aiTone: 'entrepreneur',
  },
  [PersonaType.EXPLORER]: {
    type: PersonaType.EXPLORER,
    emoji: '📸',
    nameKo: '도시 탐험가',
    nameEn: 'Explorer',
    cardOrder: [ModuleType.STORY, ModuleType.TOURISM, ModuleType.BLOG, ModuleType.XRAY],
    chipPriority: ['builtYear', 'area', 'tenantCount', 'blogCount'],
    aiTone: 'explorer',
  },
  [PersonaType.ANALYST]: {
    type: PersonaType.ANALYST,
    emoji: '📊',
    nameKo: '상권 분석가',
    nameEn: 'Analyst',
    cardOrder: [ModuleType.COMMERCE, ModuleType.XRAY, ModuleType.REAL_ESTATE, ModuleType.SAFETY],
    chipPriority: ['commerce', 'footTraffic', 'saturation', 'rentPerPyeong'],
    aiTone: 'analyst',
  },
};

// 선택 팝업용 리스트 (2x3 그리드 순서)
export const PERSONA_LIST = [
  PERSONA_CONFIGS[PersonaType.TOURIST],
  PERSONA_CONFIGS[PersonaType.FOODIE],
  PERSONA_CONFIGS[PersonaType.INVESTOR],
  PERSONA_CONFIGS[PersonaType.ENTREPRENEUR],
  PERSONA_CONFIGS[PersonaType.EXPLORER],
  PERSONA_CONFIGS[PersonaType.ANALYST],
];

// ===== 페르소나별 AI 요약 (더미 — 템플릿 기반) =====
export const getPersonaAiSummary = (persona, building) => {
  const name = building?.name || '건물';
  switch (persona) {
    case PersonaType.TOURIST:
      return `Popular Korean restaurant street — ${name}, open now with ~15min wait`;
    case PersonaType.FOODIE:
      return `1층 ${name} 평점 4.1 — 영업중, 웨이팅 약 15분`;
    case PersonaType.INVESTOR:
      return `월세 100~130만 · 수익률 추정 5.2% · 등기부 확인 가능`;
    case PersonaType.ENTREPRENEUR:
      return `이매동 상권 B+ · F&B 과밀 주의 · 월세 100만~ · 1층 공실 없음`;
    case PersonaType.EXPLORER:
      return `2003년 준공 근린생활 · 이매동 먹자골목 · 1층 F&B 밀집`;
    case PersonaType.ANALYST:
      return `이매동 상권등급 B+ · 일 유동인구 2,340명 · F&B 점포 포화도 87%`;
    default:
      return `1층 ${name} 평점 4.1 — 영업중`;
  }
};

// ===== 페르소나별 퀵 칩 (더미) =====
export const getPersonaQuickChips = (persona) => {
  switch (persona) {
    case PersonaType.TOURIST:
      return [
        { icon: '🟢', label: 'Open 3', key: 'open' },
        { icon: '⭐', label: '4.1', key: 'rating' },
        { icon: '🅿️', label: 'Parking', key: 'parking' },
        { icon: '🎫', label: 'Coupon', key: 'coupon' },
      ];
    case PersonaType.FOODIE:
      return [
        { icon: '🟢', label: '영업중 3', key: 'open' },
        { icon: '⭐', label: '4.1', key: 'rating' },
        { icon: '🎫', label: '쿠폰', key: 'coupon' },
        { icon: '🅿️', label: '주차', key: 'parking' },
      ];
    case PersonaType.INVESTOR:
      return [
        { icon: '💰', label: '수익률 5.2%', key: 'yield' },
        { icon: '📈', label: '매물 2', key: 'listing' },
        { icon: '🏗️', label: '2003년', key: 'builtYear' },
        { icon: '🔒', label: '등기부', key: 'registry' },
      ];
    case PersonaType.ENTREPRENEUR:
      return [
        { icon: '📊', label: '상권 B+', key: 'commerce' },
        { icon: '👥', label: '유동 2.3K', key: 'footTraffic' },
        { icon: '🍽', label: 'F&B 포화', key: 'competition' },
        { icon: '💰', label: '월세 100~', key: 'rent' },
      ];
    case PersonaType.EXPLORER:
      return [
        { icon: '🏗️', label: '2003년', key: 'builtYear' },
        { icon: '📐', label: '206㎡', key: 'area' },
        { icon: '🍽', label: 'F&B 7곳', key: 'tenantCount' },
        { icon: '📰', label: '블로그 42', key: 'blogCount' },
      ];
    case PersonaType.ANALYST:
      return [
        { icon: '📊', label: '상권 B+', key: 'commerce' },
        { icon: '👥', label: '유동 2.3K', key: 'footTraffic' },
        { icon: '📈', label: '포화 87%', key: 'saturation' },
        { icon: '💰', label: '평당 6.6만', key: 'rentPerPyeong' },
      ];
    default:
      return [
        { icon: '🟢', label: '영업중 3', key: 'open' },
        { icon: '⭐', label: '4.1', key: 'rating' },
        { icon: '🅿️', label: '주차', key: 'parking' },
        { icon: '🎫', label: '쿠폰', key: 'coupon' },
      ];
  }
};

// ===== AsyncStorage 유틸 =====
export const savePersona = async (personaType) => {
  try {
    await AsyncStorage.setItem(PERSONA_KEY, personaType);
  } catch {}
};

export const loadPersona = async () => {
  try {
    const saved = await AsyncStorage.getItem(PERSONA_KEY);
    return saved || null;
  } catch {
    return null;
  }
};

export const hasPersonaSelected = async () => {
  try {
    const saved = await AsyncStorage.getItem(PERSONA_KEY);
    return saved !== null;
  } catch {
    return false;
  }
};
