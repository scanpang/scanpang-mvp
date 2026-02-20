/**
 * 시드 004: 이매동 건물 프로필 통합 데이터
 * - 건물 2개 + 전체 프로필 데이터 (바텀시트 테스트용)
 * - 기존 테이블(floors, facilities, building_stats, live_feeds) + 신규 테이블(amenities, restaurants, real_estate_listings, promotions)
 * - UPSERT 패턴: 중복 실행 안전
 * - 실행: node src/db/seeds/004_imae_profiles.js
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const { Pool } = require('pg');

async function seed() {
  console.log('[시드 004] 이매동 건물 프로필 데이터 삽입 시작...');

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
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // unique constraint 보장
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'buildings_name_address_unique'
        ) THEN
          ALTER TABLE buildings ADD CONSTRAINT buildings_name_address_unique UNIQUE (name, address);
        END IF;
      END $$;
    `);

    // ============================================================
    // 건물 A: 이매센터프라자
    // ============================================================
    console.log('[시드 004] 건물 A: 이매센터프라자');

    const bARes = await client.query(`
      INSERT INTO buildings
        (name, address, location, total_floors, basement_floors, building_use, sub_type, occupancy_rate, total_tenants, operating_tenants, parking_info, completion_year, description)
      VALUES (
        '이매센터프라자',
        '경기 성남시 분당구 이매로 77',
        ST_SetSRID(ST_MakePoint(127.1290, 37.3942), 4326),
        6, 1, '상업/주거복합', '근린생활시설', 85.00, 12, 8, '지하 B1 (30대)', 2003,
        '이매역 인근 상업/주거 복합건물. 1~3층 상가, 4~6층 주거.'
      )
      ON CONFLICT (name, address) DO UPDATE SET
        sub_type = EXCLUDED.sub_type,
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING id
    `);
    const aId = bARes.rows[0].id;

    // 기존 하위 데이터 정리
    for (const table of ['live_feeds', 'building_stats', 'facilities', 'promotions', 'amenities', 'restaurants', 'real_estate_listings']) {
      await client.query(`DELETE FROM ${table} WHERE building_id = $1`, [aId]);
    }
    // floors는 restaurants FK 때문에 뒤에서 처리
    await client.query('DELETE FROM restaurants WHERE building_id = $1', [aId]);
    await client.query('DELETE FROM floors WHERE building_id = $1', [aId]);

    // -- floors (6개) --
    const aFloors = [
      ['RF', 99, '옥상', '옥상', 'rooftop', false, false, 0, 'unknown'],
      ['5F', 5, '주거', '주거', 'home', false, false, 0, 'unknown'],
      ['4F', 4, '카페 해뜰', '카페', 'coffee', false, true, 50, 'open'],
      ['3F', 3, 'GS25 편의점', '편의점', 'store', false, false, 0, 'open'],
      ['2F', 2, '이매주민센터', '관공서', 'apartment', false, false, 0, 'open'],
      ['1F', 1, '로비 / 부동산', '로비', 'door_front', false, false, 0, 'open'],
    ];
    const floorIdMap = {};
    for (const f of aFloors) {
      const fRes = await client.query(
        `INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [aId, ...f]
      );
      floorIdMap[f[0]] = fRes.rows[0].id;
    }

    // -- building_stats --
    const aStats = [
      ['total_floors', '지상6층/지하1층', 'layers', 1],
      ['occupancy', '85%', 'pie_chart', 2],
      ['tenants', '12개', 'store', 3],
      ['operating', '8개 영업중', 'check_circle', 4],
      ['residents', '200+', 'people', 5],
      ['parking_capacity', '30대', 'directions_car', 6],
    ];
    for (const s of aStats) {
      await client.query(
        'INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order) VALUES ($1,$2,$3,$4,$5)',
        [aId, ...s]
      );
    }

    // -- amenities --
    const aAmenities = [
      ['ATM', 'KB국민 ATM', '1F 로비', false, '24시간'],
      ['편의점', 'GS25', '3F', false, '07:00-24:00'],
      ['주차장', '지하주차장', 'B1', false, '30분 무료'],
    ];
    for (const a of aAmenities) {
      await client.query(
        'INSERT INTO amenities (building_id, type, label, location, is_free, hours) VALUES ($1,$2,$3,$4,$5,$6)',
        [aId, ...a]
      );
    }

    // -- restaurants --
    const aRestaurants = [
      [floorIdMap['4F'], '카페 해뜰', '카페', '핸드드립', '아이스 아메리카노', '3,000~6,000원', 0, 4.2, 87, '09:00-21:00', true],
      [floorIdMap['3F'], 'GS25 편의점', '편의점', '즉석식품', '도시락', '1,000~5,000원', 0, 3.8, 24, '07:00-24:00', true],
    ];
    for (const r of aRestaurants) {
      await client.query(
        `INSERT INTO restaurants (building_id, floor_id, name, category, sub_category, signature_menu, price_range, wait_teams, rating, review_count, hours, is_open)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [aId, ...r]
      );
    }

    // -- live_feeds --
    const aFeeds = [
      ['event', '4F 카페 해뜰 신메뉴 출시', '아이스 아메리카노 30% 할인', 'local_offer', '#4CAF50', '방금'],
      ['update', '1F 택배함 도착 알림', '3건의 택배가 도착했습니다', 'mail', '#2196F3', '10분 전'],
    ];
    for (const f of aFeeds) {
      await client.query(
        'INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [aId, ...f]
      );
    }

    // -- promotions --
    await client.query(
      `INSERT INTO promotions (building_id, title, reward_points, condition_text, is_active)
      VALUES ($1, '건물 스캔하고 100P 받기', 100, '이매센터프라자를 AR 스캔하면 100포인트 적립!', true)`,
      [aId]
    );

    // -- facilities (기존 호환) --
    const aFacilities = [
      ['ATM', '1F 로비', true, 'KB국민 24시간'],
      ['편의점', '3F', true, 'GS25'],
      ['주차장', 'B1', true, '30대 / 30분 무료'],
    ];
    for (const f of aFacilities) {
      await client.query(
        'INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text) VALUES ($1,$2,$3,$4,$5)',
        [aId, ...f]
      );
    }

    console.log('[시드 004] 건물 A 완료 (ID:', aId, ')');

    // ============================================================
    // 건물 B: 이매프라자
    // ============================================================
    console.log('[시드 004] 건물 B: 이매프라자');

    const bBRes = await client.query(`
      INSERT INTO buildings
        (name, address, location, total_floors, basement_floors, building_use, sub_type, occupancy_rate, total_tenants, operating_tenants, parking_info, completion_year, description)
      VALUES (
        '이매프라자',
        '경기 성남시 분당구 이매로 91',
        ST_SetSRID(ST_MakePoint(127.1275, 37.3955), 4326),
        8, 2, '상업/오피스', '근린생활시설', 92.00, 18, 14, '지하 B1-B2 (60대)', 2005,
        '이매역 5분 거리 상업/오피스 건물. 다양한 맛집과 오피스 입주.'
      )
      ON CONFLICT (name, address) DO UPDATE SET
        sub_type = EXCLUDED.sub_type,
        description = EXCLUDED.description,
        updated_at = NOW()
      RETURNING id
    `);
    const bId = bBRes.rows[0].id;

    // 기존 하위 데이터 정리
    for (const table of ['live_feeds', 'building_stats', 'facilities', 'promotions', 'amenities', 'real_estate_listings']) {
      await client.query(`DELETE FROM ${table} WHERE building_id = $1`, [bId]);
    }
    await client.query('DELETE FROM restaurants WHERE building_id = $1', [bId]);
    await client.query('DELETE FROM floors WHERE building_id = $1', [bId]);

    // -- floors (8개) --
    const bFloors = [
      ['RF', 99, '옥상 정원', '옥상', 'rooftop', false, false, 0, 'unknown'],
      ['8F', 8, '스타트업 허브', 'IT', 'computer', false, false, 0, 'open'],
      ['7F', 7, '법무법인 세정', '법률', 'gavel', false, false, 0, 'open'],
      ['6F', 6, '세무회계사무소', '회계', 'calculate', false, false, 0, 'open'],
      ['5F', 5, '공실', '공실', 'block', true, false, 0, 'vacant'],
      ['4F', 4, '피부과 / 치과', '의료', 'local_hospital', false, false, 0, 'open'],
      ['3F', 3, '맛닭꼬 치킨', '음식점', 'restaurant', false, true, 80, 'open'],
      ['2F', 2, '투썸플레이스', '카페', 'coffee', false, true, 100, 'open'],
      ['1F', 1, '로비 / CU편의점', '로비', 'store', false, false, 0, 'open'],
      ['B1', -1, '주차장', '주차', 'directions_car', false, false, 0, 'unknown'],
    ];
    const bFloorIdMap = {};
    for (const f of bFloors) {
      const fRes = await client.query(
        `INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [bId, ...f]
      );
      bFloorIdMap[f[0]] = fRes.rows[0].id;
    }

    // -- building_stats --
    const bStats = [
      ['total_floors', '지상8층/지하2층', 'layers', 1],
      ['occupancy', '92%', 'pie_chart', 2],
      ['tenants', '18개', 'store', 3],
      ['operating', '14개 영업중', 'check_circle', 4],
      ['parking_capacity', '60대', 'directions_car', 5],
      ['congestion', '보통', 'people', 6],
    ];
    for (const s of bStats) {
      await client.query(
        'INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order) VALUES ($1,$2,$3,$4,$5)',
        [bId, ...s]
      );
    }

    // -- amenities --
    const bAmenities = [
      ['ATM', '신한 ATM', '1F 로비', false, '24시간'],
      ['편의점', 'CU', '1F', false, '24시간'],
      ['주차장', '지하주차장', 'B1-B2', false, '1시간 무료'],
      ['와이파이', '무료 WiFi', '전층', true, '24시간'],
    ];
    for (const a of bAmenities) {
      await client.query(
        'INSERT INTO amenities (building_id, type, label, location, is_free, hours) VALUES ($1,$2,$3,$4,$5,$6)',
        [bId, ...a]
      );
    }

    // -- restaurants (3개, 대기팀수 포함) --
    const bRestaurants = [
      [bFloorIdMap['2F'], '투썸플레이스', '카페', '디저트카페', '스트로베리 초콜릿 생크림', '5,000~9,000원', 2, 4.5, 156, '08:00-22:00', true],
      [bFloorIdMap['3F'], '맛닭꼬 치킨', '음식점', '치킨', '양념치킨', '15,000~22,000원', 5, 4.3, 203, '11:00-23:00', true],
      [bFloorIdMap['1F'], 'CU편의점', '편의점', '즉석식품', '삼각김밥', '1,000~5,000원', 0, 3.9, 42, '24시간', true],
    ];
    for (const r of bRestaurants) {
      await client.query(
        `INSERT INTO restaurants (building_id, floor_id, name, category, sub_category, signature_menu, price_range, wait_teams, rating, review_count, hours, is_open)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [bId, ...r]
      );
    }

    // -- real_estate_listings (2개) --
    const bListings = [
      ['월세', '원룸', '502호', 8.0, 26.4, 1000, 55, null],
      ['전세', '투룸', '701호', 15.0, 49.6, 18000, null, null],
    ];
    for (const l of bListings) {
      await client.query(
        `INSERT INTO real_estate_listings (building_id, listing_type, room_type, unit_number, size_pyeong, size_sqm, deposit, monthly_rent, sale_price, is_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, true)`,
        [bId, ...l]
      );
    }

    // -- live_feeds --
    const bFeeds = [
      ['promotion', '2F 투썸 아메리카노 50% 할인', '오후 2-4시 해피아워', 'local_cafe', '#795548', '방금'],
      ['congestion', '3F 맛닭꼬 대기 5팀', '예상 대기시간 약 20분', 'people', '#FF9800', '현재'],
      ['event', '5F 입주 희망자 모집', '보증금 1,000만 / 월 55만원부터', 'real_estate_agent', '#607D8B', '2시간 전'],
    ];
    for (const f of bFeeds) {
      await client.query(
        'INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [bId, ...f]
      );
    }

    // -- promotions --
    await client.query(
      `INSERT INTO promotions (building_id, title, reward_points, condition_text, is_active)
      VALUES ($1, '이매프라자 첫 스캔 보너스 200P', 200, '이매프라자를 처음 AR 스캔하면 200포인트!', true)`,
      [bId]
    );

    // -- facilities (기존 호환) --
    const bFacilities = [
      ['ATM', '1F 로비', true, '신한 ATM 24시간'],
      ['편의점', '1F', true, 'CU 24시간'],
      ['주차장', 'B1-B2', true, '60대 / 1시간 무료'],
      ['와이파이', '전층', true, '무료 WiFi'],
    ];
    for (const f of bFacilities) {
      await client.query(
        'INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text) VALUES ($1,$2,$3,$4,$5)',
        [bId, ...f]
      );
    }

    console.log('[시드 004] 건물 B 완료 (ID:', bId, ')');

    await client.query('COMMIT');

    // 결과 요약
    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM buildings) as buildings,
        (SELECT COUNT(*) FROM floors) as floors,
        (SELECT COUNT(*) FROM facilities) as facilities,
        (SELECT COUNT(*) FROM building_stats) as stats,
        (SELECT COUNT(*) FROM live_feeds) as live_feeds,
        (SELECT COUNT(*) FROM amenities) as amenities,
        (SELECT COUNT(*) FROM restaurants) as restaurants,
        (SELECT COUNT(*) FROM real_estate_listings) as real_estate,
        (SELECT COUNT(*) FROM promotions) as promotions
    `);
    const s = summary.rows[0];
    console.log('[시드 004] === 전체 DB 요약 ===');
    console.log(`  건물: ${s.buildings}개, 층: ${s.floors}개, 편의시설: ${s.facilities}개`);
    console.log(`  통계: ${s.stats}개, LIVE: ${s.live_feeds}개`);
    console.log(`  어메니티: ${s.amenities}개, 맛집: ${s.restaurants}개`);
    console.log(`  부동산: ${s.real_estate}개, 프로모션: ${s.promotions}개`);
    console.log('[시드 004] 완료!');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[시드 004] 에러 (롤백됨):', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
    console.log('[시드 004] DB 연결 종료');
  }
}

module.exports = seed;

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
