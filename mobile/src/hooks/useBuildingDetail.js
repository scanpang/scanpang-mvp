/**
 * useBuildingDetail - 건물 상세 조회 커스텀 훅
 * - getBuildingProfile(id) API 호출
 * - 캐싱: 같은 건물 반복 조회 방지
 * - 로딩/에러 상태 관리
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getBuildingProfile } from '../services/api';
import { DUMMY_BUILDINGS } from '../constants/dummyData';

// 모듈 레벨 캐시 (훅 인스턴스 간 공유)
const buildingCache = new Map();

// 캐시 TTL: 5분 (밀리초)
const CACHE_TTL = 5 * 60 * 1000;

/**
 * 캐시 엔트리가 유효한지 확인
 * @param {Object} entry - 캐시 엔트리 { data, timestamp }
 * @returns {boolean} 유효 여부
 */
const isCacheValid = (entry) => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
};

/**
 * @param {string|null} buildingId - 조회할 건물 ID
 * @param {Object} options
 * @param {boolean} options.enabled - 훅 활성화 여부 (기본 true)
 * @param {boolean} options.useCache - 캐시 사용 여부 (기본 true)
 * @returns {Object} { building, loading, error, refetch, clearCache }
 */
const useBuildingDetail = (buildingId, { enabled = true, useCache = true } = {}) => {
  const [building, setBuilding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 마운트 상태 추적
  const isMounted = useRef(true);
  // 현재 요청 중인 ID (중복 요청 방지)
  const currentRequestId = useRef(null);

  /**
   * API 호출 또는 캐시에서 건물 상세 조회
   */
  const fetchBuildingDetail = useCallback(async (id, forceRefresh = false) => {
    if (!id || !isMounted.current) return;

    // 캐시 확인 (강제 새로고침이 아닌 경우)
    if (useCache && !forceRefresh) {
      const cached = buildingCache.get(id);
      if (isCacheValid(cached)) {
        setBuilding(cached.data);
        setLoading(false);
        setError(null);
        return;
      }
    }

    // 같은 ID로 이미 요청 중인 경우 스킵
    if (currentRequestId.current === id && !forceRefresh) return;

    currentRequestId.current = id;
    setLoading(true);
    setError(null);

    try {
      const response = await getBuildingProfile(id);
      // API 응답: { success, data: {...} } (인터셉터가 response.data 반환)
      const profile = response?.data || response;

      if (isMounted.current && currentRequestId.current === id) {
        // 캐시에 저장
        buildingCache.set(id, {
          data: profile,
          timestamp: Date.now(),
        });

        setBuilding(profile);
        setLoading(false);
      }
    } catch (err) {
      console.warn(`[useBuildingDetail] API 실패 (${id}), 더미 데이터로 폴백:`, err.message);

      if (isMounted.current && currentRequestId.current === id) {
        // API 실패 시 더미 데이터에서 검색
        const fallback = DUMMY_BUILDINGS.find((b) => b.id === id) || null;

        if (fallback) {
          // 더미 데이터도 캐시에 저장
          buildingCache.set(id, {
            data: fallback,
            timestamp: Date.now(),
          });
        }

        setBuilding(fallback);
        setError({
          message: fallback
            ? 'API 연결 실패. 더미 데이터를 표시합니다.'
            : `건물 정보를 찾을 수 없습니다. (ID: ${id})`,
          isFallback: !!fallback,
        });
        setLoading(false);
      }
    }
  }, [useCache]);

  /**
   * buildingId 변경 시 자동 호출
   */
  useEffect(() => {
    if (!enabled || !buildingId) {
      setBuilding(null);
      setLoading(false);
      setError(null);
      return;
    }

    fetchBuildingDetail(buildingId);
  }, [buildingId, enabled, fetchBuildingDetail]);

  /**
   * 수동 리페치 (캐시 무시)
   */
  const refetch = useCallback(() => {
    if (!buildingId) return;
    fetchBuildingDetail(buildingId, true);
  }, [buildingId, fetchBuildingDetail]);

  /**
   * 특정 건물 또는 전체 캐시 클리어
   */
  const clearCache = useCallback((id = null) => {
    if (id) {
      buildingCache.delete(id);
    } else {
      buildingCache.clear();
    }
  }, []);

  /**
   * 컴포넌트 언마운트 시 정리
   */
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      currentRequestId.current = null;
    };
  }, []);

  return {
    building,
    loading,
    error,
    refetch,
    clearCache,
  };
};

export default useBuildingDetail;
