/**
 * BuildingProfileSheet - 건물 프로필 바텀시트 컴포넌트
 * - 개요 탭: 편의시설 태그 + 스탯 그리드 + LIVE 피드 + 프로모션
 * - X레이 탭: 층별 투시 리스트
 * - 다크 테마 (#141428 배경)
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { ScrollView as GHScrollView } from 'react-native-gesture-handler';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { SPACING, TOUCH } from '../constants/theme';
import { formatDistance } from '../utils/coordinate';

const { width: SW } = Dimensions.get('window');

// ===== 색상 (다크 테마) =====
const C = {
  bg: '#141428',
  card: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  text1: '#ffffff',
  text2: 'rgba(255,255,255,0.5)',
  text3: 'rgba(255,255,255,0.3)',
  amber: '#f59e0b',
  green: '#22c55e',
  red: '#ef4444',
  blue: '#3b82f6',
  purple: '#a855f7',
  cyan: '#06b6d4',
  gray: '#475569',
  tabActive: 'rgba(255,255,255,0.15)',
  // 더미 폴백 데이터 구분 색상 (연보라 — 다크 테마와 조화)
  dummyText: '#c4b5fd',
  dummyText2: 'rgba(196,181,253,0.5)',
};

const TAG_COLORS = [C.green, C.blue, C.purple, C.amber, C.cyan, C.red];

// 만원 → "N억 M천" 변환 헬퍼
const formatPrice = (manwon) => {
  if (!manwon && manwon !== 0) return '-';
  const num = Number(manwon);
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const remainder = num % 10000;
    if (remainder === 0) return `${eok}억`;
    const cheon = Math.floor(remainder / 1000);
    if (remainder % 1000 === 0) return `${eok}억 ${cheon}천`;
    return `${eok}억 ${remainder.toLocaleString()}`;
  }
  if (num >= 1000) {
    const cheon = Math.floor(num / 1000);
    const remainder = num % 1000;
    if (remainder === 0) return `${cheon}천`;
    return `${num.toLocaleString()}`;
  }
  return `${num}`;
};

// room_type 한글 매핑
const formatRoomType = (type) => {
  const map = { studio: '원룸', one_room: '원룸', two_room: '투룸', three_room: '쓰리룸', office: '오피스', retail: '상가', 오피스: '오피스', 상가: '상가', 레지던스: '레지던스' };
  return map[type] || type || '기타';
};

// 카테고리 아이콘 매핑
const getCategoryIcon = (category) => {
  const lower = (category || '').toLowerCase();
  const map = { korean: '🍲', 한식: '🍲', japanese: '🍣', 일식: '🍣', chinese: '🥟', 중식: '🥟', western: '🍕', 양식: '🍕', cafe: '☕', 카페: '☕', bakery: '🥐', 베이커리: '🥐', bar: '🍸', 주점: '🍸', fastfood: '🍔', convenience: '🏪', 편의점: '🏪' };
  return map[lower] || '🍽️';
};

// 혼잡도 색상 헬퍼
const getCongestionColor = (congestion) => {
  if (!congestion) return C.text2;
  const lower = congestion.toLowerCase?.() || '';
  if (lower.includes('여유') || lower.includes('empty') || lower.includes('comfortable')) return '#22c55e';
  if (lower.includes('보통') || lower.includes('moderate')) return '#f59e0b';
  if (lower.includes('혼잡') || lower.includes('crowded')) return '#ef4444';
  return C.text2;
};

// ===== 스켈레톤 로딩 =====
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
  return <Animated.View style={[s.skeletonBlock, style, { opacity: anim }]} />;
};

const ProfileSkeleton = () => (
  <View style={s.skeletonWrap}>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
      {[1, 2, 3].map(i => <SkeletonPulse key={i} style={{ width: 80, height: 44, borderRadius: 10 }} />)}
    </View>
    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
      {[1, 2, 3, 4].map(i => <SkeletonPulse key={i} style={{ flex: 1, height: 80, borderRadius: 12 }} />)}
    </View>
    <SkeletonPulse style={{ width: '100%', height: 60, borderRadius: 12, marginBottom: 8 }} />
    <SkeletonPulse style={{ width: '100%', height: 60, borderRadius: 12 }} />
  </View>
);

// ===== X레이 스켈레톤 =====
const XraySkeleton = () => {
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
  return (
    <View style={s.xrayEmpty}>
      <Text style={s.xrayEmptyText}>{'층별 정보를 수집하고 있어요\n스캔할수록 정보가 채워집니다!'}</Text>
      {[1, 2, 3, 4, 5].map(i => (
        <Animated.View key={i} style={[s.skeletonFloorBar, { opacity: anim }]} />
      ))}
    </View>
  );
};

// ===== 헤더 =====
const SheetHeader = ({ building, onClose, onXrayToggle, xrayActive }) => (
  <View style={s.header}>
    <View style={s.headerLeft}>
      <Text style={s.headerName} numberOfLines={1}>{building?.name || '건물'}</Text>
      <Text style={s.headerDist}>
        {building?.lat ? `${'\uD83D\uDCCD'} 내 위치에서 ${formatDistance(building.distance || 0)}` : ''}
      </Text>
    </View>
    <View style={s.headerRight}>
      <TouchableOpacity
        style={[s.livePill, xrayActive && s.livePillActive]}
        onPress={onXrayToggle}
        activeOpacity={0.7}
      >
        <Text style={[s.livePillText, xrayActive && s.livePillTextActive]}>LIVE 투시</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={TOUCH.hitSlop}>
        <Text style={s.closeBtnText}>{'\u2715'}</Text>
      </TouchableOpacity>
    </View>
  </View>
);

// ===== 탭 바 =====
const TAB_DEFS = [
  { key: 'overview', label: '\uD83C\uDFE2 개요', alwaysShow: true },
  { key: 'xray', label: '\uD83D\uDC41\uFE0F X레이', metaKey: 'hasFloors' },
  { key: 'food', label: '\uD83C\uDF7D\uFE0F 맛집', metaKey: 'hasRestaurants' },
  { key: 'estate', label: '\uD83C\uDFE0 부동산', metaKey: 'hasRealEstate' },
  { key: 'tourism', label: '\u2708\uFE0F 관광', metaKey: 'hasTourism' },
];

const TabBar = ({ activeTab, onChangeTab, meta }) => {
  const visibleTabs = TAB_DEFS.filter(t => t.alwaysShow || meta?.[t.metaKey]);
  return (
    <GHScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      nestedScrollEnabled
      directionalLockEnabled
      style={s.tabBar}
      contentContainerStyle={s.tabBarContent}
    >
      {visibleTabs.map(t => (
        <TouchableOpacity
          key={t.key}
          style={[s.tab, activeTab === t.key && s.tabActive]}
          onPress={() => onChangeTab(t.key)}
          activeOpacity={0.7}
        >
          <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </GHScrollView>
  );
};

// ===== 개요 탭: 편의시설 태그 =====
const AmenityTags = ({ amenities = [], isDummy = false }) => {
  if (!amenities.length) return null;
  return (
    <GHScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled directionalLockEnabled style={s.amenityScroll} contentContainerStyle={s.amenityContent}>
      {amenities.map((item, i) => (
        <View key={i} style={s.amenityTag}>
          <View style={[s.amenityDot, { backgroundColor: TAG_COLORS[i % TAG_COLORS.length] }]} />
          <View>
            <Text style={[s.amenityName, isDummy && { color: C.dummyText }]}>{item.type || item.label || ''}</Text>
            <Text style={[s.amenityDetail, isDummy && { color: C.dummyText2 }]}>{item.location || item.hours || ''}</Text>
          </View>
        </View>
      ))}
    </GHScrollView>
  );
};

// ===== 개요 탭: 스탯 그리드 =====
const STAT_ICONS = { total_floors: '\uD83C\uDFE2', occupancy: '\uD83D\uDCCA', tenants: '\uD83C\uDFEC', operating: '\uD83D\uDD52', residents: '\uD83D\uDC65', parking_capacity: '\uD83D\uDE97', congestion: '\uD83D\uDE80', type: '\uD83C\uDFF7\uFE0F' };
const STAT_LABELS = { total_floors: '총층수', occupancy: '입주율', tenants: '테넌트', operating: '영업중', residents: '세대수', parking_capacity: '주차', congestion: '혼잡도', type: '용도' };

const StatGrid = ({ stats, isDummy = false }) => {
  const items = stats?.raw?.slice(0, 4) || [];
  if (!items.length) {
    return (
      <View style={s.statsGrid}>
        {['\uD83C\uDFE2 총층수', '\uD83D\uDCCA 입주율', '\uD83C\uDFEC 테넌트', '\uD83D\uDD52 영업중'].map((label, i) => (
          <View key={i} style={s.statBox}>
            <Text style={s.statIcon}>{label.split(' ')[0]}</Text>
            <Text style={s.statLabel}>{label.split(' ')[1]}</Text>
            <Text style={s.statValue}>-</Text>
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={s.statsGrid}>
      {items.map((st, i) => (
        <View key={i} style={s.statBox}>
          <Text style={s.statIcon}>{STAT_ICONS[st.type] || '\uD83D\uDCCB'}</Text>
          <Text style={[s.statLabel, isDummy && { color: C.dummyText2 }]}>{STAT_LABELS[st.type] || st.type}</Text>
          <Text style={[s.statValue, isDummy && { color: C.dummyText }]}>{st.value}</Text>
        </View>
      ))}
    </View>
  );
};

// ===== 개요 탭: LIVE 피드 =====
const FEED_ICONS = { event: '\u2B50', promotion: '\uD83C\uDF81', congestion: '\uD83D\uDC65', update: '\uD83D\uDD14' };

const LiveFeedSection = ({ feeds = [], isDummy = false }) => (
  <View style={s.liveSection}>
    <View style={s.liveHeader}>
      <View style={s.livePulseDot} />
      <Text style={s.liveHeaderTitle}>지금 이 순간</Text>
      <View style={s.liveBadge}><Text style={s.liveBadgeText}>LIVE</Text></View>
    </View>
    {feeds.length === 0 ? (
      <Text style={s.liveEmptyText}>아직 실시간 정보가 없습니다</Text>
    ) : (
      feeds.slice(0, 5).map((feed, i) => (
        <View key={i} style={s.liveFeedItem}>
          <View style={s.liveFeedIconWrap}>
            <Text style={s.liveFeedIcon}>{FEED_ICONS[feed.feed_type] || '\uD83D\uDCE2'}</Text>
          </View>
          <View style={s.liveFeedContent}>
            <Text style={[s.liveFeedTitle, isDummy && { color: C.dummyText }]} numberOfLines={1}>{feed.title}</Text>
            {feed.subtitle ? <Text style={[s.liveFeedSub, isDummy && { color: C.dummyText2 }]} numberOfLines={2}>{feed.subtitle}</Text> : null}
          </View>
          <Text style={[s.liveFeedTime, isDummy && { color: C.dummyText2 }]}>{feed.time_label || ''}</Text>
        </View>
      ))
    )}
  </View>
);

// ===== 개요 탭: 프로모션 배너 =====
const PromotionBanner = ({ promotion, isDummy = false }) => {
  if (!promotion) return null;
  return (
    <View style={[s.promoBanner, isDummy && { borderColor: 'rgba(196,181,253,0.3)', backgroundColor: 'rgba(168,85,247,0.08)' }]}>
      <Text style={s.promoStar}>{'\u2B50'}</Text>
      <Text style={[s.promoTitle, isDummy && { color: C.dummyText }]}>{promotion.title}</Text>
      {promotion.reward_points && (
        <Text style={[s.promoPoints, isDummy && { color: '#c084fc' }]}>{promotion.reward_points}P 적립 가능</Text>
      )}
      {promotion.condition_text && (
        <Text style={[s.promoCondition, isDummy && { color: C.dummyText2 }]}>{promotion.condition_text}</Text>
      )}
      <TouchableOpacity style={[s.promoCta, isDummy && { backgroundColor: '#a855f7' }]} activeOpacity={0.8}>
        <Text style={s.promoCtaText}>{'\u25B6'} 광고 보고 포인트 받기</Text>
      </TouchableOpacity>
    </View>
  );
};

// ===== 개요 탭: 수집 중 안내 =====
const CollectingMessage = () => (
  <View style={s.collectingWrap}>
    <Text style={s.collectingIcon}>{'\uD83D\uDD0D'}</Text>
    <Text style={s.collectingText}>이 건물의 정보를 수집하고 있어요</Text>
    <Text style={s.collectingSub}>스캔할수록 정보가 풍부해집니다</Text>
  </View>
);

// ===== X레이 탭 =====
const getFloorBadgeColor = (floorNumber) => {
  if (floorNumber === 'RF') return C.red;
  const num = parseInt(floorNumber);
  if (isNaN(num)) return C.gray;
  if (num < 0) return C.gray;
  if (num <= 4) return C.cyan;
  if (num <= 9) return C.blue;
  return C.purple;
};

const XrayTab = ({ floors = [], isDummy = false }) => {
  if (!floors.length) return <XraySkeleton />;
  return (
    <View style={s.xrayWrap}>
      <Text style={s.xraySectionTitle}>LIVE 투시 {'\u00B7'} 층별 정보</Text>
      {floors.map((f, i) => {
        const isVacant = f.is_vacant;
        const hasReward = f.has_reward;
        return (
          <View
            key={`${f.floor_number}-${i}`}
            style={[
              s.xrayFloor,
              isVacant && s.xrayFloorVacant,
              hasReward && s.xrayFloorReward,
            ]}
          >
            <View style={[s.xrayBadge, { backgroundColor: getFloorBadgeColor(f.floor_number) }]}>
              <Text style={s.xrayBadgeText}>{f.floor_number}</Text>
            </View>
            <Text
              style={[s.xrayTenant, isVacant && s.xrayTenantVacant, isDummy && { color: C.dummyText }]}
              numberOfLines={1}
            >
              {isVacant ? '공실' : (f.tenant_name || '정보 없음')}
            </Text>
            {f.icons && (
              <Text style={s.xrayIcons}>{f.icons}</Text>
            )}
            {hasReward && (
              <Text style={s.xrayRewardStar}>{'\u2605'}</Text>
            )}
            {!isVacant && <Text style={s.xrayChevron}>{'\u203A'}</Text>}
          </View>
        );
      })}
    </View>
  );
};

// ===== 에러 상태 =====
const ErrorView = ({ onRetry }) => (
  <View style={s.errorWrap}>
    <Text style={s.errorText}>데이터를 불러올 수 없습니다.</Text>
    <Text style={s.errorSub}>다시 시도해주세요</Text>
    <TouchableOpacity style={s.retryBtn} onPress={onRetry}>
      <Text style={s.retryBtnText}>재시도</Text>
    </TouchableOpacity>
  </View>
);

// ===== 보강 중 인디케이터 =====
const EnrichingBanner = () => (
  <View style={s.enrichingBanner}>
    <ActivityIndicator size="small" color={C.cyan} />
    <Text style={s.enrichingText}>정보 수집 중...</Text>
  </View>
);

// ===== Lazy 로딩 스피너 =====
const LazySpinner = () => (
  <View style={s.lazySpinner}>
    <ActivityIndicator size="small" color={C.blue} />
    <Text style={s.lazySpinnerText}>데이터 불러오는 중...</Text>
  </View>
);

// ===== 메인 컴포넌트 =====
const BuildingProfileSheet = ({ buildingProfile, loading, enriching, error, onClose, onRetry, onXrayToggle, xrayActive, onLazyLoad }) => {
  const [activeTab, setActiveTab] = useState('overview');
  // lazy 탭 로딩 상태
  const [lazyLoading, setLazyLoading] = useState({});
  // lazy 탭 이미 로드한 탭 추적
  const lazyLoadedRef = useRef(new Set());

  const profile = buildingProfile;
  const building = profile?.building;
  const meta = profile?.meta;

  // 탭 변경 시 lazy 데이터 로드
  const handleTabChange = (tab) => {
    setActiveTab(tab);

    // lazy 대상 탭: food, estate, tourism
    const lazyTabs = ['food', 'estate', 'tourism'];
    if (lazyTabs.includes(tab) && onLazyLoad && !lazyLoadedRef.current.has(tab)) {
      lazyLoadedRef.current.add(tab);
      setLazyLoading(prev => ({ ...prev, [tab]: true }));
      // onLazyLoad는 비동기, 완료 후 profile이 업데이트되면 자동 렌더
      Promise.resolve(onLazyLoad(tab)).finally(() => {
        setLazyLoading(prev => ({ ...prev, [tab]: false }));
      });
    }
  };

  // 프로필 바뀌면 개요탭으로 리셋 + lazy 추적 초기화
  useEffect(() => {
    setActiveTab('overview');
    lazyLoadedRef.current.clear();
    setLazyLoading({});
  }, [building?.id]);

  // 로딩 중
  if (loading && !profile) {
    return (
      <View style={s.container}>
        <SheetHeader building={{ name: building?.name || '로딩 중...' }} onClose={onClose} />
        <ProfileSkeleton />
      </View>
    );
  }

  // 에러
  if (error && !profile) {
    return (
      <View style={s.container}>
        <ErrorView onRetry={onRetry} />
      </View>
    );
  }

  // 데이터 없음
  if (!profile) {
    return (
      <View style={s.container}>
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>건물에 카메라를 맞춰 스캔해보세요</Text>
        </View>
      </View>
    );
  }

  const isDataSparse = (meta?.dataCompleteness || 0) < 25;

  // 더미 필드 추적 (색상 구분용)
  const dummyFields = new Set(profile?._dummyFields || []);
  const isFoodDummy = dummyFields.has('restaurants');
  const isEstateDummy = dummyFields.has('realEstate');
  const isTourismDummy = dummyFields.has('tourism');

  return (
    <View style={s.outerWrap}>
      {/* 고정 영역: 헤더 + 탭바 (BottomSheetScrollView 바깥 → 가로 스와이프 제스처 충돌 해결) */}
      <View style={s.fixedHeader}>
        <SheetHeader building={building} onClose={onClose} onXrayToggle={onXrayToggle} xrayActive={xrayActive} />
        <TabBar activeTab={activeTab} onChangeTab={handleTabChange} meta={meta} />
      </View>

      {/* 스크롤 영역: 탭 콘텐츠만 */}
      <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

      {activeTab === 'overview' && (
        <View>
          {enriching && <EnrichingBanner />}
          <AmenityTags amenities={profile.amenities} isDummy={dummyFields.has('amenities')} />
          <StatGrid stats={profile.stats} isDummy={dummyFields.has('stats')} />
          <LiveFeedSection feeds={profile.liveFeeds} isDummy={dummyFields.has('liveFeeds')} />
          <PromotionBanner promotion={profile.promotion} isDummy={dummyFields.has('promotion')} />
          {isDataSparse && !enriching && <CollectingMessage />}
        </View>
      )}

      {activeTab === 'xray' && (
        <XrayTab floors={profile.floors} isDummy={dummyFields.has('floors')} />
      )}

      {activeTab === 'food' && (
        <View style={s.tabContent}>
          <Text style={s.tabSectionTitle}>{'\uD83C\uDF7D\uFE0F'} 맛집 {'\u00B7'} 카페</Text>
          {lazyLoading.food && <LazySpinner />}
          {(profile.restaurants || []).length === 0 && !lazyLoading.food ? (
            <View style={s.tabEmptyWrap}>
              <Text style={s.tabEmptyIcon}>{'\uD83C\uDF7D\uFE0F'}</Text>
              <Text style={s.tabEmptyText}>이 건물의 맛집 정보를 아직 수집하지 못했어요</Text>
            </View>
          ) : (
            (profile.restaurants || []).map((r, i) => {
              const waitBadge = r.is_open === false
                ? { text: '영업종료', bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' }
                : (r.wait_teams > 0)
                  ? { text: `대기 ${r.wait_teams}팀`, bg: 'rgba(239,68,68,0.15)', color: '#ef4444' }
                  : { text: '즉각 입장', bg: 'rgba(34,197,94,0.15)', color: '#22c55e' };
              return (
                <View key={i} style={s.foodCard}>
                  <View style={s.foodIconBox}>
                    <Text style={s.foodIconText}>{getCategoryIcon(r.category)}</Text>
                  </View>
                  <View style={s.foodCenter}>
                    <Text style={[s.foodName, isFoodDummy && { color: C.dummyText }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.foodCategory, isFoodDummy && { color: C.dummyText2 }]}>{r.sub_category || r.category || ''}</Text>
                    {r.rating != null && (
                      <Text style={[s.foodRating, isFoodDummy && { color: C.dummyText }]}>
                        {'\u2B50'} {r.rating}{r.review_count != null ? ` (${r.review_count})` : ''}
                      </Text>
                    )}
                    {r.signature_menu && (
                      <View style={s.foodMenuPill}>
                        <Text style={[s.foodMenuText, isFoodDummy && { color: C.dummyText2 }]}>대표: {r.signature_menu}{r.signature_price ? ` ${r.signature_price}` : ''}</Text>
                      </View>
                    )}
                  </View>
                  <View style={[s.foodWaitBadge, { backgroundColor: waitBadge.bg }]}>
                    <Text style={[s.foodWaitText, { color: waitBadge.color }]}>{waitBadge.text}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {activeTab === 'estate' && (
        <View style={s.tabContent}>
          <Text style={s.tabSectionTitle}>{'\uD83C\uDFE0'} 매물 정보</Text>
          {lazyLoading.estate && <LazySpinner />}
          {(profile.realEstate || []).length === 0 && !lazyLoading.estate ? (
            <View style={s.tabEmptyWrap}>
              <Text style={s.tabEmptyIcon}>{'\uD83C\uDFE0'}</Text>
              <Text style={s.tabEmptyText}>현재 등록된 매물이 없습니다</Text>
            </View>
          ) : (
            (profile.realEstate || []).map((r, i) => {
              const priceStr = r.listing_type === 'monthly_rent' || r.listing_type === '월세'
                ? `월세 ${r.monthly_rent || 0}만 / 보증금 ${formatPrice(r.deposit)}`
                : r.listing_type === 'jeonse' || r.listing_type === '전세'
                  ? `전세 ${formatPrice(r.deposit)}`
                  : r.listing_type === 'sale' || r.listing_type === '매매'
                    ? `매매 ${formatPrice(r.sale_price)}`
                    : `${r.listing_type} ${formatPrice(r.deposit || r.sale_price)}`;
              return (
                <View key={i} style={s.estateCard}>
                  <View style={s.estateTop}>
                    <View style={s.estateTopLeft}>
                      <View style={s.estateTypeBadge}>
                        <Text style={s.estateTypeText}>{formatRoomType(r.room_type)}</Text>
                      </View>
                      <Text style={s.estateLink}>상세보기 {'>'}</Text>
                    </View>
                  </View>
                  <View style={s.estateBody}>
                    <View style={s.estateInfo}>
                      <Text style={[s.estatePrice, isEstateDummy && { color: C.dummyText }]}>{priceStr}</Text>
                      <Text style={[s.estateDetail, isEstateDummy && { color: C.dummyText2 }]}>
                        {r.unit_number ? `${r.unit_number} \u00B7 ` : ''}{r.size_pyeong ? `${r.size_pyeong}평 (${r.size_sqm}\u33A1)` : '면적 미정'}
                      </Text>
                    </View>
                    <View style={s.estateThumbnail}>
                      <Text style={s.estateThumbnailIcon}>{'\uD83C\uDFE0'}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {activeTab === 'tourism' && (
        <View style={s.tabContent}>
          {lazyLoading.tourism && <LazySpinner />}
          {!profile.tourism && !lazyLoading.tourism ? (
            <View style={s.tabEmptyWrap}>
              <Text style={s.tabEmptyIcon}>{'\u2708\uFE0F'}</Text>
              <Text style={s.tabEmptyText}>관광 정보가 등록되지 않은 건물입니다</Text>
            </View>
          ) : (
            <View style={s.tourismCard}>
              <View style={s.tourismHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.tourismName, isTourismDummy && { color: C.dummyText }]}>{profile.tourism.attraction_name}</Text>
                  {profile.tourism.attraction_name_en && (
                    <Text style={[s.tourismNameEn, isTourismDummy && { color: C.dummyText2 }]}>{profile.tourism.attraction_name_en}</Text>
                  )}
                </View>
                <TouchableOpacity style={s.tourismFavBtn} activeOpacity={0.7}>
                  <Text style={s.tourismFavIcon}>{'\u2661'}</Text>
                </TouchableOpacity>
              </View>
              {profile.tourism.rating != null && (
                <View style={s.tourismRatingRow}>
                  <Text style={s.tourismStar}>{'\u2B50'}</Text>
                  <Text style={[s.tourismRatingNum, isTourismDummy && { color: C.dummyText }]}>{profile.tourism.rating}</Text>
                  {profile.tourism.review_count != null && (
                    <Text style={s.tourismReviewCount}>({profile.tourism.review_count.toLocaleString()} review)</Text>
                  )}
                </View>
              )}
              <View style={s.tourismGrid}>
                <View style={s.tourismGridCell}>
                  <Text style={s.tourismGridLabel}>혼잡도</Text>
                  <Text style={[s.tourismGridValue, isTourismDummy ? { color: C.dummyText } : { color: getCongestionColor(profile.tourism.congestion) }]}>
                    {'\uD83D\uDC65'} {profile.tourism.congestion || '정보 없음'}
                  </Text>
                </View>
                <View style={s.tourismGridCell}>
                  <Text style={s.tourismGridLabel}>운영시간</Text>
                  <Text style={[s.tourismGridValue, isTourismDummy && { color: C.dummyText }]}>{profile.tourism.hours || '정보 없음'}</Text>
                </View>
              </View>
              {profile.tourism.admission_fee && (
                <View style={s.tourismFeeSection}>
                  <Text style={s.tourismFeeLabel}>입장료</Text>
                  <View style={s.tourismFeeBox}>
                    <Text style={[s.tourismFeeText, isTourismDummy && { color: C.dummyText }]}>{profile.tourism.admission_fee}</Text>
                  </View>
                </View>
              )}
              {profile.tourism.description && (
                <View style={s.tourismDescSection}>
                  <Text style={s.tourismDescLabel}>설명</Text>
                  <Text style={[s.tourismDesc, isTourismDummy && { color: C.dummyText2 }]}>{profile.tourism.description}</Text>
                </View>
              )}
              {profile.floors && profile.floors.length > 0 && (
                <View style={s.tourismFloorSection}>
                  <Text style={s.tourismFloorLabel}>층별 안내</Text>
                  <View style={s.tourismFloorGrid}>
                    {profile.floors.map((f, i) => (
                      <View key={i} style={s.tourismFloorItem}>
                        <View style={[s.tourismFloorBadge, { backgroundColor: getFloorBadgeColor(f.floor_number) }]}>
                          <Text style={s.tourismFloorBadgeText}>{f.floor_number}</Text>
                        </View>
                        <Text style={s.tourismFloorName} numberOfLines={1}>{f.tenant_name || '정보 없음'}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      <View style={{ height: 40 }} />
    </BottomSheetScrollView>
    </View>
  );
};

// ===== 스타일 =====
const s = StyleSheet.create({
  outerWrap: { flex: 1 },
  fixedHeader: { paddingHorizontal: SPACING.lg },
  scrollContent: { paddingHorizontal: SPACING.lg },
  container: { paddingHorizontal: SPACING.lg },

  // 스켈레톤
  skeletonWrap: { paddingTop: SPACING.md },
  skeletonBlock: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8 },
  skeletonFloorBar: { height: 44, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, marginBottom: 4 },

  // 헤더
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.md },
  headerLeft: { flex: 1 },
  headerName: { fontSize: 20, fontWeight: '800', color: C.text1, marginBottom: 4 },
  headerDist: { fontSize: 12, color: C.text2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  livePill: {
    borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)',
    backgroundColor: 'rgba(139,92,246,0.15)',
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20,
  },
  livePillActive: {
    backgroundColor: 'rgba(139,92,246,0.35)',
    borderColor: 'rgba(139,92,246,0.7)',
  },
  livePillText: { fontSize: 12, fontWeight: '700', color: '#c084fc' },
  livePillTextActive: { color: '#e9d5ff' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, color: C.text2 },

  // 탭 바
  tabBar: { marginBottom: SPACING.md },
  tabBarContent: { gap: SPACING.sm },
  tab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  tabActive: { backgroundColor: C.tabActive },
  tabText: { fontSize: 13, fontWeight: '500', color: C.text2 },
  tabTextActive: { fontWeight: '700', color: C.text1 },

  // 편의시설 태그
  amenityScroll: { marginBottom: SPACING.md },
  amenityContent: { gap: SPACING.sm },
  amenityTag: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
  },
  amenityDot: { width: 6, height: 6, borderRadius: 3 },
  amenityName: { fontSize: 13, fontWeight: '600', color: C.text1 },
  amenityDetail: { fontSize: 11, color: C.text2 },

  // 스탯 그리드
  statsGrid: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  statBox: {
    flex: 1, alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, paddingVertical: SPACING.md, paddingHorizontal: SPACING.xs,
    gap: 4,
  },
  statIcon: { fontSize: 20 },
  statLabel: { fontSize: 11, color: C.text2 },
  statValue: { fontSize: 16, fontWeight: '700', color: C.text1 },

  // LIVE 피드
  liveSection: { marginBottom: SPACING.lg },
  liveHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md },
  livePulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  liveHeaderTitle: { fontSize: 16, fontWeight: '700', color: C.text1 },
  liveBadge: { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  liveBadgeText: { fontSize: 10, fontWeight: '800', color: C.red, letterSpacing: 1 },
  liveEmptyText: { fontSize: 13, color: C.text3, textAlign: 'center', paddingVertical: SPACING.lg },
  liveFeedItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingVertical: 10, paddingHorizontal: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: SPACING.xs,
    gap: SPACING.md,
  },
  liveFeedIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  liveFeedIcon: { fontSize: 16 },
  liveFeedContent: { flex: 1, gap: 2 },
  liveFeedTitle: { fontSize: 14, fontWeight: '600', color: C.text1 },
  liveFeedSub: { fontSize: 12, color: C.text2 },
  liveFeedTime: { fontSize: 11, color: C.text3, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },

  // 프로모션 배너
  promoBanner: {
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
    borderRadius: 12, padding: SPACING.lg, marginBottom: SPACING.lg,
  },
  promoStar: { fontSize: 20, marginBottom: 4 },
  promoTitle: { fontSize: 16, fontWeight: '700', color: C.text1, marginBottom: 4 },
  promoPoints: { fontSize: 14, fontWeight: '600', color: C.amber, marginBottom: 4 },
  promoCondition: { fontSize: 12, color: C.text2, marginBottom: SPACING.md },
  promoCta: {
    backgroundColor: C.amber, borderRadius: 10,
    paddingVertical: SPACING.md, alignItems: 'center',
  },
  promoCtaText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // 수집 중 안내
  collectingWrap: { alignItems: 'center', paddingVertical: SPACING.xl },
  collectingIcon: { fontSize: 28, marginBottom: SPACING.sm },
  collectingText: { fontSize: 14, fontWeight: '600', color: C.text2, marginBottom: 4 },
  collectingSub: { fontSize: 12, color: C.text3 },

  // X레이
  xrayWrap: { paddingTop: SPACING.sm },
  xraySectionTitle: { fontSize: 16, fontWeight: '700', color: C.text1, marginBottom: SPACING.md },
  xrayFloor: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 3,
    gap: SPACING.md,
  },
  xrayFloorVacant: { backgroundColor: 'rgba(255,255,255,0.02)', opacity: 0.5 },
  xrayFloorReward: {
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)',
    backgroundColor: 'rgba(245,158,11,0.08)',
  },
  xrayBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, minWidth: 32, alignItems: 'center' },
  xrayBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  xrayTenant: { flex: 1, fontSize: 13, fontWeight: '500', color: C.text1 },
  xrayTenantVacant: { color: 'rgba(255,255,255,0.4)' },
  xrayIcons: { fontSize: 12 },
  xrayRewardStar: { fontSize: 12, color: C.amber },
  xrayChevron: { fontSize: 16, color: C.text3 },
  xrayEmpty: { alignItems: 'center', paddingVertical: SPACING.lg },
  xrayEmptyText: { fontSize: 13, color: C.text2, textAlign: 'center', marginBottom: SPACING.lg, lineHeight: 20 },

  // 탭 컨텐츠 공통
  tabContent: { paddingTop: SPACING.sm },
  tabSectionTitle: { fontSize: 16, fontWeight: '700', color: C.text1, marginBottom: SPACING.md },
  tabEmptyWrap: { alignItems: 'center', paddingVertical: SPACING.xxl },
  tabEmptyIcon: { fontSize: 40, marginBottom: SPACING.md, opacity: 0.3 },
  tabEmptyText: { fontSize: 13, color: C.text2, textAlign: 'center' },

  // 맛집 카드
  foodCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.cardBorder,
    gap: 12,
  },
  foodIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center', alignItems: 'center',
  },
  foodIconText: { fontSize: 20 },
  foodCenter: { flex: 1 },
  foodName: { fontSize: 14, fontWeight: '600', color: C.text1, marginBottom: 2 },
  foodCategory: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 2 },
  foodRating: { fontSize: 12, color: '#fbbf24', marginBottom: 4 },
  foodMenuPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  foodMenuText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  foodWaitBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  foodWaitText: { fontSize: 11, fontWeight: '600' },

  // 부동산 카드
  estateCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: C.cardBorder,
  },
  estateTop: { marginBottom: 8 },
  estateTopLeft: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  estateTypeBadge: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  estateTypeText: { fontSize: 11, fontWeight: '600', color: '#fbbf24' },
  estateLink: { fontSize: 12, color: '#60a5fa' },
  estateBody: { flexDirection: 'row', alignItems: 'center' },
  estateInfo: { flex: 1 },
  estatePrice: { fontSize: 16, fontWeight: '700', color: C.text1, marginBottom: 4 },
  estateDetail: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  estateThumbnail: {
    width: 56, height: 56, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  estateThumbnailIcon: { fontSize: 24, opacity: 0.3 },

  // 관광 카드
  tourismCard: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12,
    padding: SPACING.lg, borderWidth: 1, borderColor: C.cardBorder,
  },
  tourismHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: SPACING.sm },
  tourismName: { fontSize: 18, fontWeight: '700', color: C.text1, marginBottom: 2 },
  tourismNameEn: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  tourismFavBtn: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  tourismFavIcon: { fontSize: 18, color: C.text2 },
  tourismRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: SPACING.md },
  tourismStar: { fontSize: 14, color: '#fbbf24' },
  tourismRatingNum: { fontSize: 15, fontWeight: '700', color: C.text1 },
  tourismReviewCount: { fontSize: 12, color: C.text2 },
  tourismGrid: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  tourismGridCell: {
    flex: 1, padding: 10, borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tourismGridLabel: { fontSize: 11, color: C.text2, marginBottom: 4 },
  tourismGridValue: { fontSize: 13, fontWeight: '600', color: C.text1 },
  tourismFeeSection: { marginBottom: SPACING.md },
  tourismFeeLabel: { fontSize: 13, fontWeight: '600', color: C.text2, marginBottom: 6 },
  tourismFeeBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  tourismFeeText: { fontSize: 13, color: C.text1 },
  tourismDescSection: { marginBottom: SPACING.md },
  tourismDescLabel: { fontSize: 13, fontWeight: '600', color: C.text2, marginBottom: 6 },
  tourismDesc: { fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 19 },
  tourismFloorSection: { marginTop: SPACING.sm },
  tourismFloorLabel: { fontSize: 13, fontWeight: '600', color: C.text2, marginBottom: 8 },
  tourismFloorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tourismFloorItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '48%' },
  tourismFloorBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, minWidth: 28, alignItems: 'center' },
  tourismFloorBadgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  tourismFloorName: { fontSize: 12, color: C.text1, flex: 1 },

  // 에러
  errorWrap: { alignItems: 'center', paddingVertical: SPACING.xxl },
  errorText: { fontSize: 15, fontWeight: '600', color: C.text1, marginBottom: 4 },
  errorSub: { fontSize: 13, color: C.text2, marginBottom: SPACING.lg },
  retryBtn: { backgroundColor: C.blue, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: 10 },
  retryBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // 빈 상태
  emptyWrap: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { fontSize: 15, color: C.text2 },

  // enriching 배너
  enrichingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(6,182,212,0.1)',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    marginBottom: SPACING.md,
  },
  enrichingText: { fontSize: 12, color: C.cyan, fontWeight: '600' },

  // lazy 스피너
  lazySpinner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: SPACING.lg,
  },
  lazySpinnerText: { fontSize: 13, color: C.text2 },
});

export default BuildingProfileSheet;
