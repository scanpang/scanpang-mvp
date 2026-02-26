/**
 * 테스트: VWORLD 건물 좌표 → 카카오 역지오코딩 전체 보강
 * 상위 10개 전부 카카오로 보강했을 때 커버리지 + 동 단위 정확도
 */
const path = require('path');
require(path.join(__dirname, 'backend/node_modules/dotenv')).config({ path: path.join(__dirname, 'backend/.env') });
const axios = require(path.join(__dirname, 'backend/node_modules/axios'));
const vw = require(path.join(__dirname, 'backend/src/services/vworldBuildings'));

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

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

async function testLocation(name, lat, lng) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${name} (${lat}, ${lng})`);
  console.log('='.repeat(60));

  const start = Date.now();
  const buildings = await vw.fetchNearbyFromVworld(lat, lng, 200);
  const vwTime = Date.now() - start;
  const top10 = buildings.slice(0, 10);

  console.log(`VWORLD: ${buildings.length}개 중 상위 10개 (${vwTime}ms)\n`);

  // 전체 10개 카카오 역지오코딩 보강
  const kakaoStart = Date.now();
  const kakaoResults = await Promise.all(
    top10.map(b => kakaoReverse(b.lat, b.lng))
  );
  const kakaoTime = Date.now() - kakaoStart;

  console.log('#  VWORLD명              → 카카오 보강명                   거리  도로명');
  console.log('-'.repeat(90));

  let vwNamed = 0, kakaoNamed = 0, improved = 0;

  top10.forEach((b, i) => {
    const k = kakaoResults[i];
    const vName = b.name || '';
    const kName = k.building || '';
    const finalName = kName || vName || k.road || '(없음)';

    if (vName) vwNamed++;
    if (kName) kakaoNamed++;
    if (kName && (!vName || kName.length > vName.length)) improved++;

    const arrow = !vName && kName ? ' ★' : (kName && kName !== vName ? ' ↑' : '  ');
    console.log(
      `${String(i + 1).padEnd(3)}${(vName || '(없음)').padEnd(20)} → ${finalName.padEnd(28)}${arrow} ${b.distanceMeters}m  ${k.road}`
    );
  });

  const totalNamed = top10.filter((b, i) => b.name || kakaoResults[i].building).length;
  const totalWithRoad = top10.filter((b, i) => b.name || kakaoResults[i].building || kakaoResults[i].road).length;

  console.log(`\n--- 결과 ---`);
  console.log(`VWORLD 자체:        ${vwNamed}/10 (${vwNamed * 10}%)`);
  console.log(`카카오 건물명:       ${kakaoNamed}/10 (${kakaoNamed * 10}%)`);
  console.log(`합산 (건물명):       ${totalNamed}/10 (${totalNamed * 10}%)`);
  console.log(`합산 (도로명 포함):  ${totalWithRoad}/10 (${totalWithRoad * 10}%)`);
  console.log(`정확도 개선 (동 추가): ${improved}개`);
  console.log(`소요시간: VWORLD ${vwTime}ms + 카카오 ${kakaoTime}ms = ${vwTime + kakaoTime}ms`);

  return { vwNamed, kakaoNamed, totalNamed, totalWithRoad };
}

(async () => {
  console.log('VWORLD 건물 좌표 → 카카오 역지오코딩 전체 보강 테스트\n');

  const r1 = await testLocation('분당 이매동 (주거지)', 37.3910, 127.1358);
  const r2 = await testLocation('강남역 (대로변)', 37.4979, 127.0276);
  const r3 = await testLocation('홍대입구역 (상업지)', 37.5563, 126.9237);

  console.log('\n' + '='.repeat(60));
  console.log('최종 요약');
  console.log('='.repeat(60));
  console.log('          VWORLD   카카오   합산   도로명포함');
  console.log(`이매동:    ${r1.vwNamed}/10     ${r1.kakaoNamed}/10     ${r1.totalNamed}/10    ${r1.totalWithRoad}/10`);
  console.log(`강남역:    ${r2.vwNamed}/10     ${r2.kakaoNamed}/10     ${r2.totalNamed}/10    ${r2.totalWithRoad}/10`);
  console.log(`홍대입구:  ${r3.vwNamed}/10     ${r3.kakaoNamed}/10     ${r3.totalNamed}/10    ${r3.totalWithRoad}/10`);
})();
