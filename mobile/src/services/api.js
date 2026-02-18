/**
 * ScanPang API 서비스
 * - Axios 기반 HTTP 클라이언트
 * - 모든 API 엔드포인트를 중앙에서 관리
 */

import axios from 'axios';

// 환경 변수에서 API URL 가져오기 (react-native-dotenv)
// 빌드 환경에 따라 폴백 URL 사용
let API_BASE_URL = 'http://localhost:3000/api';

try {
  // @env 모듈에서 환경 변수 불러오기 시도
  const env = require('@env');
  if (env.API_BASE_URL) {
    API_BASE_URL = env.API_BASE_URL;
  }
} catch (e) {
  // .env 파일이 없는 경우 기본 URL 사용
  console.warn('[API] .env 파일을 찾을 수 없습니다. 기본 URL을 사용합니다:', API_BASE_URL);
}

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10초 타임아웃
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터: 디버그 로깅
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.params || '');
    return config;
  },
  (error) => {
    console.error('[API] 요청 오류:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터: 에러 처리
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      // 서버가 응답했지만 에러 상태 코드인 경우
      console.error(`[API] 서버 오류 (${error.response.status}):`, error.response.data);
    } else if (error.request) {
      // 요청은 보냈지만 응답이 없는 경우
      console.error('[API] 네트워크 오류: 서버에 연결할 수 없습니다.');
    } else {
      // 요청 설정 중 오류가 발생한 경우
      console.error('[API] 설정 오류:', error.message);
    }
    return Promise.reject(error);
  }
);

// ===== API 엔드포인트 함수들 =====

/**
 * 주변 건물 목록 조회
 * @param {number} lat - 현재 위도
 * @param {number} lng - 현재 경도
 * @param {number} radius - 검색 반경 (미터, 기본 500m)
 * @param {number} heading - 사용자가 바라보는 방향 (0~360도)
 * @returns {Promise<Array>} 주변 건물 목록
 */
export const getNearbyBuildings = async (lat, lng, radius = 500, heading = 0) => {
  try {
    const response = await apiClient.get('/buildings/nearby', {
      params: { lat, lng, radius, heading },
    });
    return response;
  } catch (error) {
    console.error('[API] 주변 건물 조회 실패:', error);
    throw error;
  }
};

/**
 * 건물 상세 프로필 조회
 * @param {string} id - 건물 ID
 * @returns {Promise<Object>} 건물 상세 정보
 */
export const getBuildingProfile = async (id) => {
  try {
    const response = await apiClient.get(`/buildings/${id}/profile`);
    return response;
  } catch (error) {
    console.error(`[API] 건물 프로필 조회 실패 (${id}):`, error);
    throw error;
  }
};

/**
 * 건물 층별 정보 조회
 * @param {string} id - 건물 ID
 * @returns {Promise<Array>} 건물 층별 정보 목록
 */
export const getBuildingFloors = async (id) => {
  try {
    const response = await apiClient.get(`/buildings/${id}/floors`);
    return response;
  } catch (error) {
    console.error(`[API] 건물 층별 정보 조회 실패 (${id}):`, error);
    throw error;
  }
};

/**
 * 스캔 로그 전송
 * @param {Object} data - 스캔 데이터
 * @param {string} data.buildingId - 스캔한 건물 ID
 * @param {number} data.latitude - 스캔 위치 위도
 * @param {number} data.longitude - 스캔 위치 경도
 * @param {number} data.heading - 스캔 시 방향
 * @param {string} data.scanMode - 스캔 모드 ('normal' | 'xray')
 * @param {string} [data.imageUri] - 캡처 이미지 URI (선택)
 * @returns {Promise<Object>} 스캔 결과 (포인트 등)
 */
export const postScanLog = async (data) => {
  try {
    const response = await apiClient.post('/scan/log', data);
    return response;
  } catch (error) {
    console.error('[API] 스캔 로그 전송 실패:', error);
    throw error;
  }
};

/**
 * 건물별 실시간 피드 조회
 * @param {string} buildingId - 건물 ID
 * @returns {Promise<Array>} 실시간 피드 목록
 */
export const getLiveFeeds = async (buildingId) => {
  try {
    const response = await apiClient.get(`/live/${buildingId}`);
    return response;
  } catch (error) {
    console.error(`[API] 라이브 피드 조회 실패 (${buildingId}):`, error);
    throw error;
  }
};

// API 클라이언트 인스턴스 내보내기 (커스텀 요청용)
export { apiClient };

export default {
  getNearbyBuildings,
  getBuildingProfile,
  getBuildingFloors,
  postScanLog,
  getLiveFeeds,
};
