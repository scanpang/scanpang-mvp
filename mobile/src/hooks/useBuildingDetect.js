/**
 * useBuildingDetect - VPS + OSM 건물 감지 전용 훅
 * - VPS 필수: geoPose 없거나 horizontalAccuracy >= 10 → inactive
 * - 디바운싱: 위치 5m 변화 또는 8초 경과 시 재요청 (heading 제거 → 클라이언트 실시간 FOV)
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
 * @param {Object|null} params.geoPose - ARCore Geospatial pose
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

  useEffect(() => {
    // VPS 비활성 조건
    if (!enabled || !geoPose || (geoPose.horizontalAccuracy != null && geoPose.horizontalAccuracy >= 10)) {
      setStatus('inactive');
      // 타이머 정리
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }

    const { latitude, longitude, horizontalAccuracy } = geoPose;
    if (latitude == null || longitude == null) return;

    // 디바운싱 체크
    const last = lastRequest.current;
    let shouldFetch = false;

    if (!last) {
      // 첫 요청
      shouldFetch = true;
    } else {
      const pDiff = distanceBetween(latitude, longitude, last.lat, last.lng);
      const tDiff = Date.now() - last.time;

      if (pDiff >= POSITION_THRESHOLD || tDiff >= TIME_THRESHOLD) {
        shouldFetch = true;
      }
    }

    if (shouldFetch) {
      fetchDetect(latitude, longitude, horizontalAccuracy);
    }

    // 8초 주기 타이머 (변화 없어도 갱신) — 이미 실행 중이면 중복 생성 방지
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null; // 실행 후 초기화
        if (!isMounted.current || !enabled) return;
        // stale closure 방지: geoPoseRef에서 최신 값 참조
        const gp = geoPoseRef?.current;
        if (gp && gp.horizontalAccuracy < 10) {
          fetchDetect(gp.latitude, gp.longitude, gp.horizontalAccuracy);
        }
      }, TIME_THRESHOLD);
    }

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, geoPose?.latitude, geoPose?.longitude, geoPose?.horizontalAccuracy, geoPoseRef, fetchDetect]);

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
