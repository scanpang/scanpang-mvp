/**
 * PostgreSQL 연결 Pool
 * - DATABASE_URL (Render/Supabase) 또는 개별 파라미터 지원
 */
const { Pool } = require('pg');
require('dotenv').config();

// SSL: 프로덕션(DATABASE_URL)에서만 활성화, 로컬에서는 비활성화
const useSSL = !!process.env.DATABASE_URL;

// DATABASE_URL이 있으면 connectionString 사용, 없으면 개별 파라미터
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: useSSL ? { rejectUnauthorized: false } : false,
    }
  : {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: false,
    };

const pool = new Pool({
  ...poolConfig,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 15000,
});

// 풀 에러 핸들링
pool.on('error', (err) => {
  console.error('[DB] 예기치 않은 풀 에러:', err.message);
});

// 연결 테스트 헬퍼
async function testConnection() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now');
    console.log('[DB] PostgreSQL 연결 성공:', result.rows[0].now);
    client.release();
    return true;
  } catch (err) {
    console.error('[DB] PostgreSQL 연결 실패:', err.message);
    return false;
  }
}

// 쿼리 헬퍼 - 파라미터 바인딩 포함
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log('[DB] 쿼리 실행:', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
    }
    return result;
  } catch (err) {
    console.error('[DB] 쿼리 에러:', { text: text.substring(0, 80), error: err.message });
    throw err;
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('[DB] 풀 종료 중...');
  await pool.end();
  console.log('[DB] 풀 종료 완료');
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

module.exports = {
  pool,
  query,
  testConnection,
};
