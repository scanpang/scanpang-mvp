/**
 * XRayOverlay - AR 층별 투시 오버레이
 * - 카메라 뷰 위에 절대 배치
 * - 층별 바가 stagger 애니메이션으로 등장
 * - 스크롤 가능, 층 수가 많으면 ScrollView
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

const C = {
  text1: '#ffffff',
  text2: 'rgba(255,255,255,0.5)',
  text3: 'rgba(255,255,255,0.3)',
  red: '#ef4444',
  purple: '#a855f7',
  blue: '#3b82f6',
  cyan: '#06b6d4',
  gray: '#475569',
  amber: '#f59e0b',
};

const getFloorBadgeColor = (floorNumber) => {
  if (floorNumber === 'RF') return C.red;
  const num = parseInt(floorNumber);
  if (isNaN(num)) return C.gray;
  if (num < 0) return C.gray;
  if (num <= 4) return C.cyan;
  if (num <= 9) return C.blue;
  return C.purple;
};

const FloorBar = ({ floor, index, totalCount }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 250,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const isHighlight = floor.has_reward;

  return (
    <Animated.View
      style={[
        s.floorBar,
        isHighlight && s.floorBarHighlight,
        { opacity: anim, transform: [{ translateY }] },
      ]}
    >
      <View style={[s.floorBadge, { backgroundColor: getFloorBadgeColor(floor.floor_number) }]}>
        <Text style={s.floorBadgeText}>{floor.floor_number}</Text>
      </View>
      <Text style={[s.floorTenant, floor.is_vacant && s.floorTenantVacant]} numberOfLines={1}>
        {floor.is_vacant ? '공실' : (floor.tenant_name || '정보 없음')}
      </Text>
      {floor.icons && <Text style={s.floorIcons}>{floor.icons}</Text>}
      {!floor.is_vacant && <Text style={s.floorChevron}>{'\u203A'}</Text>}
    </Animated.View>
  );
};

const XRayOverlay = ({ floors = [], visible }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible && fadeAnim._value === 0) return null;

  return (
    <Animated.View style={[s.overlay, { opacity: fadeAnim }]} pointerEvents={visible ? 'box-none' : 'none'}>
      <View style={s.scrollContainer}>
        <ScrollView
          showsVerticalScrollIndicator
          indicatorStyle="white"
          contentContainerStyle={s.scrollContent}
        >
          {floors.length === 0 ? (
            <View style={s.emptyWrap}>
              <Text style={s.emptyText}>층별 정보를 불러오는 중...</Text>
            </View>
          ) : (
            floors.map((floor, i) => (
              <FloorBar
                key={`${floor.floor_number}-${i}`}
                floor={floor}
                index={i}
                totalCount={floors.length}
              />
            ))
          )}
        </ScrollView>
      </View>
    </Animated.View>
  );
};

const s = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    top: SH * 0.12,
    bottom: SH * 0.18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    width: SW * 0.85,
    maxHeight: SH * 0.55,
    borderRadius: 12,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  floorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 50, 0.75)',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 3,
    gap: 10,
  },
  floorBarHighlight: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
  },
  floorBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    minWidth: 32,
    alignItems: 'center',
  },
  floorBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  floorTenant: { flex: 1, fontSize: 13, fontWeight: '500', color: C.text1 },
  floorTenantVacant: { color: 'rgba(255,255,255,0.4)' },
  floorIcons: { fontSize: 12 },
  floorChevron: { fontSize: 16, color: C.text3 },
  emptyWrap: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: C.text2 },
});

export default XRayOverlay;
