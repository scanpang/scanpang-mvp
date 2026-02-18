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

  // Overpass QL: name 태그가 있는 건물 조회
  const query = `
    [out:json][timeout:10];
    (
      way["building"]["name"](around:${radius},${lat},${lng});
      relation["building"]["name"](around:${radius},${lat},${lng});
    );
    out center tags;
  `;

  try {
    const response = await axios.post(
      OVERPASS_URL,
      `data=${encodeURIComponent(query)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 12000,
      }
    );

    const elements = response.data?.elements || [];

    const buildings = elements
      .filter(el => (el.center || (el.lat && el.lon)))
      .map((el) => {
        const elLat = el.center?.lat || el.lat;
        const elLng = el.center?.lon || el.lon;
        const tags = el.tags || {};
        const name = tags['name:ko'] || tags.name || '';

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
 * OSM 건물의 더미 프로필 생성
 */
function generateOsmProfile(building) {
  const totalFloors = building.totalFloors || 10;
  const basementFloors = building.basementFloors || Math.min(3, Math.max(1, Math.floor(totalFloors / 5)));
  const floors = [];

  // 지하층
  for (let i = basementFloors; i >= 1; i--) {
    floors.push({
      id: `${building.id}_b${i}`,
      floorNumber: `B${i}`,
      floorOrder: -i,
      tenantName: i === 1 ? '편의시설/주차장' : '주차장',
      tenantCategory: i === 1 ? '편의시설' : '주차',
      tenantIcon: i === 1 ? 'store' : 'local_parking',
      isVacant: false,
      hasReward: i === 1,
      rewardPoints: i === 1 ? 30 : 0,
    });
  }

  // 1층 로비
  floors.push({
    id: `${building.id}_1`,
    floorNumber: '1F',
    floorOrder: 1,
    tenantName: '로비',
    tenantCategory: '로비',
    tenantIcon: 'business',
    isVacant: false,
    hasReward: false,
    rewardPoints: 0,
  });

  // 2층 이상
  for (let i = 2; i <= totalFloors; i++) {
    const hasReward = i % 5 === 0;
    floors.push({
      id: `${building.id}_${i}`,
      floorNumber: `${i}F`,
      floorOrder: i,
      tenantName: getFloorTenant(i, totalFloors, building.buildingUse),
      tenantCategory: building.buildingUse || '오피스',
      tenantIcon: 'business',
      isVacant: false,
      hasReward,
      rewardPoints: hasReward ? 50 : 0,
    });
  }

  return {
    ...building,
    totalFloors,
    basementFloors,
    occupancyRate: 85,
    totalTenants: totalFloors,
    operatingTenants: Math.round(totalFloors * 0.8),
    floors,
    facilities: [
      { id: `${building.id}_f1`, type: '주차장', locationInfo: 'B1', isAvailable: true, statusText: '이용 가능' },
      { id: `${building.id}_f2`, type: '편의점', locationInfo: '1F 근처', isAvailable: true, statusText: '운영중' },
      { id: `${building.id}_f3`, type: '엘리베이터', locationInfo: '전층', isAvailable: true, statusText: '운행중' },
    ],
    stats: [
      { id: `${building.id}_s1`, type: 'total_floors', value: `지상${totalFloors}층/지하${basementFloors}층`, icon: 'layers', displayOrder: 1 },
      { id: `${building.id}_s2`, type: 'occupancy', value: '85%', icon: 'pie_chart', displayOrder: 2 },
      { id: `${building.id}_s3`, type: 'tenants', value: `${totalFloors}개`, icon: 'store', displayOrder: 3 },
    ],
    liveFeeds: [
      {
        id: `${building.id}_l1`,
        feedType: 'update',
        title: `${building.name} 정보`,
        description: '실시간 데이터가 곧 업데이트됩니다',
        icon: 'info',
        iconColor: '#2196F3',
        timeLabel: '방금',
      },
    ],
  };
}

// ===== 헬퍼 함수 =====

function getFloorTenant(floor, totalFloors, buildingUse) {
  if (floor === 2) return '상업시설';
  if (floor <= Math.floor(totalFloors * 0.3)) return '저층 사무실';
  if (floor <= Math.floor(totalFloors * 0.7)) return '중층 사무실';
  return '고층 사무실';
}

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
  if (tags.shop) return '상업시설';
  if (tags.amenity === 'hospital') return '병원';
  if (tags.amenity === 'school' || tags.amenity === 'university') return '학교';
  const mapping = {
    commercial: '상업시설', office: '오피스', retail: '상업시설',
    residential: '주거', apartments: '아파트', hotel: '호텔',
    hospital: '병원', school: '학교', university: '대학교',
    church: '교회', industrial: '산업시설', warehouse: '창고',
    yes: '건물',
  };
  return mapping[tags.building] || '건물';
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

module.exports = {
  fetchNearbyFromOSM,
  getOsmBuildingData,
  generateOsmProfile,
};
