/**
 * 마이그레이션 002: 스키마 확장
 * - buildings 테이블에 7-Factor용 컬럼 추가
 * - 새 테이블 4개 생성 (behavior_events, user_sessions, sourced_info, building_profiles)
 * - 실행: node src/db/migrations/002_extend_schema.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { Pool } = require('pg');

async function migrate() {
  console.log('[마이그레이션 002] 스키마 확장 시작...');

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
    // buildings 테이블에 새 컬럼 추가 (IF NOT EXISTS로 안전하게)
    const alterStatements = [
      `ALTER TABLE buildings ADD COLUMN IF NOT EXISTS heading_from_north DECIMAL(5,2)`,
      `ALTER TABLE buildings ADD COLUMN IF NOT EXISTS altitude DECIMAL(8,2)`,
      `ALTER TABLE buildings ADD COLUMN IF NOT EXISTS neon_sign_hours JSONB`,
      `ALTER TABLE buildings ADD COLUMN IF NOT EXISTS category VARCHAR(100)`,
      `ALTER TABLE buildings ADD COLUMN IF NOT EXISTS metadata JSONB`,
    ];

    for (const sql of alterStatements) {
      try {
        await pool.query(sql);
        console.log('[마이그레이션 002] OK:', sql.substring(0, 60));
      } catch (err) {
        // 이미 존재하는 경우 무시
        if (err.code === '42701') {
          console.log('[마이그레이션 002] 이미 존재:', sql.substring(40, 80));
        } else {
          throw err;
        }
      }
    }

    // 새 테이블들은 shared/schema.sql에서 IF NOT EXISTS로 생성
    const fs = require('fs');
    const schemaPath = path.join(__dirname, '..', '..', '..', '..', 'shared', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('[마이그레이션 002] schema.sql 실행 완료 (새 테이블 포함)');
    }

    // 테이블 목록 확인
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('[마이그레이션 002] 전체 테이블:');
    tables.rows.forEach((row) => console.log('  -', row.table_name));
    console.log('[마이그레이션 002] 완료!');
  } catch (err) {
    console.error('[마이그레이션 002] 에러:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

module.exports = migrate;

if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
