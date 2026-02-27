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

        // nameSource에 따른 라벨 색상 분기
        const borderColor = building.nameSource === 'road'
          ? `rgba(255, 193, 7, ${opacity})`       // 노란색 (도로명만)
          : building.nameSource === 'jibun'
            ? `rgba(158, 158, 158, ${opacity})`    // 회색 (지번만)
            : `rgba(0, 230, 118, ${opacity})`;     // 녹색 (naver 건물명 또는 기본)

        const labelBg = building.nameSource === 'road'
          ? 'rgba(255, 193, 7, 0.85)'
          : building.nameSource === 'jibun'
            ? 'rgba(158, 158, 158, 0.85)'
            : 'rgba(0, 230, 118, 0.85)';

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
            {/* 바운딩박스 중앙 라벨 */}
            <View style={styles.centerLabelWrap}>
            <View style={[styles.centerLabel, { backgroundColor: labelBg }]}>
              <Text style={styles.labelName} numberOfLines={1}>
                {building.name || building.roadAddress || building.jibun || '건물'}
              </Text>
              {building.distance != null && (
                <Text style={styles.labelDist}>
                  {formatDist(building.distance)}
                </Text>
              )}
            </View>
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
  centerLabelWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
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
