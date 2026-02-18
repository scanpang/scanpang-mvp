/**
 * 행동 로그 API 테스트
 */
const request = require('supertest');
const express = require('express');

jest.mock('../../src/db');

const scanRouter = require('../../src/routes/scan');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/scan', scanRouter);
  app.use((err, req, res, _next) => {
    res.status(500).json({ success: false, error: err.message });
  });
  return app;
}

describe('POST /api/scan/log', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it('sessionId 없으면 400 반환', async () => {
    const res = await request(app)
      .post('/api/scan/log')
      .send({ eventType: 'pin_shown' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sessionId/);
  });

  it('eventType 없으면 400 반환', async () => {
    const res = await request(app)
      .post('/api/scan/log')
      .send({ sessionId: 'test-session' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/sessionId.*eventType|eventType/);
  });

  it('유효하지 않은 eventType이면 400 반환', async () => {
    const res = await request(app)
      .post('/api/scan/log')
      .send({ sessionId: 'test-session', eventType: 'invalid_event' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/유효하지 않은 eventType/);
  });

  it('정상 요청 시 201 반환', async () => {
    const db = require('../../src/db');
    const now = new Date();
    db.query.mockResolvedValueOnce({
      rows: [{ id: 1, created_at: now }],
    });

    const res = await request(app)
      .post('/api/scan/log')
      .send({
        sessionId: 'test-session-123',
        buildingId: 1,
        eventType: 'pin_shown',
        durationMs: 5000,
        distanceMeters: 120.5,
        userLat: 37.5012,
        userLng: 127.0368,
        deviceHeading: 45.3,
        metadata: { screen: 'scan' },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(1);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('모든 유효한 eventType 허용', async () => {
    const db = require('../../src/db');
    const validTypes = [
      'pin_shown', 'pin_tapped', 'card_viewed', 'floor_tapped',
      'reward_tapped', 'profile_opened', 'live_viewed', 'facility_tapped',
    ];

    for (const eventType of validTypes) {
      db.query.mockResolvedValueOnce({
        rows: [{ id: 1, created_at: new Date() }],
      });

      const res = await request(app)
        .post('/api/scan/log')
        .send({ sessionId: 'test', eventType });

      expect(res.status).toBe(201);
    }
  });
});
