/**
 * DetectedBuildingOverlay - 건물 바운딩박스 + 건물명 라벨 + 컵 바운딩박스
 *
 * - 매칭된 건물: 초록 테두리 + 건물명/거리 라벨 → 탭 시 바텀시트
 * - 미매칭 건물 영역: 반투명 흰색 점선 테두리
 * - 컵: 노란 테두리 (라벨 없음, 실내 테스트용)
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');
const LABEL_H = 28; // 라벨 높이
const PADDING = 4;  // 화면 가장자리 여백

/**
 * @param {Object} props
 * @param {Array} props.matchedBuildings - [{ building, detection, matchScore }]
 * @param {Array} props.unmatchedRegions - [{ detection }]
 * @param {Array} props.cupRegions - [{ detection }]
 * @param {Function} props.onSelect - (building) => void
 * @param {boolean} props.visible
 */
const DetectedBuildingOverlay = ({
  matchedBuildings = [],
  unmatchedRegions = [],
  cupRegions = [],
  onSelect,
  visible = true,
}) => {
  if (!visible) return null;
  if (matchedBuildings.length === 0 && unmatchedRegions.length === 0 && cupRegions.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 매칭된 건물: 초록 테두리 + 라벨 */}
      {matchedBuildings.map(({ building, detection, matchScore }) => {
        const { left, top, right, bottom } = detection;
        const width = right - left;
        const height = bottom - top;
        const opacity = 0.5 + matchScore * 0.5;
        const borderColor = `rgba(0, 230, 118, ${opacity})`;

        // 라벨 위치: 박스 위에 공간 있으면 위, 없으면 박스 안쪽 상단
        const labelTop = top > LABEL_H + PADDING
          ? -LABEL_H
          : PADDING;

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
            <View style={[styles.label, { backgroundColor: borderColor, top: labelTop }]}>
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

      {/* 미매칭 건물 영역: 반투명 테두리만 */}
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

      {/* 컵: 노란 테두리 + 라벨 (실내 테스트용) */}
      {cupRegions.map(({ detection, label }, idx) => {
        const { left, top, right, bottom } = detection;
        const width = right - left;
        const height = bottom - top;
        const cupColor = 'rgba(255, 215, 0, 0.7)';

        // 라벨 위치: 박스 위에 공간 있으면 위, 없으면 박스 안쪽 상단
        const labelTop = top > LABEL_H + PADDING
          ? -LABEL_H
          : PADDING;

        return (
          <View
            key={`cup_${idx}`}
            style={[
              styles.boundingBox,
              {
                left, top, width, height,
                borderColor: cupColor,
              },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.label, { backgroundColor: cupColor, top: labelTop }]}>
              <Text style={styles.labelName} numberOfLines={1}>
                {label || 'Cup'}
              </Text>
            </View>
          </View>
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
