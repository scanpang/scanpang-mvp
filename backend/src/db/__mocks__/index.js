/**
 * DB 모듈 Mock (테스트용)
 * - jest.mock('../db') 시 자동으로 이 파일이 사용됨
 */
const query = jest.fn();
const testConnection = jest.fn().mockResolvedValue(true);
const pool = { on: jest.fn(), end: jest.fn() };

module.exports = {
  query,
  testConnection,
  pool,
};
