/**
 * NearbyBuildings - 주변 건물 가로 스크롤 미리보기
 * - 섹션 타이틀 + "모두 보기 >"
 * - 가로 FlatList, snap scroll
 * - 카드: 건물명 + 카테고리 + 거리 dot
 */
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Colors, CardShadow, SPACING } from '../../constants/theme';

const CARD_WIDTH = 150;
const CARD_GAP = SPACING.md;

const DistanceDot = ({ distance }) => {
  let color = Colors.primaryBlue;
  if (distance <= 100) color = Colors.successGreen;
  else if (distance <= 300) color = Colors.accentAmber;
  return <View style={[styles.distanceDot, { backgroundColor: color }]} />;
};

const BuildingPreviewCard = ({ building, onPress, onLongPress }) => (
  <TouchableOpacity style={styles.card} onPress={() => onPress && onPress(building)} onLongPress={() => onLongPress && onLongPress(building)} activeOpacity={0.7}>
    {/* 썸네일 placeholder */}
    <View style={styles.thumbnail}>
      <Text style={styles.thumbnailText}>{building.name?.charAt(0) || 'B'}</Text>
    </View>
    <Text style={styles.buildingName} numberOfLines={1}>{building.name}</Text>
    <Text style={styles.category} numberOfLines={1}>{building.category || building.buildingUse || '건물'}</Text>
    <View style={styles.distanceRow}>
      <DistanceDot distance={building.distance || 0} />
      <Text style={styles.distanceText}>{building.distance || 0}m</Text>
    </View>
  </TouchableOpacity>
);

const SkeletonCard = () => (
  <View style={[styles.card, styles.skeletonCard]}>
    <View style={[styles.thumbnail, styles.skeletonBg]} />
    <View style={[styles.skeletonLine, { width: '70%' }]} />
    <View style={[styles.skeletonLine, { width: '50%' }]} />
  </View>
);

const NearbyBuildings = ({ buildings = [], loading = false, error = null, onBuildingPress, onBuildingLongPress, onSeeAll, onRetry }) => {
  const renderItem = ({ item }) => (
    <BuildingPreviewCard building={item} onPress={onBuildingPress} onLongPress={onBuildingLongPress} />
  );

  const showSkeleton = loading;
  const showEmpty = !loading && buildings.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>주변 건물</Text>
        <TouchableOpacity onPress={onSeeAll}><Text style={styles.seeAll}>모두 보기 ›</Text></TouchableOpacity>
      </View>

      {showSkeleton ? (
        <View style={styles.skeletonRow}>
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </View>
      ) : showEmpty ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>{error ? '!' : '~'}</Text>
          <Text style={styles.emptyText}>
            {error?.message || '주변에 건물 정보가 없습니다'}
          </Text>
          {onRetry && (
            <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
              <Text style={styles.retryBtnText}>다시 시도</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {error?.isFallback && (
            <View style={styles.fallbackBanner}>
              <Text style={styles.fallbackText}>오프라인 데이터 표시 중</Text>
            </View>
          )}
          <FlatList
            data={buildings}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.listContent}
          />
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginTop: SPACING.xl },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: 14, fontWeight: '600', color: Colors.primaryBlue },
  listContent: { paddingHorizontal: SPACING.xl, gap: CARD_GAP },
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.bgWhite,
    borderRadius: 16,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...CardShadow,
  },
  thumbnail: {
    width: '100%', height: 80,
    borderRadius: 12,
    backgroundColor: Colors.bgGray,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  thumbnailText: { fontSize: 24, fontWeight: '700', color: Colors.textTertiary },
  buildingName: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  category: { fontSize: 13, color: Colors.textSecondary, marginBottom: SPACING.xs },
  distanceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  distanceDot: { width: 8, height: 8, borderRadius: 4 },
  distanceText: { fontSize: 13, color: Colors.textSecondary },
  // skeleton
  skeletonRow: { flexDirection: 'row', paddingHorizontal: SPACING.xl, gap: CARD_GAP },
  skeletonCard: { opacity: 0.5 },
  skeletonBg: { backgroundColor: Colors.borderDefault },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: Colors.borderDefault, marginBottom: SPACING.xs },
  // empty / error
  emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xl, paddingHorizontal: SPACING.xl },
  emptyIcon: { fontSize: 28, fontWeight: '700', color: Colors.textTertiary, marginBottom: SPACING.sm },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  retryBtn: { marginTop: SPACING.md, backgroundColor: Colors.primaryBlue, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm, borderRadius: 12 },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  // fallback banner
  fallbackBanner: { marginHorizontal: SPACING.xl, marginBottom: SPACING.sm, backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  fallbackText: { fontSize: 12, fontWeight: '500', color: '#92400E', textAlign: 'center' },
});

export default NearbyBuildings;
