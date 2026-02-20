/**
 * useGeospatialAnchors - ARCore Terrain Anchor 관리 훅
 *
 * nearby 건물 좌표에 Terrain Anchor를 배치하고,
 * 네이티브에서 전달되는 screen-space 좌표로 AR 라벨 위치를 관리
 *
 * @returns {Object} { anchors, handleAnchorPositionsUpdate }
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createTerrainAnchor, removeAnchor, removeAllAnchors } from 'scanpang-arcore';

const MAX_ANCHORS = 10;
const ANCHOR_RANGE = 200; // 200m 밖 앵커 자동 해제

/**
 * @param {Object} options
 * @param {Array} options.buildings - nearby 건물 배열
 * @param {boolean} options.isLocalized - Geospatial localized 여부
 * @param {boolean} options.enabled - 활성화 여부
 * @returns {Object}
 */
const useGeospatialAnchors = ({ buildings = [], isLocalized = false, enabled = false } = {}) => {
  // 앵커 screen-space 좌표: { [buildingId]: { screenX, screenY, distance, resolved } }
  const [anchorPositions, setAnchorPositions] = useState({});
  // 현재 생성된 앵커 ID 세트
  const activeAnchorIds = useRef(new Set());
  // 마운트 상태
  const isMountedRef = useRef(true);
  // 앵커 생성 중 플래그 (중복 방지)
  const creatingRef = useRef(false);

  // 상위 10개 건물 (거리순 정렬, 200m 이내)
  const targetBuildings = useMemo(() => {
    if (!buildings.length) return [];
    return buildings
      .filter(b => b.distance != null && b.distance <= ANCHOR_RANGE && b.latitude && b.longitude)
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, MAX_ANCHORS);
  }, [buildings]);

  // 건물 변경 시 앵커 동기화
  useEffect(() => {
    if (!enabled || !isLocalized || creatingRef.current) return;

    const targetIds = new Set(targetBuildings.map(b => String(b.id)));
    const currentIds = activeAnchorIds.current;

    // 범위 밖 앵커 제거
    for (const id of currentIds) {
      if (!targetIds.has(id)) {
        removeAnchor(id);
        currentIds.delete(id);
      }
    }

    // 새 건물에 앵커 생성
    const newBuildings = targetBuildings.filter(b => !currentIds.has(String(b.id)));
    if (newBuildings.length === 0) return;

    creatingRef.current = true;

    (async () => {
      for (const building of newBuildings) {
        if (!isMountedRef.current) break;
        const id = String(building.id);
        try {
          // 건물 위 15m 높이에 앵커 배치 (라벨이 건물 위에 보이도록)
          const success = await createTerrainAnchor(
            id, building.latitude, building.longitude, 15
          );
          if (success && isMountedRef.current) {
            activeAnchorIds.current.add(id);
          }
        } catch {
          // 앵커 생성 실패 (무시)
        }
      }
      creatingRef.current = false;
    })();
  }, [targetBuildings, enabled, isLocalized]);

  // 비활성화 시 모든 앵커 제거
  useEffect(() => {
    if (!enabled || !isLocalized) {
      if (activeAnchorIds.current.size > 0) {
        removeAllAnchors();
        activeAnchorIds.current.clear();
        setAnchorPositions({});
      }
    }
  }, [enabled, isLocalized]);

  // 언마운트 시 정리
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      removeAllAnchors();
      activeAnchorIds.current.clear();
    };
  }, []);

  // 네이티브 앵커 위치 이벤트 핸들러
  const handleAnchorPositionsUpdate = useCallback((event) => {
    const data = event?.nativeEvent || event;
    const anchors = data?.anchors;
    if (!Array.isArray(anchors)) return;

    const positions = {};
    for (const anchor of anchors) {
      positions[anchor.id] = {
        screenX: anchor.screenX,
        screenY: anchor.screenY,
        distance: anchor.distance,
        resolved: anchor.resolved,
      };
    }
    setAnchorPositions(positions);
  }, []);

  // 건물 + 앵커 위치 병합 배열
  const anchors = useMemo(() => {
    return targetBuildings
      .map(building => {
        const id = String(building.id);
        const pos = anchorPositions[id];
        if (!pos) return null;
        return {
          buildingId: id,
          buildingName: building.name,
          distance: building.distance,
          screenX: pos.screenX,
          screenY: pos.screenY,
          resolved: pos.resolved,
        };
      })
      .filter(Boolean);
  }, [targetBuildings, anchorPositions]);

  return {
    anchors,
    handleAnchorPositionsUpdate,
  };
};

export default useGeospatialAnchors;
