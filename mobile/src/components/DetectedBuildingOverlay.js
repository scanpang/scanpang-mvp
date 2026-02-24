/**
 * DetectedBuildingOverlay - 건물 바운딩박스 + 건물명 라벨 오버레이
 *
 * Scene Semantics 감지 + bearing 매칭 결과를 화면에 표시
 * - 매칭된 건물: 초록 테두리 + 건물명/거리 라벨 → 탭 시 바텀시트
 * - 미매칭 영역: 반투명 테두리만 (라벨 없음)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * @param {Object} props
 * @param {Array} props.matchedBuildings - [{ building, detection, matchScore }]
 * @param {Array} props.unmatchedRegions - [{ detection }]
 * @param {Function} props.onSelect - (building) => void
 * @param {boolean} props.visible
 */
const DetectedBuildingOverlay = ({
  matchedBuildings = [],
  unmatchedRegions = [],
  onSelect,
  visible = true,
}) => {
  if (!visible) return null;
  if (matchedBuildings.length === 0 && unmatchedRegions.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 매칭된 건물: 초록 테두리 + 라벨 */}
      {matchedBuildings.map(({ building, detection, matchScore }) => {
        const { left, top, right, bottom } = detection;
        const width = right - left;
        const height = bottom - top;
        const opacity = 0.5 + matchScore * 0.5;
        const borderColor = `rgba(0, 230, 118, ${opacity})`;

        return (
          <TouchableOpacity
            key={building.id}
            style={[
              styles.boundingBox,
              { left, top, width, height, borderColor },
            ]}
            activeOpacity={0.7}
            onPress={() => onSelect?.(building)}
          >
            <View style={[styles.label, { backgroundColor: borderColor }]}>
              <Text style={styles.labelName} numberOfLines={1}>
                {building.name}
              </Text>
              {building.distance != null && (
                <Text style={styles.labelDist}>
                  {formatDist(building.distance)}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {/* 미매칭 영역: 반투명 테두리만 */}
      {unmatchedRegions.map(({ detection }, idx) => {
        const { left, top, right, bottom } = detection;
        const width = right - left;
        const height = bottom - top;

        return (
          <View
            key={`unmatched_${idx}`}
            style={[
              styles.boundingBox,
              {
                left, top, width, height,
                borderColor: 'rgba(255, 255, 255, 0.25)',
                borderStyle: 'dashed',
              },
            ]}
            pointerEvents="none"
          />
        );
      })}
    </View>
  );
};

const formatDist = (m) => {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
};

const styles = StyleSheet.create({
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  label: {
    position: 'absolute',
    top: -28,
    left: -2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 6,
    minHeight: 24,
  },
  labelName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    maxWidth: 120,
  },
  labelDist: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.6)',
  },
});

export default DetectedBuildingOverlay;
