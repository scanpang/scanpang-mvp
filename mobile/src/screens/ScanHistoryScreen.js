/**
 * ScanHistoryScreen - 전체 스캔 기록 리스트
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, SPACING } from '../constants/theme';

const RECENT_SCANS_KEY = '@scanpang_recent_scans';

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

// 날짜 헤더 텍스트
const getDateLabel = (timestamp) => {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(d);
  dateOnly.setHours(0, 0, 0, 0);

  const diff = today.getTime() - dateOnly.getTime();
  const days = Math.floor(diff / 86400000);

  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

const ScanHistoryScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [scans, setScans] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(RECENT_SCANS_KEY);
        if (raw) setScans(JSON.parse(raw));
      } catch {}
    })();
  }, []);

  // 날짜별 그룹핑
  const groupedData = React.useMemo(() => {
    const groups = [];
    let lastDate = null;

    scans.forEach((item) => {
      const dateLabel = getDateLabel(item.timestamp);
      if (dateLabel !== lastDate) {
        groups.push({ type: 'header', label: dateLabel, key: `header_${item.timestamp}` });
        lastDate = dateLabel;
      }
      groups.push({ type: 'item', data: item, key: item.id });
    });

    return groups;
  }, [scans]);

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.dateHeader}>
          <Text style={styles.dateHeaderText}>{item.label}</Text>
        </View>
      );
    }

    const scan = item.data;
    const displayName = scan.name || scan.buildingName || scan.address || '건물';

    return (
      <View style={styles.scanItem}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>{displayName.charAt(0)}</Text>
        </View>
        <View style={styles.itemContent}>
          <Text style={styles.buildingName} numberOfLines={2}>{displayName}</Text>
          <Text style={styles.timeAgo}>{getTimeAgo(scan.timestamp)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>전체 기록</Text>
        <View style={styles.backBtn} />
      </View>

      {scans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>스캔 기록이 없습니다</Text>
        </View>
      ) : (
        <FlatList
          data={groupedData}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + SPACING.xl }]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  backText: { fontSize: 28, color: Colors.textPrimary, marginTop: -2 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.textPrimary },
  listContent: { paddingHorizontal: SPACING.xl },
  dateHeader: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  dateHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  scanItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
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
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
});

export default ScanHistoryScreen;
