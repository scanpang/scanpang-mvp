// VWORLD 역지오코딩 → 건축물대장 직접 연결 테스트 (카카오 없이)
const path = require('path');
const backendDir = path.resolve(__dirname, 'backend');
require(backendDir + '/node_modules/dotenv').config({ path: backendDir + '/.env' });
const axios = require(backendDir + '/node_modules/axios');

const VWORLD_KEY = 'F91770F3-8F98-3FD0-8B73-6CB5627D01D1';
const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;

async function test() {
  const targets = [
    { name: '10층', lat: 37.499262, lng: 127.025535 },
    { name: '18층A', lat: 37.498931, lng: 127.027678 },
    { name: '18층B', lat: 37.497254, lng: 127.027423 },
    { name: '12층', lat: 37.498485, lng: 127.026903 },
    { name: '10층B', lat: 37.498755, lng: 127.027797 },
  ];

  console.log('카카오 없이: VWORLD 역지오코딩 → 건축물대장 직접 연결\n');

  for (const t of targets) {
    try {
      // 1. VWORLD 역지오코딩 (좌표 → 주소)
      const vRes = await axios.get('https://api.vworld.kr/req/address', {
        params: {
          service: 'address', request: 'getAddress', version: '2.0',
          crs: 'epsg:4326', point: t.lng + ',' + t.lat,
          format: 'json', type: 'parcel', key: VWORLD_KEY
        },
        timeout: 5000
      });

      const result = vRes.data.response.result[0];
      const s = result.structure;
      // level4LC = 법정동코드 10자리 → 앞5: 시군구, 뒤5: 법정동
      const sigunguCd = s.level4LC.substring(0, 5);
      const bjdongCd = s.level4LC.substring(5, 10);
      // level5 = 번지 (1318-5 형태)
      const bunjiParts = s.level5.split('-');
      const bun = (bunjiParts[0] || '0').padStart(4, '0');
      const ji = (bunjiParts[1] || '0').padStart(4, '0');

      // 2. 건축물대장 표제부 조회
      const pubRes = await axios.get('https://apis.data.go.kr/1613000/BldRgstHubService/getBrTitleInfo', {
        params: { serviceKey: PUBLIC_KEY, sigunguCd, bjdongCd, bun, ji, numOfRows: 3, pageNo: 1, _type: 'json' },
        timeout: 10000
      });
      const items = pubRes.data.response.body.items;
      const list = (items && items.item) ? (Array.isArray(items.item) ? items.item : [items.item]) : [];
      const pubBldNm = list.length > 0 ? (list[0].bldNm || '(빈값)') : '결과없음';

      console.log(t.name + ' | VWORLD주소: ' + result.text + ' | 건축물대장: [' + pubBldNm + ']');
    } catch (e) {
      console.log(t.name + ' | 에러: ' + e.message);
    }
  }
}

test();
