/**
 * useBuildingMatcher - ML Kit 감지 결과 + bearing 투영 건물 매칭 훅
 *
 * ML Kit Object Detection에서 감지된 바운딩박스와
 * bearing 투영으로 계산된 건물 스크린 좌표를 매칭하여
 * "이 바운딩박스가 어떤 건물인지" 결정
 *
 * 매칭 로직:
 * 1. 포커스 영역(화면 중앙 60%x50%) 내 감지만 필터링
 * 2. 면적 큰 오브젝트 우선 (건물 = 화면에서 큰 물체)
 * 3. bearing 건물의 screenX와 바운딩박스 중심 X 유사도로 매칭
 * 4. 매칭 임계값: 화면 폭 30% 이내
 *
 * @param {Object} options
 * @param {Array} options.detections - ML Kit 감지 결과 (정규화 좌표 0~1)
 * @param {Array} options.projectedBuildings - useBearingProjection 반환값
 * @param {Object} options.focusRegion - 포커스 영역 정규화 좌표 { x, y, width, height }
 * @returns {Array} matchedBuildings - [{ building, detection, matchScore }]
 */
import { useMemo, useRef } from 'react';
import { Dimensions } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');

// 포커스 영역 기본값 (화면 중앙 60%x50%)
const DEFAULT_FOCUS = {
  x: 0.2,     // 좌측 20%부터
  y: 0.25,    // 상단 25%부터
  width: 0.6, // 가로 60%
  height: 0.5 // 세로 50%
};

// 매칭 임계값: 화면 폭의 30%
const MATCH_THRESHOLD_RATIO = 0.30;
// 최소 면적 비율: 포커스 영역의 5% 이상이어야 건물로 간주
const MIN_AREA_RATIO = 0.05;

const useBuildingMatcher = ({
  detections = [],
  projectedBuildings = [],
  focusRegion = DEFAULT_FOCUS,
} = {}) => {

  // 이전 매칭 결과 캐시 (깜빡임 방지)
  const prevMatchedRef = useRef([]);

  const matchedBuildings = useMemo(() => {
    // 투영된 건물이 없으면 매칭 불가
    if (!projectedBuildings.length) {
      prevMatchedRef.current = [];
      return [];
    }

    // 감지 결과가 없으면 이전 결과 유지 (300ms 쓰로틀 때문)
    if (!detections.length) {
      return prevMatchedRef.current;
    }

    const focusLeft = focusRegion.x;
    const focusTop = focusRegion.y;
    const focusRight = focusRegion.x + focusRegion.width;
    const focusBottom = focusRegion.y + focusRegion.height;
    const focusArea = focusRegion.width * focusRegion.height;

    // 1. 포커스 영역 내 감지 필터링 + 면적 계산
    const filteredDetections = detections
      .map(d => {
        // 바운딩박스 중심이 포커스 영역 내인지 확인
        const cx = (d.left + d.right) / 2;
        const cy = (d.top + d.bottom) / 2;
        const inFocus = cx >= focusLeft && cx <= focusRight &&
                        cy >= focusTop && cy <= focusBottom;
        if (!inFocus) return null;

        const area = (d.right - d.left) * (d.bottom - d.top);
        // 최소 면적 미달 → 너무 작은 객체 무시
        if (area < MIN_AREA_RATIO * focusArea) return null;

        return { ...d, cx, cy, area };
      })
      .filter(Boolean)
      // 면적 큰 순 정렬 (건물은 화면에서 큰 물체)
      .sort((a, b) => b.area - a.area);

    if (!filteredDetections.length) {
      prevMatchedRef.current = [];
      return [];
    }

    // 매칭 임계값 (픽셀)
    const matchThreshold = SW * MATCH_THRESHOLD_RATIO;

    // 2. 각 감지에 대해 가장 가까운 bearing 건물 매칭
    const usedBuildingIds = new Set();
    const matched = [];

    for (const det of filteredDetections) {
      // 바운딩박스 중심의 스크린 좌표 (정규화 → 픽셀)
      const detScreenX = det.cx * SW;
      const detScreenY = det.cy * SH;

      let bestBuilding = null;
      let bestScore = Infinity;

      for (const b of projectedBuildings) {
        if (!b.inFOV) continue;
        if (usedBuildingIds.has(b.id)) continue;

        // X 좌표 차이 (주요 매칭 기준)
        const dx = Math.abs(b.screenX - detScreenX);
        if (dx > matchThreshold) continue;

        // Y 좌표 차이 (보조 기준, 가중치 낮음)
        const dy = Math.abs(b.screenY - detScreenY);

        // 종합 점수: X 차이 가중 0.7 + Y 차이 가중 0.3
        const score = dx * 0.7 + dy * 0.3;

        if (score < bestScore) {
          bestScore = score;
          bestBuilding = b;
        }
      }

      if (bestBuilding) {
        usedBuildingIds.add(bestBuilding.id);
        matched.push({
          building: bestBuilding,
          detection: {
            // 스크린 좌표 (픽셀)로 변환
            left: det.left * SW,
            top: det.top * SH,
            right: det.right * SW,
            bottom: det.bottom * SH,
            trackingId: det.trackingId,
            labels: det.labels,
            confidence: det.confidence,
          },
          matchScore: 1 - (bestScore / matchThreshold), // 0~1 정규화 (1이 최고)
        });
      }
    }

    prevMatchedRef.current = matched;
    return matched;
  }, [detections, projectedBuildings, focusRegion]);

  // 포커스 영역에 건물이 감지되었는지 여부
  const hasFocusDetection = matchedBuildings.length > 0;

  return { matchedBuildings, hasFocusDetection };
};

export default useBuildingMatcher;
