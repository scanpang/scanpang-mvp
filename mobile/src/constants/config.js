/**
 * ScanPang App Configuration
 * - API 설정, 타임아웃, 키 등 중앙 관리
 */

export const API_BASE_URL = 'https://scanpang-backend.onrender.com/api';
export const API_KEY = 'scanpang-dev-key-2024';

// BHDB (행동 데이터 수집 대시보드) 연결
export const BHDB_API_URL = 'https://scanpang-bhdb.vercel.app/api/v1/ingest';
export const BHDB_API_KEY = 'sk-test-scanpang-2024';

export const TIMEOUTS = {
  default: 5000,
  geminiVision: 25000,
  geminiChat: 25000,
};

export default {
  API_BASE_URL,
  API_KEY,
  BHDB_API_URL,
  BHDB_API_KEY,
  TIMEOUTS,
};
