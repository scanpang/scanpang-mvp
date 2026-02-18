/**
 * FloorOverlay - 층별 안내 (레퍼런스 기준 우측 반투명 패널)
 * - Bug #4: 로딩 완료 후 스피너 제거
 * - Bug #5: 최대 높이 50%, 바텀시트 스타일
 * - 슬라이드인 애니메이션
 */

import React, { useRef, useEffect } from 'react';
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
import { COLORS, SPACING } from '../constants/theme';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_OVERLAY_HEIGHT = SCREEN_HEIGHT * 0.45; // 최대 45% 높이

const FloorBadge = ({ floor, isVacant, hasReward }) => {
  const badgeColor = isVacant
    ? 'rgba(97,97,97,0.3)'
    : hasReward
      ? 'rgba(255,140,0,0.2)'
      : 'rgba(74,144,217,0.15)';
  const textColor = isVacant
    ? COLORS.textMuted
    : hasReward ? COLORS.orange : COLORS.blue;

  return (
    <View style={[styles.floorBadge, { backgroundColor: badgeColor }]}>
      <Text style={[styles.floorBadgeText, { color: textColor }]}>{floor}</Text>
    </View>
  );
};

const FloorItem = ({ floorData, onFloorTap, onRewardTap }) => {
  const floor = floorData.floor || floorData.floorNumber || '';
  const tenants = floorData.tenants || [];
  const tenantName = floorData.tenantName || '';
  const usage = floorData.usage || floorData.tenantCategory || '';
  const isVacant = floorData.isVacant || floorData.is_vacant || false;
  const hasReward = floorData.hasReward || floorData.has_reward || false;

  const tenantDisplay = tenants.length > 0
    ? tenants.slice(0, 2).join(', ') + (tenants.length > 2 ? ` +${tenants.length - 2}` : '')
    : tenantName || usage || '정보 없음';

  return (
    <TouchableOpacity
      style={[
        styles.floorItem,
        isVacant && styles.floorItemVacant,
        hasReward && styles.floorItemReward,
      ]}
      onPress={() => onFloorTap && onFloorTap(floorData)}
      activeOpacity={0.7}
    >
      <FloorBadge floor={floor} isVacant={isVacant} hasReward={hasReward} />
      <View style={styles.floorInfo}>
        <Text
          style={[styles.tenantName, isVacant && styles.tenantNameVacant]}
          numberOfLines={1}
        >
          {isVacant ? '공실' : tenantDisplay}
        </Text>
      </View>
      <View style={styles.floorAction}>
        {hasReward ? (
          <TouchableOpacity
            style={styles.rewardBtn}
            onPress={() => onRewardTap && onRewardTap(floorData)}
          >
            <Text style={styles.rewardBtnText}>포인트</Text>
          </TouchableOpacity>
        ) : isVacant ? (
          <Text style={styles.vacantIcon}>━</Text>
        ) : (
          <Text style={styles.arrowIcon}>›</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const FloorOverlay = ({ floors = [], loading = false, onFloorTap, onRewardTap, visible = false }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1, friction: 8, tension: 65, useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1, duration: 250, useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0, duration: 200, useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0, duration: 200, useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible && !floors.length) return null;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [120, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: opacityAnim, transform: [{ translateX }] },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>층별 안내</Text>
        <Text style={styles.headerCount}>{floors.length}개 층</Text>
      </View>

      {/* Bug #4: 로딩 상태 - 데이터 로드 완료 시 스피너 제거 */}
      {loading && floors.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={COLORS.blue} />
          <Text style={styles.loadingText}>층별 정보 로딩중...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {floors.map((floorData, index) => (
            <FloorItem
              key={`${floorData.floor || floorData.floorNumber}-${index}`}
              floorData={floorData}
              onFloorTap={onFloorTap}
              onRewardTap={onRewardTap}
            />
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // Bug #5: 최대 높이 제한 + 우측 패널 스타일
  container: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '60%',
    maxWidth: 280,
    maxHeight: MAX_OVERLAY_HEIGHT,
    backgroundColor: 'rgba(10,14,39,0.92)',
    borderLeftWidth: 1,
    borderBottomLeftRadius: 16,
    borderLeftColor: 'rgba(255,255,255,0.1)',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  headerCount: { fontSize: 11, color: COLORS.textMuted },

  // 로딩 상태
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm,
  },
  loadingText: { fontSize: 12, color: COLORS.textMuted },

  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: SPACING.sm, gap: SPACING.xs + 1 },

  floorItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10, padding: SPACING.sm, gap: SPACING.sm,
  },
  floorItemVacant: { backgroundColor: 'rgba(255,255,255,0.02)', opacity: 0.5 },
  floorItemReward: {
    backgroundColor: 'rgba(255,140,0,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,140,0,0.2)',
  },

  floorBadge: {
    width: 38, height: 26, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },
  floorBadgeText: { fontSize: 11, fontWeight: '700' },

  floorInfo: { flex: 1 },
  tenantName: { fontSize: 12, fontWeight: '600', color: COLORS.textPrimary },
  tenantNameVacant: { color: COLORS.textMuted, fontStyle: 'italic' },

  floorAction: { minWidth: 28, alignItems: 'flex-end' },
  rewardBtn: {
    backgroundColor: 'rgba(255,140,0,0.8)',
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: 8,
  },
  rewardBtnText: { fontSize: 9, fontWeight: '700', color: COLORS.textPrimary },
  vacantIcon: { fontSize: 12, color: COLORS.textMuted },
  arrowIcon: { fontSize: 16, color: COLORS.textMuted, fontWeight: '300' },
});

export default FloorOverlay;
