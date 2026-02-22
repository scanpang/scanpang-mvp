/**
 * 네이버 검색 API 서비스
 * - 블로그 검색: 건물/장소 리뷰 요약
 * - 이미지 검색: 건물 썸네일
 * - 기존 NAVER_CLIENT_ID/SECRET 환경변수 활용
 * - 5분 TTL 캐시
 */
const axios = require('axios');

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

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
  if (cache.size > 100) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    cache.delete(oldest[0]);
  }
}

function getHeaders() {
  return {
    'X-Naver-Client-Id': NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': NAVER_CLIENT_SECRET,
  };
}

/**
 * 건물 리뷰 검색 (블로그)
 * @param {string} buildingName - 건물명
 * @param {string} address - 주소 (선택, 정확도 향상)
 * @returns {Object} { reviews: Array, summary: string }
 */
async function getBuildingReviews(buildingName, address) {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    console.warn('[네이버검색] API 키 미설정, 건너뜀');
    return { reviews: [], summary: '' };
  }
  if (!buildingName) return { reviews: [], summary: '' };

  const cacheKey = `review_${buildingName}_${address || ''}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // 지역명 + 건물명으로 블로그 검색
    const query = address ? `${buildingName} ${address.split(' ').slice(-2).join(' ')}` : buildingName;
    const res = await axios.get('https://openapi.naver.com/v1/search/blog.json', {
      params: {
        query,
        display: 5,
        sort: 'sim', // 정확도순
      },
      headers: getHeaders(),
      timeout: 3000,
    });

    const items = res.data?.items || [];
    const reviews = items.map(item => ({
      title: stripHtml(item.title),
      description: stripHtml(item.description),
      link: item.link,
      bloggerName: item.bloggername,
      postDate: item.postdate,
    }));

    // 간단 요약 생성 (첫 3개 블로그 설명 합치기)
    const summaryParts = reviews.slice(0, 3).map(r => r.description).filter(Boolean);
    const summary = summaryParts.length > 0
      ? summaryParts.join(' ').substring(0, 200) + '...'
      : '';

    const result = { reviews, summary };
    setCache(cacheKey, result);
    console.log(`[네이버검색] 블로그 ${reviews.length}건 (${buildingName})`);
    return result;
  } catch (err) {
    console.warn('[네이버검색] 블로그 검색 실패:', err.message);
    return { reviews: [], summary: '' };
  }
}

// HTML 태그 제거
function stripHtml(str) {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/g, ' ').trim();
}

module.exports = {
  getBuildingReviews,
};
