/**
 * useNearbyBuildings - 주변 건물 조회 커스텀 훅
 * - 위치/heading 변경 시 자동 API 호출
 * - 500ms 디바운싱
 * - 로딩/에러 상태 관리
 * - API 실패 시 더미 데이터 폴백
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getNearbyBuildings } from '../services/api';
import { DUMMY_BUILDINGS } from '../constants/dummyData';

/**
 * @param {Object} params
 * @param {number|null} params.latitude - 현재 위도
 * @param {number|null} params.longitude - 현재 경도
 * @param {number} params.heading - 사용자가 바라보는 방향 (0~360)
 * @param {number} params.radius - 검색 반경 (미터, 기본 500m)
 * @param {boolean} params.enabled - 훅 활성화 여부 (기본 true)
 * @returns {Object} { buildings, loading, error, refetch }
 */
const useNearbyBuildings = ({
  latitude = null,
  longitude = null,
  heading = 0,
  radius = 500,
  enabled = true,
} = {}) => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 디바운싱 타이머 ref
  const debounceTimer = useRef(null);
  // 마지막 요청 파라미터 (불필요한 중복 요청 방지)
  const lastParams = useRef(null);
  // 마운트 상태 추적
  const isMounted = useRef(true);

  /**
   * API 호출 실행 함수
   */
  const fetchBuildings = useCallback(async (lat, lng, hd, rad) => {
    // 마운트 상태 확인
    if (!isMounted.current) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getNearbyBuildings(lat, lng, rad, hd);
      if (isMounted.current) {
        // API 응답: { success, data: [...], meta } (인터셉터가 response.data 반환)
        const rawBuildings = Array.isArray(response) ? response
          : response?.data ? (Array.isArray(response.data) ? response.data : [])
          : [];
        // API 필드명 정규화 (distanceMeters → distance)
        const buildings = rawBuildings.map((b) => ({
          ...b,
          distance: b.distance ?? b.distanceMeters ?? null,
        }));
        setBuildings(buildings);
        setLoading(false);
      }
    } catch (err) {
      console.warn('[useNearbyBuildings] API 실패, 더미 데이터로 폴백:', err.message);

      if (isMounted.current) {
        // API 실패 시 더미 데이터로 폴백
        // 거리순 정렬하여 radius 이내의 건물만 필터링
        const fallback = DUMMY_BUILDINGS
          .filter((b) => b.distance <= rad)
          .sort((a, b) => a.distance - b.distance);

        setBuildings(fallback);
        setError({
          message: 'API 연결 실패. 더미 데이터를 표시합니다.',
          isFallback: true,
        });
        setLoading(false);
      }
    }
  }, []);

  /**
   * 디바운싱된 fetch 함수
   */
  const debouncedFetch = useCallback((lat, lng, hd, rad) => {
    // 기존 타이머 취소
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 파라미터 변경 여부 확인
    const paramsKey = `${lat?.toFixed(5)}_${lng?.toFixed(5)}_${Math.round(hd)}_${rad}`;
    if (lastParams.current === paramsKey) return;

    // 500ms 디바운싱
    debounceTimer.current = setTimeout(() => {
      lastParams.current = paramsKey;
      fetchBuildings(lat, lng, hd, rad);
    }, 500);
  }, [fetchBuildings]);

  /**
   * 위치/heading 변경 시 자동 호출
   */
  useEffect(() => {
    if (!enabled || latitude === null || longitude === null) return;

    debouncedFetch(latitude, longitude, heading, radius);
  }, [latitude, longitude, heading, radius, enabled, debouncedFetch]);

  /**
   * 수동 리페치 함수
   */
  const refetch = useCallback(() => {
    if (latitude === null || longitude === null) return;

    // 디바운싱 무시하고 즉시 호출
    lastParams.current = null;
    fetchBuildings(latitude, longitude, heading, radius);
  }, [latitude, longitude, heading, radius, fetchBuildings]);

  /**
   * 컴포넌트 언마운트 시 정리
   */
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return {
    buildings,
    loading,
    error,
    refetch,
  };
};

export default useNearbyBuildings;
