/**
 * LIVE 피드 API 테스트
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../src/db');

const liveRouter = require('../../src/routes/live');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/live', liveRouter);
  app.use((err, req, res, _next) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

describe('GET /api/live/:buildingId', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('유효하지 않은 건물 ID이면 400 반환', async () => {
    const res = await request(app).get('/api/live/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/유효하지 않은 건물 ID/);
  });

  it('유효하지 않은 type이면 400 반환', async () => {
    const res = await request(app).get('/api/live/1?type=invalid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/유효하지 않은 type/);
  });

  it('정상 요청 시 피드 목록 반환', async () => {
    const db = require('../../src/db');
    db.query.mockResolvedValueOnce({
      rows: [
        {
          id: 1, feed_type: 'promotion', title: '카페 할인',
          description: '아메리카노 20%', icon: 'fire',
          icon_color: '#FF0000', time_label: '방금',
          is_active: true, created_at: new Date(),
        },
        {
          id: 2, feed_type: 'congestion', title: '식당가 혼잡',
          description: '대기 15분', icon: 'clock',
          icon_color: '#FFA500', time_label: '현재',
          is_active: true, created_at: new Date(),
        },
      ],
    });

    const res = await request(app).get('/api/live/1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].feedType).toBe('promotion');
    expect(res.body.meta.buildingId).toBe(1);
    expect(res.body.meta.count).toBe(2);
  });

  it('type 필터 적용 시 해당 쿼리 실행', async () => {
    const db = require('../../src/db');
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/live/1?type=promotion');

    expect(res.status).toBe(200);
    expect(res.body.meta.type).toBe('promotion');
    // type 필터 쿼리는 3개 파라미터 (buildingId, feedType, limit)
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('feed_type = $2'),
      [1, 'promotion', 10],
    );
  });

  it('limit 파라미터 적용', async () => {
    const db = require('../../src/db');
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/live/1?limit=5');

    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(5);
  });

  it('limit 최대 50으로 제한', async () => {
    const db = require('../../src/db');
    db.query.mockResolvedValueOnce({ rows: [] });

    await request(app).get('/api/live/1?limit=100');

    // 두 번째 파라미터가 50으로 제한됨
    expect(db.query).toHaveBeenCalledWith(
      expect.any(String),
      [1, 50],
    );
  });
});
