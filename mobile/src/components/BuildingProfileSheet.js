/**
 * BuildingProfileSheet - 하이브리드 피드 구조 바텀시트
 * - L1: 건물 DNA (헤더 + AI 요약)
 * - L2: 퀵 인사이트 칩 + 카테고리 필터
 * - L3: 인사이트 카드 피드 (아코디언)
 * - 다크 테마 (#08080D ~ #0A0A0F)
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SPACING, TOUCH } from '../constants/theme';
import { formatDistance } from '../utils/coordinate';
import {
  demoBuilding,
  demoCategoryFilters,
  getDemoCards,
  getDemoAiSummary,
  getDemoQuickChips,
  CardTier,
  ModuleType,
} from '../data/demoBottomSheet';
import { PersonaType, PERSONA_CONFIGS } from '../data/persona';

// Android LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SW } = Dimensions.get('window');

// ===== 디자인 토큰 (md 스펙) =====
const T = {
  bg: '#08080D',
  bgCard: 'rgba(255,255,255,0.02)',
  bgCardBorder: 'rgba(255,255,255,0.04)',
  bgCardExpanded: 'rgba(255,255,255,0.05)',
  bgCardExpandedBorder: 'rgba(255,255,255,0.1)',
  text1: '#F1F5F9',
  text2: 'rgba(255,255,255,0.4)',
  text3: 'rgba(255,255,255,0.3)',
  purple: '#8B5CF6',
  purpleLight: '#A78BFA',
  green: '#22C55E',
  yellow: '#F59E0B',
  red: '#EF4444',
  indigo: '#6366F1',
  blue: '#3B82F6',
};

// ===== 스켈레톤 Shimmer =====
const SkeletonPulse = ({ style }) => {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[s.skeleton, style, { opacity: anim }]} />;
};

const FeedSkeleton = () => (
  <View style={s.skeletonWrap}>
    {[1, 2, 3].map(i => (
      <SkeletonPulse key={i} style={{ width: '100%', height: 56, borderRadius: 12, marginBottom: 8 }} />
    ))}
  </View>
);

// ===== L1: 건물 DNA =====
const BuildingDNA = ({ building, aiSummary, onClose }) => (
  <View style={s.dna}>
    {/* 건물명 + 닫기 */}
    <View style={s.dnaRow}>
      <View style={s.dnaLeft}>
        <Text style={s.dnaName} numberOfLines={1}>{building?.name || '건물'}</Text>
        <Text style={s.dnaAddress} numberOfLines={1}>
          📍 {building?.address || ''}{building?.distance != null ? ` · ${formatDistance(building.distance)}` : ''}
        </Text>
      </View>
      <TouchableOpacity style={s.dnaCloseBtn} onPress={onClose} hitSlop={TOUCH.hitSlop}>
        <Text style={s.dnaCloseText}>✕</Text>
      </TouchableOpacity>
    </View>

    {/* AI 요약 박스 */}
    {aiSummary ? (
      <View style={s.aiBox}>
        <View style={s.aiBadge}>
          <Text style={s.aiBadgeText}>AI</Text>
        </View>
        <Text style={s.aiText} numberOfLines={2}>{aiSummary}</Text>
      </View>
    ) : null}
  </View>
);

// ===== L2: 퀵 인사이트 칩 =====
const QuickChips = ({ chips }) => (
  <GHScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    nestedScrollEnabled
    directionalLockEnabled
    style={s.chipsScroll}
    contentContainerStyle={s.chipsContent}
  >
    {chips.map(chip => (
      <View key={chip.key} style={s.chip}>
        <Text style={s.chipIcon}>{chip.icon}</Text>
        <Text style={s.chipLabel}>{chip.label}</Text>
      </View>
    ))}
  </GHScrollView>
);

