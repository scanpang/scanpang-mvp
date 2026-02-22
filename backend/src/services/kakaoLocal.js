/**
 * 카카오 로컬 API 서비스
 * - 카테고리 검색: 좌표 주변 건물/장소
 * - 키워드 검색: 건물 내 업소
 * - 좌표→주소 변환: 법정동코드 추출 (건축물대장용)
 * - 5분 TTL Map 캐시
 */
const axios = require('axios');

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const BASE_URL = 'https://dapi.kakao.com/v2/local';

// ===== 캐시 =====
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  // 캐시 크기 제한
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    cache.delete(oldest[0]);
  }
}

function getHeaders() {
  return { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` };
}

/**
 * 카테고리 검색 — 좌표 주변 건물/장소
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radius - 반경(미터, 최대 20000)
 * @returns {Array} 장소 목록
 */
async function searchNearbyPlaces(lat, lng, radius = 200) {
  if (!KAKAO_REST_API_KEY) {
    console.warn('[카카오] API 키 미설정, 건너뜀');
    return [];
  }

  const cacheKey = `nearby_${lat.toFixed(4)}_${lng.toFixed(4)}_${radius}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // 카테고리: BK9(은행), MT1(마트), CS2(편의점), AT4(관광), FD6(음식), CE7(카페), HP8(병원), PM9(약국)
    // 건물 자체는 카테고리가 없으므로 키워드 검색 병행
    const categories = ['BK9', 'MT1', 'FD6', 'CE7', 'HP8'];
    const results = await Promise.allSettled(
      categories.map(code =>
        axios.get(`${BASE_URL}/search/category.json`, {
          params: {
            category_group_code: code,
            x: lng, y: lat,
            radius: Math.min(radius, 20000),
            sort: 'distance',
            size: 15,
          },
          headers: getHeaders(),
          timeout: 3000,
        })
      )
    );

    const places = [];
    const seen = new Set();

    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      const documents = result.value.data?.documents || [];
      for (const doc of documents) {
        if (seen.has(doc.id)) continue;
        seen.add(doc.id);
        places.push(formatPlace(doc, lat, lng));
      }
    }

    // 거리순 정렬
    places.sort((a, b) => a.distanceMeters - b.distanceMeters);
    setCache(cacheKey, places);
    console.log(`[카카오] ${places.length}개 장소 조회 (반경 ${radius}m)`);
    return places;
  } catch (err) {
    console.warn('[카카오] 카테고리 검색 실패:', err.message);
    return [];
  }
}

/**
 * 키워드 검색 — 건물명/주소로 검색
 * @param {string} keyword - 검색어
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radius - 반경(미터)
 * @returns {Array} 장소 목록
 */
async function searchByKeyword(keyword, lat, lng, radius = 300) {
  if (!KAKAO_REST_API_KEY || !keyword) return [];

  const cacheKey = `kw_${keyword}_${lat.toFixed(4)}_${lng.toFixed(4)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`${BASE_URL}/search/keyword.json`, {
      params: {
        query: keyword,
        x: lng, y: lat,
        radius: Math.min(radius, 20000),
        sort: 'accuracy',
        size: 15,
      },
      headers: getHeaders(),
      timeout: 3000,
    });

    const places = (res.data?.documents || []).map(doc => formatPlace(doc, lat, lng));
    setCache(cacheKey, places);
    return places;
  } catch (err) {
    console.warn('[카카오] 키워드 검색 실패:', err.message);
    return [];
  }
}

/**
 * 좌표→주소 변환 (법정동코드 추출, 건축물대장용)
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @returns {Object|null} { address, roadAddress, regionCode, bCode, hCode }
 */
async function coordToAddress(lat, lng) {
  if (!KAKAO_REST_API_KEY) return null;

  const cacheKey = `addr_${lat.toFixed(5)}_${lng.toFixed(5)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`${BASE_URL}/geo/coord2regioncode.json`, {
      params: { x: lng, y: lat },
      headers: getHeaders(),
      timeout: 3000,
    });

    const documents = res.data?.documents || [];
    // region_type: 'B' = 법정동, 'H' = 행정동
    const bDoc = documents.find(d => d.region_type === 'B');
    const hDoc = documents.find(d => d.region_type === 'H');

    if (!bDoc) return null;

    // 주소 변환도 함께
    const addrRes = await axios.get(`${BASE_URL}/geo/coord2address.json`, {
      params: { x: lng, y: lat },
      headers: getHeaders(),
      timeout: 3000,
    });
    const addrDoc = addrRes.data?.documents?.[0];

    const result = {
      address: addrDoc?.address?.address_name || '',
      roadAddress: addrDoc?.road_address?.address_name || '',
      buildingName: addrDoc?.road_address?.building_name || '',  // 건물명 (역지오코딩)
      zoneNo: addrDoc?.road_address?.zone_no || '',              // 우편번호
      // 법정동코드 10자리: 시도(2) + 시군구(3) + 읍면동(3) + 리(2)
      bCode: bDoc.code || '',
      hCode: hDoc?.code || '',
      // 시군구코드 5자리 (건축물대장용)
      sigunguCd: bDoc.code ? bDoc.code.substring(0, 5) : '',
      // 법정동코드 5자리 (건축물대장용)
      bjdongCd: bDoc.code ? bDoc.code.substring(5, 10) : '',
      region1: bDoc.region_1depth_name || '',
      region2: bDoc.region_2depth_name || '',
      region3: bDoc.region_3depth_name || '',
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[카카오] 좌표→주소 변환 실패:', err.message);
    return null;
  }
}

