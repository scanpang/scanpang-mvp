/**
 * 시드 데이터: 강남/역삼 건물 5개
 * - 역삼역, 강남역 근처 실제 건물 기반 더미 데이터
 * - 건물 + 층별 정보 + 편의시설 + 통계 + LIVE 피드
 * - 실행: npm run seed
 */
const path = require('path');

// .env 로드 (backend 루트 기준)
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const { Pool } = require('pg');

async function seed() {
  console.log('[시드] 강남/역삼 건물 데이터 삽입 시작...');

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 기존 데이터 초기화 (외래키 순서 주의)
    console.log('[시드] 기존 데이터 삭제...');
    await client.query('DELETE FROM scan_logs');
    await client.query('DELETE FROM live_feeds');
    await client.query('DELETE FROM building_stats');
    await client.query('DELETE FROM facilities');
    await client.query('DELETE FROM floors');
    await client.query('DELETE FROM buildings');

    // 시퀀스 리셋
    await client.query("ALTER SEQUENCE buildings_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE floors_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE facilities_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE building_stats_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE live_feeds_id_seq RESTART WITH 1");

    // ========================================
    // 건물 1: GS타워 (역삼역 근처)
    // ========================================
    console.log('[시드] 건물 1: GS타워');
    const b1 = await client.query(
      `INSERT INTO buildings (name, address, location, total_floors, basement_floors, building_use, occupancy_rate, total_tenants, operating_tenants, parking_info, completion_year)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      ['GS타워', '서울 강남구 역삼로 508', 127.0363, 37.5298, 39, 7, '오피스/상업', 95.5, 48, 42, '지하 B3-B7 (1,200대)', 2004]
    );
    const b1Id = b1.rows[0].id;

    // GS타워 층별 정보
    const gsFloors = [
      ['B2', -2, 'GS25 편의점', '편의점', 'store', false, true, 50],
      ['B1', -1, '푸드코트', '식당', 'restaurant', false, false, 0],
      ['1F', 1, '로비 / 카페', '로비', 'coffee', false, false, 0],
      ['2F', 2, '스타벅스 리저브', '카페', 'coffee', false, true, 100],
      ['3F', 3, '다이소', '생활용품', 'shopping_bag', false, false, 0],
      ['4F-10F', 10, 'GS에너지 본사', '오피스', 'business', false, false, 0],
      ['11F-20F', 20, 'GS리테일', '오피스', 'business', false, false, 0],
      ['21F-30F', 30, '임대 오피스', '오피스', 'business', false, false, 0],
      ['31F-38F', 38, 'GS칼텍스 본사', '오피스', 'business', false, false, 0],
      ['RF', 99, '스카이라운지', '라운지', 'rooftop', false, false, 0],
    ];
    for (const f of gsFloors) {
      await client.query(
        `INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [b1Id, ...f]
      );
    }

    // GS타워 편의시설
    const gsFacilities = [
      ['ATM', '1F 로비', true, 'KB/신한/우리'],
      ['편의점', 'B2', true, 'GS25 24시간'],
      ['주차장', 'B3-B7', true, '1,200대 / 기본 30분 무료'],
      ['와이파이', '전층', true, 'GS_Guest 무료'],
      ['냉난방', '전층', true, '중앙 공급'],
      ['우편함', '1F', true, '우체국 택배함'],
    ];
    for (const f of gsFacilities) {
      await client.query(
        `INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [b1Id, ...f]
      );
    }

    // GS타워 통계
    const gsStats = [
      ['total_floors', '지상39층/지하7층', 'layers', 1],
      ['occupancy', '95.5%', 'pie_chart', 2],
      ['tenants', '48개', 'store', 3],
      ['operating', '42개 영업중', 'check_circle', 4],
      ['parking_capacity', '1,200대', 'directions_car', 5],
      ['congestion', '보통', 'people', 6],
    ];
    for (const s of gsStats) {
      await client.query(
        `INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [b1Id, ...s]
      );
    }

    // GS타워 LIVE 피드
    const gsLive = [
      ['event', '2F 스타벅스 리저브 신메뉴 출시', '아이스 브라운슈가 오트라떼 30% 할인', 'local_offer', '#4CAF50', '방금'],
      ['congestion', '점심시간 혼잡도 높음', 'B1 푸드코트 대기 약 15분', 'people', '#FF9800', '현재'],
      ['update', 'B3-B5 주차장 공사 안내', '2/20-2/28 B3-B5 주차 불가, B6-B7 이용', 'construction', '#F44336', '2시간 전'],
    ];
    for (const l of gsLive) {
      await client.query(
        `INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b1Id, ...l]
      );
    }

    // ========================================
    // 건물 2: 역삼센터빌딩 (역삼역 3번 출구)
    // ========================================
    console.log('[시드] 건물 2: 역삼센터빌딩');
    const b2 = await client.query(
      `INSERT INTO buildings (name, address, location, total_floors, basement_floors, building_use, occupancy_rate, total_tenants, operating_tenants, parking_info, completion_year)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      ['역삼센터빌딩', '서울 강남구 테헤란로 134', 127.0345, 37.5005, 20, 4, '오피스', 88.0, 32, 28, '지하 B1-B4 (400대)', 1998]
    );
    const b2Id = b2.rows[0].id;

    const ysCenterFloors = [
      ['B1', -1, '주차장/창고', '주차', 'local_parking', false, false, 0],
      ['1F', 1, '로비 / 이디야커피', '카페', 'coffee', false, true, 30],
      ['2F', 2, '하나은행', '금융', 'account_balance', false, false, 0],
      ['3F-10F', 10, 'IT스타트업 다수', '오피스', 'business', false, false, 0],
      ['11F-15F', 15, '법무법인 세종', '오피스', 'gavel', false, false, 0],
      ['16F-20F', 20, '임대 사무실', '오피스', 'business', true, false, 0],
    ];
    for (const f of ysCenterFloors) {
      await client.query(
        `INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [b2Id, ...f]
      );
    }

    const ysCenterFacilities = [
      ['ATM', '2F 하나은행', true, '하나은행 ATM'],
      ['편의점', '없음', false, '건물 내 편의점 없음'],
      ['주차장', 'B1-B4', true, '400대 / 시간당 3,000원'],
      ['냉난방', '전층', true, '개별 공조'],
    ];
    for (const f of ysCenterFacilities) {
      await client.query(
        `INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [b2Id, ...f]
      );
    }

    const ysCenterStats = [
      ['total_floors', '지상20층/지하4층', 'layers', 1],
      ['occupancy', '88%', 'pie_chart', 2],
      ['tenants', '32개', 'store', 3],
      ['operating', '28개 영업중', 'check_circle', 4],
      ['parking_capacity', '400대', 'directions_car', 5],
    ];
    for (const s of ysCenterStats) {
      await client.query(
        `INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [b2Id, ...s]
      );
    }

    const ysCenterLive = [
      ['promotion', '1F 이디야 아메리카노 2,000원', '평일 오후 2-4시 한정', 'local_cafe', '#795548', '5분 전'],
      ['congestion', '엘리베이터 대기 보통', '평균 대기 2분', 'elevator', '#2196F3', '현재'],
    ];
    for (const l of ysCenterLive) {
      await client.query(
        `INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b2Id, ...l]
      );
    }

    // ========================================
    // 건물 3: 강남파이낸스센터 (강남역 11번 출구)
    // ========================================
    console.log('[시드] 건물 3: 강남파이낸스센터');
    const b3 = await client.query(
      `INSERT INTO buildings (name, address, location, total_floors, basement_floors, building_use, occupancy_rate, total_tenants, operating_tenants, parking_info, completion_year)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      ['강남파이낸스센터', '서울 강남구 테헤란로 152', 127.0285, 37.4979, 34, 8, '오피스/상업', 97.0, 55, 50, '지하 B1-B8 (1,800대)', 2001]
    );
    const b3Id = b3.rows[0].id;

    const gnfcFloors = [
      ['B2', -2, 'CU 편의점 / 약국', '편의점', 'store', false, true, 20],
      ['B1', -1, '푸드코트 / 카페', '식당', 'restaurant', false, false, 0],
      ['1F', 1, '로비 / 우리은행', '금융', 'account_balance', false, false, 0],
      ['2F', 2, '커피빈', '카페', 'coffee', false, true, 80],
      ['3F-5F', 5, '패스트파이브 강남점', '코워킹', 'groups', false, false, 0],
      ['6F-15F', 15, '금융사 사무실', '오피스', 'business', false, false, 0],
      ['16F-25F', 25, '대형 법무법인', '오피스', 'gavel', false, false, 0],
      ['26F-33F', 33, 'IT기업 사무실', '오피스', 'computer', false, false, 0],
      ['RF', 99, '옥상 정원', '정원', 'park', false, false, 0],
    ];
    for (const f of gnfcFloors) {
      await client.query(
        `INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [b3Id, ...f]
      );
    }

    const gnfcFacilities = [
      ['ATM', '1F 우리은행', true, '우리/KB/신한'],
      ['편의점', 'B2', true, 'CU 07:00-23:00'],
      ['주차장', 'B1-B8', true, '1,800대 / 기본 1시간 무료'],
      ['와이파이', '전층', true, 'GNFC_Free'],
      ['냉난방', '전층', true, '중앙 공급'],
      ['약국', 'B2', true, '강남파이낸스약국'],
    ];
    for (const f of gnfcFacilities) {
      await client.query(
        `INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [b3Id, ...f]
      );
    }

    const gnfcStats = [
      ['total_floors', '지상34층/지하8층', 'layers', 1],
      ['occupancy', '97%', 'pie_chart', 2],
      ['tenants', '55개', 'store', 3],
      ['operating', '50개 영업중', 'check_circle', 4],
      ['parking_capacity', '1,800대', 'directions_car', 5],
      ['congestion', '혼잡', 'people', 6],
    ];
    for (const s of gnfcStats) {
      await client.query(
        `INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [b3Id, ...s]
      );
    }

    const gnfcLive = [
      ['event', '3F 패스트파이브 무료 코워킹 데이', '2/20(목) 종일 무료 이용 가능', 'event', '#9C27B0', '1시간 전'],
      ['congestion', '점심시간 엘리베이터 매우 혼잡', '저층(B2-5F)용 엘리베이터 이용 권장', 'warning', '#FF5722', '현재'],
      ['promotion', 'B2 CU 삼각김밥 1+1', '오늘 하루 한정', 'local_offer', '#4CAF50', '30분 전'],
    ];
    for (const l of gnfcLive) {
      await client.query(
        `INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b3Id, ...l]
      );
    }

    // ========================================
    // 건물 4: 테헤란로 미왕빌딩 (역삼역 4번 출구)
    // ========================================
    console.log('[시드] 건물 4: 미왕빌딩');
    const b4 = await client.query(
      `INSERT INTO buildings (name, address, location, total_floors, basement_floors, building_use, occupancy_rate, total_tenants, operating_tenants, parking_info, completion_year)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      ['미왕빌딩', '서울 강남구 테헤란로 108', 127.0310, 37.5000, 15, 3, '오피스/상업', 82.0, 24, 18, '지하 B1-B3 (200대)', 1995]
    );
    const b4Id = b4.rows[0].id;

    const mwFloors = [
      ['B1', -1, '주차장', '주차', 'local_parking', false, false, 0],
      ['1F', 1, '세븐일레븐 / 로비', '편의점', 'store', false, true, 40],
      ['2F', 2, '메가MGC커피', '카페', 'coffee', false, true, 60],
      ['3F', 3, '배달의민족 사무실', '오피스', 'business', false, false, 0],
      ['4F-8F', 8, 'IT 스타트업', '오피스', 'business', false, false, 0],
      ['9F', 9, '공실', '공실', 'block', true, false, 0],
      ['10F-14F', 14, '회계법인', '오피스', 'calculate', false, false, 0],
      ['15F', 15, '옥상 휴게실', '휴게', 'deck', false, false, 0],
    ];
    for (const f of mwFloors) {
      await client.query(
        `INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [b4Id, ...f]
      );
    }

    const mwFacilities = [
      ['편의점', '1F', true, '세븐일레븐 24시간'],
      ['주차장', 'B1-B3', true, '200대 / 시간당 4,000원'],
      ['냉난방', '전층', true, '개별 공조'],
    ];
    for (const f of mwFacilities) {
      await client.query(
        `INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [b4Id, ...f]
      );
    }

    const mwStats = [
      ['total_floors', '지상15층/지하3층', 'layers', 1],
      ['occupancy', '82%', 'pie_chart', 2],
      ['tenants', '24개', 'store', 3],
      ['operating', '18개 영업중', 'check_circle', 4],
      ['parking_capacity', '200대', 'directions_car', 5],
      ['congestion', '여유', 'people', 6],
    ];
    for (const s of mwStats) {
      await client.query(
        `INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [b4Id, ...s]
      );
    }

    const mwLive = [
      ['promotion', '2F 메가MGC 아이스아메리카노 1,500원', '평일 전 시간', 'local_cafe', '#795548', '10분 전'],
      ['update', '9F 임대 문의 가능', '보증금 5,000만 / 월 350만', 'real_estate_agent', '#607D8B', '3시간 전'],
    ];
    for (const l of mwLive) {
      await client.query(
        `INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b4Id, ...l]
      );
    }

    // ========================================
    // 건물 5: 삼성생명 역삼빌딩 (역삼역 7번 출구)
    // ========================================
    console.log('[시드] 건물 5: 삼성생명 역삼빌딩');
    const b5 = await client.query(
      `INSERT INTO buildings (name, address, location, total_floors, basement_floors, building_use, occupancy_rate, total_tenants, operating_tenants, parking_info, completion_year)
       VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      ['삼성생명 역삼빌딩', '서울 강남구 테헤란로 142', 127.0330, 37.5010, 25, 5, '오피스', 92.0, 38, 35, '지하 B1-B5 (600대)', 2002]
    );
    const b5Id = b5.rows[0].id;

    const ssFloors = [
      ['B2', -2, '구내식당', '식당', 'restaurant', false, false, 0],
      ['B1', -1, '편의점 / 카페', '편의점', 'store', false, true, 30],
      ['1F', 1, '로비 / 삼성생명', '금융', 'account_balance', false, false, 0],
      ['2F-5F', 5, '삼성생명 사무실', '오피스', 'business', false, false, 0],
      ['6F-12F', 12, '삼성화재 사무실', '오피스', 'business', false, false, 0],
      ['13F-18F', 18, 'IT기업 입주', '오피스', 'computer', false, false, 0],
      ['19F-24F', 24, '임대 사무실', '오피스', 'business', false, false, 0],
      ['25F', 25, '임원실/회의실', '오피스', 'meeting_room', false, false, 0],
    ];
    for (const f of ssFloors) {
      await client.query(
        `INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [b5Id, ...f]
      );
    }

    const ssFacilities = [
      ['ATM', '1F 로비', true, '삼성생명/신한/국민'],
      ['편의점', 'B1', true, 'CU 07:00-22:00'],
      ['주차장', 'B1-B5', true, '600대 / 기본 1시간 무료'],
      ['구내식당', 'B2', true, '점심 11:30-13:30 (외부인 이용가능)'],
      ['냉난방', '전층', true, '중앙 공급'],
      ['와이파이', '전층', true, 'SamsungLife_Guest'],
    ];
    for (const f of ssFacilities) {
      await client.query(
        `INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text)
         VALUES ($1, $2, $3, $4, $5)`,
        [b5Id, ...f]
      );
    }

    const ssStats = [
      ['total_floors', '지상25층/지하5층', 'layers', 1],
      ['occupancy', '92%', 'pie_chart', 2],
      ['tenants', '38개', 'store', 3],
      ['operating', '35개 영업중', 'check_circle', 4],
      ['parking_capacity', '600대', 'directions_car', 5],
      ['congestion', '보통', 'people', 6],
    ];
    for (const s of ssStats) {
      await client.query(
        `INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order)
         VALUES ($1, $2, $3, $4, $5)`,
        [b5Id, ...s]
      );
    }

    const ssLive = [
      ['congestion', 'B2 구내식당 혼잡도 보통', '현재 대기 약 5분', 'restaurant', '#FF9800', '현재'],
      ['event', '1F 로비 보안 강화 안내', '2/18부터 외부인 출입시 신분증 확인', 'security', '#F44336', '1시간 전'],
      ['promotion', 'B1 CU 도시락 20% 할인', '점심시간 한정 (11:00-14:00)', 'lunch_dining', '#4CAF50', '15분 전'],
    ];
    for (const l of ssLive) {
      await client.query(
        `INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b5Id, ...l]
      );
    }

    await client.query('COMMIT');
    console.log('[시드] 완료! 건물 5개, 층별/편의시설/통계/LIVE 데이터 삽입 성공');

    // 삽입 결과 요약
    const summary = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM buildings) as buildings,
        (SELECT COUNT(*) FROM floors) as floors,
        (SELECT COUNT(*) FROM facilities) as facilities,
        (SELECT COUNT(*) FROM building_stats) as stats,
        (SELECT COUNT(*) FROM live_feeds) as live_feeds
    `);
    const s = summary.rows[0];
    console.log(`[시드] 요약: 건물 ${s.buildings}개, 층 ${s.floors}개, 편의시설 ${s.facilities}개, 통계 ${s.stats}개, LIVE ${s.live_feeds}개`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[시드] 에러 (롤백됨):', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    console.log('[시드] DB 연결 종료');
  }
}

// 직접 실행 시
seed();
