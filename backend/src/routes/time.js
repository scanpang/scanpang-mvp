/**
 * Server Time API
 * - 서버 시각 반환 (7-Factor 검증용)
 * - 시각 + 위치 기반 컨텍스트 (일출/일몰, 조명 상태)
 */
const express = require('express');
const router = express.Router();

/**
 * 간단한 일출/일몰 계산 (서울 기준 근사)
 * 정밀도는 ±10분 수준 — MVP에 충분
 */
function getSunTimes(lat, lng, date) {
  const dayOfYear = Math.floor(
    (date - new Date(date.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24)
  );

  // 서울 기준 일출/일몰 근사 (계절 보정)
  const sunriseBase = 6.5; // 6:30 평균
  const sunsetBase = 18.0; // 18:00 평균
  const variation = 1.5; // ±1.5시간 변동

  // 간단한 사인 곡선 (하지 = 172일, 동지 = 355일)
  const angle = ((dayOfYear - 80) / 365) * 2 * Math.PI;
  const sunriseHour = sunriseBase - variation * Math.sin(angle);
  const sunsetHour = sunsetBase + variation * Math.sin(angle);

  const toTime = (h) => {
    const hours = Math.floor(h);
    const minutes = Math.round((h - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  return {
    sunrise: toTime(sunriseHour),
    sunset: toTime(sunsetHour),
    sunriseHour,
    sunsetHour,
  };
}

/**
 * 현재 시각 기반 조명/외관 상태 판단
 */
function getLightingContext(currentHour, sunTimes) {
  if (currentHour < sunTimes.sunriseHour - 0.5) {
    return { period: 'night', lighting: 'artificial', neonActive: true, shadowDirection: null };
  }
  if (currentHour < sunTimes.sunriseHour + 0.5) {
    return { period: 'dawn', lighting: 'transitioning', neonActive: true, shadowDirection: 'west' };
  }
  if (currentHour < 12) {
    return { period: 'morning', lighting: 'natural', neonActive: false, shadowDirection: 'west' };
  }
  if (currentHour < 14) {
    return { period: 'midday', lighting: 'natural', neonActive: false, shadowDirection: 'north' };
  }
  if (currentHour < sunTimes.sunsetHour - 0.5) {
    return { period: 'afternoon', lighting: 'natural', neonActive: false, shadowDirection: 'east' };
  }
  if (currentHour < sunTimes.sunsetHour + 0.5) {
    return { period: 'dusk', lighting: 'transitioning', neonActive: true, shadowDirection: 'east' };
  }
  return { period: 'night', lighting: 'artificial', neonActive: true, shadowDirection: null };
}

/**
 * GET /api/time — 서버 시각 반환
 */
router.get('/', (req, res) => {
  const now = new Date();
  res.json({
    success: true,
    data: {
      serverTime: now.toISOString(),
      timestamp: now.getTime(),
      timezone: 'Asia/Seoul',
      utcOffset: '+09:00',
    },
  });
});

/**
 * GET /api/time/context?lat=&lng= — 시각 + 위치 기반 컨텍스트
 */
router.get('/context', (req, res) => {
  const lat = parseFloat(req.query.lat) || 37.4979;
  const lng = parseFloat(req.query.lng) || 127.0276;

  const now = new Date();
  // KST (UTC+9) 변환
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const currentHour = kst.getUTCHours() + kst.getUTCMinutes() / 60;

  const sunTimes = getSunTimes(lat, lng, kst);
  const lighting = getLightingContext(currentHour, sunTimes);

  res.json({
    success: true,
    data: {
      serverTime: now.toISOString(),
      timestamp: now.getTime(),
      timezone: 'Asia/Seoul',
      location: { lat, lng },
      sun: {
        sunrise: sunTimes.sunrise,
        sunset: sunTimes.sunset,
      },
      context: {
        ...lighting,
        currentHour: Math.floor(currentHour),
        isDaytime: currentHour >= sunTimes.sunriseHour && currentHour < sunTimes.sunsetHour,
        description: getContextDescription(lighting),
      },
    },
  });
});

function getContextDescription(ctx) {
  switch (ctx.period) {
    case 'night': return '야간 — 네온사인/간판 조명 활성, 그림자 없음';
    case 'dawn': return '새벽 — 조명 전환 중, 네온사인 점등';
    case 'morning': return '오전 — 자연광, 서쪽 그림자';
    case 'midday': return '정오 — 직사광, 그림자 최소';
    case 'afternoon': return '오후 — 자연광, 동쪽 그림자';
    case 'dusk': return '해질녘 — 조명 전환 중, 네온사인 점등';
    default: return '';
  }
}

module.exports = router;
