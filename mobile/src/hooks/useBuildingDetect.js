/**
 * useBuildingDetect - VPS + OSM 건물 감지 전용 훅
 * - VPS 필수: geoPose 없거나 horizontalAccuracy >= 10 → inactive
 * - 디바운싱: heading 10° 변화, 위치 5m 변화, 또는 5초 경과 시 재요청
 * - 출력: { buildings, loading, status }
 *   status: 'inactive' | 'detecting' | 'ready'
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { detectBuildings } from '../services/api';

// 디바운싱 임계값
const HEADING_THRESHOLD = 10;    // heading 10° 변화 시 재요청
const POSITION_THRESHOLD = 5;    // 5m 이동 시 재요청
const TIME_THRESHOLD = 5000;     // 5초 경과 시 재요청

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
 * @param {number} params.fov - 포커스 각도
 * @param {boolean} params.enabled - 훅 활성화 여부
 * @returns {{ buildings: Array, loading: boolean, status: string }}
 */
const useBuildingDetect = ({ geoPose = null, fov = 30, enabled = true } = {}) => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('inactive');

  const isMounted = useRef(true);
  const requestId = useRef(0);
  const lastRequest = useRef(null);    // { lat, lng, heading, time }
  const timerRef = useRef(null);

  const fetchDetect = useCallback(async (lat, lng, heading, horizontalAccuracy, currentFov) => {
    if (!isMounted.current) return;

    const myId = ++requestId.current;
    setLoading(true);
    setStatus('detecting');

    try {
      const response = await detectBuildings({
        lat, lng, heading,
        horizontalAccuracy,
        fov: currentFov,
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
      lastRequest.current = { lat, lng, heading, time: Date.now() };
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

    const { latitude, longitude, heading, horizontalAccuracy } = geoPose;
    if (latitude == null || longitude == null || heading == null) return;

    // 디바운싱 체크
    const last = lastRequest.current;
    let shouldFetch = false;

    if (!last) {
      // 첫 요청
      shouldFetch = true;
    } else {
      const hDiff = headingDiff(heading, last.heading);
      const pDiff = distanceBetween(latitude, longitude, last.lat, last.lng);
      const tDiff = Date.now() - last.time;

      if (hDiff >= HEADING_THRESHOLD || pDiff >= POSITION_THRESHOLD || tDiff >= TIME_THRESHOLD) {
        shouldFetch = true;
      }
    }

    if (shouldFetch) {
      fetchDetect(latitude, longitude, heading, horizontalAccuracy, fov);
    }

    // 5초 주기 타이머 (변화 없어도 갱신)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isMounted.current || !enabled) return;
      const gp = geoPose; // 클로저 캡처
      if (gp && gp.horizontalAccuracy < 10) {
        fetchDetect(gp.latitude, gp.longitude, gp.heading, gp.horizontalAccuracy, fov);
      }
    }, TIME_THRESHOLD);

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, geoPose?.latitude, geoPose?.longitude, geoPose?.heading, geoPose?.horizontalAccuracy, fov, fetchDetect]);

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
