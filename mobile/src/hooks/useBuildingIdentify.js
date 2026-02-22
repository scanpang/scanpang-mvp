/**
 * useBuildingIdentify - 레이캐스팅 건물 식별 훅
 * - depth 있으면 → 즉시 identify 요청
 * - depth null + heading ±15° 3초 안정 → identify 요청 (서버에서 레이캐스팅)
 * - heading 이동 중 → 아무것도 안 함
 * - buildings 배열 반환으로 useNearbyBuildings와 호환
 * - status 반환: idle / stabilizing / requesting / done
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { identifyBuilding } from '../services/api';

// heading 안정 판정
const HEADING_STABLE_THRESHOLD = 15;  // ±15° 이내면 안정
const HEADING_STABLE_DURATION = 3000; // 3초 유지 시 트리거
const POSITION_THRESHOLD = 5;         // 5m 이상 이동 시 재요청

// 위치 변화 계산 (미터)
function distanceBetween(lat1, lng1, lat2, lng2) {
  const dlat = (lat2 - lat1) * 111320;
  const dlng = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

// heading 차이 계산 (0~180)
function headingDiff(a, b) {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * @param {Object} params
 * @param {Object|null} params.geoPose - ARCore Geospatial pose
 * @param {boolean} params.enabled - 훅 활성화 여부
 * @returns {{ buildings: Array, loading: boolean, error: Object|null, status: string, refetch: Function }}
 */
const useBuildingIdentify = ({ geoPose = null, enabled = true } = {}) => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle'); // idle / stabilizing / requesting / done

  const isMounted = useRef(true);
  const requestId = useRef(0);          // 경합 방지
  const lastRequest = useRef(null);     // 마지막 성공 요청 파라미터

  // heading 안정 추적
  const stableHeadingRef = useRef(null); // 안정 기준 heading
  const stableStartRef = useRef(null);   // 안정 시작 시각
  const stableTimerRef = useRef(null);   // 3초 타이머
  const stableFiredRef = useRef(false);  // 안정 후 이미 요청 발사했는지

  const fetchIdentify = useCallback(async (lat, lng, heading, depthMeters, horizontalAccuracy, headingAccuracy) => {
    if (!isMounted.current) return;

    const myId = ++requestId.current;
    setLoading(true);
    setStatus('requesting');
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
      setStatus('done');
      lastRequest.current = { lat, lng, heading, depthMeters };
    } catch (err) {
      if (!isMounted.current || myId !== requestId.current) return;
      console.warn('[useBuildingIdentify] API 실패:', err.message);
      setError({ message: 'identify 실패', isFallback: false });
      setBuildings([]);
      setLoading(false);
      setStatus('done');
    }
  }, []);

  useEffect(() => {
    if (!enabled || !geoPose) {
      if (buildings.length > 0) setBuildings([]);
      setStatus('idle');
      // heading 안정 상태 초기화
      stableHeadingRef.current = null;
      stableStartRef.current = null;
      stableFiredRef.current = false;
      if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
      return;
    }

    const { latitude, longitude, heading, depthMeters, horizontalAccuracy, headingAccuracy } = geoPose;
    if (latitude == null || longitude == null || heading == null) return;

    const hasDepth = depthMeters != null && depthMeters >= 0.5 && depthMeters <= 30;

    // === Case 1: depth 있으면 즉시 요청 ===
    if (hasDepth) {
      // 이전 요청과 비교: heading 10°+, depth 2m+, 위치 5m+ 중 하나 변해야 재요청
      const last = lastRequest.current;
      if (last) {
        const hDiff = headingDiff(heading, last.heading);
        const dDiff = Math.abs((depthMeters || 0) - (last.depthMeters || 0));
        const pDiff = distanceBetween(latitude, longitude, last.lat, last.lng);
        if (hDiff < 10 && dDiff < 2 && pDiff < POSITION_THRESHOLD) return;
      }
      fetchIdentify(latitude, longitude, heading, depthMeters, horizontalAccuracy, headingAccuracy);
      // depth 모드에서는 heading 안정 타이머 불필요
      stableHeadingRef.current = null;
      stableStartRef.current = null;
      stableFiredRef.current = false;
      if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
      return;
    }

    // === Case 2: depth 없음 → heading 안정 3초 대기 ===
    const now = Date.now();

    if (stableHeadingRef.current == null) {
      // 첫 heading 기록
      stableHeadingRef.current = heading;
      stableStartRef.current = now;
      stableFiredRef.current = false;
      setStatus('stabilizing');
    } else if (headingDiff(heading, stableHeadingRef.current) > HEADING_STABLE_THRESHOLD) {
      // heading이 크게 변함 → 안정 리셋
      stableHeadingRef.current = heading;
      stableStartRef.current = now;
      stableFiredRef.current = false;
      if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
      stableTimerRef.current = null;
      setStatus('stabilizing');
    }

    // 아직 발사 안 했으면 3초 타이머 설정
    if (!stableFiredRef.current && stableTimerRef.current == null) {
      const elapsed = now - (stableStartRef.current || now);
      const remaining = Math.max(0, HEADING_STABLE_DURATION - elapsed);

      stableTimerRef.current = setTimeout(() => {
        stableTimerRef.current = null;
        if (!isMounted.current || !enabled) return;

        // 위치 변화 체크 (이전 요청 대비)
        const last = lastRequest.current;
        if (last) {
          const hDiff = headingDiff(heading, last.heading);
          const pDiff = distanceBetween(latitude, longitude, last.lat, last.lng);
          if (hDiff < 10 && pDiff < POSITION_THRESHOLD) {
            stableFiredRef.current = true;
            return;
          }
        }

        stableFiredRef.current = true;
        fetchIdentify(latitude, longitude, heading, null, horizontalAccuracy, headingAccuracy);
      }, remaining);
    }

    return () => {
      if (stableTimerRef.current) {
        clearTimeout(stableTimerRef.current);
        stableTimerRef.current = null;
      }
    };
  }, [enabled, geoPose?.latitude, geoPose?.longitude, geoPose?.heading, geoPose?.depthMeters, fetchIdentify]);

  // 수동 리페치
  const refetch = useCallback(() => {
    if (!geoPose) return;
    lastRequest.current = null;
    stableFiredRef.current = false;
    const { latitude, longitude, heading, depthMeters, horizontalAccuracy, headingAccuracy } = geoPose;
    fetchIdentify(latitude, longitude, heading, depthMeters, horizontalAccuracy, headingAccuracy);
  }, [geoPose, fetchIdentify]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (stableTimerRef.current) clearTimeout(stableTimerRef.current);
    };
  }, []);

  return { buildings, loading, error, status, refetch };
};

export default useBuildingIdentify;
