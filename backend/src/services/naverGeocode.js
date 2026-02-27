/**
 * 네이버 NCP 역지오코딩 서비스
 * - scanForward: 전방 부채꼴 12포인트 역지오코딩 → 건물 목록 반환
 * - 엔드포인트: https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc
 * - 헤더: X-NCP-APIGW-API-KEY-ID / X-NCP-APIGW-API-KEY
 * - 5분 TTL 캐시 (heading 10도 단위 반올림 키)
 */
const axios = require('axios');

const NCP_CLIENT_ID = process.env.NCP_CLIENT_ID;
const NCP_CLIENT_SECRET = process.env.NCP_CLIENT_SECRET;

const BASE_URL = 'https://maps.apigw.ntruss.com/map-reversegeocode/v2/gc';

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
  if (cache.size > 300) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    cache.delete(oldest[0]);
  }
}

function getHeaders() {
  return {
    'X-NCP-APIGW-API-KEY-ID': NCP_CLIENT_ID,
    'X-NCP-APIGW-API-KEY': NCP_CLIENT_SECRET,
  };
}

/**
 * 전방 좌표 계산
 */
function forwardCoord(lat, lng, headingDeg, distanceM) {
  const headingRad = headingDeg * Math.PI / 180;
  const latRad = lat * Math.PI / 180;
  return {
    lat: lat + (distanceM * Math.cos(headingRad)) / 111320,
    lng: lng + (distanceM * Math.sin(headingRad)) / (111320 * Math.cos(latRad)),
  };
}

/**
 * Haversine 거리 (미터)
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * bearing 계산
 */
function calculateBearing(lat1, lng1, lat2, lng2) {
  const toRad = d => d * Math.PI / 180;
  const toDeg = r => r * 180 / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return Math.round((toDeg(Math.atan2(y, x)) + 360) % 360);
}

/**
 * 네이버 역지오코딩 단일 호출
 * @returns {Object|null} 파싱된 결과
 */
async function reverseGeocode(lat, lng) {
  if (!NCP_CLIENT_ID || !NCP_CLIENT_SECRET) return null;

  try {
    const res = await axios.get(BASE_URL, {
      params: {
        coords: `${lng},${lat}`,
        orders: 'roadaddr,addr,legalcode',
        output: 'json',
      },
      headers: getHeaders(),
      timeout: 3000,
    });

    const results = res.data?.results || [];
    if (results.length === 0) return null;

    // roadaddr 결과 우선, 없으면 addr
    const roadResult = results.find(r => r.name === 'roadaddr');
    const addrResult = results.find(r => r.name === 'addr');
    const legalResult = results.find(r => r.name === 'legalcode');

    // 지번 정보 추출 (중복 제거 키용)
    const addrLand = addrResult?.land || {};
    const dong = addrResult?.region?.area3?.name || legalResult?.region?.area3?.name || '';
    const bun = addrLand.number1 || '';
    const ji = addrLand.number2 || '';

    if (!dong && !bun) return null; // 지번 정보 없으면 무효

    // 건물명 추출: roadaddr > addition0.value
    const roadLand = roadResult?.land || {};
    const buildingName = roadLand.addition0?.value || '';

    // 도로명주소 조합
    const region = roadResult?.region || addrResult?.region || {};
    const area1 = region.area1?.name || '';
    const area2 = region.area2?.name || '';
    const roadName = roadLand.name || '';
    const roadNum = roadLand.number1 || '';
    const roadNum2 = roadLand.number2 ? `-${roadLand.number2}` : '';
    const roadAddress = roadName ? `${area1} ${area2} ${roadName} ${roadNum}${roadNum2}`.trim() : '';

    // 지번주소 조합
    const jibunAddress = `${area1} ${area2} ${dong} ${bun}${ji ? '-' + ji : ''}`.trim();

    return {
      dong,
      bun,
      ji,
      buildingName,
      roadAddress,
      jibunAddress,
      area1,
      area2,
    };
  } catch (err) {
    // 개별 실패 무시
    return null;
  }
}

