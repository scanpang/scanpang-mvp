/**
 * NearbyBuildingsScreen - 주변 건물 전체 목록
 * - 세로 리스트로 건물 나열
 * - 건물 클릭 → 바텀시트로 프로필 표시
 * - 카메라로 이동하지 않음
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Colors, SPACING, CardShadow } from '../constants/theme';
import { formatDistance } from '../utils/coordinate';
import useBuildingDetail from '../hooks/useBuildingDetail';
import BuildingProfileSheet from '../components/BuildingProfileSheet';

const NearbyBuildingsScreen = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { buildings = [], selectedBuildingId: initialId = null } = route?.params || {};

  const [selectedId, setSelectedId] = useState(initialId);
  const bottomSheetRef = React.useRef(null);
  const snapPoints = useMemo(() => ['1%', '55%', '90%'], []);

  // 선택된 건물의 메타 정보
  const selectedMeta = useMemo(() => {
    if (!selectedId) return null;
    const found = buildings.find(b => b.id === selectedId);
    if (!found) return null;
    return {
      lat: found.lat,
      lng: found.lng,
      name: found.name,
      address: found.address || found.roadAddress || '',
      category: found.category || '',
      categoryDetail: found.categoryDetail || '',
    };
  }, [selectedId, buildings]);

  const { building: buildingDetail, loading, enriching, fetchLazyTab } = useBuildingDetail(
    selectedId,
    { buildingMeta: selectedMeta },
  );

  const handleBuildingPress = useCallback((building) => {
    setSelectedId(building.id);
    setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 50);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedId(null);
    bottomSheetRef.current?.close();
  }, []);

  // 초기 선택 건물이 있으면 바텀시트 열기
  React.useEffect(() => {
    if (initialId) {
      setTimeout(() => bottomSheetRef.current?.snapToIndex(1), 300);
    }
  }, []);

  // 거리 색상
  const getDistanceColor = (distance) => {
    if (distance <= 100) return Colors.successGreen;
    if (distance <= 300) return Colors.accentAmber;
    return Colors.primaryBlue;
  };

  const renderItem = useCallback(({ item }) => {
    const isSelected = item.id === selectedId;
    return (
      <TouchableOpacity
        style={[styles.buildingItem, isSelected && styles.buildingItemSelected]}
        onPress={() => handleBuildingPress(item)}
        activeOpacity={0.7}
      >
        {/* 건물 아이콘 */}
        <View style={[styles.buildingIcon, isSelected && styles.buildingIconSelected]}>
          <Text style={[styles.buildingIconText, isSelected && styles.buildingIconTextSelected]}>
            {item.name?.charAt(0) || 'B'}
          </Text>
        </View>

        {/* 건물 정보 */}
        <View style={styles.buildingInfo}>
          <Text style={styles.buildingName} numberOfLines={1}>{item.name || '건물'}</Text>
          <Text style={styles.buildingAddress} numberOfLines={1}>
            {item.address || item.roadAddress || item.category || ''}
          </Text>
          <View style={styles.buildingMeta}>
            <View style={[styles.distanceDot, { backgroundColor: getDistanceColor(item.distance || 0) }]} />
            <Text style={styles.distanceText}>{formatDistance(item.distance || 0)}</Text>
            {item.category && (
              <Text style={styles.categoryTag}>{item.category}</Text>
            )}
          </View>
        </View>

        {/* 화살표 */}
        <Text style={styles.arrow}>{'›'}</Text>
      </TouchableOpacity>
    );
  }, [selectedId, handleBuildingPress]);

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.bgWhite} />

      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2039'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>주변 건물</Text>
        <Text style={styles.headerCount}>{buildings.length}개</Text>
      </View>

      <FlatList
        data={buildings}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>주변에 건물 정보가 없습니다</Text>
          </View>
        }
      />

      {/* 바텀시트: 건물 프로필 */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        backgroundStyle={styles.bsBackground}
        handleIndicatorStyle={styles.bsHandle}
        enablePanDownToClose={true}
        onChange={(index) => {
          if (index === -1) setSelectedId(null);
        }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          {selectedId ? (
            <BuildingProfileSheet
              buildingProfile={buildingDetail}
              loading={loading && !buildingDetail}
              enriching={enriching}
              onClose={handleCloseSheet}
              onLazyLoad={fetchLazyTab}
            />
          ) : (
            <View style={styles.bsEmpty}>
              <Text style={styles.bsEmptyText}>건물을 선택해주세요</Text>
            </View>
          )}
        </BottomSheetView>
      </BottomSheet>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgWhite },
  // 헤더
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    backgroundColor: Colors.bgWhite,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgGray,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.md,
  },
  backText: { fontSize: 22, color: Colors.textPrimary, marginTop: -2 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: Colors.textPrimary },
  headerCount: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  // 리스트
  listContent: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  buildingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: 14,
    backgroundColor: Colors.bgWhite,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...CardShadow,
  },
  buildingItemSelected: {
    borderColor: Colors.primaryBlue,
    backgroundColor: Colors.primaryBlueLight,
  },
  buildingIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: Colors.bgGray,
    justifyContent: 'center', alignItems: 'center',
    marginRight: SPACING.md,
  },
  buildingIconSelected: { backgroundColor: Colors.primaryBlue },
  buildingIconText: { fontSize: 18, fontWeight: '700', color: Colors.textTertiary },
  buildingIconTextSelected: { color: '#FFF' },
  buildingInfo: { flex: 1 },
  buildingName: { fontSize: 16, fontWeight: '700', color: Colors.textPrimary, marginBottom: 2 },
  buildingAddress: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4 },
  buildingMeta: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  distanceDot: { width: 7, height: 7, borderRadius: 4 },
  distanceText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  categoryTag: {
    fontSize: 11, fontWeight: '500', color: Colors.primaryBlue,
    backgroundColor: Colors.primaryBlueLight,
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4,
    overflow: 'hidden',
  },
  arrow: { fontSize: 22, color: Colors.textTertiary, marginLeft: SPACING.sm },
  // 빈 상태
  emptyContainer: { alignItems: 'center', paddingVertical: SPACING.xxl * 2 },
  emptyText: { fontSize: 15, color: Colors.textTertiary },
  // 바텀시트
  bsBackground: { backgroundColor: '#141428', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  bsHandle: { backgroundColor: 'rgba(255,255,255,0.2)', width: 36, height: 4, borderRadius: 2 },
  bsEmpty: { alignItems: 'center', paddingVertical: SPACING.xxl },
  bsEmptyText: { fontSize: 15, color: '#B0B0B0' },
});

export default NearbyBuildingsScreen;
