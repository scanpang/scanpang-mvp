/**
 * ScanPang 다크 테마 상수
 * - 앱 전체에서 일관된 디자인을 유지하기 위한 테마 정의
 */

// 메인 컬러 팔레트
export const COLORS = {
  // 배경 색상
  background: '#0A0E27',           // 메인 배경 (딥 네이비)
  cardBackground: 'rgba(255,255,255,0.08)', // 카드 배경 (반투명 화이트)
  cardBackgroundSolid: '#141833',  // 카드 배경 (불투명 대체용)
  surface: 'rgba(255,255,255,0.04)',       // 서피스 배경

  // 액센트 색상
  blue: '#4A90D9',     // 메인 액센트 (블루)
  orange: '#FF8C00',   // 보조 액센트 (오렌지)
  green: '#00C853',    // 성공/활성 상태 (그린)
  red: '#FF5252',      // 에러/위험 상태 (레드)

  // 텍스트 색상
  textPrimary: '#FFFFFF',   // 주요 텍스트 (화이트)
  textSecondary: '#B0B0B0', // 보조 텍스트 (WCAG AA 대비율 개선)
  textMuted: '#616161',     // 비활성 텍스트

  // 보더 및 구분선
  border: 'rgba(255,255,255,0.12)',
  divider: 'rgba(255,255,255,0.06)',

  // 상태 색상
  live: '#FF5252',     // 라이브 상태 표시
  online: '#00C853',   // 온라인 표시
  offline: '#9E9E9E',  // 오프라인 표시

  // 글라스 효과 색상
  glassHeavy: 'rgba(255,255,255,0.12)',
  glassBorder: 'rgba(255,255,255,0.18)',

  // 틴트 색상
  blueTint: 'rgba(74,144,217,0.15)',
  orangeTint: 'rgba(255,140,0,0.15)',
  greenTint: 'rgba(0,200,83,0.15)',
  redTint: 'rgba(255,82,82,0.15)',
};

// 타이포그래피 스타일
export const TYPOGRAPHY = {
  // 제목 스타일
  h1: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  // 본문 스타일
  body: {
    fontSize: 15,
    fontWeight: '400',
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  // 캡션 스타일
  caption: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
  },
  // 버튼 텍스트
  button: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
};

// 간격 (spacing) 상수
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// 애니메이션 상수
export const ANIMATION = {
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  spring: {
    default: { friction: 8, tension: 100 },
    gentle: { friction: 10, tension: 65 },
    bouncy: { friction: 4, tension: 120 },
  },
  stagger: {
    fast: 60,
    normal: 80,
    slow: 120,
  },
};

// 터치 상수
export const TOUCH = {
  minSize: 44,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
};

// 카드 스타일 기본값
export const CARD_STYLE = {
  backgroundColor: COLORS.cardBackground,
  borderRadius: 16,
  padding: SPACING.lg,
  borderWidth: 1,
  borderColor: COLORS.border,
};

// 글라스 카드 스타일
export const CARD_STYLE_GLASS = {
  backgroundColor: COLORS.glassHeavy,
  borderRadius: 16,
  padding: SPACING.lg,
  borderWidth: 1,
  borderColor: COLORS.glassBorder,
};

// 그림자 스타일 (Android + iOS)
export const SHADOW = {
  light: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
  },
};

export default {
  COLORS,
  TYPOGRAPHY,
  SPACING,
  ANIMATION,
  TOUCH,
  CARD_STYLE,
  CARD_STYLE_GLASS,
  SHADOW,
};
