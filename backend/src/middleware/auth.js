/**
 * 간단한 API 키 인증 미들웨어
 * - x-api-key 헤더 또는 ?api_key 쿼리로 인증
 * - MVP 단계이므로 단순 문자열 비교
 */

// 환경변수에서 API 키 로드 (없으면 기본값 사용 - 개발용)
const API_KEY = process.env.API_KEY || 'scanpang-dev-key-2024';

/**
 * API 키 인증 미들웨어
 * - 헤더: x-api-key
 * - 쿼리: ?api_key=xxx
 * - NODE_ENV=development이면 인증 건너뜀
 */
function apiKeyAuth(req, res, next) {
  // 개발 환경에서는 인증 건너뜀
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  const headerKey = req.headers['x-api-key'];
  const queryKey = req.query.api_key;
  const providedKey = headerKey || queryKey;

  if (!providedKey) {
    return res.status(401).json({
      success: false,
      error: 'API 키가 필요합니다. x-api-key 헤더 또는 api_key 쿼리 파라미터를 포함해주세요.',
    });
  }

  if (providedKey !== API_KEY) {
    return res.status(403).json({
      success: false,
      error: '유효하지 않은 API 키입니다.',
    });
  }

  next();
}

module.exports = { apiKeyAuth };
