/**
 * DetectedBuildingOverlay - YOLO 바운딩박스 + 건물상세보기 라벨 + 컵 바운딩박스
 *
 * - 화면 중앙에 가장 가까운 건물 박스: 초록 테두리 + "건물상세보기" 라벨
 * - 나머지 건물 박스: 반투명 점선 테두리
 * - 컵: 노란 테두리 + 라벨
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

const DetectedBuildingOverlay = ({
  detections = [],
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
        const left = detection.left * SW;
        const top = detection.top * SH;
        const width = (detection.right - detection.left) * SW;
        const height = (detection.bottom - detection.top) * SH;
        const isPrimary = idx === primaryIndex;

        if (isPrimary) {
          // 주 건물: 초록 테두리 + "건물상세보기" 라벨
          return (
            <TouchableOpacity
              key={`building_${idx}`}
              style={[styles.boundingBox, {
                left, top, width, height,
                borderColor: 'rgba(0, 230, 118, 0.8)',
              }]}
              activeOpacity={0.7}
              onPress={() => onSelect?.()}
            >
              <View style={styles.centerLabelWrap}>
                <View style={styles.detailLabel}>
                  <Text style={styles.detailLabelText}>건물상세보기</Text>
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
  centerLabelWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailLabel: {
    backgroundColor: 'rgba(0, 230, 118, 0.85)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000',
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
