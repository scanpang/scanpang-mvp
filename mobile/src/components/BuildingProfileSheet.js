/**
 * BuildingProfileSheet - 건물 프로필 바텀시트 컴포넌트
 * - 개요 탭: 편의시설 태그 + 스탯 그리드 + LIVE 피드 + 프로모션
 * - X레이 탭: 층별 투시 리스트
 * - 다크 테마 (#141428 배경)
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
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
};

const TAG_COLORS = [C.green, C.blue, C.purple, C.amber, C.cyan, C.red];

// 만원 → 억 변환 헬퍼
const formatManToEok = (man) => {
  if (!man && man !== 0) return '미정';
  const num = Number(man);
  if (num >= 10000) {
    const eok = Math.floor(num / 10000);
    const rest = num % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만` : `${eok}억`;
  }
  return `${num.toLocaleString()}만`;
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
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
    </ScrollView>
  );
};

// ===== 개요 탭: 편의시설 태그 =====
const AmenityTags = ({ amenities = [] }) => {
  if (!amenities.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.amenityScroll} contentContainerStyle={s.amenityContent}>
      {amenities.map((item, i) => (
        <View key={i} style={s.amenityTag}>
          <View style={[s.amenityDot, { backgroundColor: TAG_COLORS[i % TAG_COLORS.length] }]} />
          <View>
            <Text style={s.amenityName}>{item.type || item.label || ''}</Text>
            <Text style={s.amenityDetail}>{item.location || item.hours || ''}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
};

// ===== 개요 탭: 스탯 그리드 =====
const STAT_ICONS = { total_floors: '\uD83C\uDFE2', occupancy: '\uD83D\uDCCA', tenants: '\uD83C\uDFEC', operating: '\uD83D\uDD52', residents: '\uD83D\uDC65', parking_capacity: '\uD83D\uDE97', congestion: '\uD83D\uDE80' };

const StatGrid = ({ stats }) => {
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
          <Text style={s.statLabel}>{st.type === 'total_floors' ? '총층수' : st.type === 'occupancy' ? '입주율' : st.type === 'tenants' ? '테넌트' : st.type === 'operating' ? '영업중' : st.type}</Text>
          <Text style={s.statValue}>{st.value}</Text>
        </View>
      ))}
    </View>
  );
};

// ===== 개요 탭: LIVE 피드 =====
const FEED_ICONS = { event: '\u2B50', promotion: '\uD83C\uDF81', congestion: '\uD83D\uDC65', update: '\uD83D\uDD14' };

const LiveFeedSection = ({ feeds = [] }) => (
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
            <Text style={s.liveFeedTitle} numberOfLines={1}>{feed.title}</Text>
            {feed.subtitle ? <Text style={s.liveFeedSub} numberOfLines={1}>{feed.subtitle}</Text> : null}
          </View>
          <Text style={s.liveFeedTime}>{feed.time_label || ''}</Text>
        </View>
      ))
    )}
  </View>
);

// ===== 개요 탭: 프로모션 배너 =====
const PromotionBanner = ({ promotion }) => {
  if (!promotion) return null;
  return (
    <View style={s.promoBanner}>
      <Text style={s.promoStar}>{'\u2B50'}</Text>
      <Text style={s.promoTitle}>{promotion.title}</Text>
      {promotion.reward_points && (
        <Text style={s.promoPoints}>{promotion.reward_points}P 적립 가능</Text>
      )}
      {promotion.condition_text && (
        <Text style={s.promoCondition}>{promotion.condition_text}</Text>
      )}
      <TouchableOpacity style={s.promoCta} activeOpacity={0.8}>
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

const XrayTab = ({ floors = [] }) => {
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
              style={[s.xrayTenant, isVacant && s.xrayTenantVacant]}
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

// ===== 메인 컴포넌트 =====
const BuildingProfileSheet = ({ buildingProfile, loading, error, onClose, onRetry, onXrayToggle, xrayActive }) => {
  const [activeTab, setActiveTab] = useState('overview');

  const profile = buildingProfile;
  const building = profile?.building;
  const meta = profile?.meta;

  // 탭 변경 시 데이터 없으면 개요로 폴백
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  // 프로필 바뀌면 개요탭으로 리셋
  useEffect(() => {
    setActiveTab('overview');
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

  return (
    <BottomSheetScrollView style={s.container} showsVerticalScrollIndicator={false} nestedScrollEnabled>
      <SheetHeader building={building} onClose={onClose} onXrayToggle={onXrayToggle} xrayActive={xrayActive} />
      <TabBar activeTab={activeTab} onChangeTab={handleTabChange} meta={meta} />

      {activeTab === 'overview' && (
        <View>
          <AmenityTags amenities={profile.amenities} />
          <StatGrid stats={profile.stats} />
          <LiveFeedSection feeds={profile.liveFeeds} />
          <PromotionBanner promotion={profile.promotion} />
          {isDataSparse && <CollectingMessage />}
        </View>
      )}

      {activeTab === 'xray' && (
        <XrayTab floors={profile.floors} />
      )}

      {activeTab === 'food' && (
        <View style={s.tabContent}>
          <Text style={s.tabSectionTitle}>{'\uD83C\uDF7D\uFE0F'} 맛집 {'\u00B7'} 카페</Text>
          {(profile.restaurants || []).length === 0 ? (
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
              const catIcon = r.category?.includes('카페') ? '\u2615' : r.category?.includes('주점') || r.category?.includes('바') ? '\uD83C\uDF78' : '\uD83C\uDF72';
              return (
                <View key={i} style={s.foodCard}>
                  <View style={s.foodIconBox}>
                    <Text style={s.foodIconText}>{catIcon}</Text>
                  </View>
                  <View style={s.foodCenter}>
                    <Text style={s.foodName} numberOfLines={1}>{r.name}</Text>
                    <Text style={s.foodCategory}>{r.sub_category || r.category || ''}</Text>
                    {r.signature_menu && (
                      <View style={s.foodMenuPill}>
                        <Text style={s.foodMenuText}>대표: {r.signature_menu}{r.signature_price ? ` ${r.signature_price}` : ''}</Text>
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
          {(profile.realEstate || []).length === 0 ? (
            <View style={s.tabEmptyWrap}>
              <Text style={s.tabEmptyIcon}>{'\uD83C\uDFE0'}</Text>
              <Text style={s.tabEmptyText}>현재 등록된 매물이 없습니다</Text>
            </View>
          ) : (
            (profile.realEstate || []).map((r, i) => {
              const priceStr = r.listing_type === 'monthly_rent' || r.listing_type === '월세'
                ? `월세 ${r.monthly_rent || 0}만 / 보증금 ${formatManToEok(r.deposit)}`
                : r.listing_type === 'jeonse' || r.listing_type === '전세'
                  ? `전세 ${formatManToEok(r.deposit)}`
                  : `매매 ${formatManToEok(r.sale_price)}`;
              return (
                <View key={i} style={s.estateCard}>
                  <View style={s.estateTop}>
                    <View style={s.estateTopLeft}>
                      <View style={s.estateTypeBadge}>
                        <Text style={s.estateTypeText}>{r.room_type || r.listing_type}</Text>
                      </View>
                      <Text style={s.estateLink}>상세보기 {'>'}</Text>
                    </View>
                  </View>
                  <View style={s.estateBody}>
                    <View style={s.estateInfo}>
                      <Text style={s.estatePrice}>{priceStr}</Text>
                      <Text style={s.estateDetail}>
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
          {!profile.tourism ? (
            <View style={s.tabEmptyWrap}>
              <Text style={s.tabEmptyIcon}>{'\u2708\uFE0F'}</Text>
              <Text style={s.tabEmptyText}>관광 정보가 등록되지 않은 건물입니다</Text>
            </View>
          ) : (
            <View style={s.tourismCard}>
              <View style={s.tourismHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={s.tourismName}>{profile.tourism.attraction_name}</Text>
                  {profile.tourism.attraction_name_en && (
                    <Text style={s.tourismNameEn}>{profile.tourism.attraction_name_en}</Text>
                  )}
                </View>
                <TouchableOpacity style={s.tourismFavBtn} activeOpacity={0.7}>
                  <Text style={s.tourismFavIcon}>{'\u2661'}</Text>
                </TouchableOpacity>
              </View>
              {profile.tourism.rating != null && (
                <View style={s.tourismRatingRow}>
                  <Text style={s.tourismStar}>{'\u2B50'}</Text>
                  <Text style={s.tourismRatingNum}>{profile.tourism.rating}</Text>
                  {profile.tourism.review_count != null && (
                    <Text style={s.tourismReviewCount}>({profile.tourism.review_count.toLocaleString()} review)</Text>
                  )}
                </View>
              )}
              <View style={s.tourismGrid}>
                <View style={s.tourismGridCell}>
                  <Text style={s.tourismGridLabel}>혼잡도</Text>
                  <Text style={[s.tourismGridValue, { color: getCongestionColor(profile.tourism.congestion) }]}>
                    {'\uD83D\uDC65'} {profile.tourism.congestion || '정보 없음'}
                  </Text>
                </View>
                <View style={s.tourismGridCell}>
                  <Text style={s.tourismGridLabel}>운영시간</Text>
                  <Text style={s.tourismGridValue}>{profile.tourism.hours || '정보 없음'}</Text>
                </View>
              </View>
              {profile.tourism.admission_fee && (
                <View style={s.tourismFeeSection}>
                  <Text style={s.tourismFeeLabel}>입장료</Text>
                  <View style={s.tourismFeeBox}>
                    <Text style={s.tourismFeeText}>{profile.tourism.admission_fee}</Text>
                  </View>
                </View>
              )}
              {profile.tourism.description && (
                <View style={s.tourismDescSection}>
                  <Text style={s.tourismDescLabel}>설명</Text>
                  <Text style={s.tourismDesc}>{profile.tourism.description}</Text>
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
  );
};

// ===== 스타일 =====
const s = StyleSheet.create({
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
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.sm,
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
  foodCategory: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4 },
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
});

export default BuildingProfileSheet;
