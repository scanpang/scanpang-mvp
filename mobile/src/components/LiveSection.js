/**
 * LiveSection - "지금 이 순간 LIVE" 섹션
 * - LIVE 뱃지 깜빡임 1200ms (간질 위험 방지, 0.42Hz 안전)
 * - 피드 아이콘 이모지 → 텍스트 아이콘
 * - minHeight 48
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { COLORS, SPACING, TOUCH } from '../constants/theme';

/**
 * 피드 타입별 색상 매핑
 */
const FEED_TYPE_COLORS = {
  event: '#4CAF50',
  congestion: '#FF9800',
  promotion: '#2196F3',
  update: '#F44336',
  promo: '#2196F3',
  alert: '#F44336',
  news: '#4CAF50',
};

/**
 * 피드 타입별 텍스트 아이콘 매핑
 */
const FEED_TYPE_ICONS = {
  event: 'EVT',
  congestion: 'TRF',
  promotion: 'SAL',
  update: 'UPD',
  promo: 'SAL',
  alert: 'ALT',
  news: 'NEW',
};

/**
 * 피드 타입별 라벨 매핑
 */
const FEED_TYPE_LABELS = {
  event: '이벤트',
  congestion: '혼잡도',
  promotion: '프로모션',
  update: '업데이트',
  promo: '프로모션',
  alert: '알림',
  news: '뉴스',
};

/**
 * 타임스탬프를 "N분 전" 형태로 변환
 */
const getRelativeTime = (timestamp) => {
  const now = Date.now();
  const time = new Date(timestamp).getTime();
  const diffMin = Math.floor((now - time) / (1000 * 60));

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
};

/**
 * LIVE 뱃지 - 깜빡임 1200ms (안전한 0.42Hz)
 */
const LiveBadge = () => {
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0.3,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();

    return () => animation.stop();
  }, [blinkAnim]);

  return (
    <View style={styles.liveBadge}>
      <Animated.View style={[styles.liveDot, { opacity: blinkAnim }]} />
      <Text style={styles.liveLabel}>LIVE</Text>
    </View>
  );
};

/**
 * 개별 피드 아이템
 */
const FeedItem = ({ feed }) => {
  const typeColor = FEED_TYPE_COLORS[feed.type] || COLORS.blue;
  const typeIcon = FEED_TYPE_ICONS[feed.type] || 'PIN';
  const typeLabel = FEED_TYPE_LABELS[feed.type] || feed.type;

  return (
    <TouchableOpacity style={styles.feedItem} activeOpacity={0.7}>
      {/* 텍스트 아이콘 (타입별 색상 원형 배경) */}
      <View style={[styles.feedIconCircle, { backgroundColor: `${typeColor}20` }]}>
        <Text style={[styles.feedIcon, { color: typeColor }]}>{typeIcon}</Text>
      </View>

      {/* 피드 내용 */}
      <View style={styles.feedContent}>
        {/* 제목 행: 타입 태그 + 제목 */}
        <View style={styles.feedTitleRow}>
          <View style={[styles.feedTypeTag, { backgroundColor: `${typeColor}20` }]}>
            <Text style={[styles.feedTypeText, { color: typeColor }]}>
              {typeLabel}
            </Text>
          </View>
          <Text style={styles.feedTitle} numberOfLines={1}>
            {feed.title}
          </Text>
        </View>

        {/* 설명 */}
        {feed.description && (
          <Text style={styles.feedDescription} numberOfLines={1}>
            {feed.description}
          </Text>
        )}
      </View>

      {/* 시간 라벨 */}
      <Text style={styles.feedTime}>
        {getRelativeTime(feed.timestamp)}
      </Text>
    </TouchableOpacity>
  );
};

const LiveSection = ({ feeds = [] }) => {
  if (!feeds || feeds.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* 섹션 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <LiveBadge />
          <Text style={styles.headerTitle}>지금 이 순간</Text>
        </View>
        <Text style={styles.feedCount}>{feeds.length}건</Text>
      </View>

      {/* 피드 목록 */}
      {feeds.map((feed) => (
        <FeedItem key={feed.id} feed={feed} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingTop: SPACING.md,
  },

  // 섹션 헤더
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm + 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  feedCount: {
    fontSize: 11,
    color: COLORS.textMuted,
  },

  // LIVE 뱃지
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.live,
  },
  liveLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.live,
    letterSpacing: 1,
  },

  // 피드 아이템 (minHeight 48)
  feedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.sm + 2,
    minHeight: 48,
  },

  // 텍스트 아이콘 원형 배경
  feedIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedIcon: {
    fontSize: 10,
    fontWeight: '800',
  },

  // 피드 내용
  feedContent: {
    flex: 1,
    gap: 2,
  },
  feedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
  },
  feedTypeTag: {
    paddingHorizontal: SPACING.xs + 2,
    paddingVertical: 1,
    borderRadius: 4,
  },
  feedTypeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  feedTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  feedDescription: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 1,
  },

  // 시간 라벨
  feedTime: {
    fontSize: 10,
    color: COLORS.textMuted,
    minWidth: 45,
    textAlign: 'right',
  },
});

export default LiveSection;
