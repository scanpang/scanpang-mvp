/**
 * ScanPang MVP - Express 앱 엔트리
 * AR 기반 건물 정보 서비스 백엔드
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// 라우터 임포트
const buildingsRouter = require('./routes/buildings');
const scanRouter = require('./routes/scan');
const timeRouter = require('./routes/time');
const geminiRouter = require('./routes/gemini');

// 미들웨어 임포트
const { apiKeyAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== 기본 미들웨어 =====

// 보안 헤더 설정
app.use(helmet());

// CORS 설정 (모바일 앱 + 개발용)
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key'],
}));

// JSON 바디 파싱 (10MB 제한)
app.use(express.json({ limit: '10mb' }));

// 요청 로깅 (개발 환경)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });
}

// ===== 헬스체크 (인증 불필요) =====
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'scanpang-backend',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
  });
});

// ===== API 라우터 마운트 =====
// API 키 인증 미들웨어 적용
app.use('/api/buildings', apiKeyAuth, buildingsRouter);
app.use('/api/scan', apiKeyAuth, scanRouter);
app.use('/api/time', apiKeyAuth, timeRouter);
app.use('/api/gemini', apiKeyAuth, geminiRouter);

// ===== 404 핸들러 =====
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `${req.method} ${req.url} 경로를 찾을 수 없습니다.`,
  });
});

// ===== 글로벌 에러 핸들러 =====
app.use((err, req, res, _next) => {
  console.error('[에러]', {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
  });

  // 기본 에러 응답
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : '서버 내부 오류가 발생했습니다.',
  });
});

// ===== 서버 시작 (Vercel 환경에서는 listen하지 않음) =====
if (!process.env.VERCEL) {
  const server = app.listen(PORT, async () => {
    console.log('========================================');
    console.log('  ScanPang Backend v0.1.0');
    console.log(`  환경: ${process.env.NODE_ENV || 'production'}`);
    console.log(`  포트: ${PORT}`);
    console.log('========================================');

    console.log('  DB: 없음 (Stateless 모드)');
  });

  const gracefulShutdown = (signal) => {
    console.log(`[${signal}] Graceful shutdown 시작...`);
    server.close(() => {
      console.log('[Server] HTTP 서버 종료 완료');
      process.exit(0);
    });
    setTimeout(() => { process.exit(1); }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
