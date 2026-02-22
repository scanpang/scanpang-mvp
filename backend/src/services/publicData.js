/**
 * 공공데이터 포털 API 서비스
 * - 건축물대장 총괄표제부: 건물 기본 정보 (층수, 용도, 준공일 등)
 * - 건축물대장 층별개요: 층별 용도/면적
 * - 아파트 실거래가: 실시간 거래 데이터 (lazy 탭용)
 * - 30분 TTL 캐시 (건축물대장 데이터 변동 적음)
 */
const axios = require('axios');

const PUBLIC_DATA_API_KEY = process.env.PUBLIC_DATA_API_KEY;
// BldRgstHubService = 건축물대장 허브 서비스 (기존 BldRgstService_v2 → 500 에러)
// .env의 PUBLIC_DATA_API_KEY는 Decoding 키 사용 (axios가 자동 인코딩)
const BASE_URL = 'https://apis.data.go.kr/1613000/BldRgstHubService';

// ===== 캐시 =====
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30분

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    cache.delete(oldest[0]);
  }
}

/**
 * 건축물대장 총괄표제부 조회
 * @param {string} sigunguCd - 시군구코드 (5자리)
 * @param {string} bjdongCd - 법정동코드 (5자리)
 * @param {string} bun - 번 (4자리, 좌측 0 채움)
 * @param {string} ji - 지 (4자리, 좌측 0 채움)
 * @returns {Object|null} 건축물대장 요약
 */
async function getBuildingSummary(sigunguCd, bjdongCd, bun, ji) {
  if (!PUBLIC_DATA_API_KEY) {
    console.warn('[공공데이터] API 키 미설정, 건너뜀');
    return null;
  }
  if (!sigunguCd || !bjdongCd) return null;

  const cacheKey = `summary_${sigunguCd}_${bjdongCd}_${bun}_${ji}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`${BASE_URL}/getBrTitleInfo`, {
      params: {
        serviceKey: PUBLIC_DATA_API_KEY,
        sigunguCd,
        bjdongCd,
        bun: bun || '',
        ji: ji || '',
        numOfRows: 1,
        pageNo: 1,
        _type: 'json',
      },
      timeout: 5000,
    });

    const items = res.data?.response?.body?.items?.item;
    if (!items) return null;

    const item = Array.isArray(items) ? items[0] : items;
    const result = {
      // 건물명
      bldNm: item.bldNm || '',
      // 주 용도
      mainPurpsCdNm: item.mainPurpsCdNm || '',
      // 기타 용도
      etcPurps: item.etcPurps || '',
      // 지상 층수
      grndFlrCnt: parseInt(item.grndFlrCnt) || 0,
      // 지하 층수
      ugrndFlrCnt: parseInt(item.ugrndFlrCnt) || 0,
      // 사용승인일
      useAprDay: item.useAprDay || '',
      // 건축면적 (㎡)
      archArea: parseFloat(item.archArea) || 0,
      // 연면적 (㎡)
      totArea: parseFloat(item.totArea) || 0,
      // 건폐율
      bcRat: parseFloat(item.bcRat) || 0,
      // 용적률
      vlRat: parseFloat(item.vlRat) || 0,
      // 주차장 수
      indrAutoArea: parseInt(item.indrAutoArea) || 0,
      oudrAutoArea: parseInt(item.oudrAutoArea) || 0,
      totalParking: (parseInt(item.indrAutoArea) || 0) + (parseInt(item.oudrAutoArea) || 0),
      // 세대 수
      hhldCnt: parseInt(item.hhldCnt) || 0,
      // 구조
      strctCdNm: item.strctCdNm || '',
    };

    setCache(cacheKey, result);
    console.log(`[공공데이터] 건축물대장 조회: ${result.bldNm || '이름없음'} (${sigunguCd}/${bjdongCd})`);
    return result;
  } catch (err) {
    console.warn('[공공데이터] 건축물대장 총괄표제부 실패:', err.message);
    return null;
  }
}

/**
 * 건축물대장 층별개요 조회
 * @returns {Array} 층별 정보 배열
 */
async function getBuildingFloors(sigunguCd, bjdongCd, bun, ji) {
  if (!PUBLIC_DATA_API_KEY || !sigunguCd || !bjdongCd) return [];

  const cacheKey = `floors_${sigunguCd}_${bjdongCd}_${bun}_${ji}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get(`${BASE_URL}/getBrFlrOulnInfo`, {
      params: {
        serviceKey: PUBLIC_DATA_API_KEY,
        sigunguCd,
        bjdongCd,
        bun: bun || '',
        ji: ji || '',
        numOfRows: 100,
        pageNo: 1,
        _type: 'json',
      },
      timeout: 5000,
    });

    const items = res.data?.response?.body?.items?.item;
    if (!items) return [];

    const list = Array.isArray(items) ? items : [items];
    const floors = list.map(item => ({
      // 층 구분 (지상/지하)
      flrGbCdNm: item.flrGbCdNm || '',
      // 층 번호
      flrNo: parseInt(item.flrNo) || 0,
      // 층 용도
      mainPurpsCdNm: item.mainPurpsCdNm || item.etcPurps || '',
      // 면적 (㎡)
      area: parseFloat(item.area) || 0,
      // 구조
      strctCdNm: item.strctCdNm || '',
    }));

    // 층 번호순 정렬 (지하 → 지상)
    floors.sort((a, b) => {
      const aOrder = a.flrGbCdNm.includes('지하') ? -a.flrNo : a.flrNo;
      const bOrder = b.flrGbCdNm.includes('지하') ? -b.flrNo : b.flrNo;
      return bOrder - aOrder;
    });

    setCache(cacheKey, floors);
    return floors;
  } catch (err) {
    console.warn('[공공데이터] 건축물대장 층별개요 실패:', err.message);
    return [];
  }
}

