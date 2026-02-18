/**
 * ScanPang API 서비스
 * - Axios 기반 HTTP 클라이언트
 * - 자동 재시도 (exponential backoff)
 * - 사용자 친화적 에러 메시지 변환
 * - 스캔 로그 오프라인 큐
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL
const API_BASE_URL = 'https://scanpang-backend.onrender.com/api';

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

// API 인증 키
const API_KEY = 'scanpang-dev-key-2024';

// Axios 인스턴스 생성
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
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

const withRetry = async (fn, maxRetries = 3) => {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await sleep(delay);
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

export const getBuildingProfile = async (id) => {
  return withRetry(() => apiClient.get(`/buildings/${id}/profile`));
};

export const getBuildingFloors = async (id) => {
  return withRetry(() => apiClient.get(`/buildings/${id}/floors`));
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

export { apiClient };

export default {
  getNearbyBuildings,
  getBuildingProfile,
  getBuildingFloors,
  postScanLog,
  getLiveFeeds,
  getUserFriendlyError,
  flushPendingLogs,
};