/**
 * 전방 부채꼴 스캔 — 12포인트 병렬 역지오코딩
 * @param {number} lat - 현재 위도
 * @param {number} lng - 현재 경도
 * @param {number} heading - 방위각 (0~360)
 * @returns {Array} 건물 목록 [{ id, name, lat, lng, distance, bearing, ... }]
 */
async function scanForward(lat, lng, heading) {
  if (!NCP_CLIENT_ID || !NCP_CLIENT_SECRET) {
    console.warn('[naverGeocode] NCP API 키 미설정');
    return [];
  }

  // 캐시 키: heading 10도 단위 반올림
  const roundedHeading = Math.round(heading / 10) * 10;
  const cacheKey = `scan_${lat.toFixed(4)}_${lng.toFixed(4)}_${roundedHeading}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const startTime = Date.now();

  // 부채꼴 12포인트: -15° / 0° / +15° × 5m / 20m / 35m / 50m
  const angles = [-15, 0, 15];
  const distances = [5, 20, 35, 50];

  const points = [];
  for (const angleDelta of angles) {
    for (const dist of distances) {
      const h = (heading + angleDelta + 360) % 360;
      const coord = forwardCoord(lat, lng, h, dist);
      points.push({ ...coord, distance: dist, angle: h });
    }
  }

  // 12포인트 병렬 역지오코딩
  const results = await Promise.allSettled(
    points.map(p => reverseGeocode(p.lat, p.lng))
  );

  // 지번(동+번+지) 기준 중복 제거
  const seen = new Map(); // key: "동_번_지" → value: { ...buildingInfo, pointIndex }
  results.forEach((result, i) => {
    if (result.status !== 'fulfilled' || !result.value) return;
    const r = result.value;
    const jibunKey = `${r.dong}_${r.bun}_${r.ji}`;

    if (!seen.has(jibunKey)) {
      seen.set(jibunKey, {
        ...r,
        pointLat: points[i].lat,
        pointLng: points[i].lng,
        pointDistance: points[i].distance,
      });
    } else {
      // 더 가까운 포인트로 교체
      const existing = seen.get(jibunKey);
      if (points[i].distance < existing.pointDistance) {
        seen.set(jibunKey, {
          ...r,
          pointLat: points[i].lat,
          pointLng: points[i].lng,
          pointDistance: points[i].distance,
        });
      }
    }
  });

  // 건물 목록 생성
  const buildings = [];
  for (const [jibunKey, r] of seen) {
    const id = `naver_${r.dong}_${r.bun}_${r.ji}`;
    const distance = haversineDistance(lat, lng, r.pointLat, r.pointLng);
    const bearing = calculateBearing(lat, lng, r.pointLat, r.pointLng);

    // 건물명 결정 + nameSource
    let name, nameSource;
    if (r.buildingName) {
      name = r.buildingName;
      nameSource = 'naver';
    } else if (r.roadAddress) {
      name = r.roadAddress;
      nameSource = 'road';
    } else {
      name = r.jibunAddress;
      nameSource = 'jibun';
    }

    buildings.push({
      id,
      name,
      lat: r.pointLat,
      lng: r.pointLng,
      distance,
      distanceMeters: distance,
      bearing,
      jibun: r.jibunAddress,
      roadAddress: r.roadAddress,
      address: r.jibunAddress,
      nameSource,
      dong: r.dong,
      bun: r.bun,
      ji: r.ji,
    });
  }

  // 거리순 정렬
  buildings.sort((a, b) => a.distance - b.distance);

  const elapsed = Date.now() - startTime;
  console.log(`[naverGeocode] scanForward: ${buildings.length}개 건물 (${elapsed}ms)`);

  setCache(cacheKey, buildings);
  return buildings;
}

module.exports = {
  scanForward,
  reverseGeocode,
};