/**
 * 상업용 부동산(비주거) 실거래가 조회 (lazy 탭용)
 * API: RTMSDataSvcNrgTrade (비주거용 부동산 매매)
 * @param {string} lawdCd - 지역코드 (5자리 시군구코드)
 * @param {string} dealYmd - 계약년월 (YYYYMM)
 * @returns {Array} 거래 목록
 */
async function getTradePrice(lawdCd, dealYmd) {
  if (!PUBLIC_DATA_API_KEY || !lawdCd) return [];

  // 기본: 현재 월
  if (!dealYmd) {
    const now = new Date();
    dealYmd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const cacheKey = `nrg_${lawdCd}_${dealYmd}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await axios.get('https://apis.data.go.kr/1613000/RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade', {
      params: {
        serviceKey: PUBLIC_DATA_API_KEY,
        LAWD_CD: lawdCd,
        DEAL_YMD: dealYmd,
        numOfRows: 30,
        pageNo: 1,
        _type: 'json',
      },
      headers: { 'User-Agent': 'ScanPang/1.0' },
      timeout: 5000,
    });

    const items = res.data?.response?.body?.items?.item;
    if (!items) return [];

    const list = Array.isArray(items) ? items : [items];
    const trades = list.map(item => ({
      dongName: (item.umdNm || '').trim(),
      jibun: (item.jibun || '').trim(),
      buildingUse: (item.buildingUse || '').trim(),
      buildingType: (item.buildingType || '').trim(),
      dealAmount: (item.dealAmount || '').toString().trim().replace(/,/g, ''),
      area: parseFloat(item.buildingAr) || 0,
      floor: typeof item.floor === 'number' ? item.floor : (parseInt(item.floor) || 0),
      dealYear: item.dealYear,
      dealMonth: item.dealMonth,
      dealDay: item.dealDay,
      buildYear: item.buildYear,
      landUse: (item.landUse || '').trim(),
      dealingType: (item.dealingGbn || '').trim(),
    }));

    setCache(cacheKey, trades);
    return trades;
  } catch (err) {
    console.warn('[공공데이터] 실거래가 조회 실패:', err.message);
    return [];
  }
}

/**
 * 카카오 지역 정보에서 주소코드 파싱
 * @param {Object} regionResult - coordToAddress 결과
 * @returns {Object} { sigunguCd, bjdongCd, bun, ji }
 */
function parseAddressCode(regionResult) {
  if (!regionResult) return { sigunguCd: '', bjdongCd: '', bun: '', ji: '' };

  // 도로명 주소에서 번지 추출 시도
  const address = regionResult.address || '';
  const bunjiMatch = address.match(/(\d+)(?:-(\d+))?$/);

  return {
    sigunguCd: regionResult.sigunguCd || '',
    bjdongCd: regionResult.bjdongCd || '',
    bun: bunjiMatch ? bunjiMatch[1].padStart(4, '0') : '',
    ji: bunjiMatch?.[2] ? bunjiMatch[2].padStart(4, '0') : '0000',
  };
}

module.exports = {
  getBuildingSummary,
  getBuildingFloors,
  getTradePrice,
  parseAddressCode,
};
