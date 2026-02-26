// VWORLD에서 이름 없는 건물 → 카카오 vs 건축물대장 비교
const path = require('path');
const backendDir = path.resolve(__dirname, 'backend');
require(backendDir + '/node_modules/dotenv').config({ path: backendDir + '/.env' });
const axios = require(backendDir + '/node_modules/axios');

const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;

async function test() {
  const targets = [
    { name: '10층', lat: 37.499262, lng: 127.025535 },
    { name: '18층A', lat: 37.498931, lng: 127.027678 },
    { name: '18층B', lat: 37.497254, lng: 127.027423 },
    { name: '12층', lat: 37.498485, lng: 127.026903 },
    { name: '10층B', lat: 37.498755, lng: 127.027797 },
  ];

  console.log('VWORLD 이름없는 건물 → 카카오 vs 건축물대장 비교\n');

  for (const t of targets) {
    try {
      // 1. 카카오 coord2regioncode (법정동코드)
      const regionRes = await axios.get('https://dapi.kakao.com/v2/local/geo/coord2regioncode.json', {
        params: { x: t.lng, y: t.lat },
        headers: { Authorization: 'KakaoAK ' + KAKAO_KEY }
      });
      const bDoc = regionRes.data.documents.find(d => d.region_type === 'B');

      // 2. 카카오 coord2address (건물명)
      const addrRes = await axios.get('https://dapi.kakao.com/v2/local/geo/coord2address.json', {
        params: { x: t.lng, y: t.lat, input_coord: 'WGS84' },
        headers: { Authorization: 'KakaoAK ' + KAKAO_KEY }
      });
      const addrDoc = addrRes.data.documents[0];
      const kakaoBldNm = addrDoc?.road_address?.building_name || '(빈값)';
      const addr = addrDoc?.address;

      // 주소코드 추출
      const sigunguCd = bDoc ? bDoc.code.substring(0, 5) : '';
      const bjdongCd = bDoc ? bDoc.code.substring(5, 10) : '';
      const bun = (addr?.main_address_no || '0').padStart(4, '0');
      const ji = (addr?.sub_address_no || '0').padStart(4, '0');

      // 3. 건축물대장 표제부 조회
      let pubBldNm = '조회불가';
      if (sigunguCd && bjdongCd) {
        const pubRes = await axios.get('https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo', {
          params: { serviceKey: PUBLIC_KEY, sigunguCd, bjdongCd, bun, ji, numOfRows: 3, pageNo: 1, _type: 'json' },
          timeout: 10000
        });
        const items = pubRes.data?.response?.body?.items;
        const list = (items && items.item) ? (Array.isArray(items.item) ? items.item : [items.item]) : [];
        pubBldNm = list.length > 0 ? (list[0].bldNm || '(빈값)') : '결과없음';
      }

      console.log(t.name + ' | VWORLD:이름없음 | 카카오:[' + kakaoBldNm + '] | 건축물대장:[' + pubBldNm + '] | ' + (addr?.address_name || ''));
    } catch (e) {
      console.log(t.name + ' | 에러: ' + e.message);
    }
  }
}

test();
