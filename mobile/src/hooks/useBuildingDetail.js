/**
 * useBuildingDetail - 건물 상세 조회 커스텀 훅 (v3 — 프로그레시브 로딩 + 더미 폴백)
 * - 3단계 상태: loading → enriching → 완료
 * - 1차: getBuildingProfile → 빈 필드에 폴백 채움 → 즉시 UI 갱신
 * - 2차: enrichProfile (meta.enrichAvailable → 자동 트리거)
 * - Lazy: fetchLazyTab (탭 전환 시 호출)
 * - safeMerge: 실제 데이터가 더미로 덮어써지지 않도록 보호
 * - _dummyFields: 어떤 필드가 더미인지 추적 (UI 색상 구분용)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getBuildingProfile, getBuildingEnrich, getBuildingLazy } from '../services/api';
import { generateFallbackData } from '../constants/dummyData';

// 모듈 레벨 캐시 (훅 인스턴스 간 공유)
const buildingCache = new Map();

// 캐시 TTL: 5분
const CACHE_TTL = 5 * 60 * 1000;

const isCacheValid = (entry) => {
  if (!entry) return false;
  return Date.now() - entry.timestamp < CACHE_TTL;
};

/**
 * _dummyFields 배열에서 특정 필드 제거
 */
function removeDummyField(dummyFields, field) {
  const idx = dummyFields.indexOf(field);
  if (idx !== -1) dummyFields.splice(idx, 1);
}

/**
 * 빈 필드에 building_use 기반 폴백 데이터 채우기
 * - 이미 값이 있는 필드는 건드리지 않음
 * - _dummyFields로 어떤 필드가 더미인지 추적
 */
function fillFallbackData(profile) {
  if (!profile) return profile;

  const buildingUse = profile.building?.type || '';
  const buildingName = profile.building?.name || '건물';
  const fallback = generateFallbackData(buildingUse, buildingName);
  const dummyFields = [];
  const filled = { ...profile };

  // 편의시설
  if (!filled.amenities || filled.amenities.length === 0) {
    filled.amenities = fallback.amenities;
    dummyFields.push('amenities');
  }

  // 스탯
  if (!filled.stats?.raw?.length) {
    filled.stats = fallback.stats;
    dummyFields.push('stats');
  }

  // 층별
  if (!filled.floors?.length) {
    filled.floors = fallback.floors;
    dummyFields.push('floors');
  }

  // 맛집
  if (!filled.restaurants?.length) {
    filled.restaurants = fallback.restaurants;
    dummyFields.push('restaurants');
  }

  // 부동산
  if (!filled.realEstate?.length) {
    filled.realEstate = fallback.realEstate;
    dummyFields.push('realEstate');
  }

  // 관광
  if (!filled.tourism) {
    filled.tourism = fallback.tourism;
    dummyFields.push('tourism');
  }

  filled._dummyFields = dummyFields;

  // meta: 탭 표시를 위해 has* 플래그 업데이트
  filled.meta = {
    ...filled.meta,
    hasFloors: (filled.floors?.length || 0) > 0,
    hasRestaurants: (filled.restaurants?.length || 0) > 0,
    hasRealEstate: (filled.realEstate?.length || 0) > 0,
    hasTourism: !!filled.tourism,
  };

  return filled;
}

/**
 * @param {string|null} buildingId - 조회할 건물 ID
 * @param {Object} options
 * @param {boolean} options.enabled - 훅 활성화 여부
 * @param {boolean} options.useCache - 캐시 사용 여부
 * @param {Object} options.buildingMeta - 건물 기본 정보 (nearby에서 전달, profile 호출 시 쿼리 파라미터용)
 * @returns {Object} { building, loading, enriching, error, refetch, clearCache, fetchLazyTab }
 */
