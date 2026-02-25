/**
 * useBuildingMatcher - YOLO 감지 + bearing 투영 매칭 훅
 *
 * YOLO에서 감지된 건물 바운딩박스와 bearing 투영 건물을 1:1 매칭
 * - 건물 바운딩박스 1개당 가장 일치하는 건물 라벨 1개만 표시
 * - 바운딩박스 없는 건물 → 숨김
 * - 컵은 바운딩박스만 표시 (라벨 없음)
 *
 * @param {Object} options
 * @param {Array} options.detections - YOLO 감지 결과 (정규화 좌표 0~1, type: "building"/"cup")
 * @param {Array} options.projectedBuildings - useBearingProjection 반환값
 * @returns {{ matchedBuildings, unmatchedRegions, cupRegions, hasDetection }}
 */
import { useMemo, useRef } from 'react';
import { Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// 매칭 임계값: 화면 폭의 25%
const MATCH_THRESHOLD_RATIO = 0.25;

const useBuildingMatcher = ({
  detections = [],
  projectedBuildings = [],
} = {}) => {

  // 이전 매칭 결과 캐시 (300ms 쓰로틀 갭 동안 깜빡임 방지)
  const prevResultRef = useRef({ matched: [], unmatched: [], cups: [] });

  const result = useMemo(() => {
    // 감지 결과가 없으면 즉시 비움 (이전 결과 유지 안 함)
    if (!detections.length) {
      const empty = { matched: [], unmatched: [], cups: [] };
      prevResultRef.current = empty;
      return empty;
    }

    // 건물/컵 분리
    const buildingDetections = detections.filter(d => d.type === 'building');
    const cupDetections = detections.filter(d => d.type === 'cup');

    // 화면 영역으로 클램핑하는 헬퍼
    const clampBox = (d) => ({
      left: Math.max(0, d.left * SW),
      top: Math.max(0, d.top * SH),
      right: Math.min(SW, d.right * SW),
      bottom: Math.min(SH, d.bottom * SH),
      confidence: d.confidence,
    });

    // 컵 → 스크린 좌표 변환 (클램핑 적용)
    const cups = cupDetections.map(d => ({
      detection: clampBox(d),
      label: 'Cup',
    }));

    // 건물 감지가 없거나 투영 건물이 없으면 매칭 불가
    if (!buildingDetections.length || !projectedBuildings.length) {
      const res = { matched: [], unmatched: [], cups };
      prevResultRef.current = res;
      return res;
    }

    // 면적 계산 + 큰 순 정렬
    const sortedDetections = buildingDetections
      .map(d => {
        const cx = d.centerX != null ? d.centerX : (d.left + d.right) / 2;
        const area = (d.right - d.left) * (d.bottom - d.top);
        return { ...d, cx, area };
      })
      .sort((a, b) => b.area - a.area);

    const matchThreshold = SW * MATCH_THRESHOLD_RATIO;
    const usedBuildingIds = new Set();
    const matched = [];
    const unmatched = [];

    for (const det of sortedDetections) {
      // 바운딩박스 centerX → 스크린 픽셀
      const detScreenX = det.cx * SW;

      let bestBuilding = null;
      let bestDx = Infinity;

      for (const b of projectedBuildings) {
        if (!b.inFOV) continue;
        if (usedBuildingIds.has(b.id)) continue;

        const dx = Math.abs(b.screenX - detScreenX);
        if (dx > matchThreshold) continue;

        if (dx < bestDx) {
          bestDx = dx;
          bestBuilding = b;
        }
      }

      // 스크린 좌표 변환 (정규화 → 픽셀, 화면 클램핑)
      const screenBox = clampBox(det);

      if (bestBuilding) {
        usedBuildingIds.add(bestBuilding.id);
        const matchScore = 1 - (bestDx / matchThreshold);
        matched.push({
          building: bestBuilding,
          detection: screenBox,
          matchScore,
        });
      } else {
        // 매칭 안 됨 → 건물 테두리만 표시
        unmatched.push({ detection: screenBox });
      }
    }

    const res = { matched, unmatched, cups };
    prevResultRef.current = res;
    return res;
  }, [detections, projectedBuildings]);

  return {
    matchedBuildings: result.matched,
    unmatchedRegions: result.unmatched,
    cupRegions: result.cups,
    hasDetection: result.matched.length > 0,
  };
};

export default useBuildingMatcher;
