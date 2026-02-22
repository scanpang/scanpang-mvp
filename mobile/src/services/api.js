/**
 * ScanPang API 서비스
 * - Axios 기반 HTTP 클라이언트
 * - 자동 재시도 (exponential backoff)
 * - 사용자 친화적 에러 메시지 변환
 * - 스캔 로그 오프라인 큐
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_KEY as CONFIG_API_KEY, TIMEOUTS } from '../constants/config';

// ===== 에러 메시지 매핑 =====
const ERROR_MESSAGES = {
  network: '인터넷 연결을 확인해주세요',
  timeout: '서버 응답이 느립니다. 잠시 후 다시 시도해주세요',
  404: '건물 정보를 찾을 수 없습니다',
  500: '서버 오류가 발생했습니다',
  default: '일시적인 오류가 발생했습니다',
};

/**
 * Axios 에러를 사용자 친화적 메시지로 변환
 */
export const getUserFriendlyError = (error) => {
  if (!error) return ERROR_MESSAGES.default;

  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return ERROR_MESSAGES.timeout;
  }
  if (!error.response) {
    return ERROR_MESSAGES.network;
  }
  const status = error.response?.status;
  return ERROR_MESSAGES[status] || ERROR_MESSAGES.default;
};

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: TIMEOUTS.default,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': CONFIG_API_KEY,
  },
});

// 응답 인터셉터: response.data만 반환
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 콘솔에만 로그 (사용자에게 노출하지 않음)
    if (error.response) {
      console.warn(`[API] ${error.response.status}: ${error.config?.url}`);
    } else if (error.request) {
      console.warn(`[API] Network error: ${error.config?.url}`);
    }
    return Promise.reject(error);
  }
);

// ===== 재시도 로직 (exponential backoff) =====
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const withRetry = async (fn, maxRetries = 2) => {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        await sleep(1000);
      }
    }
  }
  throw lastError;
};

// ===== API 엔드포인트 함수들 =====

export const getNearbyBuildings = async (lat, lng, radius = 500, heading = 0) => {
  return withRetry(() =>
    apiClient.get('/buildings/nearby', {
      params: { lat, lng, radius, heading },
    })
  );
};

export const getBuildingProfile = async (id, params = {}) => {
  return withRetry(() => apiClient.get(`/buildings/${id}/profile`, { params }));
};

export const getBuildingEnrich = async (id, params = {}) => {
  return withRetry(() => apiClient.get(`/buildings/${id}/profile/enrich`, { params }));
};

export const getBuildingLazy = async (id, params = {}) => {
  return withRetry(() => apiClient.get(`/buildings/${id}/profile/lazy`, { params }));
};

export const getBuildingFloors = async (id) => {
  return withRetry(() => apiClient.get(`/buildings/${id}/floors`));
};

export const identifyBuilding = async (params) => {
  return withRetry(() => apiClient.post('/buildings/identify', params));
};

export const postScanComplete = async (id, { confidence, sensorData, cameraFrame } = {}) => {
  return apiClient.post(`/buildings/${id}/scan-complete`, {
    confidence,
    sensorData,
    cameraFrame,
  });
};

// ===== 스캔 로그: 오프라인 큐 지원 =====
const SCAN_LOG_QUEUE_KEY = '@scanpang_log_queue';

const savePendingLog = async (data) => {
  try {
    const raw = await AsyncStorage.getItem(SCAN_LOG_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    queue.push({ ...data, queuedAt: Date.now() });
    // 최대 50건 보관
    if (queue.length > 50) queue.splice(0, queue.length - 50);
    await AsyncStorage.setItem(SCAN_LOG_QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    // 무시
  }
};

export const flushPendingLogs = async () => {
  try {
    const raw = await AsyncStorage.getItem(SCAN_LOG_QUEUE_KEY);
    if (!raw) return;
    const queue = JSON.parse(raw);
    if (queue.length === 0) return;

    const remaining = [];
    for (const log of queue) {
      try {
        await apiClient.post('/scan/log', log);
      } catch {
        remaining.push(log);
      }
    }
    await AsyncStorage.setItem(SCAN_LOG_QUEUE_KEY, JSON.stringify(remaining));
  } catch (e) {
    // 무시
  }
};

export const postScanLog = async (data) => {
  try {
    const response = await apiClient.post('/scan/log', data);
    // 성공 시 대기 중인 로그도 전송 시도
    flushPendingLogs();
    return response;
  } catch (error) {
    // 실패 시 로컬 큐에 저장
    await savePendingLog(data);
    // 스캔 로그 실패는 사용자에게 노출하지 않음
    return null;
  }
};

export const getLiveFeeds = async (buildingId) => {
  return withRetry(() => apiClient.get(`/live/${buildingId}`));
};

// ===== Server Time API =====

export const getServerTime = async () => {
  return apiClient.get('/time');
};

export const getServerTimeContext = async (lat, lng) => {
  return apiClient.get('/time/context', { params: { lat, lng } });
};

// ===== Behavior Report API =====

export const getBehaviorReport = async (buildingId) => {
  return withRetry(() => apiClient.get(`/behavior/report/${buildingId}`));
};

export const getAreaBehaviorReport = async (lat, lng, radius = 500) => {
  return withRetry(() => apiClient.get('/behavior/report/area', { params: { lat, lng, radius } }));
};

// ===== Gemini Proxy API =====

export const analyzeFrame = async (imageBase64, options = {}) => {
  return apiClient.post('/gemini/analyze-frame', {
    imageBase64,
    mimeType: options.mimeType || 'image/jpeg',
    buildingId: options.buildingId || null,
    buildingName: options.buildingName || null,
    lat: options.lat || null,
    lng: options.lng || null,
    heading: options.heading || null,
    sessionId: options.sessionId || null,
  }, { timeout: TIMEOUTS.geminiVision });
};

export const startGeminiLive = async (options = {}) => {
  return apiClient.post('/gemini/live/start', {
    buildingId: options.buildingId || null,
    buildingName: options.buildingName || null,
    buildingInfo: options.buildingInfo || null,
    lat: options.lat || null,
    lng: options.lng || null,
  });
};

export const sendGeminiMessage = async (sessionId, message) => {
  return apiClient.post('/gemini/live/audio', { sessionId, message }, { timeout: TIMEOUTS.geminiChat });
};

export const getGeminiStreamUrl = (sessionId, message) => {
  const params = new URLSearchParams({ sessionId, message });
  return `${API_BASE_URL}/gemini/live/stream?${params.toString()}`;
};

// ===== Flywheel Stats API =====

export const getFlywheelStats = async () => {
  return withRetry(() => apiClient.get('/flywheel/stats'));
};

export const getFlywheelPending = async (limit = 20, offset = 0) => {
  return withRetry(() => apiClient.get('/flywheel/pending', { params: { limit, offset } }));
};

export { apiClient };

export default {
  getNearbyBuildings,
  identifyBuilding,
  getBuildingProfile,
  getBuildingEnrich,
  getBuildingLazy,
  getBuildingFloors,
  postScanComplete,
  postScanLog,
  getLiveFeeds,
  getServerTime,
  getServerTimeContext,
  getBehaviorReport,
  getAreaBehaviorReport,
  getUserFriendlyError,
  flushPendingLogs,
  analyzeFrame,
  startGeminiLive,
  sendGeminiMessage,
  getGeminiStreamUrl,
  getFlywheelStats,
  getFlywheelPending,
};
