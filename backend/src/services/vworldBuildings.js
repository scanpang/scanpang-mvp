/**
 * VWORLD 건물 조회 서비스
 * - VWORLD 2D 데이터 API (LT_C_SPBD 레이어) 로 주변 건물 조회
 * - 5분 TTL 캐시
 * - 폴리곤 중심점 계산 + bearing/distance
 * - bd_mgt_sn에서 시군구코드/법정동코드 추출 (건축물대장 연계용)
 */
const axios = require('axios');

const VWORLD_API_KEY = process.env.VWORLD_API_KEY;
const BASE_URL = 'https://api.vworld.kr/req/data';

// ===== 캐시 =====
const nearbyCache = new Map();
const buildingDataCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

function getCacheKey(lat, lng, radius) {
  return `vw_${lat.toFixed(3)}_${lng.toFixed(3)}_${radius}`;
}

/**
 * VWORLD 2D 데이터 API로 주변 건물 조회
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radius - 반경 (미터)
 * @returns {Array} 건물 목록
 */
async function fetchNearbyFromVworld(lat, lng, radius = 200) {
  if (!VWORLD_API_KEY) {
    console.warn('[VWORLD] API 키 미설정, 건너뜀');
    return [];
  }

  const cacheKey = getCacheKey(lat, lng, radius);
  const cached = nearbyCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // BOX 좌표 계산 (반경 → 바운딩박스)
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.cos(lat * Math.PI / 180));
  const minX = (lng - lngDelta).toFixed(6);
  const minY = (lat - latDelta).toFixed(6);
  const maxX = (lng + lngDelta).toFixed(6);
  const maxY = (lat + latDelta).toFixed(6);

  try {
    console.log(`[VWORLD] 건물 조회 시작: lat=${lat} lng=${lng} radius=${radius}`);

    const response = await axios.get(BASE_URL, {
      params: {
        service: 'data',
        request: 'GetFeature',
        data: 'LT_C_SPBD',
        key: VWORLD_API_KEY,
        geomFilter: `BOX(${minX},${minY},${maxX},${maxY})`,
        crs: 'EPSG:4326',
        size: 100,
        page: 1,
        format: 'json',
        geometry: true,
        attribute: true,
      },
      timeout: 8000,
    });

    const features = response.data?.response?.result?.featureCollection?.features || [];
    console.log(`[VWORLD] 응답: ${features.length}개 건물`);

    const buildings = features
      .map((feature) => {
        const props = feature.properties || {};
        const geom = feature.geometry || {};

        // 좌표 추출: geometry에서 중심점
        let center = null;
        if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
          const coords = geom.coordinates[0];
          let sumLng = 0, sumLat = 0;
          for (const [x, y] of coords) {
            sumLng += x;
            sumLat += y;
          }
          center = { lat: sumLat / coords.length, lng: sumLng / coords.length };
        } else if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]) {
          const coords = geom.coordinates[0][0];
          let sumLng = 0, sumLat = 0;
          for (const [x, y] of coords) {
            sumLng += x;
            sumLat += y;
          }
          center = { lat: sumLat / coords.length, lng: sumLng / coords.length };
        } else if (geom.type === 'Point' && geom.coordinates) {
          center = { lat: geom.coordinates[1], lng: geom.coordinates[0] };
        }

        if (!center) return null;

        const distance = haversineDistance(lat, lng, center.lat, center.lng);
        if (distance > radius) return null;

        const bearing = calculateBearing(lat, lng, center.lat, center.lng);

        // LT_C_SPBD 속성 매핑:
        // buld_nm: 건물명, rd_nm: 도로명, buld_no: 건물번호
        // gro_flo_co: 지상층수, sido/sigungu/gu: 주소
        // bd_mgt_sn: 건축물대장 관리번호 (25자리: 시군구5+법정동5+대지구분1+번4+지4+...)
        const name = (props.buld_nm || '').trim();

        // 층수
        const totalFloors = parseInt(props.gro_flo_co) || null;

        // 주소 조합
        const sido = (props.sido || '').trim();
        const sigungu = (props.sigungu || '').trim();
        const gu = (props.gu || '').trim();
        const rdNm = (props.rd_nm || '').trim();
        const buldNo = (props.buld_no || '').trim();
        const address = [sido, sigungu, gu].filter(Boolean).join(' ');
        const roadAddress = rdNm && buldNo ? `${rdNm} ${buldNo}` : rdNm || '';

        // bd_mgt_sn에서 시군구코드/법정동코드 추출 (건축물대장 연계용)
        const bdMgtSn = (props.bd_mgt_sn || '');
        const sigunguCd = bdMgtSn.length >= 5 ? bdMgtSn.substring(0, 5) : '';
        const bjdongCd = bdMgtSn.length >= 10 ? bdMgtSn.substring(5, 10) : '';

        // 건물 ID: LT_C_SPBD.XXXXXXXXXX 형식에서 숫자 추출
        const featureId = feature.id
          ? feature.id.replace('LT_C_SPBD.', '')
          : bdMgtSn || `${center.lat.toFixed(6)}_${center.lng.toFixed(6)}`;

        const building = {
          id: `vworld_${featureId}`,
          name: name || '',
          nameSource: name ? 'vworld' : null,
          needsEnrich: !name,
          address,
          roadAddress,
          lat: center.lat,
          lng: center.lng,
          distance: Math.round(distance),
          distanceMeters: Math.round(distance),
          bearing: Math.round(bearing),
          totalFloors,
          basementFloors: null,
          buildingUse: '',
          completionYear: null,
          // 건축물대장 연계용 코드
          sigunguCd,
          bjdongCd,
          bdMgtSn,
          occupancyRate: null,
          totalTenants: null,
          operatingTenants: null,
          parkingInfo: null,
          thumbnailUrl: null,
          source: 'vworld',
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

    console.log(`[VWORLD] ${buildings.length}개 건물 조회 (반경 ${radius}m)`);
    return buildings;
  } catch (err) {
    console.warn(`[VWORLD] API 실패: ${err.code || ''} ${err.message}`);
    if (err.response?.data) {
      const body = typeof err.response.data === 'string'
        ? err.response.data.substring(0, 200)
        : JSON.stringify(err.response.data).substring(0, 200);
      console.warn(`[VWORLD] 응답 본문: ${body}`);
    }
    return [];
  }
}

