/**
 * 마이그레이션: 초기 스키마 생성
 * - shared/schema.sql을 읽어서 Supabase DB에 실행
 * - 실행: npm run migrate
 */
const fs = require('fs');
const path = require('path');

// .env 로드 (backend 루트 기준)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { Pool } = require('pg');

async function migrate() {
  console.log('[마이그레이션] 시작...');

  // DB 연결 (DATABASE_URL 우선, 없으면 개별 파라미터)
  const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT, 10) || 5432,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
      };
  const pool = new Pool(poolConfig);

  try {
    // shared/schema.sql 파일 읽기
    const schemaPath = path.join(__dirname, '..', '..', '..', '..', 'shared', 'schema.sql');
    console.log('[마이그레이션] 스키마 파일 경로:', schemaPath);

    if (!fs.existsSync(schemaPath)) {
      throw new Error(`스키마 파일을 찾을 수 없습니다: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    console.log('[마이그레이션] 스키마 SQL 로드 완료 (길이:', schemaSql.length, '자)');

    // SQL 실행
    await pool.query(schemaSql);
    console.log('[마이그레이션] 스키마 생성 완료!');

    // 테이블 목록 확인
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('[마이그레이션] 생성된 테이블:');
    tables.rows.forEach((row) => {
      console.log('  -', row.table_name);
    });
  } catch (err) {
    console.error('[마이그레이션] 에러:', err.message);
    throw err;
  } finally {
    await pool.end();
    console.log('[마이그레이션] DB 연결 종료');
  }
}

module.exports = migrate;

// 직접 실행 시
if (require.main === module) {
  migrate().catch(() => process.exit(1));
}