const useBuildingDetail = (buildingId, { enabled = true, useCache = true, buildingMeta = null } = {}) => {
  const [building, setBuilding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [error, setError] = useState(null);

  const isMounted = useRef(true);
  const currentRequestId = useRef(null);
  // enrich 호출 여부 추적 (중복 방지)
  const enrichCalledRef = useRef(new Set());

  /**
   * 1차: 빠른 프로필 조회 + 폴백 채우기 + 자동 2차 보강
   */
  const fetchBuildingDetail = useCallback(async (id, forceRefresh = false) => {
    if (!id || !isMounted.current) return;

    // 캐시 확인
    if (useCache && !forceRefresh) {
      const cached = buildingCache.get(id);
      if (isCacheValid(cached)) {
        setBuilding(cached.data);
        setLoading(false);
        setError(null);
        return;
      }
    }

    if (currentRequestId.current === id && !forceRefresh) return;
    currentRequestId.current = id;
    setLoading(true);
    setError(null);

    try {
      // 쿼리 파라미터 구성 (카카오 건물용)
      const params = {};
      if (buildingMeta) {
        if (buildingMeta.lat) params.lat = buildingMeta.lat;
        if (buildingMeta.lng) params.lng = buildingMeta.lng;
        if (buildingMeta.name) params.name = buildingMeta.name;
        if (buildingMeta.address) params.address = buildingMeta.address;
        if (buildingMeta.category) params.category = buildingMeta.category;
        if (buildingMeta.categoryDetail) params.categoryDetail = buildingMeta.categoryDetail;
      }

      const response = await getBuildingProfile(id, params);
      const profile = response?.data || response;

      if (isMounted.current && currentRequestId.current === id && profile) {
        // 빈 필드에 폴백 데이터 채우기
        const filledProfile = fillFallbackData(profile);

        buildingCache.set(id, { data: filledProfile, timestamp: Date.now() });
        setBuilding(filledProfile);
        setLoading(false);

        // 2차 자동 보강 트리거
        if (filledProfile.meta?.enrichAvailable && !enrichCalledRef.current.has(id)) {
          enrichCalledRef.current.add(id);
          enrichProfile(id, filledProfile);
        }
      }
    } catch (err) {
      console.warn(`[useBuildingDetail] API 실패 (${id}):`, err.message);
      if (isMounted.current) {
        setError(err.message || '데이터를 불러올 수 없습니다');
        setLoading(false);
      }
    }
  }, [useCache, buildingMeta]);

  /**
   * 2차: 건축물대장 + 네이버블로그 보강
   */
  const enrichProfile = useCallback(async (id, currentProfile) => {
    if (!id || !isMounted.current) return;
    setEnriching(true);

    try {
      const params = {};
      const meta = currentProfile?.meta;
      const bldg = currentProfile?.building;

      // 건축물대장 파라미터
      if (meta?.regionCode) {
        const rc = meta.regionCode;
        params.sigunguCd = rc.sigunguCd || '';
        params.bjdongCd = rc.bjdongCd || '';
        // 주소에서 번지 추출
        const addr = rc.address || bldg?.address || '';
        const bunjiMatch = addr.match(/(\d+)(?:-(\d+))?$/);
        if (bunjiMatch) {
          params.bun = bunjiMatch[1].padStart(4, '0');
          params.ji = bunjiMatch[2] ? bunjiMatch[2].padStart(4, '0') : '0000';
        }
      }
      params.name = bldg?.name || '';
      params.address = bldg?.address || '';
      params.lat = bldg?.lat || '';
      params.lng = bldg?.lng || '';

      const response = await getBuildingEnrich(id, params);
      const enrichData = response?.data || response;

      if (isMounted.current && enrichData) {
        setBuilding(prev => {
          const merged = mergeEnrichData(prev, enrichData);
          // 캐시 업데이트
          const cached = buildingCache.get(id);
          if (cached) cached.data = merged;
          return merged;
        });
      }
    } catch (err) {
      console.warn(`[useBuildingDetail] enrich 실패 (${id}):`, err.message);
      // enrich 실패해도 1차 데이터 + 폴백 유지
    } finally {
      if (isMounted.current) setEnriching(false);
    }
  }, []);

  /**
   * Lazy 탭 데이터 로드 (탭 전환 시 호출)
   * @param {string} tab - 'food' | 'estate' | 'tourism'
   */
  const fetchLazyTab = useCallback(async (tab) => {
    if (!buildingId || !isMounted.current) return;

    const bldg = building?.building;
    const params = {
      tab,
      lat: bldg?.lat || buildingMeta?.lat || '',
      lng: bldg?.lng || buildingMeta?.lng || '',
      name: bldg?.name || buildingMeta?.name || '',
    };

    // 실거래가용 시군구코드
    if (tab === 'estate' && building?.meta?.regionCode?.sigunguCd) {
      params.sigunguCd = building.meta.regionCode.sigunguCd;
    }

    try {
      const response = await getBuildingLazy(buildingId, params);
      const lazyData = response?.data || response;

      if (isMounted.current && lazyData) {
        setBuilding(prev => {
          const merged = mergeLazyData(prev, lazyData, tab);
          // 캐시 업데이트
          const cached = buildingCache.get(buildingId);
          if (cached) cached.data = merged;
          return merged;
        });
      }
    } catch (err) {
      console.warn(`[useBuildingDetail] lazy 실패 (${tab}):`, err.message);
    }
  }, [buildingId, building, buildingMeta]);

  /**
   * buildingId 변경 시 자동 호출
   */
  useEffect(() => {
    if (!enabled || !buildingId) {
      setBuilding(null);
      setLoading(false);
      setEnriching(false);
      setError(null);
      return;
    }
    fetchBuildingDetail(buildingId);
  }, [buildingId, enabled, fetchBuildingDetail]);

  /**
   * 수동 리페치
   */
  const refetch = useCallback(() => {
    if (!buildingId) return;
    enrichCalledRef.current.delete(buildingId);
    fetchBuildingDetail(buildingId, true);
  }, [buildingId, fetchBuildingDetail]);

  /**
   * 캐시 클리어
   */
  const clearCache = useCallback((id = null) => {
    if (id) {
      buildingCache.delete(id);
      enrichCalledRef.current.delete(id);
    } else {
      buildingCache.clear();
      enrichCalledRef.current.clear();
    }
  }, []);

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
    enriching,
    error,
    refetch,
    clearCache,
    fetchLazyTab,
  };
};

