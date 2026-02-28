/**
 * DetectedBuildingOverlay - YOLO 바운딩박스 + 건물명 라벨 + 컵 바운딩박스
 *
 * 새 아키텍처: YOLO 감지 → 바운딩박스 즉시 표시 → 역지오코딩 건물명 라벨
 * - 화면 중앙에 가장 가까운 건물 박스: 초록 테두리 + 건물명 라벨
 * - 나머지 건물 박스: 반투명 점선 테두리
 * - 컵: 노란 테두리 + 라벨
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');
const LABEL_H = 28;
const PADDING = 4;

/**
 * @param {Object} props
 * @param {Array} props.detections - YOLO 감지 결과 [{ type, left, top, right, bottom, confidence, label }]
 * @param {Object|null} props.identifiedBuilding - 역지오코딩된 건물 정보 { id, name, distance, nameSource, ... }
 * @param {number|null} props.primaryIndex - 건물명 라벨을 표시할 건물 감지 인덱스
 * @param {Function} props.onSelect - (building) => void
 * @param {boolean} props.visible
 */
const DetectedBuildingOverlay = ({
  detections = [],
  identifiedBuilding = null,
  primaryIndex = null,
  onSelect,
  visible = true,
}) => {
  if (!visible) return null;
  if (detections.length === 0) return null;

  const buildings = [];
  const cups = [];

  detections.forEach((d, idx) => {
    if (d.type === 'building') {
      buildings.push({ detection: d, idx });
    } else if (d.type === 'cup') {
      cups.push({ detection: d, idx });
    }
  });

  if (buildings.length === 0 && cups.length === 0) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* 건물 바운딩박스 */}
      {buildings.map(({ detection, idx }) => {
        const { left, top, right, bottom } = detection;
        const width = right - left;
        const height = bottom - top;
        const isPrimary = idx === primaryIndex;

        if (isPrimary && identifiedBuilding) {
          // 주 건물: 초록 테두리 + 건물명 라벨
          const ns = identifiedBuilding.nameSource;
          const borderColor = ns === 'road'
            ? 'rgba(255, 193, 7, 0.8)'
            : ns === 'jibun'
              ? 'rgba(158, 158, 158, 0.8)'
              : 'rgba(0, 230, 118, 0.8)';
          const labelBg = ns === 'road'
            ? 'rgba(255, 193, 7, 0.85)'
            : ns === 'jibun'
              ? 'rgba(158, 158, 158, 0.85)'
              : 'rgba(0, 230, 118, 0.85)';

          return (
            <TouchableOpacity
              key={`building_${idx}`}
              style={[styles.boundingBox, { left, top, width, height, borderColor }]}
              activeOpacity={0.7}
              onPress={() => onSelect?.(identifiedBuilding)}
            >
              <View style={styles.centerLabelWrap}>
                <View style={[styles.centerLabel, { backgroundColor: labelBg }]}>
                  <Text style={styles.labelName} numberOfLines={1}>
                    {identifiedBuilding.name || identifiedBuilding.roadAddress || identifiedBuilding.jibun || '건물'}
                  </Text>
                  {identifiedBuilding.distance != null && (
                    <Text style={styles.labelDist}>
                      {formatDist(identifiedBuilding.distance)}
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }

        // 비주 건물: 점선 테두리만
        return (
          <View
            key={`building_${idx}`}
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

      {/* 컵: 노란 테두리 + 라벨 */}
      {cups.map(({ detection, idx }) => {
        const { left, top, right, bottom, label } = detection;
        const width = right - left;
        const height = bottom - top;
        const cupColor = 'rgba(255, 215, 0, 0.7)';
        const labelTop = top > LABEL_H + PADDING ? -LABEL_H : PADDING;

        return (
          <View
            key={`cup_${idx}`}
            style={[styles.boundingBox, { left, top, width, height, borderColor: cupColor }]}
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
  label: {
    position: 'absolute',
    left: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
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
