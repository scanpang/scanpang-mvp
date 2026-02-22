/**
 * useBuildingIdentify - Depth/방위각 기반 건물 식별 훅
 * - geoPose(위치+heading+depth) → identify API → 건물 반환
 * - 디바운싱: heading 10°+, depth 2m+, 위치 5m+ 변화 시에만 재요청
 * - buildings 배열 반환으로 useNearbyBuildings와 호환
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { identifyBuilding } from '../services/api';

// 디바운싱 조건
const HEADING_THRESHOLD = 10;   // 10° 이상 변화
const DEPTH_THRESHOLD = 2;      // 2m 이상 변화
const POSITION_THRESHOLD = 5;   // 5m 이상 이동
const DEBOUNCE_MS = 300;        // 300ms 디바운스

// 위치 변화 계산 (미터)
function distanceBetween(lat1, lng1, lat2, lng2) {
  const dlat = (lat2 - lat1) * 111320;
  const dlng = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

/**
 * @param {Object} params
 * @param {Object|null} params.geoPose - ARCore Geospatial pose
 * @param {boolean} params.enabled - 훅 활성화 여부
 * @returns {{ buildings: Array, loading: boolean, error: Object|null, refetch: Function }}
 */
const useBuildingIdentify = ({ geoPose = null, enabled = true } = {}) => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounceTimer = useRef(null);
  const lastRequest = useRef(null);  // { lat, lng, heading, depthMeters }
  const isMounted = useRef(true);
  const requestId = useRef(0);       // 경합 방지

  const fetchIdentify = useCallback(async (lat, lng, heading, depthMeters, horizontalAccuracy, headingAccuracy) => {
    if (!isMounted.current) return;

    const myId = ++requestId.current;
    setLoading(true);
    setError(null);

    try {
      const response = await identifyBuilding({
        lat, lng, heading,
        depthMeters: depthMeters || undefined,
        horizontalAccuracy: horizontalAccuracy || undefined,
        headingAccuracy: headingAccuracy || undefined,
      });

      // 경합 방지: 최신 요청만 반영
      if (!isMounted.current || myId !== requestId.current) return;

      const rawBuildings = response?.data || [];
      // confidence 95% 고정 (identify 결과는 이미 특정된 건물)
      const withConfidence = rawBuildings.map(b => ({
        ...b,
        confidence: 0.95,
        confidencePercent: 95,
        identifySource: b.source || 'identify',
      }));

      setBuildings(withConfidence);
      setLoading(false);
    } catch (err) {
      if (!isMounted.current || myId !== requestId.current) return;
      console.warn('[useBuildingIdentify] API 실패:', err.message);
      setError({ message: 'identify 실패', isFallback: false });
      setBuildings([]);
      setLoading(false);
    }
  }, []);

  // 디바운싱 조건 체크 + 요청
  useEffect(() => {
    if (!enabled || !geoPose) {
      // 비활성 시 결과 초기화
      if (buildings.length > 0) setBuildings([]);
      return;
    }

    const { latitude, longitude, heading, depthMeters, horizontalAccuracy, headingAccuracy } = geoPose;
    if (latitude == null || longitude == null || heading == null) return;

    // 변화량 체크 (이전 요청 대비)
    const last = lastRequest.current;
    if (last) {
      const headingDiff = Math.abs(((heading - last.heading + 540) % 360) - 180);
      const depthDiff = Math.abs((depthMeters || 0) - (last.depthMeters || 0));
      const posDiff = distanceBetween(latitude, longitude, last.lat, last.lng);

      // 모든 조건 미만이면 재요청 안 함
      if (headingDiff < HEADING_THRESHOLD && depthDiff < DEPTH_THRESHOLD && posDiff < POSITION_THRESHOLD) {
        return;
      }
    }

    // 디바운스
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      lastRequest.current = { lat: latitude, lng: longitude, heading, depthMeters };
      fetchIdentify(latitude, longitude, heading, depthMeters, horizontalAccuracy, headingAccuracy);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [enabled, geoPose?.latitude, geoPose?.longitude, geoPose?.heading, geoPose?.depthMeters, fetchIdentify]);

  // 수동 리페치
  const refetch = useCallback(() => {
    if (!geoPose) return;
    lastRequest.current = null;  // 강제 리셋
    const { latitude, longitude, heading, depthMeters, horizontalAccuracy, headingAccuracy } = geoPose;
    fetchIdentify(latitude, longitude, heading, depthMeters, horizontalAccuracy, headingAccuracy);
  }, [geoPose, fetchIdentify]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return { buildings, loading, error, refetch };
};

export default useBuildingIdentify;
