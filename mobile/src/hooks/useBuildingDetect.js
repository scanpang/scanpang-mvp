/**
 * useBuildingDetect - 수동 건물 식별 훅
 *
 * 사용자가 탭할 때만 API 호출하여 건물명 확인
 * - 자동 호출 없음 (디바운스/타이머 제거)
 * - fetchDetect(params)로 수동 호출
 *
 * @returns {{ buildings: Array, loading: boolean, fetchDetect: Function }}
 */
import { useState, useRef, useCallback } from 'react';
import { detectBuildings } from '../services/api';

const useBuildingDetect = () => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const isLoadingRef = useRef(false);

  const fetchDetect = useCallback(async ({ lat, lng, heading, horizontalAccuracy }) => {
    if (isLoadingRef.current) return null;
    isLoadingRef.current = true;
    setLoading(true);

    try {
      const response = await detectBuildings({ lat, lng, heading, horizontalAccuracy });
      const data = response?.data || [];
      setBuildings(data);
      return data;
    } catch (err) {
      console.warn('[useBuildingDetect] API 실패:', err.message);
      return null;
    } finally {
      isLoadingRef.current = false;
      setLoading(false);
    }
  }, []);

  return { buildings, loading, fetchDetect };
};

export default useBuildingDetect;
