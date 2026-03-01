/**
 * DetectedBuildingOverlay - YOLO 바운딩박스 오버레이
 *
 * - 포커스 영역에 가장 가까운 주 건물만 초록 테두리 표시
 * - 컵: 노란 테두리 + 라벨
 */
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

const DetectedBuildingOverlay = ({
  detections = [],
  primaryIndex = null,
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
      {/* 주 건물 바운딩박스만 표시 (초록 테두리) */}
      {buildings.filter(({ idx }) => idx === primaryIndex).map(({ detection, idx }) => {
        const left = detection.left * SW;
        const top = detection.top * SH;
        const width = (detection.right - detection.left) * SW;
        const height = (detection.bottom - detection.top) * SH;

        return (
          <View
            key={`building_${idx}`}
            style={[styles.boundingBox, {
              left, top, width, height,
              borderColor: 'rgba(0, 230, 118, 0.8)',
            }]}
            pointerEvents="none"
          />
        );
      })}

      {/* 컵: 노란 테두리 + 라벨 */}
      {cups.map(({ detection, idx }) => {
        const left = detection.left * SW;
        const top = detection.top * SH;
        const width = (detection.right - detection.left) * SW;
        const height = (detection.bottom - detection.top) * SH;
        const cupColor = 'rgba(255, 215, 0, 0.7)';

        return (
          <View
            key={`cup_${idx}`}
            style={[styles.boundingBox, { left, top, width, height, borderColor: cupColor }]}
            pointerEvents="none"
          >
            <View style={[styles.cupLabel, { backgroundColor: cupColor }]}>
              <Text style={styles.cupLabelText} numberOfLines={1}>
                {detection.label || 'Cup'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  boundingBox: {
    position: 'absolute',
    borderWidth: 2,
    borderRadius: 4,
    zIndex: 10,
  },
  cupLabel: {
    position: 'absolute',
    left: 0,
    top: -24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  cupLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000',
    maxWidth: 120,
  },
});

export default DetectedBuildingOverlay;
