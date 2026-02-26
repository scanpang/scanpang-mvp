/**
 * 테스트: heading 전방 좌표 → 카카오 역지오코딩으로 건물명 감지
 * VWORLD 없이 "내 위치 + 바라보는 방향"만으로 건물명을 알아낼 수 있는지
 */
const path = require('path');
require(path.join(__dirname, 'backend/node_modules/dotenv')).config({ path: path.join(__dirname, 'backend/.env') });
const axios = require(path.join(__dirname, 'backend/node_modules/axios'));

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

function forwardCoord(lat, lng, heading, dist) {
  const hr = heading * Math.PI / 180;
  const lr = lat * Math.PI / 180;
  return {
    lat: lat + (dist * Math.cos(hr)) / 111320,
    lng: lng + (dist * Math.sin(hr)) / (111320 * Math.cos(lr)),
  };
}

async function kakaoReverse(lat, lng) {
  const res = await axios.get('https://dapi.kakao.com/v2/local/geo/coord2address.json', {
    params: { x: lng, y: lat },
    headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    timeout: 3000,
  });
  const doc = res.data?.documents?.[0];
  return {
    building: doc?.road_address?.building_name || '',
    road: doc?.road_address?.address_name || '',
  };
}

/**
 * 레이캐스팅: heading 방향으로 가까운 거리부터 역지오코딩
 * 첫 번째 건물명 히트 = 바라보는 건물
 */
async function detectByHeading(lat, lng, heading) {
  const distances = [5, 10, 15, 20, 30, 40, 50, 70, 100];
  const start = Date.now();

  for (const d of distances) {
    const coord = forwardCoord(lat, lng, heading, d);
    const result = await kakaoReverse(coord.lat, coord.lng);
    if (result.building) {
      return {
        name: result.building,
        road: result.road,
        distance: d,
        elapsed: Date.now() - start,
      };
    }
  }

  // 건물명 없으면 도로명이라도
  for (const d of [10, 30, 50]) {
    const coord = forwardCoord(lat, lng, heading, d);
    const result = await kakaoReverse(coord.lat, coord.lng);
    if (result.road) {
      return {
        name: result.road,
        road: result.road,
        distance: d,
        elapsed: Date.now() - start,
        fallback: true,
      };
    }
  }

  return { name: null, elapsed: Date.now() - start };
}

(async () => {
  console.log('=== heading 기반 건물 감지 테스트 ===\n');

  const tests = [
    // 이매동: 사용자가 각 방향을 바라볼 때
    { label: '이매동 → 대지아트빌C동 (남)', lat: 37.3910, lng: 127.1358, heading: 180 },
    { label: '이매동 → 베스티아5차 (동)', lat: 37.3910, lng: 127.1358, heading: 90 },
    { label: '이매동 → 진흥아마란스 (북)', lat: 37.3910, lng: 127.1358, heading: 0 },
    { label: '이매동 → 축복빌라 (서)', lat: 37.3910, lng: 127.1358, heading: 270 },
    { label: '이매동 → 이매타운 (북서)', lat: 37.3910, lng: 127.1358, heading: 315 },

    // 강남역: 사용자가 각 방향을 바라볼 때
    { label: '강남역 → 북(테헤란로)', lat: 37.4979, lng: 127.0276, heading: 0 },
    { label: '강남역 → 북동', lat: 37.4979, lng: 127.0276, heading: 45 },
    { label: '강남역 → 동', lat: 37.4979, lng: 127.0276, heading: 90 },
    { label: '강남역 → 남동', lat: 37.4979, lng: 127.0276, heading: 135 },
    { label: '강남역 → 남', lat: 37.4979, lng: 127.0276, heading: 180 },
    { label: '강남역 → 남서', lat: 37.4979, lng: 127.0276, heading: 225 },
    { label: '강남역 → 서', lat: 37.4979, lng: 127.0276, heading: 270 },
    { label: '강남역 → 북서', lat: 37.4979, lng: 127.0276, heading: 315 },
  ];

  let hit = 0;
  let total = tests.length;

  for (const t of tests) {
    const result = await detectByHeading(t.lat, t.lng, t.heading);
    const status = result.name ? (result.fallback ? '△' : '●') : '✗';
    if (result.name && !result.fallback) hit++;
    console.log(
      `${status} ${t.label.padEnd(32)} → ${(result.name || '(없음)').padEnd(25)} ${result.distance || '-'}m  ${result.elapsed}ms`
    );
  }

  console.log(`\n=== 결과: ${hit}/${total} 건물명 감지 (${Math.round(hit/total*100)}%) ===`);
  console.log('● = 건물명 히트, △ = 도로명 폴백, ✗ = 미감지');
})();