// ===== L2: 카테고리 필터 =====
const CategoryFilter = ({ filters, activeFilter, onSelect }) => (
  <GHScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    nestedScrollEnabled
    directionalLockEnabled
    style={s.filterScroll}
    contentContainerStyle={s.filterContent}
  >
    {filters.map(f => {
      const isActive = activeFilter === f.key;
      return (
        <TouchableOpacity
          key={f.key}
          style={[s.filterChip, isActive && s.filterChipActive]}
          onPress={() => onSelect(f.key)}
          activeOpacity={0.7}
        >
          <Text style={[s.filterText, isActive && s.filterTextActive]}>
            {f.emoji ? `${f.emoji} ` : ''}{f.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </GHScrollView>
);

// ===== L3: 인사이트 카드 (접힘/펼침) =====
const InsightCard = ({ card, isExpanded, onToggle }) => {
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isExpanded]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // 카드 배경/보더 결정
  const cardStyle = getCardStyle(card.tier, isExpanded);

  return (
    <View style={[s.card, cardStyle]}>
      {/* 접힌 헤더 — 터치로 펼침 */}
      <TouchableOpacity
        style={s.cardHeader}
        onPress={() => onToggle(card.id)}
        activeOpacity={0.7}
      >
        {/* 좌측 컬러 바 */}
        <View style={[s.cardColorBar, { backgroundColor: card.colorAccent }]} />
        {/* 이모지 */}
        <Text style={s.cardEmoji}>{card.emoji}</Text>
        {/* 제목 + 서브 */}
        <View style={s.cardCenter}>
          <Text style={s.cardTitle} numberOfLines={1}>{card.title}</Text>
          <Text style={s.cardHighlight} numberOfLines={1}>{card.highlight}</Text>
        </View>
        {/* 뱃지 */}
        {card.badge && (
          <View style={[s.cardBadge, { backgroundColor: `${card.badge.color}20` }]}>
            <Text style={[s.cardBadgeText, { color: card.badge.color }]}>{card.badge.text}</Text>
          </View>
        )}
        {/* 펼침 화살표 */}
        {card.detailItems && card.detailItems.length > 0 && (
          <Animated.Text style={[s.cardArrow, { transform: [{ rotate }] }]}>▼</Animated.Text>
        )}
      </TouchableOpacity>

      {/* 펼친 상세 */}
      {isExpanded && card.detailItems && card.detailItems.length > 0 && (
        <View style={s.cardDetail}>
          <View style={s.cardDetailDivider} />
          {card.detailItems.map((item, i) => (
            <View key={i} style={s.detailRow}>
              <View style={s.detailLeft}>
                <Text style={s.detailName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.detailSub} numberOfLines={1}>{item.subtitle}</Text>
              </View>
              <View style={s.detailRight}>
                {item.rightText ? <Text style={s.detailRightText}>{item.rightText}</Text> : null}
                {item.status ? (
                  <Text style={[s.detailStatus, { color: item.statusColor || T.text2 }]}>{item.status}</Text>
                ) : null}
              </View>
            </View>
          ))}
          {/* CTA 버튼 (AD, REWARD) */}
          {card.ctaText && (
            <TouchableOpacity style={[s.ctaBtn, { backgroundColor: `${card.colorAccent}25`, borderColor: `${card.colorAccent}40` }]} activeOpacity={0.7}>
              <Text style={[s.ctaText, { color: card.colorAccent }]}>{card.ctaText}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 접힌 상태에서도 CTA 표시 (REWARD 카드) */}
      {!isExpanded && card.tier === CardTier.REWARD && card.ctaText && (
        <TouchableOpacity style={[s.ctaBtn, { marginTop: 8, marginHorizontal: 12, backgroundColor: `${card.colorAccent}25`, borderColor: `${card.colorAccent}40` }]} activeOpacity={0.7}>
          <Text style={[s.ctaText, { color: card.colorAccent }]}>{card.ctaText}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// 카드 배경/보더 스타일 (tier별)
const getCardStyle = (tier, isExpanded) => {
  if (tier === CardTier.AD) {
    return {
      backgroundColor: 'rgba(245,158,11,0.06)',
      borderColor: 'rgba(245,158,11,0.25)',
      borderWidth: 1,
    };
  }
  if (tier === CardTier.REWARD) {
    return {
      backgroundColor: 'rgba(99,102,241,0.06)',
      borderColor: 'rgba(99,102,241,0.25)',
      borderWidth: 1,
    };
  }
  if (tier === CardTier.PREMIUM) {
    return {
      backgroundColor: 'rgba(245,158,11,0.04)',
      borderColor: 'rgba(245,158,11,0.2)',
      borderWidth: 1,
    };
  }
  // FREE — 일반/펼침
  if (isExpanded) {
    return {
      backgroundColor: T.bgCardExpanded,
      borderColor: T.bgCardExpandedBorder,
      borderWidth: 1,
    };
  }
  return {
    backgroundColor: T.bgCard,
    borderColor: T.bgCardBorder,
    borderWidth: 1,
  };
};

// ===== 메인 컴포넌트 =====
const BuildingProfileSheet = ({
  buildingProfile,
  loading,
  enriching,
  error,
  onClose,
  onRetry,
  onXrayToggle,
  xrayActive,
  onLazyLoad,
  persona,
}) => {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [expandedCardId, setExpandedCardId] = useState(null);

  const currentPersona = persona || PersonaType.EXPLORER;

  // 실제 API 데이터 or 페르소나별 더미 데이터
  const building = buildingProfile?.building || demoBuilding;
  const aiSummary = buildingProfile?.aiSummary || getDemoAiSummary(currentPersona, building);
  const quickChips = buildingProfile?.quickChips || getDemoQuickChips(currentPersona);
  const cards = buildingProfile?.cards || getDemoCards(currentPersona);

  // 프로필 바뀌면 상태 리셋
  useEffect(() => {
    setActiveFilter('ALL');
    setExpandedCardId(null);
  }, [building?.id]);

  // 카드 펼침/접힘 토글
  const handleToggleCard = useCallback((cardId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCardId(prev => prev === cardId ? null : cardId);
  }, []);

  // 필터 적용된 카드 목록 (AD/REWARD는 필터 무관하게 항상 표시)
  const filteredCards = useMemo(() => {
    if (activeFilter === 'ALL') return cards;
    return cards.filter(c =>
      c.tier === CardTier.AD ||
      c.tier === CardTier.REWARD ||
      c.moduleType === activeFilter
    );
  }, [cards, activeFilter]);

  // 로딩 중
  if (loading && !buildingProfile) {
    return (
      <View style={s.outerWrap}>
        <View style={s.fixedHeader}>
          <BuildingDNA building={{ name: '로딩 중...' }} aiSummary={null} onClose={onClose} />
        </View>
        <FeedSkeleton />
      </View>
    );
  }

  // 에러
  if (error && !buildingProfile) {
    return (
      <View style={s.outerWrap}>
        <View style={s.errorWrap}>
          <Text style={s.errorText}>데이터를 불러올 수 없습니다.</Text>
          <Text style={s.errorSub}>다시 시도해주세요</Text>
          <TouchableOpacity style={s.retryBtn} onPress={onRetry}>
            <Text style={s.retryBtnText}>재시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={s.outerWrap}>
      {/* 고정 영역: L1 + L2 */}
      <View style={s.fixedHeader}>
        <BuildingDNA building={building} aiSummary={aiSummary} onClose={onClose} />
        <QuickChips chips={quickChips} />
        <CategoryFilter
          filters={demoCategoryFilters}
          activeFilter={activeFilter}
          onSelect={setActiveFilter}
        />
      </View>

      {/* 스크롤 영역: L3 카드 피드 */}
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
      >
        {filteredCards.map(card => (
          <InsightCard
            key={card.id}
            card={card}
            isExpanded={expandedCardId === card.id}
            onToggle={handleToggleCard}
          />
        ))}
        <View style={{ height: 120 }} />
      </BottomSheetScrollView>
    </View>
  );
};

// ===== 스타일 =====
const s = StyleSheet.create({
  outerWrap: { flex: 1 },
  fixedHeader: { paddingHorizontal: SPACING.lg },
  scrollContent: { paddingHorizontal: SPACING.lg, paddingTop: 4 },

  // 스켈레톤
  skeletonWrap: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  skeleton: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8 },

  // ===== L1: 건물 DNA =====
  dna: { marginBottom: SPACING.md },
  dnaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dnaLeft: { flex: 1, marginRight: SPACING.md },
  dnaName: { fontSize: 17, fontWeight: '800', color: T.text1, marginBottom: 4 },
  dnaAddress: { fontSize: 11, color: T.text3 },
  dnaCloseBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  dnaCloseText: { fontSize: 12, color: T.text2 },

  // AI 요약 박스
  aiBox: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.15)',
    // 그라디언트 대신 단색 근사치 (RN 네이티브는 LinearGradient 필요)
    backgroundColor: 'rgba(99,52,196,0.08)',
    gap: SPACING.sm,
  },
  aiBadge: {
    backgroundColor: 'rgba(139,92,246,0.2)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4,
  },
  aiBadgeText: { fontSize: 9, fontWeight: '700', color: T.purpleLight },
  aiText: { flex: 1, fontSize: 12, color: T.text1, lineHeight: 18 },

  // ===== L2: 퀵 칩 =====
  chipsScroll: { marginBottom: SPACING.sm },
  chipsContent: { gap: SPACING.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 5, paddingHorizontal: 9,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
    gap: 4,
  },
  chipIcon: { fontSize: 11 },
  chipLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },

  // ===== L2: 카테고리 필터 =====
  filterScroll: { marginBottom: SPACING.md },
  filterContent: { gap: SPACING.sm },
  filterChip: {
    paddingVertical: 6, paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(139,92,246,0.2)',
  },
  filterText: { fontSize: 12, fontWeight: '500', color: T.text3 },
  filterTextActive: { color: T.purpleLight, fontWeight: '600' },

  // ===== L3: 인사이트 카드 =====
  card: {
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    gap: 8,
  },
  cardColorBar: {
    width: 3, height: 24, borderRadius: 2,
  },
  cardEmoji: { fontSize: 16 },
  cardCenter: { flex: 1 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: T.text1 },
  cardHighlight: { fontSize: 10, color: T.text2, marginTop: 1 },
  cardBadge: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5,
  },
  cardBadgeText: { fontSize: 9, fontWeight: '700' },
  cardArrow: { fontSize: 10, color: T.text3 },

  // 카드 상세 (펼침)
  cardDetail: { paddingHorizontal: 12, paddingBottom: 12 },
  cardDetailDivider: {
    height: 1, backgroundColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  detailLeft: { flex: 1 },
  detailName: { fontSize: 13, fontWeight: '600', color: T.text1 },
  detailSub: { fontSize: 11, color: T.text2, marginTop: 1 },
  detailRight: { alignItems: 'flex-end', marginLeft: 8 },
  detailRightText: { fontSize: 12, color: '#fbbf24', fontWeight: '600' },
  detailStatus: { fontSize: 10, fontWeight: '600', marginTop: 2 },

  // CTA 버튼
  ctaBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  ctaText: { fontSize: 13, fontWeight: '700' },

  // 에러
  errorWrap: { alignItems: 'center', paddingVertical: SPACING.xxl, paddingHorizontal: SPACING.lg },
  errorText: { fontSize: 15, fontWeight: '600', color: T.text1, marginBottom: 4 },
  errorSub: { fontSize: 13, color: T.text2, marginBottom: SPACING.lg },
  retryBtn: { backgroundColor: T.blue, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});

export default BuildingProfileSheet;
