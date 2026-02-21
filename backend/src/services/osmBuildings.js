/**
 * OSM(OpenStreetMap) 건물 조회 서비스
 * - Overpass API로 주변 모든 건물 실시간 조회
 * - 5분 TTL 캐시
 * - DB에 없는 건물도 AR 라벨로 표시 가능
 */
const axios = require('axios');

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

// ===== 캐시 =====
const nearbyCache = new Map();       // 위치별 건물 목록 캐시
const buildingDataCache = new Map();  // 개별 건물 데이터 캐시 (프로필 조회용)
const CACHE_TTL = 5 * 60 * 1000;     // 5분

function getCacheKey(lat, lng, radius) {
  return `${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;
}

/**
 * Overpass API로 주변 건물 조회
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radius - 반경 (미터)
 * @returns {Array} 건물 목록
 */
async function fetchNearbyFromOSM(lat, lng, radius = 500) {
  const cacheKey = getCacheKey(lat, lng, radius);
  const cached = nearbyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // Overpass QL: 이름 있는 건물 + 주소 있는 건물 + 아파트 단지 relation 조회
  const query = `
    [out:json][timeout:8];
    (
      way["building"]["name"](around:${radius},${lat},${lng});
      way["building"]["addr:street"](around:${radius},${lat},${lng});
      relation["building"="apartments"](around:${radius},${lat},${lng});
      relation["landuse"="residential"]["name"](around:${radius},${lat},${lng});
    );
    out center tags;
  `;

  try {
    const response = await axios.post(
      OVERPASS_URL,
      `data=${encodeURIComponent(query)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 6000,
      }
    );

    const elements = response.data?.elements || [];

    // 1단계: relation(아파트 단지) 이름 수집
    const complexNames = [];
    elements.forEach(el => {
      if (el.type === 'relation' && el.tags?.name) {
        const eLat = el.center?.lat || el.lat;
        const eLng = el.center?.lon || el.lon;
        if (eLat && eLng) {
          complexNames.push({
            name: el.tags['name:ko'] || el.tags.name,
            lat: eLat, lng: eLng,
          });
        }
      }
    });

    // 2단계: "X동" 패턴 이름에 단지명 보강
    const DONG_PATTERN = /^[A-Za-z0-9가-힣]{1,3}동$/;
    function enrichName(rawName, tags, elLat, elLng) {
      let name = tags['name:ko'] || rawName || '';

      // "X동" 패턴이면 가장 가까운 단지명을 앞에 붙임
      if (name && DONG_PATTERN.test(name) && complexNames.length > 0) {
        let bestDist = Infinity, bestComplex = null;
        for (const c of complexNames) {
          const d = haversineDistance(elLat, elLng, c.lat, c.lng);
          if (d < bestDist && d < 300) { bestDist = d; bestComplex = c.name; }
        }
        if (bestComplex) {
          // "이매촌 한신아파트" + "A동" → "이매촌한신 A동"
          const short = bestComplex.replace(/아파트$|아파트먼트$|단지$/g, '').trim();
          name = `${short} ${name}`;
        }
      }

      // 이름이 없으면 주소에서 생성
      if (!name) {
        const street = tags['addr:street'] || '';
        const houseNum = tags['addr:housenumber'] || '';
        if (street && houseNum) {
          name = `${street} ${houseNum}`;
        } else if (street) {
          name = street;
        }
      }

      return name || null;
    }

    // 3단계: 건물 way 처리
    const buildings = elements
      .filter(el => el.type === 'way' && (el.center || (el.lat && el.lon)))
      .map((el) => {
        const elLat = el.center?.lat || el.lat;
        const elLng = el.center?.lon || el.lon;
        const tags = el.tags || {};
        const name = enrichName(tags.name || '', tags, elLat, elLng);

        if (!name) return null;

        const distance = haversineDistance(lat, lng, elLat, elLng);
        const bearing = calculateBearing(lat, lng, elLat, elLng);
        const totalFloors = parseInt(tags['building:levels']) || null;
        const basementFloors = parseInt(tags['building:levels:underground']) || null;

        const building = {
          id: `osm_${el.id}`,
          name,
          address: buildAddress(tags),
          lat: elLat,
          lng: elLng,
          distance: Math.round(distance),
          distanceMeters: Math.round(distance),
          bearing: Math.round(bearing),
          totalFloors,
          basementFloors,
          buildingUse: mapBuildingType(tags),
          occupancyRate: null,
          totalTenants: null,
          operatingTenants: null,
          parkingInfo: null,
          completionYear: tags.start_date ? parseInt(tags.start_date) : null,
          thumbnailUrl: null,
          source: 'osm',
        };

        // 개별 캐시에도 저장 (프로필 조회용)
        buildingDataCache.set(building.id, { data: building, timestamp: Date.now() });

        return building;
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);

    nearbyCache.set(cacheKey, { data: buildings, timestamp: Date.now() });

    // 캐시 크기 제한
    if (nearbyCache.size > 100) {
      const oldest = [...nearbyCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      nearbyCache.delete(oldest[0]);
    }

    console.log(`[OSM] ${buildings.length}개 건물 조회 (반경 ${radius}m)`);
    return buildings;
  } catch (err) {
    console.warn('[OSM] Overpass API 실패:', err.message);
    return [];
  }
}

