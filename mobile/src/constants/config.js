/**
 * ScanPang App Configuration
 * - API 설정, 타임아웃, 키 등 중앙 관리
 */

export const API_BASE_URL = 'https://scanpang-backend.onrender.com/api';
export const API_KEY = 'scanpang-dev-key-2024';

export const TIMEOUTS = {
  default: 5000,
  geminiVision: 25000,
  geminiChat: 25000,
};

export default {
  API_BASE_URL,
  API_KEY,
  TIMEOUTS,
};
