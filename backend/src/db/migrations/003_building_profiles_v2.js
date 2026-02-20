/**
 * 마이그레이션 003: 건물 프로필 통합 DB 구축
 * - buildings 테이블 확장 (sub_type, description)
 * - 신규 테이블 5개: amenities, real_estate_listings, restaurants, tourism_info, promotions
 * - 기존 테이블 확장: floors(status), live_feeds(expires_at)
 * - 실행: node src/db/migrations/003_building_profiles_v2.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { Pool } = require('pg');

async function migrate() {
  console.log('[마이그레이션 003] 건물 프로필 통합 DB 구축 시작...');

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
    // 1. buildings 테이블 확장
    const alterBuildings = [
      `ALTER TABLE buildings ADD COLUMN IF NOT EXISTS sub_type TEXT`,
      `ALTER TABLE buildings ADD COLUMN IF NOT EXISTS description TEXT`,
    ];

    for (const sql of alterBuildings) {
      try {
        await pool.query(sql);
        console.log('[003] OK:', sql.substring(0, 60));
      } catch (err) {
        if (err.code === '42701') {
          console.log('[003] 이미 존재:', sql.substring(40, 80));
        } else {
          throw err;
        }
      }
    }

    // 2. floors 테이블 확장
    const alterFloors = [
      `ALTER TABLE floors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unknown'`,
    ];
    for (const sql of alterFloors) {
      try {
        await pool.query(sql);
        console.log('[003] OK:', sql.substring(0, 60));
      } catch (err) {
        if (err.code === '42701') {
          console.log('[003] 이미 존재:', sql.substring(40, 80));
        } else {
          throw err;
        }
      }
    }

    // 3. live_feeds 테이블 확장
    const alterLiveFeeds = [
      `ALTER TABLE live_feeds ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP`,
    ];
    for (const sql of alterLiveFeeds) {
      try {
        await pool.query(sql);
        console.log('[003] OK:', sql.substring(0, 60));
      } catch (err) {
        if (err.code === '42701') {
          console.log('[003] 이미 존재:', sql.substring(40, 80));
        } else {
          throw err;
        }
      }
    }

    // 4. 신규 테이블 생성
    await pool.query(`
      CREATE TABLE IF NOT EXISTS amenities (
        id SERIAL PRIMARY KEY,
        building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        location TEXT,
        is_free BOOLEAN DEFAULT FALSE,
        hours TEXT
      )
    `);
    console.log('[003] amenities 테이블 생성/확인');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS real_estate_listings (
        id SERIAL PRIMARY KEY,
        building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
        listing_type TEXT NOT NULL,
        room_type TEXT,
        unit_number TEXT,
        size_pyeong DECIMAL(5,1),
        size_sqm DECIMAL(6,1),
        deposit INTEGER,
        monthly_rent INTEGER,
        sale_price INTEGER,
        thumbnail_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[003] real_estate_listings 테이블 생성/확인');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id SERIAL PRIMARY KEY,
        building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
        floor_id INTEGER REFERENCES floors(id),
        name TEXT NOT NULL,
        category TEXT,
        sub_category TEXT,
        signature_menu TEXT,
        price_range TEXT,
        wait_teams INTEGER DEFAULT 0,
        rating DECIMAL(2,1),
        review_count INTEGER,
        hours TEXT,
        is_open BOOLEAN DEFAULT TRUE
      )
    `);
    console.log('[003] restaurants 테이블 생성/확인');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tourism_info (
        id SERIAL PRIMARY KEY,
        building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
        attraction_name TEXT,
        attraction_name_en TEXT,
        category TEXT,
        description TEXT,
        admission_fee TEXT,
        hours TEXT,
        congestion TEXT DEFAULT 'unknown',
        rating DECIMAL(2,1),
        review_count INTEGER
      )
    `);
    console.log('[003] tourism_info 테이블 생성/확인');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS promotions (
        id SERIAL PRIMARY KEY,
        building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        reward_points INTEGER,
        condition_text TEXT,
        media_url TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('[003] promotions 테이블 생성/확인');

    // 5. 인덱스
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_amenities_building ON amenities(building_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_real_estate_building ON real_estate_listings(building_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_restaurants_building ON restaurants(building_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tourism_building ON tourism_info(building_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_promotions_building ON promotions(building_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_live_feeds_expires ON live_feeds(building_id, created_at DESC)`);
    console.log('[003] 인덱스 생성/확인');

    // 테이블 목록 확인
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('[003] 전체 테이블:');
    tables.rows.forEach((row) => console.log('  -', row.table_name));
    console.log('[마이그레이션 003] 완료!');
  } catch (err) {
    console.error('[마이그레이션 003] 에러:', err.message);
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
