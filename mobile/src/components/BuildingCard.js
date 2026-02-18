/**
 * BuildingCard - 하단 건물 정보 카드 컴포넌트 (개선판)
 * - 건물명 + 주소 + 거리 + LIVE/투시 토글
 * - FacilityChips, StatsRow, LiveSection 컴포넌트 통합
 * - 접기/펼치기 애니메이션 (미니 모드 <-> 전체 펼침)
 * - ScrollView로 스크롤 가능
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, CARD_STYLE } from '../constants/theme';
import { formatDistance } from '../utils/coordinate';

// 하위 컴포넌트 임포트
import FacilityChips from './FacilityChips';
import StatsRow from './StatsRow';
import LiveSection from './LiveSection';

// Android LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * 건물 데이터를 StatsRow 형식으로 변환
 */
const buildStatsData = (building) => {
  if (!building) return null;

  // 테넌트 총 수 계산
  const tenantCount = building.floors
    ? building.floors.reduce((sum, f) => sum + (f.tenants ? f.tenants.length : 0), 0)
    : 0;

  // 입주율 (공실이 아닌 층의 비율, 더미: 임의 값)
  const occupancyRate = building.stats?.occupancyRate
    || Math.min(Math.round((tenantCount / Math.max(building.totalFloors || 1, 1)) * 100), 100)
    || 85;

  // 영업중 (임의 기반 계산)
  const openNow = building.stats?.openNow
    || Math.round(tenantCount * 0.7);

  return {
    totalFloors: building.totalFloors || 0,
    occupancyRate,
    tenantCount,
    openNow,
  };
};

/**
 * 뷰 모드 토글 버튼
 */
const ViewModeToggle = ({ mode, onToggle }) => (
  <View style={styles.toggleContainer}>
    <TouchableOpacity
      style={[
        styles.toggleButton,
        mode === 'live' && styles.toggleButtonActive,
      ]}
      onPress={() => onToggle('live')}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.toggleText,
        mode === 'live' && styles.toggleTextActive,
      ]}>
        LIVE
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.toggleButton,
        mode === 'xray' && styles.toggleButtonActiveXray,
      ]}
      onPress={() => onToggle('xray')}
      activeOpacity={0.7}
    >
      <Text style={[
        styles.toggleText,
        mode === 'xray' && styles.toggleTextActive,
      ]}>
        투시
      </Text>
    </TouchableOpacity>
  </View>
);

