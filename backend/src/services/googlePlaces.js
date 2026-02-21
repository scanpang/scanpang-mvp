/**
 * Google Places API (New) 서비스
 * - Place Details: 평점/영업시간/리뷰 (field mask 필수)
 * - Nearby Search: 근처 장소 검색
 * - Text Search: 텍스트→placeId 매칭
 * - API 키 없으면 graceful skip (null 반환)
 * - 10분 TTL 캐시
 */
const axios = require('axios');

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = 'https://places.googleapis.com/v1';

// ===== 캐시 =====
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10분

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    cache.delete(oldest[0]);
  }
}

/**
 * Place Details — 평점/영업시간/리뷰
 * @param {string} placeId - Google Place ID
 * @param {Array<string>} fields - 요청 필드 목록
 * @returns {Object|null} 장소 상세 정보
 */
async function getPlaceDetails(placeId, fields) {
  if (!GOOGLE_PLACES_API_KEY || !placeId) return null;

  const fieldMask = (fields || [
    'displayName', 'rating', 'userRatingCount',
    'currentOpeningHours', 'reviews', 'photos',
    'formattedAddress', 'types', 'priceLevel',
  ]).join(',');

  const cacheKey = `detail_${placeId}_${fieldMask}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`${BASE_URL}/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      timeout: 5000,
    });

    const data = res.data;
    if (!data) return null;

    const result = {
      name: data.displayName?.text || '',
      rating: data.rating || null,
      userRatingCount: data.userRatingCount || 0,
      priceLevel: data.priceLevel || null,
      address: data.formattedAddress || '',
      types: data.types || [],
      openingHours: data.currentOpeningHours?.weekdayDescriptions || [],
      isOpen: data.currentOpeningHours?.openNow ?? null,
      reviews: (data.reviews || []).slice(0, 5).map(r => ({
        author: r.authorAttribution?.displayName || '',
        rating: r.rating || 0,
        text: r.text?.text || '',
        time: r.relativePublishTimeDescription || '',
      })),
      photos: (data.photos || []).slice(0, 3).map(p => ({
        name: p.name,
        widthPx: p.widthPx,
        heightPx: p.heightPx,
      })),
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[Google Places] Details 실패:', err.message);
    return null;
  }
}

/**
 * Nearby Search — 근처 장소 검색
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radius - 반경(미터)
 * @param {string} type - 장소 유형 (restaurant, cafe 등)
 * @returns {Array} 장소 목록
 */
async function searchNearby(lat, lng, radius = 300, type = 'restaurant') {
  if (!GOOGLE_PLACES_API_KEY) return [];

  const cacheKey = `nearby_${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}_${type}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.post(`${BASE_URL}/places:searchNearby`, {
      includedTypes: [type],
      maxResultCount: 10,
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: Math.min(radius, 50000),
        },
      },
    }, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.displayName,places.rating,places.userRatingCount,places.formattedAddress,places.currentOpeningHours,places.priceLevel,places.id',
      },
      timeout: 5000,
    });

    const places = (res.data?.places || []).map(p => ({
      placeId: p.id,
      name: p.displayName?.text || '',
      rating: p.rating || null,
      userRatingCount: p.userRatingCount || 0,
      address: p.formattedAddress || '',
      priceLevel: p.priceLevel || null,
      isOpen: p.currentOpeningHours?.openNow ?? null,
    }));

    setCache(cacheKey, places);
    console.log(`[Google Places] ${places.length}개 ${type} 조회`);
    return places;
  } catch (err) {
    console.warn('[Google Places] Nearby 실패:', err.message);
    return [];
  }
}

/**
 * Text Search — 텍스트→placeId 매칭
 * @param {string} textQuery - 검색 텍스트
 * @param {number} lat - 위도 (위치 바이어스)
 * @param {number} lng - 경도 (위치 바이어스)
 * @returns {Object|null} 첫 번째 매칭 결과
 */
async function findPlaceFromText(textQuery, lat, lng) {
  if (!GOOGLE_PLACES_API_KEY || !textQuery) return null;

  const cacheKey = `text_${textQuery}_${lat?.toFixed(4)}_${lng?.toFixed(4)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const body = {
      textQuery,
      maxResultCount: 1,
    };

    if (lat && lng) {
      body.locationBias = {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 500,
        },
      };
    }

    const res = await axios.post(`${BASE_URL}/places:searchText`, body, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.formattedAddress',
      },
      timeout: 5000,
    });

    const place = res.data?.places?.[0];
    if (!place) return null;

    const result = {
      placeId: place.id,
      name: place.displayName?.text || '',
      rating: place.rating || null,
      userRatingCount: place.userRatingCount || 0,
      address: place.formattedAddress || '',
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[Google Places] Text Search 실패:', err.message);
    return null;
  }
}

module.exports = {
  getPlaceDetails,
  searchNearby,
  findPlaceFromText,
};
