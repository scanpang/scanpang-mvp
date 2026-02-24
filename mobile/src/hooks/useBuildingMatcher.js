/**
 * useBuildingMatcher - Scene Semantics 건물 영역 + bearing 투영 매칭 훅
 *
 * ARCore Scene Semantics에서 감지된 건물 바운딩박스와
 * bearing 투영으로 계산된 건물 스크린 좌표를 매칭하여
 * "이 바운딩박스가 어떤 건물인지" 결정
 *
 * 매칭 로직:
 * 1. bearing 건물의 screenX와 바운딩박스 centerX 비교
 * 2. X 차이가 화면 폭 25% 이내면 매칭
 * 3. 면적 큰 바운딩박스 우선 (화면에서 크게 보이는 건물)
 * 4. 매칭 안 되는 바운딩박스는 라벨 없이 테두리만 표시
 *
 * @param {Object} options
 * @param {Array} options.detections - Scene Semantics 건물 영역 (정규화 좌표 0~1)
 * @param {Array} options.projectedBuildings - useBearingProjection 반환값
 * @returns {{ matchedBuildings: Array, unmatchedRegions: Array }}
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
  const prevResultRef = useRef({ matched: [], unmatched: [] });

  const result = useMemo(() => {
    // 투영된 건물이 없으면 매칭 불가
    if (!projectedBuildings.length) {
      prevResultRef.current = { matched: [], unmatched: [] };
      return prevResultRef.current;
    }

    // 감지 결과가 없으면 이전 결과 유지
    if (!detections.length) {
      return prevResultRef.current;
    }

    // 면적 계산 + 큰 순 정렬
    const sortedDetections = detections
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

      // 스크린 좌표 변환 (정규화 → 픽셀)
      const screenBox = {
        left: det.left * SW,
        top: det.top * SH,
        right: det.right * SW,
        bottom: det.bottom * SH,
        confidence: det.confidence,
      };

      if (bestBuilding) {
        usedBuildingIds.add(bestBuilding.id);
        const matchScore = 1 - (bestDx / matchThreshold);
        matched.push({
          building: bestBuilding,
          detection: screenBox,
          matchScore,
        });
      } else {
        // 매칭 안 됨 → 테두리만 표시용
        unmatched.push({ detection: screenBox });
      }
    }

    prevResultRef.current = { matched, unmatched };
    return prevResultRef.current;
  }, [detections, projectedBuildings]);

  return {
    matchedBuildings: result.matched,
    unmatchedRegions: result.unmatched,
    hasDetection: result.matched.length > 0,
  };
};

export default useBuildingMatcher;
