require('./backend/node_modules/dotenv').config({ path: './backend/.env' });
const axios = require('./backend/node_modules/axios');

function forwardCoord(lat, lng, heading, dist) {
  const hr = heading * Math.PI / 180;
  const lr = lat * Math.PI / 180;
  return {
    lat: lat + (dist * Math.cos(hr)) / 111320,
    lng: lng + (dist * Math.sin(hr)) / (111320 * Math.cos(lr)),
  };
}

async function kakaoReverse(lat, lng) {
  try {
    const res = await axios.get('https://dapi.kakao.com/v2/local/geo/coord2address.json', {
      params: { x: lng, y: lat },
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
      timeout: 3000,
    });
    const doc = res.data?.documents?.[0];
    return {
      building: doc?.road_address?.building_name || '',
      road: doc?.road_address?.address_name || '',
      jibun: doc?.address?.address_name || '',
    };
  } catch (e) { return { building: '', road: '', jibun: '' }; }
}

async function testLocation(name, lat, lng) {
  console.log('\n========================================');
  console.log(`테스트: ${name} (${lat}, ${lng})`);
  console.log('========================================');

  const headings = [0, 45, 90, 135, 180, 225, 270, 315];
  const distances = [10, 20, 30, 50, 80, 100, 150];
  const foundBuildings = new Map();

  for (const h of headings) {
    for (const d of distances) {
      const coord = forwardCoord(lat, lng, h, d);
      const result = await kakaoReverse(coord.lat, coord.lng);
      if (result.building && !foundBuildings.has(result.building)) {
        foundBuildings.set(result.building, { heading: h, distance: d, road: result.road });
      }
    }
  }

  console.log(`\n발견된 건물 (${foundBuildings.size}개):`);
  console.log('-'.repeat(70));
  [...foundBuildings.entries()]
    .sort((a, b) => a[1].distance - b[1].distance)
    .forEach(([bName, info], i) => {
      console.log(
        `${i + 1}. ${bName.padEnd(22)} | ${info.distance}m | heading ${info.heading}도 | ${info.road}`
      );
    });

  return foundBuildings.size;
}

async function testSingleHeading(name, lat, lng, heading) {
  console.log(`\n--- ${name} heading=${heading}도 ---`);
  const distances = [5, 10, 15, 20, 30, 40, 50, 70, 100];

  for (const d of distances) {
    const coord = forwardCoord(lat, lng, heading, d);
    const result = await kakaoReverse(coord.lat, coord.lng);
    const bldg = result.building || '(없음)';
    const road = result.road || result.jibun || '';
    console.log(`  ${String(d).padEnd(4)}m  ${bldg.padEnd(22)} ${road}`);
  }
}

// VWORLD 비교
async function testVworld(name, lat, lng) {
  const vw = require('./backend/src/services/vworldBuildings');
  const buildings = await vw.fetchNearbyFromVworld(lat, lng, 150);
  const named = buildings.filter(b => b.name);
  console.log(`\n[VWORLD 비교] ${name}: ${buildings.length}개 중 이름있음 ${named.length}개 (${Math.round(named.length / Math.max(buildings.length, 1) * 100)}%)`);
  return buildings.length;
}

(async () => {
  const start = Date.now();

  // 1. 강남역 전방향 스캔
  const count1 = await testLocation('강남역', 37.4979, 127.0276);
  await testVworld('강남역', 37.4979, 127.0276);

  // 2. 이매동 (사용자 위치) 전방향 스캔
  const count2 = await testLocation('분당 이매동', 37.3910, 127.1358);
  await testVworld('이매동', 37.3910, 127.1358);

  // 3. 특정 heading 레이캐스팅 테스트
  await testSingleHeading('이매동→북서(대지아트빌)', 37.3910, 127.1358, 315);
  await testSingleHeading('강남역→북(테헤란로)', 37.4979, 127.0276, 0);

  console.log(`\n=== 총 소요시간: ${Date.now() - start}ms ===`);
  console.log(`강남역: ${count1}개 건물`);
  console.log(`이매동: ${count2}개 건물`);
})();
