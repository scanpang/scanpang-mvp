/**
 * ScanPang 디자인 시스템
 * - 홈: 화이트 클린 UI (토스/카카오뱅크 레퍼런스)
 * - 카메라/바텀시트: 다크 테마 유지
 */

// ===== 컬러 팔레트 =====
export const Colors = {
  // 배경
  bgWhite: '#FFFFFF',
  bgGray: '#F8F9FA',
  bgBlueGradientStart: '#2563EB',
  bgBlueGradientEnd: '#4F46E5',

  // 텍스트
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textWhite: '#FFFFFF',

  // 브랜드
  primaryBlue: '#2563EB',
  primaryBlueLight: '#EFF6FF',
  accentAmber: '#F59E0B',
  accentAmberLight: '#FFFBEB',
  successGreen: '#10B981',
  liveRed: '#EF4444',

  // 카드/보더
  borderLight: '#F3F4F6',
  borderDefault: '#E5E7EB',

  // 다크 (카메라 화면 / 바텀시트용)
  darkBg: '#1A1F2E',
  darkCard: 'rgba(255,255,255,0.08)',
  darkBorder: 'rgba(255,255,255,0.12)',
  darkTextPrimary: '#FFFFFF',
  darkTextSecondary: '#B0B0B0',
  darkTextMuted: '#616161',
};

// 기존 호환용 (다크 테마 - 카메라 화면에서 사용)
export const COLORS = {
  background: Colors.darkBg,
  cardBackground: Colors.darkCard,
  surface: 'rgba(255,255,255,0.04)',
  blue: Colors.primaryBlue,
  orange: Colors.accentAmber,
  green: Colors.successGreen,
  red: Colors.liveRed,
  textPrimary: Colors.darkTextPrimary,
  textSecondary: Colors.darkTextSecondary,
  textMuted: Colors.darkTextMuted,
  border: Colors.darkBorder,
  divider: 'rgba(255,255,255,0.06)',
  live: Colors.liveRed,
};

// ===== 그림자 =====
export const CardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 3,
};

export const CardShadowMedium = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 12,
  elevation: 5,
};

// ===== 타이포그래피 =====
export const TYPOGRAPHY = {
  h1: { fontSize: 28, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '600', color: Colors.textPrimary },
  body: { fontSize: 15, fontWeight: '400', color: Colors.textPrimary, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400', color: Colors.textSecondary, lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500', color: Colors.textSecondary, letterSpacing: 0.3 },
  button: { fontSize: 16, fontWeight: '600', color: Colors.textPrimary },
};

// ===== 간격 =====
export const SPACING = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
};

// ===== 터치 =====
export const TOUCH = {
  minSize: 44,
  hitSlop: { top: 8, bottom: 8, left: 8, right: 8 },
};

// 기존 호환
export const CARD_STYLE = {
  backgroundColor: Colors.bgWhite,
  borderRadius: 16,
  padding: SPACING.lg,
  borderWidth: 1,
  borderColor: Colors.borderLight,
};

export const SHADOW = {
  light: CardShadow,
  medium: CardShadowMedium,
};

export default { Colors, COLORS, TYPOGRAPHY, SPACING, TOUCH, CARD_STYLE, SHADOW };