const BuildingCard = ({
  building,
  liveFeeds = [],
  onViewModeChange,
  initialExpanded = false,
}) => {
  // 접기/펼치기 상태
  const [expanded, setExpanded] = useState(initialExpanded);
  // 뷰 모드: 'live' | 'xray'
  const [viewMode, setViewMode] = useState('live');

  // 펼치기 애니메이션 값
  const expandAnim = useRef(new Animated.Value(initialExpanded ? 1 : 0)).current;
  // 카드 등장 애니메이션
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const fadeInAnim = useRef(new Animated.Value(0)).current;

  // LIVE 상태인 피드만 필터링 (최대 5개)
  const activeLiveFeeds = liveFeeds
    .filter((feed) => feed.isLive)
    .slice(0, 5);

  // 통계 데이터 생성
  const statsData = buildStatsData(building);

  /**
   * 카드 등장 애니메이션
   */
  useEffect(() => {
    if (building) {
      Animated.parallel([
        Animated.spring(slideUpAnim, {
          toValue: 0,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(fadeInAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideUpAnim.setValue(30);
      fadeInAnim.setValue(0);
    }
  }, [building, slideUpAnim, fadeInAnim]);

  /**
   * 접기/펼치기 토글
   */
  const toggleExpand = useCallback(() => {
    const newExpanded = !expanded;
    setExpanded(newExpanded);

    // LayoutAnimation으로 레이아웃 변화를 부드럽게 처리
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    Animated.spring(expandAnim, {
      toValue: newExpanded ? 1 : 0,
      friction: 8,
      tension: 80,
      useNativeDriver: false,
    }).start();
  }, [expanded, expandAnim]);

  /**
   * 뷰 모드 토글
   */
  const handleViewModeToggle = useCallback((mode) => {
    setViewMode(mode);
    onViewModeChange && onViewModeChange(mode);
  }, [onViewModeChange]);

  // 건물 데이터가 없으면 렌더링하지 않음
  if (!building) return null;

  // 펼침 상태의 최대 높이 (애니메이션용)
  const expandedMaxHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  // 화살표 회전
  const arrowRotation = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Animated.View
      style={[
        styles.outerContainer,
        {
          transform: [{ translateY: slideUpAnim }],
          opacity: fadeInAnim,
        },
      ]}
    >
      <View style={styles.container}>
        {/* ===== 헤더 (항상 표시, 탭으로 접기/펼치기) ===== */}
        <TouchableOpacity
          style={styles.header}
          onPress={toggleExpand}
          activeOpacity={0.8}
        >
          <View style={styles.headerLeft}>
            {/* 건물명 */}
            <Text style={styles.buildingName} numberOfLines={1}>
              {building.name}
            </Text>
            {/* 주소 */}
            <Text style={styles.buildingAddress} numberOfLines={1}>
              {building.address}
            </Text>
          </View>

          <View style={styles.headerRight}>
            {/* 거리 배지 */}
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>
                {formatDistance(building.distance)}
              </Text>
            </View>

            {/* 접기/펼치기 화살표 */}
            <Animated.Text
              style={[
                styles.expandArrow,
                { transform: [{ rotate: arrowRotation }] },
              ]}
            >
              ▼
            </Animated.Text>
          </View>
        </TouchableOpacity>

        {/* ===== 펼침 영역 (확장 시에만 표시) ===== */}
        {expanded && (
          <Animated.View style={{ maxHeight: expandedMaxHeight, overflow: 'hidden' }}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollContent}
              nestedScrollEnabled
            >
              {/* LIVE / 투시 뷰 모드 토글 */}
              <ViewModeToggle
                mode={viewMode}
                onToggle={handleViewModeToggle}
              />

              {/* 편의시설 칩 */}
              {building.amenities && building.amenities.length > 0 && (
                <FacilityChips facilities={building.amenities} />
              )}

              {/* 건물 지표 */}
              {statsData && (
                <StatsRow stats={statsData} />
              )}

              {/* LIVE 피드 섹션 */}
              {activeLiveFeeds.length > 0 && (
                <LiveSection feeds={activeLiveFeeds} />
              )}

              {/* 하단 여백 */}
              <View style={styles.bottomPadding} />
            </ScrollView>
          </Animated.View>
        )}

        {/* ===== 미니 모드 힌트 (접힌 상태) ===== */}
        {!expanded && activeLiveFeeds.length > 0 && (
          <View style={styles.miniHint}>
            <View style={styles.miniLiveDot} />
            <Text style={styles.miniHintText}>
              LIVE {activeLiveFeeds.length}건 · 탭하여 펼치기
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    marginHorizontal: SPACING.lg,
  },

  container: {
    ...CARD_STYLE,
    padding: 0,
    overflow: 'hidden',
  },

  // ===== 헤더 (미니 모드에서도 표시) =====
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  headerLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  buildingName: {
    ...TYPOGRAPHY.h3,
    marginBottom: 2,
  },
  buildingAddress: {
    ...TYPOGRAPHY.caption,
    color: COLORS.textMuted,
  },

  // 거리 배지
  distanceBadge: {
    backgroundColor: 'rgba(74, 144, 217, 0.15)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
  },
  distanceText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.blue,
  },

  // 접기/펼치기 화살표
  expandArrow: {
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // ===== 스크롤 콘텐츠 (펼침 시) =====
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    maxHeight: 380,
  },

  // ===== 뷰 모드 토글 =====
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 10,
    padding: 3,
    marginBottom: SPACING.md,
    gap: 3,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(74, 144, 217, 0.2)',
  },
  toggleButtonActiveXray: {
    backgroundColor: 'rgba(0, 200, 83, 0.2)',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
  },
  toggleTextActive: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // ===== 미니 모드 힌트 =====
  miniHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    gap: SPACING.xs,
  },
  miniLiveDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.live,
  },
  miniHintText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: '500',
  },

  // 하단 여백
  bottomPadding: {
    height: SPACING.md,
  },
});

export default BuildingCard;
