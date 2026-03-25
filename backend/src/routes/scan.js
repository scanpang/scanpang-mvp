/**
 * 행동 로그 API 라우터 (DB 제거 — console.log만)
 * - POST /log : 행동 로그를 콘솔에 기록
 */
const express = require('express');
const router = express.Router();

// 허용되는 이벤트 타입 목록
const VALID_EVENT_TYPES = [
  'detail_tap',      // 건물상세보기 탭
  'pin_shown',       // AR 핀이 화면에 표시됨
  'pin_tapped',      // AR 핀을 탭함
  'card_viewed',     // 건물 카드 조회
  'floor_tapped',    // 층별 정보 탭
  'reward_tapped',   // 리워드 탭
  'profile_opened',  // 프로필 전체 열림
  'live_viewed',     // LIVE 피드 조회
  'facility_tapped', // 편의시설 탭
];

/**
 * POST /api/scan/log
 * 행동 로그 저장 (콘솔 출력만)
 */
router.post('/log', async (req, res, next) => {
  try {
    const { sessionId, eventType } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'sessionId와 eventType은 필수입니다.',
      });
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `유효하지 않은 eventType입니다. 허용: ${VALID_EVENT_TYPES.join(', ')}`,
      });
    }

    // 콘솔 로그만 남김
    console.log(`[scan/log] ${eventType} | session=${sessionId}`);

    res.status(201).json({
      success: true,
      data: {
        id: Date.now(),
        createdAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