/**
 * 캐시에서 OSM 건물 데이터 조회
 */
function getOsmBuildingData(osmId) {
  const cached = buildingDataCache.get(osmId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

/**
 * OSM 건물의 프로필 생성 (BuildingProfileSheet 호환 형식)
 * 더미 데이터 없이 실제 OSM 태그 기반 최소 프로필 반환
 */
function generateOsmProfile(building) {
  const buildingUse = building.buildingUse || '';
  const totalFloors = building.totalFloors || null;
  const basementFloors = building.basementFloors || null;
  const buildingName = building.name || '건물';

  // 스탯: OSM 태그에서 추출 가능한 것만
  const statsRaw = [];
  if (totalFloors) statsRaw.push({ type: 'total_floors', value: `${totalFloors}층`, displayOrder: 1 });
  if (buildingUse) statsRaw.push({ type: 'type', value: buildingUse, displayOrder: 2 });

  return {
    building: {
      id: building.id,
      name: buildingName,
      address: building.address || '',
      type: buildingUse,
      total_floors: totalFloors,
      basement_floors: basementFloors,
      built_year: building.completionYear || null,
      parking_count: null,
      description: null,
      lat: building.lat,
      lng: building.lng,
      thumbnail_url: null,
    },
    stats: statsRaw.length > 0 ? { raw: statsRaw } : null,
    floors: [],
    amenities: [],
    restaurants: [],
    realEstate: [],
    tourism: null,
    liveFeeds: [],
    promotion: null,
    meta: {
      hasFloors: false,
      hasRestaurants: false,
      hasRealEstate: false,
      hasTourism: false,
      dataCompleteness: 10,
      enrichAvailable: true,
      source: 'osm',
    },
  };
}

// ===== 헬퍼 함수 =====

function buildAddress(tags) {
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [];
  if (tags['addr:city']) parts.push(tags['addr:city']);
  if (tags['addr:district']) parts.push(tags['addr:district']);
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  return parts.join(' ') || '';
}

function mapBuildingType(tags) {
  if (tags.office) return '오피스';
  if (tags.shop) return tags.shop === 'convenience' ? '편의점' : tags.shop === 'supermarket' ? '마트' : '상가';
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic') return '병원';
  if (tags.amenity === 'school' || tags.amenity === 'university') return '학교';
  if (tags.amenity === 'restaurant') return '음식점';
  if (tags.amenity === 'cafe') return '카페';
  if (tags.amenity === 'bank') return '은행';
  if (tags.amenity === 'pharmacy') return '약국';
  if (tags.tourism === 'hotel') return '호텔';
  const mapping = {
    commercial: '상업시설', office: '오피스', retail: '상가',
    residential: '주거', apartments: '아파트', hotel: '호텔',
    hospital: '병원', school: '학교', university: '대학교',
    church: '교회', temple: '사찰', industrial: '산업시설',
    warehouse: '창고', garage: '주차장', civic: '공공시설',
    public: '공공시설', train_station: '역', supermarket: '마트',
    kindergarten: '유치원', dormitory: '기숙사',
    yes: '',
  };
  return mapping[tags.building] || '';
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * 캐시에서 주변 건물 즉시 조회 (캐시 히트만)
 * @returns {Array|null} 캐시 히트 시 건물 배열, 미스 시 null
 */
function getCachedNearby(lat, lng, radius) {
  const cacheKey = getCacheKey(lat, lng, radius);
  const cached = nearbyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

module.exports = {
  fetchNearbyFromOSM,
  getOsmBuildingData,
  generateOsmProfile,
  getCachedNearby,
};
