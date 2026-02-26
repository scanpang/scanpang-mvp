/**
 * heading 필터링 정확도 비교 테스트
 * 기존 방식 (전방위 10개) vs 개선 방식 (heading 전방 필터 10개)
 *
 * 실행: node test_heading_filter.js
 */
require('./backend/node_modules/dotenv').config({ path: __dirname + '/backend/.env' });
const axios = require('./backend/node_modules/axios');

const VWORLD_API_KEY = process.env.VWORLD_API_KEY;
const BASE_URL = 'https://api.vworld.kr/req/data';

// ===== 헬퍼 =====
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

function normalizeAngleDiff(diff) {
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

// ===== VWORLD 건물 조회 =====
async function fetchVworldBuildings(lat, lng, radius = 200) {
  const latDelta = radius / 111320;
  const lngDelta = radius / (111320 * Math.cos(lat * Math.PI / 180));
  const minX = (lng - lngDelta).toFixed(6);
  const minY = (lat - latDelta).toFixed(6);
  const maxX = (lng + lngDelta).toFixed(6);
  const maxY = (lat + latDelta).toFixed(6);

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
    timeout: 10000,
  });

  const features = response.data?.response?.result?.featureCollection?.features || [];

  return features
    .map((feature) => {
      const props = feature.properties || {};
      const geom = feature.geometry || {};

      let center = null;
      if (geom.type === 'Polygon' && geom.coordinates?.[0]) {
        const coords = geom.coordinates[0];
        let sumLng = 0, sumLat = 0;
        for (const [x, y] of coords) { sumLng += x; sumLat += y; }
        center = { lat: sumLat / coords.length, lng: sumLng / coords.length };
      } else if (geom.type === 'MultiPolygon' && geom.coordinates?.[0]?.[0]) {
        const coords = geom.coordinates[0][0];
        let sumLng = 0, sumLat = 0;
        for (const [x, y] of coords) { sumLng += x; sumLat += y; }
        center = { lat: sumLat / coords.length, lng: sumLng / coords.length };
      } else if (geom.type === 'Point' && geom.coordinates) {
        center = { lat: geom.coordinates[1], lng: geom.coordinates[0] };
      }

      if (!center) return null;

      const distance = haversineDistance(lat, lng, center.lat, center.lng);
      if (distance > radius) return null;

      const bearing = calculateBearing(lat, lng, center.lat, center.lng);
      const name = (props.buld_nm || '').trim();

      return {
        name: name || '(무명)',
        lat: center.lat,
        lng: center.lng,
        distance: Math.round(distance),
        bearing: Math.round(bearing),
        hasName: !!name,
        needsEnrich: !name,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.distance - b.distance);
}

// ===== 방식 A: 기존 (전방위 거리순 10개) =====
function methodA_current(allBuildings) {
  return allBuildings.slice(0, 10);
}

// ===== 방식 B: heading 필터 (전방 ±60° 우선, 거리순 10개) =====
function methodB_headingFilter(allBuildings, heading, halfAngle = 60) {
  // 전방 범위 내 건물 필터
  const inFront = allBuildings.filter(b => {
    const diff = normalizeAngleDiff(b.bearing - heading);
    return Math.abs(diff) <= halfAngle;
  });

  // 전방 건물이 10개 미만이면 나머지를 측면에서 채움
  if (inFront.length >= 10) {
    return inFront.slice(0, 10);
  }

  const frontIds = new Set(inFront.map(b => `${b.lat}_${b.lng}`));
  const rest = allBuildings.filter(b => !frontIds.has(`${b.lat}_${b.lng}`));
  return [...inFront, ...rest].slice(0, 10);
}

// ===== 정확도 분석 =====
function analyzeAccuracy(buildings, heading, fov = 60) {
  const halfFov = fov / 2;
  let inFOV = 0;        // 실제 카메라 FOV(±30°) 안에 있는 건물
  let inFront = 0;      // 전방 ±60° 안에 있는 건물
  let namedInFOV = 0;   // FOV 안 + 이름 있는 건물
  let namedTotal = 0;   // 전체 이름 있는 건물

  for (const b of buildings) {
    const diff = Math.abs(normalizeAngleDiff(b.bearing - heading));
    if (diff <= halfFov) {
      inFOV++;
      if (b.hasName) namedInFOV++;
    }
    if (diff <= 60) inFront++;
    if (b.hasName) namedTotal++;
  }

  return {
    total: buildings.length,
    inFOV,
    inFront,
    behindBack: buildings.length - inFront,
    namedInFOV,
    namedTotal,
    fovRatio: buildings.length > 0 ? (inFOV / buildings.length * 100).toFixed(1) : '0',
    frontRatio: buildings.length > 0 ? (inFront / buildings.length * 100).toFixed(1) : '0',
  };
}

// ===== 테스트 케이스 =====
const TEST_CASES = [
  {
    name: '이매동 주거지 (북향)',
    lat: 37.3947, lng: 127.1253,
    heading: 0,
  },
  {
    name: '이매동 주거지 (동향)',
    lat: 37.3947, lng: 127.1253,
    heading: 90,
  },
  {
    name: '강남역 대로 (북향)',
    lat: 37.4980, lng: 127.0276,
    heading: 0,
  },
  {
    name: '강남역 대로 (서향)',
    lat: 37.4980, lng: 127.0276,
    heading: 270,
  },
  {
    name: '홍대입구 (남향)',
    lat: 37.5563, lng: 126.9237,
    heading: 180,
  },
  {
    name: '홍대입구 (동향)',
    lat: 37.5563, lng: 126.9237,
    heading: 90,
  },
  {
    name: '판교역 (북동향)',
    lat: 37.3949, lng: 127.1115,
    heading: 45,
  },
  {
    name: '잠실 롯데타워 (남향)',
    lat: 37.5126, lng: 127.1025,
    heading: 180,
  },
];

// ===== 메인 =====
async function main() {
  console.log('='.repeat(90));
  console.log('  건물 감지 정확도 비교: 기존 (전방위) vs heading 필터링 (전방 ±60°)');
  console.log('  카메라 FOV = 60° (±30°)');
  console.log('='.repeat(90));
  console.log();

  const summaryA = { totalFOV: 0, totalBuildings: 0, totalBehind: 0 };
  const summaryB = { totalFOV: 0, totalBuildings: 0, totalBehind: 0 };

  for (const tc of TEST_CASES) {
    console.log(`━━━ ${tc.name} | heading=${tc.heading}° ━━━`);

    try {
      const allBuildings = await fetchVworldBuildings(tc.lat, tc.lng, 200);
      console.log(`  VWORLD 전체 조회: ${allBuildings.length}개 건물 (200m 반경)`);

      // 방식 A: 기존
      const buildingsA = methodA_current(allBuildings);
      const statsA = analyzeAccuracy(buildingsA, tc.heading);

      // 방식 B: heading 필터
      const buildingsB = methodB_headingFilter(allBuildings, tc.heading);
      const statsB = analyzeAccuracy(buildingsB, tc.heading);

      // 결과 출력
      console.log();
      console.log('  ┌─────────────────────┬──────────────┬──────────────┐');
      console.log('  │ 항목                │ A. 기존      │ B. heading   │');
      console.log('  ├─────────────────────┼──────────────┼──────────────┤');
      console.log(`  │ 반환 건물 수        │ ${String(statsA.total).padStart(6)}개     │ ${String(statsB.total).padStart(6)}개     │`);
      console.log(`  │ FOV(±30°) 내 건물   │ ${String(statsA.inFOV).padStart(6)}개     │ ${String(statsB.inFOV).padStart(6)}개     │`);
      console.log(`  │ 전방(±60°) 내 건물  │ ${String(statsA.inFront).padStart(6)}개     │ ${String(statsB.inFront).padStart(6)}개     │`);
      console.log(`  │ 뒤쪽 건물 (낭비)    │ ${String(statsA.behindBack).padStart(6)}개     │ ${String(statsB.behindBack).padStart(6)}개     │`);
      console.log(`  │ FOV 비율            │ ${String(statsA.fovRatio).padStart(6)}%     │ ${String(statsB.fovRatio).padStart(6)}%     │`);
      console.log(`  │ 이름 있는 건물      │ ${String(statsA.namedTotal).padStart(6)}개     │ ${String(statsB.namedTotal).padStart(6)}개     │`);
      console.log(`  │ FOV+이름 있는 건물  │ ${String(statsA.namedInFOV).padStart(6)}개     │ ${String(statsB.namedInFOV).padStart(6)}개     │`);
      console.log('  └─────────────────────┴──────────────┴──────────────┘');

      // 개선 효과
      const fovImprove = statsB.inFOV - statsA.inFOV;
      const wasteReduce = statsA.behindBack - statsB.behindBack;
      if (fovImprove > 0 || wasteReduce > 0) {
        console.log(`  → 개선: FOV 건물 +${fovImprove}개, 뒤쪽 낭비 -${wasteReduce}개`);
      } else {
        console.log(`  → 변화 없음 (전방에 건물이 충분)`);
      }

      // 방식 B에서 추가로 잡힌 건물 상세
      if (fovImprove > 0) {
        const aIds = new Set(buildingsA.map(b => `${b.lat}_${b.lng}`));
        const newInB = buildingsB.filter(b => !aIds.has(`${b.lat}_${b.lng}`));
        if (newInB.length > 0) {
          console.log(`  → B에서 새로 포함된 건물:`);
          for (const b of newInB.slice(0, 5)) {
            const diff = normalizeAngleDiff(b.bearing - tc.heading);
            console.log(`     ${b.name} (${b.distance}m, bearing=${b.bearing}°, diff=${diff.toFixed(0)}°)`);
          }
        }
      }

      // A에서 포함됐지만 B에서 빠진 건물 (뒤쪽 건물)
      const bIds = new Set(buildingsB.map(b => `${b.lat}_${b.lng}`));
      const droppedFromA = buildingsA.filter(b => !bIds.has(`${b.lat}_${b.lng}`));
      if (droppedFromA.length > 0) {
        console.log(`  → A에서 빠진 뒤쪽 건물 (낭비였던 것):`);
        for (const b of droppedFromA.slice(0, 5)) {
          const diff = normalizeAngleDiff(b.bearing - tc.heading);
          console.log(`     ${b.name} (${b.distance}m, bearing=${b.bearing}°, diff=${diff.toFixed(0)}°)`);
        }
      }

      summaryA.totalFOV += statsA.inFOV;
      summaryA.totalBuildings += statsA.total;
      summaryA.totalBehind += statsA.behindBack;
      summaryB.totalFOV += statsB.inFOV;
      summaryB.totalBuildings += statsB.total;
      summaryB.totalBehind += statsB.behindBack;

    } catch (err) {
      console.log(`  ❌ 실패: ${err.message}`);
    }
    console.log();
  }

  // ===== 종합 요약 =====
  console.log('='.repeat(90));
  console.log('  종합 요약');
  console.log('='.repeat(90));
  console.log();
  console.log('  ┌───────────────────────┬──────────────┬──────────────┐');
  console.log('  │ 전체 합산             │ A. 기존      │ B. heading   │');
  console.log('  ├───────────────────────┼──────────────┼──────────────┤');
  console.log(`  │ 총 반환 건물          │ ${String(summaryA.totalBuildings).padStart(6)}개     │ ${String(summaryB.totalBuildings).padStart(6)}개     │`);
  console.log(`  │ FOV 내 건물 합계      │ ${String(summaryA.totalFOV).padStart(6)}개     │ ${String(summaryB.totalFOV).padStart(6)}개     │`);
  console.log(`  │ 뒤쪽 낭비 합계        │ ${String(summaryA.totalBehind).padStart(6)}개     │ ${String(summaryB.totalBehind).padStart(6)}개     │`);
  const avgFovA = summaryA.totalBuildings > 0 ? (summaryA.totalFOV / summaryA.totalBuildings * 100).toFixed(1) : '0';
  const avgFovB = summaryB.totalBuildings > 0 ? (summaryB.totalFOV / summaryB.totalBuildings * 100).toFixed(1) : '0';
  console.log(`  │ FOV 적중률 (평균)     │ ${String(avgFovA).padStart(6)}%     │ ${String(avgFovB).padStart(6)}%     │`);
  console.log('  └───────────────────────┴──────────────┴──────────────┘');
  console.log();

  const improvement = summaryB.totalFOV - summaryA.totalFOV;
  const wasteReduction = summaryA.totalBehind - summaryB.totalBehind;
  console.log(`  결론: heading 필터링으로 FOV 내 건물 +${improvement}개, 뒤쪽 낭비 -${wasteReduction}개`);
  console.log(`         FOV 적중률 ${avgFovA}% → ${avgFovB}%`);
}

main().catch(console.error);
