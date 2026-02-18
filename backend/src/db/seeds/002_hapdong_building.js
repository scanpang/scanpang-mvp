/**
 * 시드 데이터: 합동빌딩 (현장 테스트용)
 * - 서울 강남구 역삼로 217
 * - 좌표: 37.496789, 127.040776
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const { Pool } = require('pg');

async function seed() {
  console.log('[시드] 합동빌딩 데이터 삽입 시작...');

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

    // 1. 합동빌딩 삽입
    const bRes = await client.query(`
      INSERT INTO buildings (name, address, location, total_floors, basement_floors, building_use, occupancy_rate, total_tenants, operating_tenants, parking_info, completion_year)
      VALUES (
        '합동빌딩',
        '서울 강남구 역삼로 217',
        ST_SetSRID(ST_MakePoint(127.040776, 37.496789), 4326),
        15, 3, '오피스/상업', 85.00, 28, 22, '지하 B1-B3 (150대)', 1992
      )
      RETURNING id
    `);
    const buildingId = bRes.rows[0].id;
    console.log('[시드] 합동빌딩 ID:', buildingId);

    // 2. 층별 정보 (18개 층)
    const floors = [
      ['B3', -3, '주차장', '주차', 'directions_car', false, false, 0],
      ['B2', -2, '주차장', '주차', 'directions_car', false, false, 0],
      ['B1', -1, 'CU 편의점 / 식당가', '편의점/식당', 'store', false, true, 50],
      ['1F', 1, '로비 / 약국', '로비', 'medical_services', false, false, 0],
      ['2F', 2, '신한은행 강남역삼지점', '은행', 'account_balance', false, false, 0],
      ['3F', 3, '한솥도시락 / 뷰티샵', '음식점/뷰티', 'restaurant', false, true, 30],
      ['4F', 4, '세무법인 택스원', '사무실', 'business', false, false, 0],
      ['5F', 5, '코드스테이츠 강남', '교육', 'school', false, false, 0],
      ['6F', 6, '프리랜서 공유오피스', '공유오피스', 'groups', false, true, 80],
      ['7F', 7, '법무법인 정의', '법률', 'gavel', false, false, 0],
      ['8F', 8, '치과 / 피부과', '의료', 'local_hospital', false, false, 0],
      ['9F', 9, '보험 대리점', '금융', 'shield', false, false, 0],
      ['10F', 10, '임대 사무실', '사무실', 'business', false, false, 0],
      ['11F', 11, '공실', '공실', 'block', true, false, 0],
      ['12F', 12, '스타트업 A사', '스타트업', 'rocket_launch', false, false, 0],
      ['13F', 13, 'IT 솔루션즈', 'IT', 'computer', false, false, 0],
      ['14F', 14, '회계법인', '회계', 'calculate', false, false, 0],
      ['15F', 15, '옥상 (출입제한)', '옥상', 'rooftop', false, false, 0],
    ];
    for (const f of floors) {
      await client.query(
        'INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
        [buildingId, ...f]
      );
    }
    console.log('[시드] 층별 정보:', floors.length, '개');

    // 3. 편의시설
    const facilities = [
      ['ATM', '2F 신한은행', true, '신한/KB'],
      ['편의점', 'B1', true, 'CU 24시간'],
      ['주차장', 'B1-B3', true, '150대 / 30분 무료'],
      ['와이파이', '전층', true, 'Hapdong_Guest 무료'],
      ['냉난방', '전층', true, '중앙 공급'],
    ];
    for (const f of facilities) {
      await client.query(
        'INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text) VALUES ($1,$2,$3,$4,$5)',
        [buildingId, ...f]
      );
    }
    console.log('[시드] 편의시설:', facilities.length, '개');

    // 4. 건물 통계
    const stats = [
      ['total_floors', '지상15층/지하3층', 'layers', 1],
      ['occupancy', '85%', 'pie_chart', 2],
      ['tenants', '28개', 'store', 3],
      ['operating', '22개 영업중', 'check_circle', 4],
      ['parking_capacity', '150대', 'directions_car', 5],
      ['congestion', '보통', 'people', 6],
    ];
    for (const s of stats) {
      await client.query(
        'INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order) VALUES ($1,$2,$3,$4,$5)',
        [buildingId, ...s]
      );
    }
    console.log('[시드] 통계:', stats.length, '개');

    // 5. LIVE 피드
    const feeds = [
      ['promotion', 'B1 CU 편의점 도시락 할인', '전 품목 15% 할인 (오늘 한정)', 'local_offer', '#4CAF50', '방금'],
      ['congestion', '점심시간 엘리베이터 혼잡', '12시~1시 대기 약 5분', 'people', '#FF9800', '현재'],
      ['update', '6F 공유오피스 무료 체험', '이번 주 1일 무료 체험 가능', 'event', '#2196F3', '1시간 전'],
    ];
    for (const f of feeds) {
      await client.query(
        'INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [buildingId, ...f]
      );
    }
    console.log('[시드] LIVE 피드:', feeds.length, '개');

    await client.query('COMMIT');
    console.log('[시드] 합동빌딩 시드 완료!');

    // 확인 쿼리
    const check = await client.query(
      "SELECT id, name, address, ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng FROM buildings WHERE name = '합동빌딩'"
    );
    console.log('[시드] 확인:', check.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[시드] 에러:', err.message);
  } finally {
    client.release();
    await pool.end();
    console.log('[시드] DB 연결 종료');
  }
}

seed();
