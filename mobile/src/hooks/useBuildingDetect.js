/**
 * useBuildingDetect - 건물 감지 훅
 * - VPS(geoPose) 우선, GPS(userLocation) 폴백
 * - VPS 콜드스타트 중에도 GPS로 초기 감지 → VPS 도착 시 자동 전환
 * - 디바운싱: 위치 5m 변화 또는 8초 경과 시 재요청
 * - 출력: { buildings, loading, status }
 *   status: 'inactive' | 'detecting' | 'ready'
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { detectBuildings } from '../services/api';

// 디바운싱 임계값
const POSITION_THRESHOLD = 5;    // 5m 이동 시 재요청
const TIME_THRESHOLD = 8000;     // 8초 경과 시 재요청

// 위치 변화 계산 (미터)
function distanceBetween(lat1, lng1, lat2, lng2) {
  const dlat = (lat2 - lat1) * 111320;
  const dlng = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

/**
 * @param {Object} params
 * @param {Object|null} params.geoPose - ARCore Geospatial pose (VPS, 우선)
 * @param {Object} params.geoPoseRef - geoPose stale closure 방지용 ref
 * @param {Object|null} params.userLocation - GPS 위치 { lat, lng } (VPS 대기 중 폴백)
 * @param {Object} params.userLocationRef - userLocation stale closure 방지용 ref
 * @param {boolean} params.enabled - 훅 활성화 여부
 * @returns {{ buildings: Array, loading: boolean, status: string, source: string }}
 */
const useBuildingDetect = ({ geoPose = null, geoPoseRef = null, userLocation = null, userLocationRef = null, enabled = true } = {}) => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('inactive');
  const [source, setSource] = useState('none'); // 'vps' | 'gps' | 'none'

  const isMounted = useRef(true);
  const requestId = useRef(0);
  const lastRequest = useRef(null);    // { lat, lng, time, source }
  const timerRef = useRef(null);

  const fetchDetect = useCallback(async (lat, lng, horizontalAccuracy, detectSource) => {
    if (!isMounted.current) return;

    const myId = ++requestId.current;
    setLoading(true);
    setStatus('detecting');

    try {
      const response = await detectBuildings({
        lat, lng,
        horizontalAccuracy,
      });

      if (!isMounted.current || myId !== requestId.current) return;

      const rawBuildings = response?.data || [];
      // confidence 계산: 거리 기반 (가까울수록 높음)
      const withConfidence = rawBuildings.map(b => {
        const dist = b.distanceMeters || b.distance || 100;
        const conf = Math.max(30, Math.min(95, 95 - (dist - 10) * 0.5));
        return {
          ...b,
          confidence: conf / 100,
          confidencePercent: Math.round(conf),
          detectSource: detectSource === 'vps' ? 'osm_vps' : 'osm_gps',
        };
      });

      setBuildings(withConfidence);
      setSource(detectSource);
      setStatus('ready');
      lastRequest.current = { lat, lng, time: Date.now(), source: detectSource };
    } catch (err) {
      if (!isMounted.current || myId !== requestId.current) return;
      console.warn('[useBuildingDetect] API 실패:', err.message);
      // 실패해도 기존 buildings 유지
      setStatus('ready');
    } finally {
      if (isMounted.current && myId === requestId.current) {
        setLoading(false);
      }
    }
  }, []);

  // VPS geoPose 사용 가능한 좌표 결정
  const effectiveLat = geoPose?.latitude ?? userLocation?.lat ?? null;
  const effectiveLng = geoPose?.longitude ?? userLocation?.lng ?? null;
  const effectiveHAcc = geoPose?.horizontalAccuracy ?? 50;
  const effectiveSource = geoPose ? 'vps' : (userLocation ? 'gps' : 'none');

  useEffect(() => {
    if (!enabled) {
      setStatus('inactive');
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }

    // 위치 없으면 inactive
    if (effectiveLat == null || effectiveLng == null) {
      setStatus('inactive');
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }

    // VPS 도착 시 GPS 결과 즉시 갱신 (소스 전환)
    const last = lastRequest.current;
    let shouldFetch = false;

    if (!last) {
      shouldFetch = true;
    } else if (last.source === 'gps' && effectiveSource === 'vps') {
      // GPS → VPS 전환: 즉시 재요청
      shouldFetch = true;
    } else {
      const pDiff = distanceBetween(effectiveLat, effectiveLng, last.lat, last.lng);
      const tDiff = Date.now() - last.time;

      if (pDiff >= POSITION_THRESHOLD || tDiff >= TIME_THRESHOLD) {
        shouldFetch = true;
      }
    }

    if (shouldFetch) {
      fetchDetect(effectiveLat, effectiveLng, effectiveHAcc, effectiveSource);
    }

    // 8초 주기 타이머 (변화 없어도 갱신)
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!isMounted.current || !enabled) return;
        // stale closure 방지: ref에서 최신 값 참조
        const gp = geoPoseRef?.current;
        const ul = userLocationRef?.current;
        const lat = gp?.latitude ?? ul?.lat;
        const lng = gp?.longitude ?? ul?.lng;
        const hAcc = gp?.horizontalAccuracy ?? 50;
        const src = gp ? 'vps' : 'gps';
        if (lat != null && lng != null) {
          fetchDetect(lat, lng, hAcc, src);
        }
      }, TIME_THRESHOLD);
    }

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, effectiveLat, effectiveLng, effectiveHAcc, effectiveSource, geoPoseRef, userLocationRef, fetchDetect]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { buildings, loading, status, source };
};

export default useBuildingDetect;
