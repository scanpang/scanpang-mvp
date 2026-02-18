/**
 * 건물 조회 API 테스트
 */
const request = require('supertest');
const express = require('express');

// DB mock
jest.mock('../../src/db');

const buildingsRouter = require('../../src/routes/buildings');

// 테스트용 Express 앱 설정
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/buildings', buildingsRouter);
  app.use((err, req, res, _next) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

describe('GET /api/buildings/nearby', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('lat, lng 없으면 400 반환', async () => {
    const res = await request(app).get('/api/buildings/nearby');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/lat, lng/);
  });

  it('lat만 있고 lng 없으면 400 반환', async () => {
    const res = await request(app).get('/api/buildings/nearby?lat=37.5');
    expect(res.status).toBe(400);
  });

  it('유효하지 않은 좌표값이면 400 반환', async () => {
    const res = await request(app).get('/api/buildings/nearby?lat=999&lng=999');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/유효하지 않은 좌표/);
  });

  it('문자열 좌표값이면 400 반환', async () => {
    const res = await request(app).get('/api/buildings/nearby?lat=abc&lng=def');
    expect(res.status).toBe(400);
  });

  it('정상 요청 시 건물 목록 반환', async () => {
    const db = require('../../src/db');
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1,
          name: '역삼 스퀘어',
          address: '서울 강남구 역삼동',
          total_floors: 12,
          basement_floors: 2,
          building_use: '오피스',
          occupancy_rate: '87.50',
          total_tenants: 24,
          operating_tenants: 18,
          parking_info: '지하 1~2층',
          completion_year: 2001,
          thumbnail_url: null,
          lng: '127.0368',
          lat: '37.5012',
          distance_meters: '120.5',
          bearing: '45.3',
        },
      ],
    });

    const res = await request(app)
      .get('/api/buildings/nearby?lat=37.5012&lng=127.0368&radius=300');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('역삼 스퀘어');
    expect(res.body.data[0].distanceMeters).toBe(121);
    expect(res.body.meta.count).toBe(1);
    expect(res.body.meta.radius).toBe(300);
  });

  it('결과 없을 때 빈 배열 반환', async () => {
    const db = require('../../src/db');
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/buildings/nearby?lat=37.5012&lng=127.0368');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.count).toBe(0);
  });
});

describe('GET /api/buildings/:id/profile', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('유효하지 않은 ID이면 400 반환', async () => {
    const res = await request(app).get('/api/buildings/abc/profile');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/유효하지 않은 건물 ID/);
  });

  it('존재하지 않는 건물이면 404 반환', async () => {
    const db = require('../../src/db');
    // getProfile은 5개의 병렬 쿼리를 실행함
    db.query
      .mockResolvedValueOnce({ rows: [] })       // building
      .mockResolvedValueOnce({ rows: [] })       // floors
      .mockResolvedValueOnce({ rows: [] })       // facilities
      .mockResolvedValueOnce({ rows: [] })       // stats
      .mockResolvedValueOnce({ rows: [] });      // liveFeeds

    const res = await request(app).get('/api/buildings/9999/profile');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/건물을 찾을 수 없습니다/);
  });

  it('정상 요청 시 프로필 반환', async () => {
    const db = require('../../src/db');
    db.query
      .mockResolvedValueOnce({
        rows: [{
          id: 1, name: '역삼 스퀘어', address: '서울 강남구',
          lng: '127.036', lat: '37.501', total_floors: 12,
          basement_floors: 2, building_use: '오피스',
          occupancy_rate: '87.50', total_tenants: 24,
          operating_tenants: 18, parking_info: '지하 1~2층',
          completion_year: 2001, thumbnail_url: null,
          created_at: new Date(), updated_at: new Date(),
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 1, floor_number: '1F', floor_order: 1,
          tenant_name: '편의점', tenant_category: '편의시설',
          tenant_icon: 'store', is_vacant: false,
          has_reward: true, reward_points: 50,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 1, facility_type: 'ATM', location_info: '1F 로비',
          is_available: true, status_text: '24시간',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 1, stat_type: 'total_floors', stat_value: '12층',
          stat_icon: 'building', display_order: 1,
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 1, feed_type: 'promotion', title: '카페 할인',
          description: '아메리카노 20% 할인', icon: 'fire',
          icon_color: '#FF0000', time_label: '방금',
          created_at: new Date(),
        }],
      });

    const res = await request(app).get('/api/buildings/1/profile');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('역삼 스퀘어');
    expect(res.body.data.floors).toHaveLength(1);
    expect(res.body.data.facilities).toHaveLength(1);
    expect(res.body.data.stats).toHaveLength(1);
    expect(res.body.data.liveFeeds).toHaveLength(1);
  });
});

describe('GET /api/buildings/:id/floors', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('유효하지 않은 ID이면 400 반환', async () => {
    const res = await request(app).get('/api/buildings/abc/floors');
    expect(res.status).toBe(400);
  });

  it('정상 요청 시 층별 정보 반환', async () => {
    const db = require('../../src/db');
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 1, floor_number: '2F', floor_order: 2, tenant_name: '카페', tenant_category: '음식', tenant_icon: 'cafe', is_vacant: false, has_reward: false, reward_points: 0 },
        { id: 2, floor_number: '1F', floor_order: 1, tenant_name: '편의점', tenant_category: '편의시설', tenant_icon: 'store', is_vacant: false, has_reward: true, reward_points: 50 },
      ],
    });

    const res = await request(app).get('/api/buildings/1/floors');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.buildingId).toBe(1);
    expect(res.body.meta.count).toBe(2);
  });
});
