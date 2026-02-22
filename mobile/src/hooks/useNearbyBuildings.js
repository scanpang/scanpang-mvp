/**
 * useNearbyBuildings - 주변 건물 조회 커스텀 훅 (v2 — 더미 의존 제거)
 * - 위치/heading 변경 시 자동 API 호출
 * - 200ms 디바운싱
 * - 폴백: AsyncStorage 캐시만, 더미 없음
 * - kakao_ prefix ID 인식
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNearbyBuildings } from '../services/api';

const BUILDINGS_CACHE_KEY = '@scanpang_nearby_cache';

// 아파트/주거 타입 제외 필터
const EXCLUDED_TYPES = ['아파트', '주거', 'apartment', 'residential'];
const filterOutApartments = (buildings) =>
  buildings.filter((b) => {
    const type = (b.buildingUse || b.building_use || b.category || b.buildingType || '').toLowerCase();
    return !EXCLUDED_TYPES.some((t) => type.includes(t));
  });

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
  source = 'auto',
  enabled = true,
} = {}) => {
  const [buildings, setBuildings] = useState([]);
  const [loading, setLoading] = useState(true); // 초기 로딩 상태
  const [error, setError] = useState(null);

  const debounceTimer = useRef(null);
  const lastParams = useRef(null);
  const isMounted = useRef(true);
  const retryDoneRef = useRef(false);
  const cacheLoadedRef = useRef(false);

  // 마운트 즉시 캐시 로드 → API 응답 전에도 감지 가능
  useEffect(() => {
    if (cacheLoadedRef.current) return;
    cacheLoadedRef.current = true;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(BUILDINGS_CACHE_KEY);
        if (cached && isMounted.current) {
          const parsed = JSON.parse(cached);
          if (parsed.length > 0) {
            setBuildings(prev => prev.length === 0 ? parsed : prev);
          }
        }
      } catch {}
    })();
  }, []);

  /**
   * API 호출 실행 함수
   */
  const fetchBuildings = useCallback(async (lat, lng, hd, rad, src) => {
    if (!isMounted.current) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getNearbyBuildings(lat, lng, rad, hd, src);
      if (isMounted.current) {
        const rawBuildings = Array.isArray(response) ? response
          : response?.data ? (Array.isArray(response.data) ? response.data : [])
          : [];
        // API 필드명 정규화
        const normalized = rawBuildings.map((b) => ({
          ...b,
          distance: b.distance ?? b.distanceMeters ?? null,
        }));
        const filtered = filterOutApartments(normalized);
        setBuildings(filtered);
        setLoading(false);
        // 성공 시 캐시 저장
        try {
          await AsyncStorage.setItem(BUILDINGS_CACHE_KEY, JSON.stringify(filtered.slice(0, 30)));
        } catch {}
      }
    } catch (err) {
      console.warn('[useNearbyBuildings] API 실패, 캐시 데이터로 폴백:', err.message);

      if (isMounted.current) {
        // 캐시된 데이터 사용 (더미 데이터 폴백 제거)
        let fallback = [];
        try {
          const cached = await AsyncStorage.getItem(BUILDINGS_CACHE_KEY);
          if (cached) {
            fallback = JSON.parse(cached);
          }
        } catch {}

        setBuildings(fallback);
        setError({
          message: fallback.length > 0
            ? 'API 연결 실패. 캐시 데이터를 표시합니다.'
            : 'API 연결 실패. 건물 데이터를 불러올 수 없습니다.',
          isFallback: true,
        });
        setLoading(false);

        // 3초 후 자동 재시도 1회
        if (!retryDoneRef.current) {
          retryDoneRef.current = true;
          setTimeout(() => {
            if (isMounted.current) {
              lastParams.current = null;
              fetchBuildings(lat, lng, hd, rad, src);
            }
          }, 3000);
        }
      }
    }
  }, []);

  /**
   * 디바운싱된 fetch 함수
   */
  const debouncedFetch = useCallback((lat, lng, hd, rad, src) => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const paramsKey = `${lat?.toFixed(5)}_${lng?.toFixed(5)}_${Math.round(hd)}_${rad}_${src}`;
    if (lastParams.current === paramsKey) return;

    debounceTimer.current = setTimeout(() => {
      lastParams.current = paramsKey;
      fetchBuildings(lat, lng, hd, rad, src);
    }, 200);
  }, [fetchBuildings]);

  /**
   * 위치/heading 변경 시 자동 호출
   */
  useEffect(() => {
    if (!enabled || latitude === null || longitude === null) return;
    debouncedFetch(latitude, longitude, heading, radius, source);
  }, [latitude, longitude, heading, radius, source, enabled, debouncedFetch]);

  /**
   * 수동 리페치 함수
   */
  const refetch = useCallback(() => {
    if (latitude === null || longitude === null) return;
    lastParams.current = null;
    fetchBuildings(latitude, longitude, heading, radius, source);
  }, [latitude, longitude, heading, radius, source, fetchBuildings]);

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
