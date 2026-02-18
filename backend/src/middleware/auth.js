/**
 * 간단한 API 키 인증 미들웨어
 * - x-api-key 헤더 또는 ?api_key 쿼리로 인증
 * - MVP 단계이므로 단순 문자열 비교
 */

// 환경변수에서 API 키 로드
const ENV_API_KEY = process.env.API_KEY;
const DEFAULT_KEY = 'scanpang-dev-key-2024';

/**
 * API 키 인증 미들웨어
 * - 헤더: x-api-key
 * - 쿼리: ?api_key=xxx
 * - NODE_ENV=development이면 인증 건너뜀
 * - 기본 키(DEFAULT_KEY)와 환경변수 키 모두 허용
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

  // 기본 키 또는 환경변수 키 중 하나라도 일치하면 허용
  if (providedKey === DEFAULT_KEY || (ENV_API_KEY && providedKey === ENV_API_KEY)) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: '유효하지 않은 API 키입니다.',
  });
}

module.exports = { apiKeyAuth };
