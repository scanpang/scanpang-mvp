/**
 * 시드 003: 강남/역삼/삼성 주변 건물 확충 (30+ 건물)
 * - 실제 건물명 + 근사 좌표
 * - 기본 층별 정보, 편의시설, 통계, 라이브피드 자동 생성
 * - UPSERT 패턴 (ON CONFLICT DO NOTHING)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const { Pool } = require('pg');

// 강남/역삼/삼성 주변 실제 건물 데이터
const BUILDINGS = [
  // === 강남역 주변 ===
  { name: '강남역 CGV빌딩', address: '서울 강남구 강남대로 438', lat: 37.49795, lng: 127.02763, floors: 10, basement: 3, use: '상업/문화', occupancy: 92, tenants: 15, parking: '지하 200대' },
  { name: '신논현역 빌딩', address: '서울 강남구 강남대로 478', lat: 37.50054, lng: 127.02528, floors: 12, basement: 3, use: '오피스', occupancy: 88, tenants: 22, parking: '지하 150대' },
  { name: '강남 교보타워', address: '서울 강남구 강남대로 465', lat: 37.49897, lng: 127.02815, floors: 24, basement: 5, use: '오피스', occupancy: 95, tenants: 45, parking: '지하 400대' },
  { name: '메리츠타워', address: '서울 강남구 테헤란로 152', lat: 37.50012, lng: 127.03625, floors: 22, basement: 5, use: '오피스/금융', occupancy: 96, tenants: 30, parking: '지하 350대' },
  { name: '르네상스호텔', address: '서울 강남구 테헤란로 337', lat: 37.50928, lng: 127.06018, floors: 30, basement: 4, use: '호텔', occupancy: 82, tenants: 12, parking: '지하 450대' },
  { name: '역삼역 센트럴푸르지오시티', address: '서울 강남구 테헤란로 180', lat: 37.50063, lng: 127.03690, floors: 20, basement: 4, use: '주상복합', occupancy: 90, tenants: 35, parking: '지하 300대' },
  { name: '디아이타워', address: '서울 강남구 테헤란로 211', lat: 37.50118, lng: 127.03898, floors: 18, basement: 4, use: '오피스/IT', occupancy: 94, tenants: 28, parking: '지하 250대' },
  { name: '현대글로비스빌딩', address: '서울 강남구 테헤란로 203', lat: 37.50104, lng: 127.03845, floors: 16, basement: 3, use: '오피스', occupancy: 100, tenants: 5, parking: '지하 200대' },

  // === 역삼역~삼성역 테헤란로 ===
  { name: '포스코타워 역삼', address: '서울 강남구 테헤란로 134', lat: 37.49969, lng: 127.03410, floors: 30, basement: 6, use: '오피스', occupancy: 97, tenants: 40, parking: '지하 500대' },
  { name: 'TIPS Town(팁스타운)', address: '서울 강남구 역삼로 165', lat: 37.49642, lng: 127.03714, floors: 8, basement: 2, use: '창업지원', occupancy: 100, tenants: 60, parking: '없음' },
  { name: '한국기술센터', address: '서울 강남구 테헤란로 305', lat: 37.50672, lng: 127.05509, floors: 24, basement: 5, use: '오피스/기술', occupancy: 91, tenants: 55, parking: '지하 300대' },
  { name: '아셈타워', address: '서울 강남구 영동대로 517', lat: 37.51165, lng: 127.05919, floors: 39, basement: 6, use: '오피스/국제', occupancy: 90, tenants: 35, parking: '지하 600대' },
  { name: '파르나스타워', address: '서울 강남구 테헤란로 521', lat: 37.51088, lng: 127.06062, floors: 38, basement: 6, use: '오피스', occupancy: 93, tenants: 50, parking: '지하 550대' },
  { name: '삼성SDS타워', address: '서울 강남구 멀티캠퍼스로 28', lat: 37.51052, lng: 127.06224, floors: 16, basement: 3, use: '오피스/IT', occupancy: 100, tenants: 3, parking: '지하 300대' },
  { name: '현대백화점 무역센터점', address: '서울 강남구 테헤란로 517', lat: 37.50891, lng: 127.06088, floors: 10, basement: 4, use: '상업/백화점', occupancy: 95, tenants: 200, parking: '지하 2000대' },
  { name: '인터컨티넨탈 서울 코엑스', address: '서울 강남구 봉은사로 524', lat: 37.51272, lng: 127.05827, floors: 35, basement: 4, use: '호텔', occupancy: 78, tenants: 8, parking: '지하 400대' },

  // === 선릉역 주변 ===
  { name: '현대모비스빌딩', address: '서울 강남구 테헤란로 239', lat: 37.50323, lng: 127.04267, floors: 14, basement: 3, use: '오피스', occupancy: 100, tenants: 4, parking: '지하 180대' },
  { name: '동부금융센터', address: '서울 강남구 테헤란로 432', lat: 37.50616, lng: 127.05118, floors: 22, basement: 5, use: '오피스/금융', occupancy: 92, tenants: 35, parking: '지하 400대' },
  { name: '에이프로스퀘어', address: '서울 강남구 테헤란로 410', lat: 37.50549, lng: 127.04998, floors: 16, basement: 4, use: '오피스', occupancy: 87, tenants: 20, parking: '지하 200대' },
  { name: '글래드호텔 강남 코엑스', address: '서울 강남구 봉은사로 110', lat: 37.51445, lng: 127.06134, floors: 12, basement: 2, use: '호텔', occupancy: 75, tenants: 5, parking: '지하 80대' },

  // === 강남대로 남쪽 ===
  { name: '강남역 쏠레시티', address: '서울 강남구 강남대로 382', lat: 37.49589, lng: 127.02910, floors: 15, basement: 4, use: '상업/오피스', occupancy: 91, tenants: 32, parking: '지하 250대' },
  { name: 'GT타워', address: '서울 강남구 강남대로 396', lat: 37.49649, lng: 127.02870, floors: 20, basement: 5, use: '오피스', occupancy: 93, tenants: 28, parking: '지하 300대' },
  { name: '강남 스파크플러스', address: '서울 강남구 강남대로 374', lat: 37.49543, lng: 127.02945, floors: 10, basement: 2, use: '코워킹스페이스', occupancy: 88, tenants: 150, parking: '없음' },
  { name: '서초 현대렉시온', address: '서울 서초구 서초대로 77길 3', lat: 37.49470, lng: 127.02601, floors: 25, basement: 5, use: '주상복합', occupancy: 94, tenants: 18, parking: '지하 400대' },

  // === 도산대로/압구정 방면 ===
  { name: '현대산업개발빌딩', address: '서울 강남구 논현로 630', lat: 37.51330, lng: 127.04115, floors: 20, basement: 4, use: '오피스', occupancy: 100, tenants: 3, parking: '지하 250대' },
  { name: 'H타워(한화생명빌딩)', address: '서울 강남구 테헤란로 316', lat: 37.50533, lng: 127.04978, floors: 18, basement: 4, use: '오피스/보험', occupancy: 95, tenants: 15, parking: '지하 200대' },

  // === 봉은사역/삼성역 동쪽 ===
  { name: '코엑스몰', address: '서울 강남구 영동대로 513', lat: 37.51190, lng: 127.05905, floors: 4, basement: 3, use: '상업/전시', occupancy: 93, tenants: 300, parking: '지하 4000대' },
  { name: '코엑스 컨벤션센터', address: '서울 강남구 영동대로 513', lat: 37.51275, lng: 127.05780, floors: 4, basement: 2, use: '전시/컨벤션', occupancy: 80, tenants: 10, parking: '공유' },
  { name: '도심공항터미널', address: '서울 강남구 테헤란로 526', lat: 37.50880, lng: 127.06183, floors: 6, basement: 2, use: '교통/항공', occupancy: 90, tenants: 20, parking: '지하 100대' },
  { name: '한국전력 강남지사', address: '서울 강남구 테헤란로 302', lat: 37.50428, lng: 127.04767, floors: 8, basement: 2, use: '공공/전력', occupancy: 100, tenants: 1, parking: '지하 80대' },

  // === 학동역/언주역 방면 ===
  { name: '지멘스타워', address: '서울 강남구 논현로 508', lat: 37.50925, lng: 127.03520, floors: 15, basement: 3, use: '오피스/IT', occupancy: 92, tenants: 12, parking: '지하 150대' },
  { name: '어반하이브', address: '서울 강남구 논현로 838', lat: 37.51568, lng: 127.03865, floors: 5, basement: 1, use: '상업/복합문화', occupancy: 88, tenants: 25, parking: '없음' },
];

// 업종별 기본 테넌트 템플릿
const TENANT_TEMPLATES = {
  '오피스': ['로비', '기업 사무실', '회의실', '스카이라운지'],
  '상업': ['편의점', '카페', '음식점', '약국'],
  '호텔': ['로비 라운지', '레스토랑', '바', '피트니스센터', '비즈니스센터'],
  '코워킹스페이스': ['오픈 데스크', '전용 오피스', '회의실', '라운지'],
  '백화점': ['명품관', '패션', '식품관', '문화센터'],
};

// 편의시설 템플릿
const FACILITY_TEMPLATES = [
  { type: '주차장', info: '지하', status: '입차 가능' },
  { type: '와이파이', info: '전 층', status: '무료' },
  { type: '냉난방', info: '전 층', status: '중앙 공급' },
];

// 라이브피드 템플릿
const FEED_TEMPLATES = [
  { type: 'congestion', title: '현재 혼잡도', desc: '보통 수준입니다', icon: '👥', color: '#F59E0B', time: '현재' },
  { type: 'event', title: '주변 이벤트', desc: '특별 이벤트 진행중', icon: '🎉', color: '#3B82F6', time: '오늘' },
  { type: 'promotion', title: '프로모션', desc: '입점 매장 할인 진행', icon: '🏷️', color: '#10B981', time: '이번주' },
];

async function seed() {
  console.log('[시드 003] 강남 확장 건물 데이터 시딩 시작...');

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
    let insertedCount = 0;

    for (const b of BUILDINGS) {
      // 건물 UPSERT
      const buildingResult = await pool.query(`
        INSERT INTO buildings (name, address, location, total_floors, basement_floors, building_use, occupancy_rate, total_tenants, operating_tenants, parking_info)
        VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (name, address) DO NOTHING
        RETURNING id
      `, [
        b.name, b.address, b.lng, b.lat,
        b.floors, b.basement, b.use,
        b.occupancy, b.tenants, Math.round(b.tenants * b.occupancy / 100),
        b.parking,
      ]);

      if (buildingResult.rows.length === 0) {
        // 이미 존재 - ID 조회
        const existing = await pool.query(
          `SELECT id FROM buildings WHERE name = $1 AND address = $2`,
          [b.name, b.address]
        );
        if (existing.rows.length === 0) continue;
        continue; // 이미 시드된 건물은 스킵
      }

      const buildingId = buildingResult.rows[0].id;
      insertedCount++;

      // 층별 정보 생성
      const floors = [];
      for (let f = -b.basement; f <= b.floors; f++) {
        if (f === 0) continue;
        const floorNum = f < 0 ? `B${Math.abs(f)}` : f === b.floors ? 'RF' : `${f}F`;
        const order = f < 0 ? f : f;

        let tenantName, tenantCategory, tenantIcon;
        const mainUse = b.use.split('/')[0];
        const templates = TENANT_TEMPLATES[mainUse] || TENANT_TEMPLATES['오피스'];

        if (f < 0) {
          tenantName = '주차장';
          tenantCategory = '주차';
          tenantIcon = 'car';
        } else if (f === 1) {
          tenantName = '로비 / 편의시설';
          tenantCategory = '로비';
          tenantIcon = 'building';
        } else if (f === b.floors) {
          tenantName = '옥상';
          tenantCategory = '기타';
          tenantIcon = 'sun';
        } else {
          tenantName = templates[Math.floor(Math.random() * templates.length)];
          tenantCategory = mainUse;
          tenantIcon = 'briefcase';
        }

        floors.push([buildingId, floorNum, order, tenantName, tenantCategory, tenantIcon, false, false, 0]);
      }

      // 층 데이터 배치 INSERT
      for (const fl of floors) {
        await pool.query(`
          INSERT INTO floors (building_id, floor_number, floor_order, tenant_name, tenant_category, tenant_icon, is_vacant, has_reward, reward_points)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING
        `, fl);
      }

      // 편의시설 추가
      for (const fac of FACILITY_TEMPLATES) {
        await pool.query(`
          INSERT INTO facilities (building_id, facility_type, location_info, is_available, status_text)
          VALUES ($1, $2, $3, TRUE, $4)
        `, [buildingId, fac.type, fac.info, fac.status]);
      }

      // 통계 추가
      const stats = [
        ['total_floors', `${b.floors}층`, '🏢', 1],
        ['basement', `지하 ${b.basement}층`, '⬇️', 2],
        ['occupancy', `${b.occupancy}%`, '📊', 3],
        ['tenants', `${b.tenants}개`, '🏪', 4],
      ];
      for (const [type, value, icon, order] of stats) {
        await pool.query(`
          INSERT INTO building_stats (building_id, stat_type, stat_value, stat_icon, display_order)
          VALUES ($1, $2, $3, $4, $5)
        `, [buildingId, type, value, icon, order]);
      }

      // 라이브피드 추가
      for (const feed of FEED_TEMPLATES) {
        await pool.query(`
          INSERT INTO live_feeds (building_id, feed_type, title, description, icon, icon_color, time_label, is_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        `, [buildingId, feed.type, feed.title, feed.desc, feed.icon, feed.color, feed.time]);
      }
    }

    // 최종 건물 수 확인
    const total = await pool.query('SELECT COUNT(*) as cnt FROM buildings');
    console.log(`[시드 003] 완료! 새로 추가: ${insertedCount}개, 전체 건물: ${total.rows[0].cnt}개`);

  } catch (err) {
    console.error('[시드 003] 에러:', err.message);
    throw err;
  } finally {
    await pool.end();
  }
}

module.exports = seed;

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
