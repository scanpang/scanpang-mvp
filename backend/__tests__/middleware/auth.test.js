/**
 * API 키 인증 미들웨어 테스트
 */
const request = require('supertest');
const express = require('express');

describe('apiKeyAuth 미들웨어', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // 각 테스트마다 모듈 캐시 초기화
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createApp(env = {}) {
    Object.assign(process.env, env);
    const { apiKeyAuth } = require('../../src/middleware/auth');

    const app = express();
    app.use('/test', apiKeyAuth, (req, res) => {
      res.json({ success: true });
    });
    return app;
  }

  it('development 환경에서는 인증 건너뜀', async () => {
    const app = createApp({ NODE_ENV: 'development' });
    const res = await request(app).get('/test');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('production에서 API 키 없으면 401 반환', async () => {
    const app = createApp({ NODE_ENV: 'production' });
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/API 키가 필요합니다/);
  });

  it('잘못된 API 키이면 403 반환', async () => {
    const app = createApp({ NODE_ENV: 'production' });
    const res = await request(app)
      .get('/test')
      .set('x-api-key', 'wrong-key');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/유효하지 않은 API 키/);
  });

  it('올바른 API 키(헤더)이면 통과', async () => {
    const app = createApp({ NODE_ENV: 'production', API_KEY: 'my-secret' });
    const res = await request(app)
      .get('/test')
      .set('x-api-key', 'my-secret');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('올바른 API 키(쿼리)이면 통과', async () => {
    const app = createApp({ NODE_ENV: 'production', API_KEY: 'my-secret' });
    const res = await request(app)
      .get('/test?api_key=my-secret');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('기본 API 키 사용 (환경변수 미설정 시)', async () => {
    const app = createApp({ NODE_ENV: 'production' });
    const res = await request(app)
      .get('/test')
      .set('x-api-key', 'scanpang-dev-key-2024');
    expect(res.status).toBe(200);
  });
});
