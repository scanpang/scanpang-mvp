/**
 * RecentActivity - 최근 활동 섹션
 * - 리스트 최대 3건
 * - 건물 아이콘 + 건물명 + 획득 포인트 + 시간
 * - 빈 상태: "아직 스캔 기록이 없어요"
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, SPACING } from '../../constants/theme';

// 시간 표시 헬퍼
const getTimeAgo = (timestamp) => {
  if (!timestamp) return '';
  const diff = Date.now() - timestamp;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금 전';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  return `${Math.floor(day / 7)}주 전`;
};

const ActivityItem = ({ item }) => {
  // 건물명 우선순위: name > buildingName > address
  const displayName = item.name || item.buildingName || item.address || '건물';
  const timeDisplay = item.timeAgo || getTimeAgo(item.timestamp);
  return (
    <View style={styles.item}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconText}>{displayName.charAt(0)}</Text>
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.buildingName} numberOfLines={2} ellipsizeMode="tail">{displayName}</Text>
        <Text style={styles.timeAgo}>{timeDisplay}</Text>
      </View>
      <Text style={styles.points}>+{item.points || 50}P</Text>
    </View>
  );
};

const RecentActivity = ({ activities = [], onScanPress }) => (
  <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.sectionTitle}>최근 활동</Text>
      <TouchableOpacity><Text style={styles.seeAll}>전체 기록 ›</Text></TouchableOpacity>
    </View>

    {activities.length === 0 ? (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>아직 스캔 기록이 없어요</Text>
        <TouchableOpacity style={styles.miniScanBtn} onPress={onScanPress}>
          <Text style={styles.miniScanBtnText}>스캔하러 가기</Text>
        </TouchableOpacity>
      </View>
    ) : (
      <View style={styles.list}>
        {activities.slice(0, 3).map((item) => (
          <ActivityItem key={item.id} item={item} />
        ))}
      </View>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { marginTop: SPACING.xl, paddingBottom: SPACING.xxl },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.xl, marginBottom: SPACING.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  seeAll: { fontSize: 14, fontWeight: '600', color: Colors.primaryBlue },
  list: { paddingHorizontal: SPACING.xl },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.primaryBlueLight,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.md,
  },
  iconText: { fontSize: 14, fontWeight: '700', color: Colors.primaryBlue },
  itemContent: { flex: 1 },
  buildingName: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  timeAgo: { fontSize: 13, color: Colors.textTertiary, marginTop: 2 },
  points: { fontSize: 15, fontWeight: '700', color: Colors.successGreen },
  // empty
  emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxl },
  emptyText: { fontSize: 15, color: Colors.textTertiary, marginBottom: SPACING.md },
  miniScanBtn: {
    backgroundColor: Colors.primaryBlueLight,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  miniScanBtnText: { fontSize: 14, fontWeight: '600', color: Colors.primaryBlue },
});

export default RecentActivity;
