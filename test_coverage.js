// VWORLD 이름없는 건물 → 카카오 vs 건축물대장 vs 둘다 커버리지 비교
const path = require('path');
const backendDir = path.resolve(__dirname, 'backend');
require(backendDir + '/node_modules/dotenv').config({ path: backendDir + '/.env' });
const axios = require(backendDir + '/node_modules/axios');

const VWORLD_KEY = 'F91770F3-8F98-3FD0-8B73-6CB5627D01D1';
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;

// 폴리곤 중심점 계산
function getCenter(coords) {
  let sumLng = 0, sumLat = 0;
  coords.forEach(c => { sumLng += c[0]; sumLat += c[1]; });
  return { lat: sumLat / coords.length, lng: sumLng / coords.length };
}

// 딜레이
const delay = ms => new Promise(r => setTimeout(r, ms));

async function test() {
  // 1. VWORLD에서 전체 건물 가져오기
  console.log('1. VWORLD 건물 조회 중...\n');
  const vRes = await axios.get('https://api.vworld.kr/req/data', {
    params: {
      service: 'data', request: 'GetFeature', data: 'LT_C_BLDGINFO',
      key: VWORLD_KEY, geomFilter: 'BOX(127.025,37.496,127.030,37.500)',
      crs: 'EPSG:4326', format: 'json', size: 100
    },
    timeout: 10000
  });

  const features = vRes.data.response.result.featureCollection.features;
  const named = features.filter(f => (f.properties.bld_nm || '').trim().length > 0);
  const unnamed = features.filter(f => (f.properties.bld_nm || '').trim().length === 0);

  console.log('VWORLD 전체: ' + features.length + '개');
  console.log('VWORLD 건물명 있음: ' + named.length + '개 (' + Math.round(named.length * 100 / features.length) + '%)');
  console.log('VWORLD 건물명 없음: ' + unnamed.length + '개 → 보강 대상\n');
  console.log('보강 테스트 시작 (건물 ' + unnamed.length + '개)...\n');

  let kakaoFound = 0;
  let publicFound = 0;
  let bothFound = 0;
  let noneFound = 0;
  let kakaoOnly = 0;
  let publicOnly = 0;
  const results = [];

  for (let i = 0; i < unnamed.length; i++) {
    const f = unnamed[i];
    const p = f.properties;
    const coords = f.geometry.coordinates[0][0];
    const center = getCenter(coords);

    let kakaoName = '';
    let publicName = '';
    let address = '';

    try {
      // 카카오 역지오코딩 (건물명 + 주소코드)
      const [regionRes, addrRes] = await Promise.all([
        axios.get('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json', {
          params: { x: center.lng, y: center.lat },
          headers: { Authorization: 'KakaoAK ' + KAKAO_KEY },
          timeout: 3000
        }),
        axios.get('https://dapi.kakao.com/v2/local/geo/coord2address.json', {
          params: { x: center.lng, y: center.lat, input_coord: 'WGS84' },
          headers: { Authorization: 'KakaoAK ' + KAKAO_KEY },
          timeout: 3000
        })
      ]);

      const bDoc = regionRes.data.documents.find(d => d.region_type === 'B');
      const addrDoc = addrRes.data.documents[0];
      kakaoName = (addrDoc && addrDoc.road_address && addrDoc.road_address.building_name) ? addrDoc.road_address.building_name : '';
      address = addrDoc && addrDoc.address ? addrDoc.address.address_name : '';

      // 건축물대장 조회
      if (bDoc && addrDoc && addrDoc.address) {
        const sigunguCd = bDoc.code.substring(0, 5);
        const bjdongCd = bDoc.code.substring(5, 10);
        const bun = (addrDoc.address.main_address_no || '0').padStart(4, '0');
        const ji = (addrDoc.address.sub_address_no || '0').padStart(4, '0');

        const pubRes = await axios.get('https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo', {
          params: { serviceKey: PUBLIC_KEY, sigunguCd, bjdongCd, bun, ji, numOfRows: 3, pageNo: 1, _type: 'json' },
          timeout: 10000
        });
        const items = pubRes.data.response.body.items;
        const list = (items && items.item) ? (Array.isArray(items.item) ? items.item : [items.item]) : [];
        if (list.length > 0 && list[0].bldNm) {
          publicName = list[0].bldNm.trim();
        }
      }
    } catch (e) {
      // 에러 무시
    }

    const hasKakao = kakaoName.length > 0;
    const hasPublic = publicName.length > 0;

    if (hasKakao && hasPublic) bothFound++;
    else if (hasKakao) kakaoOnly++;
    else if (hasPublic) publicOnly++;
    else noneFound++;

    if (hasKakao) kakaoFound++;
    if (hasPublic) publicFound++;

    const status = hasKakao || hasPublic ? 'O' : 'X';
    results.push({ floors: p.grnd_flr, kakao: kakaoName || '-', public: publicName || '-', address, status });

    // API 속도 조절
    await delay(200);

    // 진행상황
    if ((i + 1) % 10 === 0) {
      process.stdout.write('  ' + (i + 1) + '/' + unnamed.length + ' 완료\n');
    }
  }

  // 결과 출력
  console.log('\n========================================');
  console.log('         보강 커버리지 비교 결과');
  console.log('========================================\n');

  const total = unnamed.length;
  console.log('VWORLD 이름없는 건물: ' + total + '개\n');

  console.log('방법1) 카카오만:        ' + kakaoFound + '/' + total + ' (' + Math.round(kakaoFound * 100 / total) + '%)');
  console.log('방법2) 건축물대장만:    ' + publicFound + '/' + total + ' (' + Math.round(publicFound * 100 / total) + '%)');
  console.log('방법3) 카카오+건축물대장: ' + (kakaoFound + publicOnly) + '/' + total + ' (' + Math.round((kakaoFound + publicOnly) * 100 / total) + '%)');
  console.log('');
  console.log('  - 카카오만 찾음:     ' + kakaoOnly + '개');
  console.log('  - 건축물대장만 찾음: ' + publicOnly + '개');
  console.log('  - 둘 다 찾음:        ' + bothFound + '개');
  console.log('  - 둘 다 못 찾음:     ' + noneFound + '개');

  console.log('\n========================================');
  console.log('         전체 건물명 커버리지');
  console.log('========================================\n');

  const vworldNamed = named.length;
  console.log('방법1) VWORLD + 카카오:            ' + (vworldNamed + kakaoFound) + '/' + features.length + ' (' + Math.round((vworldNamed + kakaoFound) * 100 / features.length) + '%)');
  console.log('방법2) VWORLD + 건축물대장:        ' + (vworldNamed + publicFound) + '/' + features.length + ' (' + Math.round((vworldNamed + publicFound) * 100 / features.length) + '%)');
  console.log('방법3) VWORLD + 카카오 + 건축물대장: ' + (vworldNamed + kakaoFound + publicOnly) + '/' + features.length + ' (' + Math.round((vworldNamed + kakaoFound + publicOnly) * 100 / features.length) + '%)');

  // 상세 결과
  console.log('\n--- 상세 결과 (건물명 찾은 것만) ---');
  results.filter(r => r.status === 'O').forEach((r, i) => {
    console.log((i + 1) + '. ' + r.floors + '층 | 카카오:[' + r.kakao + '] | 건축물대장:[' + r.public + '] | ' + r.address);
  });
}

test().catch(e => console.error('에러:', e.message));
