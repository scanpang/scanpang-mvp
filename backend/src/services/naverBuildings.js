/**
 * Naver Local Search API 건물 보강 서비스
 * - OSM 건물명이 부정확할 때 Naver 검색으로 한국어 이름 보강
 * - 사용자 좌표 → 동 이름 변환 (간단 그리드 매핑)
 * - KATEC 좌표 → WGS84 변환
 * - 5분 TTL 캐시
 */
const axios = require('axios');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const NAVER_SEARCH_URL = 'https://openapi.naver.com/v1/search/local.json';

// ===== 캐시 =====
const searchCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 좌표 → 대략적인 동 이름 매핑 (강남/서초/역삼 중심)
 * 정밀 역지오코딩 대신 간단 그리드 사용
 */
function getDongName(lat, lng) {
  const grid = [
    { name: '역삼동', latMin: 37.495, latMax: 37.505, lngMin: 127.030, lngMax: 127.045 },
    { name: '삼성동', latMin: 37.505, latMax: 37.515, lngMin: 127.055, lngMax: 127.070 },
    { name: '대치동', latMin: 37.490, latMax: 37.500, lngMin: 127.055, lngMax: 127.070 },
    { name: '논현동', latMin: 37.505, latMax: 37.515, lngMin: 127.025, lngMax: 127.040 },
    { name: '서초동', latMin: 37.483, latMax: 37.495, lngMin: 127.005, lngMax: 127.020 },
    { name: '방배동', latMin: 37.475, latMax: 37.485, lngMin: 126.990, lngMax: 127.010 },
    { name: '잠실동', latMin: 37.505, latMax: 37.520, lngMin: 127.075, lngMax: 127.095 },
    { name: '신사동', latMin: 37.515, latMax: 37.525, lngMin: 127.020, lngMax: 127.035 },
    { name: '청담동', latMin: 37.520, latMax: 37.530, lngMin: 127.045, lngMax: 127.060 },
    { name: '압구정동', latMin: 37.525, latMax: 37.535, lngMin: 127.025, lngMax: 127.040 },
    { name: '도곡동', latMin: 37.485, latMax: 37.495, lngMin: 127.045, lngMax: 127.060 },
    { name: '개포동', latMin: 37.475, latMax: 37.490, lngMin: 127.050, lngMax: 127.070 },
  ];

  for (const d of grid) {
    if (lat >= d.latMin && lat <= d.latMax && lng >= d.lngMin && lng <= d.lngMax) {
      return d.name;
    }
  }
  return null;
}

/**
 * KATEC 좌표 → WGS84 변환 (근사 공식)
 * Naver Local Search API는 KATEC 좌표를 반환함
 */
function katecToWgs84(x, y) {
  // 근사 변환 (서울 지역 기준, 오차 ~50m 이내)
  const lng = (x / 2.5148) + 122.1432;
  const lat = (y / 3.0875) + 23.8596;
  return { lat, lng };
}

/**
 * Haversine 거리 계산 (미터)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Naver Local Search로 주변 건물 검색
 * @param {number} lat - 사용자 위도
 * @param {number} lng - 사용자 경도
 * @param {number} radius - 검색 반경 (미터, 결과 필터링용)
 * @returns {Array} Naver 검색 결과 건물 목록
 */
async function searchNearbyBuildings(lat, lng, radius = 200) {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('[Naver] API 키 미설정, 건너뜀');
    return [];
  }

  const cacheKey = `${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const dongName = getDongName(lat, lng);
  if (!dongName) {
    return [];
  }

  // 여러 검색어로 병렬 검색
  const queries = [
    `${dongName} 빌딩`,
    `${dongName} 오피스`,
    `${dongName} 타워`,
  ];

  try {
    const results = await Promise.all(
      queries.map(query =>
        axios.get(NAVER_SEARCH_URL, {
          params: { query, display: 5 },
          headers: {
            'X-Naver-Client-Id': NAVER_CLIENT_ID,
            'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
          },
          timeout: 3000,
        }).catch(() => ({ data: { items: [] } }))
      )
    );

    // 결과 병합 + 중복 제거
    const seen = new Set();
    const buildings = [];

    for (const res of results) {
      const items = res.data?.items || [];
      for (const item of items) {
        if (seen.has(item.title)) continue;
        seen.add(item.title);

        // KATEC → WGS84
        const coords = katecToWgs84(parseInt(item.mapx), parseInt(item.mapy));
        const distance = haversineDistance(lat, lng, coords.lat, coords.lng);

        // 반경 필터
        if (distance > radius * 1.5) continue;

        // HTML 태그 제거
        const cleanTitle = item.title.replace(/<[^>]*>/g, '');
        const cleanAddress = (item.roadAddress || item.address || '').replace(/<[^>]*>/g, '');

        buildings.push({
          name: cleanTitle,
          address: cleanAddress,
          lat: coords.lat,
          lng: coords.lng,
          distance: Math.round(distance),
          category: item.category || '',
          source: 'naver',
        });
      }
    }

    // 거리순 정렬
    buildings.sort((a, b) => a.distance - b.distance);

    searchCache.set(cacheKey, { data: buildings, timestamp: Date.now() });

    // 캐시 크기 제한
    if (searchCache.size > 50) {
      const oldest = [...searchCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      searchCache.delete(oldest[0]);
    }

    console.log(`[Naver] ${buildings.length}개 건물 검색 (${dongName})`);
    return buildings;
  } catch (err) {
    console.warn('[Naver] 검색 실패:', err.message);
    return [];
  }
}

/**
 * OSM 건물 이름을 Naver 결과로 보강
 * - OSM 건물 좌표와 50m 이내 Naver 결과가 있으면 이름 교체
 * @param {Array} osmBuildings - OSM 건물 목록
 * @param {Array} naverBuildings - Naver 검색 결과
 * @returns {Array} 이름 보강된 건물 목록
 */
function enrichWithNaver(osmBuildings, naverBuildings) {
  if (!naverBuildings.length) return osmBuildings;

  return osmBuildings.map(osm => {
    // 50m 이내에서 가장 가까운 Naver 결과 찾기
    let bestMatch = null;
    let bestDist = Infinity;

    for (const naver of naverBuildings) {
      const dist = haversineDistance(osm.lat, osm.lng, naver.lat, naver.lng);
      if (dist < 50 && dist < bestDist) {
        bestDist = dist;
        bestMatch = naver;
      }
    }

    if (bestMatch) {
      return {
        ...osm,
        name: bestMatch.name,
        address: bestMatch.address || osm.address,
        naverEnriched: true,
      };
    }

    return osm;
  });
}

module.exports = {
  searchNearbyBuildings,
  enrichWithNaver,
  getDongName,
};