/**
 * 동일 건물 내 장소만 필터 (주소 기반)
 * @param {Array} places - 카카오 검색 결과
 * @param {string} targetAddress - 대상 건물 도로명 주소
 * @returns {Array} 필터된 장소 목록
 */
function filterByAddress(places, targetAddress) {
  if (!targetAddress || !places.length) return places;
  // 도로명 주소에서 건물번호까지만 추출 (예: "테헤란로 152")
  const normalized = targetAddress.replace(/\s+/g, '').toLowerCase();
  return places.filter(p => {
    const addr = (p.roadAddress || p.address || '').replace(/\s+/g, '').toLowerCase();
    // 같은 도로명+건물번호면 동일 건물
    return addr.includes(normalized) || normalized.includes(addr);
  });
}

// ===== 헬퍼 =====

function formatPlace(doc, userLat, userLng) {
  const lat = parseFloat(doc.y);
  const lng = parseFloat(doc.x);
  return {
    id: `kakao_${doc.id}`,
    kakaoId: doc.id,
    name: doc.place_name || '',
    address: doc.address_name || '',
    roadAddress: doc.road_address_name || '',
    lat,
    lng,
    distanceMeters: doc.distance ? parseInt(doc.distance) : haversineDistance(userLat, userLng, lat, lng),
    distance: doc.distance ? parseInt(doc.distance) : haversineDistance(userLat, userLng, lat, lng),
    bearing: calculateBearing(userLat, userLng, lat, lng),
    category: doc.category_group_name || '',
    categoryCode: doc.category_group_code || '',
    categoryDetail: doc.category_name || '',
    phone: doc.phone || '',
    placeUrl: doc.place_url || '',
    source: 'kakao',
  };
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function calculateBearing(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

/**
 * 건물 이미지 검색 (카카오 이미지 검색 API)
 * 네이버 이미지 검색 API 지원 종료로 카카오로 대체
 * @param {string} buildingName - 건물명
 * @returns {string|null} 첫 번째 이미지 썸네일 URL
 */
async function searchBuildingImage(buildingName) {
  if (!KAKAO_REST_API_KEY || !buildingName) return null;

  const cacheKey = `img_${buildingName}`;
  const cached = getCached(cacheKey);
  if (cached !== null) return cached;

  try {
    const res = await axios.get('https://dapi.kakao.com/v2/search/image', {
      params: {
        query: `${buildingName} 건물`,
        size: 1,
        sort: 'accuracy',
      },
      headers: getHeaders(),
      timeout: 3000,
    });

    const item = res.data?.documents?.[0];
    const thumbnail = item?.thumbnail_url || item?.image_url || null;
    setCache(cacheKey, thumbnail);
    return thumbnail;
  } catch (err) {
    console.warn('[카카오] 이미지 검색 실패:', err.message);
    return null;
  }
}

/**
 * 전방 좌표 계산 (현재 위치 + 방위각 + 거리 → 전방 좌표)
 * @param {number} lat - 현재 위도
 * @param {number} lng - 현재 경도
 * @param {number} heading - 방위각 (0~360)
 * @param {number} distanceMeters - 전방 거리 (미터)
 * @returns {{ lat: number, lng: number }}
 */
function calculateForwardCoord(lat, lng, heading, distanceMeters) {
  const headingRad = heading * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  return {
    lat: lat + (distanceMeters * Math.cos(headingRad)) / 111320,
    lng: lng + (distanceMeters * Math.sin(headingRad)) / (111320 * Math.cos(latRad)),
  };
}

module.exports = {
  searchNearbyPlaces,
  searchByKeyword,
  coordToAddress,
  filterByAddress,
  searchBuildingImage,
  calculateForwardCoord,
  haversineDistance,
  calculateBearing,
};
