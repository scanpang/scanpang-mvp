/**
 * DetectedBuildingOverlay - 바운딩박스 + 건물명 라벨 오버레이
 *
 * ML Kit 감지 + bearing 매칭 결과를 화면에 표시
 * - 바운딩박스 테두리 (감지 영역)
 * - 상단에 건물명 라벨
 * - 탭 시 onSelect 콜백 → 바텀시트 오픈
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * @param {Object} props
 * @param {Array} props.matchedBuildings - useBuildingMatcher 반환값
 *   [{ building: { id, name, distance, ... }, detection: { left, top, right, bottom }, matchScore }]
 * @param {Function} props.onSelect - (building) => void
 * @param {boolean} props.visible
 */
const DetectedBuildingOverlay = ({ matchedBuildings = [], onSelect, visible = true }) => {
  if (!visible || matchedBuildings.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {matchedBuildings.map(({ building, detection, matchScore }) => {
        const { left, top, right, bottom } = detection;
        const width = right - left;
        const height = bottom - top;

        // matchScore 기반 투명도 (높을수록 선명)
        const opacity = 0.5 + matchScore * 0.5;
        const borderColor = `rgba(0, 230, 118, ${opacity})`;

        return (
          <TouchableOpacity
            key={building.id}
            style={[
              styles.boundingBox,
              {
                left, top, width, height,
                borderColor,
              },
            ]}
            activeOpacity={0.7}
            onPress={() => onSelect?.(building)}
          >
            {/* 건물명 라벨 (바운딩박스 상단) */}
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
