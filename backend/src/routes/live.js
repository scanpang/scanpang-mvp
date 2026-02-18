/**
 * LIVE 피드 API 라우터
 * - GET /:buildingId : 건물별 LIVE 피드 조회
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/live/:buildingId
 * 건물별 LIVE 피드 조회
 *
 * Query params:
 *   limit  - 조회 개수 (선택, 기본 10, 최대 50)
 *   type   - 피드 타입 필터 (선택, 'event'|'congestion'|'promotion'|'update')
 */
router.get('/:buildingId', async (req, res, next) => {
  try {
    const buildingId = parseInt(req.params.buildingId, 10);

    if (isNaN(buildingId)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 건물 ID입니다.',
      });
    }

    // 쿼리 파라미터 파싱
    let limit = parseInt(req.query.limit, 10) || 10;
    limit = Math.min(Math.max(limit, 1), 50); // 1~50 범위로 제한
    const feedType = req.query.type || null;

    // 허용되는 피드 타입 검증
    const validTypes = ['event', 'congestion', 'promotion', 'update'];
    if (feedType && !validTypes.includes(feedType)) {
      return res.status(400).json({
        success: false,
        error: `유효하지 않은 type입니다. 허용: ${validTypes.join(', ')}`,
      });
    }

    // 피드 조회 쿼리 (타입 필터 선택 적용)
    let queryText;
    let queryParams;

    if (feedType) {
      queryText = `
        SELECT
          id, feed_type, title, description,
          icon, icon_color, time_label, is_active, created_at
        FROM live_feeds
        WHERE building_id = $1 AND is_active = true AND feed_type = $2
        ORDER BY created_at DESC
        LIMIT $3
      `;
      queryParams = [buildingId, feedType, limit];
    } else {
      queryText = `
        SELECT
          id, feed_type, title, description,
          icon, icon_color, time_label, is_active, created_at
        FROM live_feeds
        WHERE building_id = $1 AND is_active = true
        ORDER BY created_at DESC
        LIMIT $2
      `;
      queryParams = [buildingId, limit];
    }

    const result = await db.query(queryText, queryParams);

    // 응답 형식 변환
    const feeds = result.rows.map((f) => ({
      id: f.id,
      feedType: f.feed_type,
      title: f.title,
      description: f.description,
      icon: f.icon,
      iconColor: f.icon_color,
      timeLabel: f.time_label,
      createdAt: f.created_at,
    }));

    res.json({
      success: true,
      data: feeds,
      meta: {
        buildingId,
        count: feeds.length,
        limit,
        type: feedType,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
