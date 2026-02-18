/**
 * FloorOverlay - 카메라 뷰 위에 반투명 배경으로 표시되는 층별 리스트
 * - 위에서 아래로 층 표시 (RF -> 1F -> B1)
 * - 공실은 회색 처리
 * - 리워드 가능 층은 오렌지 하이라이트
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
} from 'react-native';
import { COLORS, SPACING } from '../constants/theme';

/**
 * 층 번호 배지 컴포넌트
 */
const FloorBadge = ({ floor, isVacant, hasReward }) => {
  // 배지 색상 결정
  const badgeColor = isVacant
    ? 'rgba(97, 97, 97, 0.3)'
    : hasReward
      ? 'rgba(255, 140, 0, 0.2)'
      : 'rgba(74, 144, 217, 0.15)';

  const textColor = isVacant
    ? COLORS.textMuted
    : hasReward
      ? COLORS.orange
      : COLORS.blue;

  return (
    <View style={[styles.floorBadge, { backgroundColor: badgeColor }]}>
      <Text style={[styles.floorBadgeText, { color: textColor }]}>
        {floor}
      </Text>
    </View>
  );
};

/**
 * 개별 층 아이템 컴포넌트
 */
const FloorItem = ({ floorData, onFloorTap, onRewardTap, index }) => {
  // API 형태(floorNumber/tenantName/tenantCategory)와 더미 형태(floor/tenants/usage) 모두 지원
  const floor = floorData.floor || floorData.floorNumber || '';
  const tenants = floorData.tenants || [];
  const tenantName = floorData.tenantName || '';
  const usage = floorData.usage || floorData.tenantCategory || '';
  const isVacant = floorData.isVacant || floorData.is_vacant || false;
  const hasReward = floorData.hasReward || floorData.has_reward || false;
  const rewardPoints = floorData.rewardPoints || floorData.reward_points || 50;

  // 업체명 결합 (최대 2개 표시)
  const tenantDisplay = tenants.length > 0
    ? tenants.slice(0, 2).join(', ') + (tenants.length > 2 ? ` 외 ${tenants.length - 2}개` : '')
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
      {/* 층 번호 배지 */}
      <FloorBadge floor={floor} isVacant={isVacant} hasReward={hasReward} />

      {/* 업체명/용도 */}
      <View style={styles.floorInfo}>
        <Text
          style={[
            styles.tenantName,
            isVacant && styles.tenantNameVacant,
          ]}
          numberOfLines={1}
        >
          {isVacant ? '공실' : tenantDisplay}
        </Text>
        {usage && !isVacant && (
          <Text style={styles.usageText}>{usage}</Text>
        )}
      </View>

      {/* 우측 아이콘/버튼 영역 */}
      <View style={styles.floorAction}>
        {hasReward ? (
          <TouchableOpacity
            style={styles.rewardBtn}
            onPress={() => onRewardTap && onRewardTap(floorData)}
            activeOpacity={0.7}
          >
            <Text style={styles.rewardBtnText}>포인트 받기</Text>
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

const FloorOverlay = ({ floors = [], onFloorTap, onRewardTap, visible = false }) => {
  // 슬라이드인 애니메이션
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // 슬라이드인: 우측에서 좌측으로
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // 슬라이드아웃
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  // visible이 false이고 애니메이션 완료 시 렌더링 안 함
  // (opacity로 자연스럽게 처리)
  if (!floors || floors.length === 0) return null;

  // 슬라이드 변환 값 (우측에서 진입)
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 0],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: opacityAnim,
          transform: [{ translateX }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>층별 안내</Text>
        <Text style={styles.headerCount}>{floors.length}개 층</Text>
      </View>

      {/* 층별 리스트 (스크롤 가능, 최대 8~10개 표시) */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {floors.map((floorData, index) => (
          <FloorItem
            key={`${floorData.floor}-${index}`}
            floorData={floorData}
            onFloorTap={onFloorTap}
            onRewardTap={onRewardTap}
            index={index}
          />
        ))}
      </ScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '75%',
    maxWidth: 320,
    backgroundColor: 'rgba(10, 14, 39, 0.88)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },

  // 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerCount: {
    fontSize: 12,
    color: COLORS.textMuted,
  },

  // 스크롤뷰
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.xs + 2,
  },

  // 개별 층 아이템
  floorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: SPACING.sm + 2,
    gap: SPACING.sm + 2,
  },
  floorItemVacant: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    opacity: 0.6,
  },
  floorItemReward: {
    backgroundColor: 'rgba(255, 140, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.2)',
  },

  // 층 번호 배지
  floorBadge: {
    width: 42,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // 업체/용도 정보
  floorInfo: {
    flex: 1,
    gap: 1,
  },
  tenantName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  tenantNameVacant: {
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  usageText: {
    fontSize: 10,
    color: COLORS.textMuted,
  },

  // 우측 액션 영역
  floorAction: {
    minWidth: 30,
    alignItems: 'flex-end',
  },

  // 리워드 버튼
  rewardBtn: {
    backgroundColor: 'rgba(255, 140, 0, 0.8)',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: 10,
  },
  rewardBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  // 공실 아이콘
  vacantIcon: {
    fontSize: 14,
    color: COLORS.textMuted,
  },

  // 화살표 아이콘
  arrowIcon: {
    fontSize: 18,
    color: COLORS.textMuted,
    fontWeight: '300',
  },
});

export default FloorOverlay;
