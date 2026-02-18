/**
 * 행동 로그 API 라우터
 * - POST /log : 스캔/탭/조회 등 사용자 행동 로그 저장
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// 허용되는 이벤트 타입 목록
const VALID_EVENT_TYPES = [
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
 * 행동 로그 저장
 *
 * Body (JSON):
 *   sessionId      - 세션 ID (필수)
 *   buildingId     - 건물 ID (선택)
 *   eventType      - 이벤트 타입 (필수, VALID_EVENT_TYPES 중 하나)
 *   durationMs     - 체류 시간 ms (선택)
 *   distanceMeters - 건물까지 거리 m (선택)
 *   userLat        - 사용자 위도 (선택)
 *   userLng        - 사용자 경도 (선택)
 *   deviceHeading  - 디바이스 방향 (선택)
 *   metadata       - 추가 메타데이터 JSON (선택)
 */
router.post('/log', async (req, res, next) => {
  try {
    const {
      sessionId,
      buildingId,
      eventType,
      durationMs,
      distanceMeters,
      userLat,
      userLng,
      deviceHeading,
      metadata,
    } = req.body;

    // 필수 파라미터 검증
    if (!sessionId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'sessionId와 eventType은 필수입니다.',
      });
    }

    // 이벤트 타입 유효성 검증
    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `유효하지 않은 eventType입니다. 허용: ${VALID_EVENT_TYPES.join(', ')}`,
      });
    }

    // DB에 로그 삽입
    const result = await db.query(
      `INSERT INTO scan_logs
        (session_id, building_id, event_type, duration_ms, distance_meters,
         user_lat, user_lng, device_heading, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, created_at`,
      [
        sessionId,
        buildingId || null,
        eventType,
        durationMs || null,
        distanceMeters || null,
        userLat || null,
        userLng || null,
        deviceHeading || null,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );

    const log = result.rows[0];

    res.status(201).json({
      success: true,
      data: {
        id: log.id,
        createdAt: log.created_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