/**
 * enrich 데이터를 기존 프로필에 병합 (safeMerge 적용)
 * - 실제 데이터가 도착하면 더미 교체 + _dummyFields에서 제거
 * - null/빈 응답은 기존 데이터 덮어쓰지 않음
 */
function mergeEnrichData(prev, enrichData) {
  if (!prev) return prev;
  const merged = { ...prev };
  const dummyFields = [...(prev._dummyFields || [])];

  // 건축물대장 기본 정보
  if (enrichData.buildingInfo) {
    merged.building = {
      ...merged.building,
      total_floors: enrichData.buildingInfo.total_floors || merged.building.total_floors,
      basement_floors: enrichData.buildingInfo.basement_floors || merged.building.basement_floors,
      built_year: enrichData.buildingInfo.built_year || merged.building.built_year,
      type: enrichData.buildingInfo.type || merged.building.type,
      parking_count: enrichData.buildingInfo.parking_count || merged.building.parking_count,
    };
  }

  // 스탯 (실제 데이터가 있으면 더미 교체)
  if (enrichData.stats?.raw?.length > 0) {
    merged.stats = enrichData.stats;
    removeDummyField(dummyFields, 'stats');
  }

  // 층별 (실제 데이터가 있으면 더미 교체)
  if (enrichData.floors?.length > 0) {
    merged.floors = enrichData.floors;
    removeDummyField(dummyFields, 'floors');
    merged.meta = { ...merged.meta, hasFloors: true };
  }

  // 블로그 리뷰
  if (enrichData.blogReviews?.length > 0) {
    merged.blogReviews = enrichData.blogReviews;
    merged.reviewSummary = enrichData.reviewSummary;
  }

  // 썸네일
  if (enrichData.thumbnail_url) {
    merged.building = { ...merged.building, thumbnail_url: enrichData.thumbnail_url };
  }

  merged._dummyFields = dummyFields;
  // enrichAvailable 해제 (다시 호출 방지)
  merged.meta = { ...merged.meta, enrichAvailable: false, enriched: true };

  return merged;
}

/**
 * lazy 탭 데이터를 기존 프로필에 병합 (safeMerge 적용)
 * - 더미였던 필드: 실제 데이터로 완전 교체
 * - 실제였던 필드: 기존 데이터에 추가 병합
 */
function mergeLazyData(prev, lazyData, tab) {
  if (!prev) return prev;
  const merged = { ...prev };
  const dummyFields = [...(prev._dummyFields || [])];

  if (tab === 'food' && lazyData.restaurants?.length > 0) {
    // 더미였으면 완전 교체, 실제 데이터였으면 병합
    if (dummyFields.includes('restaurants')) {
      merged.restaurants = lazyData.restaurants;
      removeDummyField(dummyFields, 'restaurants');
    } else {
      const existing = merged.restaurants || [];
      const existingNames = new Set(existing.map(r => r.name));
      const newPlaces = lazyData.restaurants.filter(r => !existingNames.has(r.name));
      merged.restaurants = [...existing, ...newPlaces];
    }
    merged.meta = { ...merged.meta, hasRestaurants: true };
  }

  if (tab === 'estate' && lazyData.realEstate?.length > 0) {
    if (dummyFields.includes('realEstate')) {
      merged.realEstate = lazyData.realEstate;
      removeDummyField(dummyFields, 'realEstate');
    } else {
      merged.realEstate = [...(merged.realEstate || []), ...lazyData.realEstate];
    }
    merged.meta = { ...merged.meta, hasRealEstate: true };
  }

  if (tab === 'tourism' && lazyData.tourism) {
    merged.tourism = lazyData.tourism;
    removeDummyField(dummyFields, 'tourism');
    merged.meta = { ...merged.meta, hasTourism: true };
  }

  merged._dummyFields = dummyFields;
  return merged;
}

export default useBuildingDetail;
