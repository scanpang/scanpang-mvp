/**
 * useBuildingDetect - 건물 감지 훅 (GPS 기반)
 * - GPS(geoPose)로 위치 확보 후 건물 API 호출
 * - GPS 정확도 30m 초과 시 감지 비활성화
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

// GPS 정확도 임계값 (30m 초과 시 감지 비활성화)
const GPS_ACCURACY_THRESHOLD = 30;

/**
 * @param {Object} params
 * @param {Object|null} params.geoPose - GPS pose { latitude, longitude, horizontalAccuracy, ... }
 * @param {Object} params.geoPoseRef - geoPose stale closure 방지용 ref
 * @param {boolean} params.enabled - 훅 활성화 여부
 * @returns {{ buildings: Array, loading: boolean, status: string }}
 */
const useBuildingDetect = ({ geoPose = null, geoPoseRef = null, enabled = true } = {}) => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('inactive');

  const isMounted = useRef(true);
  const requestId = useRef(0);
  const lastRequest = useRef(null);    // { lat, lng, time }
  const timerRef = useRef(null);

  const fetchDetect = useCallback(async (lat, lng, horizontalAccuracy) => {
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
          detectSource: 'osm_vps',
        };
      });

      setBuildings(withConfidence);
      setStatus('ready');
      lastRequest.current = { lat, lng, time: Date.now() };
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

  // GPS geoPose 좌표 사용
  const effectiveLat = geoPose?.latitude ?? null;
  const effectiveLng = geoPose?.longitude ?? null;
  const effectiveHAcc = geoPose?.horizontalAccuracy ?? 50;

  useEffect(() => {
    if (!enabled) {
      setStatus('inactive');
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }

    // 위치 없거나 GPS 정확도 30m 초과 시 inactive
    if (effectiveLat == null || effectiveLng == null || effectiveHAcc > GPS_ACCURACY_THRESHOLD) {
      setStatus('inactive');
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }

    const last = lastRequest.current;
    let shouldFetch = false;

    if (!last) {
      shouldFetch = true;
    } else {
      const pDiff = distanceBetween(effectiveLat, effectiveLng, last.lat, last.lng);
      const tDiff = Date.now() - last.time;

      if (pDiff >= POSITION_THRESHOLD || tDiff >= TIME_THRESHOLD) {
        shouldFetch = true;
      }
    }

    if (shouldFetch) {
      fetchDetect(effectiveLat, effectiveLng, effectiveHAcc);
    }

    // 8초 주기 타이머 (변화 없어도 갱신)
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!isMounted.current || !enabled) return;
        // stale closure 방지: ref에서 최신 값 참조
        const gp = geoPoseRef?.current;
        if (!gp) return;
        fetchDetect(gp.latitude, gp.longitude, gp.horizontalAccuracy);
      }, TIME_THRESHOLD);
    }

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, effectiveLat, effectiveLng, effectiveHAcc, geoPoseRef, fetchDetect]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { buildings, loading, status };
};

export default useBuildingDetect;
