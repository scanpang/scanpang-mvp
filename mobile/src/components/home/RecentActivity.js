/**
 * RecentActivity - 최근 활동 섹션
 * - 리스트 최대 3건
 * - 건물 아이콘 + 건물명 + 획득 포인트 + 시간
 * - 빈 상태: "아직 스캔 기록이 없어요"
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, SPACING } from '../../constants/theme';

const DUMMY_ACTIVITY = [
  { id: 1, buildingName: '강남 파이낸스센터', points: 50, timeAgo: '2시간 전' },
  { id: 2, buildingName: '삼성타운', points: 50, timeAgo: '어제' },
  { id: 3, buildingName: '코엑스몰', points: 100, timeAgo: '3일 전' },
];

const ActivityItem = ({ item }) => (
  <View style={styles.item}>
    <View style={styles.iconCircle}>
      <Text style={styles.iconText}>B</Text>
    </View>
    <View style={styles.itemContent}>
      <Text style={styles.buildingName}>{item.buildingName}</Text>
      <Text style={styles.timeAgo}>{item.timeAgo}</Text>
    </View>
    <Text style={styles.points}>+{item.points}P</Text>
  </View>
);

const RecentActivity = ({ activities = DUMMY_ACTIVITY, onScanPress }) => (
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
