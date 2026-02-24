/**
 * BearingLabels - 방향 지시자 라벨 오버레이
 *
 * bearing 투영 좌표를 기반으로 건물 라벨을 화면에 표시
 * - FOV 내: 해당 위치에 라벨 카드 표시
 * - FOV 밖: 화면 가장자리에 방향 힌트 화살표
 * - 탭 시 onSelect 콜백 호출
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const { width: SW } = Dimensions.get('window');
const EDGE_PADDING = 12; // 가장자리 힌트 여백

/**
 * @param {Object} props
 * @param {Array} props.projectedBuildings - useBearingProjection 반환값
 * @param {Function} props.onSelect - (building) => void
 * @param {boolean} props.visible - 표시 여부
 */
const BearingLabels = ({ projectedBuildings = [], onSelect, visible = true }) => {
  if (!visible || projectedBuildings.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {projectedBuildings.map(b => {
        // FOV 밖 → 가장자리 힌트
        if (!b.inFOV) {
          return (
            <View
              key={b.id}
              style={[
                styles.edgeHint,
                b.edgeHint === 'left'
                  ? { left: EDGE_PADDING, top: b.screenY }
                  : { right: EDGE_PADDING, top: b.screenY },
              ]}
            >
              <Text style={styles.edgeArrow}>
                {b.edgeHint === 'left' ? '\u2039' : '\u203A'}
              </Text>
              <Text style={styles.edgeName} numberOfLines={1}>{b.name}</Text>
            </View>
          );
        }

        // FOV 내 → 라벨 카드
        return (
          <TouchableOpacity
            key={b.id}
            style={[styles.label, { left: b.screenX - 60, top: b.screenY }]}
            activeOpacity={0.7}
            onPress={() => onSelect?.(b)}
          >
            <View style={styles.labelCard}>
              <Text style={styles.labelName} numberOfLines={1}>{b.name}</Text>
              <Text style={styles.labelDist}>{formatDist(b.distance)}</Text>
            </View>
            {/* 방향 지시자 꼬리 (아래쪽 삼각형) */}
            <View style={styles.labelTail} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// 거리 포맷
const formatDist = (m) => {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
};

const styles = StyleSheet.create({
  // FOV 내 라벨 카드
  label: {
    position: 'absolute',
    alignItems: 'center',
    width: 120,
  },
  labelCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 100,
    minHeight: 44,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  labelName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFF',
    maxWidth: 140,
    textAlign: 'center',
  },
  labelDist: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  labelTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: 'rgba(0, 0, 0, 0.75)',
    marginTop: -1,
  },

  // FOV 밖 가장자리 힌트
  edgeHint: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  edgeArrow: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  edgeName: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    maxWidth: 80,
  },
});

export default BearingLabels;
