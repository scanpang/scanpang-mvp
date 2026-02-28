/**
 * useBuildingDetect - YOLO 감지 트리거 건물 식별 훅
 *
 * YOLO가 건물을 감지하면 역지오코딩 API 호출하여 건물명 확인
 * - heading 변화에 반응하지 않음 (레이스 컨디션 방지)
 * - YOLO 감지 시작 시 즉시 호출, 이후 10초 주기 재호출
 * - 50m 이동 전에는 재호출 안 함 (디바운스)
 * - 동시 호출 방지 lock
 *
 * @returns {{ buildings: Array, loading: boolean }}
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { detectBuildings } from '../services/api';

// 디바운싱 임계값
const POSITION_THRESHOLD = 50;   // 50m 이동 시 재요청
const TIME_THRESHOLD = 10000;    // 10초 주기 재요청

function distanceBetween(lat1, lng1, lat2, lng2) {
  const dlat = (lat2 - lat1) * 111320;
  const dlng = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

const useBuildingDetect = ({ geoPoseRef = null, hasYoloBuilding = false, enabled = true } = {}) => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);

  const isLoadingRef = useRef(false);
  const lastCallRef = useRef(null);   // { lat, lng, time }
  const isMountedRef = useRef(true);
  const timerRef = useRef(null);

  const fetchDetect = useCallback(async () => {
    if (isLoadingRef.current || !isMountedRef.current) return;

    const gp = geoPoseRef?.current;
    if (!gp || gp.latitude == null || gp.longitude == null) return;
    if ((gp.horizontalAccuracy ?? 999) > 30) return;

    // 디바운스: 50m 이동 또는 10초 경과
    const last = lastCallRef.current;
    if (last) {
      const dist = distanceBetween(gp.latitude, gp.longitude, last.lat, last.lng);
      const elapsed = Date.now() - last.time;
      if (dist < POSITION_THRESHOLD && elapsed < TIME_THRESHOLD) return;
    }

    isLoadingRef.current = true;
    setLoading(true);

    try {
      const response = await detectBuildings({
        lat: gp.latitude,
        lng: gp.longitude,
        heading: gp.heading ?? 0,
        horizontalAccuracy: gp.horizontalAccuracy,
      });

      if (!isMountedRef.current) return;
      setBuildings(response?.data || []);
      lastCallRef.current = { lat: gp.latitude, lng: gp.longitude, time: Date.now() };
    } catch (err) {
      if (!isMountedRef.current) return;
      console.warn('[useBuildingDetect] API 실패:', err.message);
    } finally {
      isLoadingRef.current = false;
      if (isMountedRef.current) setLoading(false);
    }
  }, [geoPoseRef]);

  useEffect(() => {
    if (!enabled || !hasYoloBuilding) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      // YOLO 감지 중단 → 다음 감지 시 즉시 호출되도록 리셋
      lastCallRef.current = null;
      return;
    }

    // YOLO 건물 감지 → 즉시 호출 + 주기적 재호출
    fetchDetect();
    timerRef.current = setInterval(fetchDetect, TIME_THRESHOLD);

    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [enabled, hasYoloBuilding, fetchDetect]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { buildings, loading };
};

export default useBuildingDetect;