/**
 * 캐시에서 VWORLD 건물 데이터 조회
 */
function getVworldBuildingData(vworldId) {
  const cached = buildingDataCache.get(vworldId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

/**
 * VWORLD 건물의 프로필 생성 (BuildingProfileSheet 호환 형식)
 */
function generateVworldProfile(building) {
  const buildingUse = building.buildingUse || '';
  const totalFloors = building.totalFloors || null;
  const basementFloors = building.basementFloors || null;
  const buildingName = building.name || '건물';

  // 스탯: VWORLD에서 추출 가능한 것만
  const statsRaw = [];
  if (totalFloors) {
    const floorStr = basementFloors
      ? `지상${totalFloors}층/지하${basementFloors}층`
      : `${totalFloors}층`;
    statsRaw.push({ type: 'total_floors', value: floorStr, displayOrder: 1 });
  }
  if (buildingUse) statsRaw.push({ type: 'type', value: buildingUse, displayOrder: 2 });

  return {
    building: {
      id: building.id,
      name: buildingName,
      address: building.address || '',
      roadAddress: building.roadAddress || '',
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
      dataCompleteness: 15,
      enrichAvailable: true,
      source: 'vworld',
    },
  };
}

// ===== 헬퍼 함수 =====

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
  fetchNearbyFromVworld,
  getVworldBuildingData,
  generateVworldProfile,
};
