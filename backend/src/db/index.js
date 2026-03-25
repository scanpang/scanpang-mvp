/**
 * DB 스텁 (PostgreSQL 제거됨)
 * - 모든 query()는 빈 결과 반환
 * - DB 없이 동작하도록 no-op 처리
 */

const emptyResult = { rows: [], rowCount: 0 };

async function query() {
  return emptyResult;
}

async function testConnection() {
  return true;
}

async function shutdown() {
  // no-op
}

module.exports = {
  pool: { end: async () => {} },
  query,
  testConnection,
};
