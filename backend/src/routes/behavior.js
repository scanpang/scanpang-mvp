/**
 * Behavior Data API
 * - 행동 이벤트 기록 (단일/배치)
 * - 세션 관리 (시작/종료)
 * - 건물별/지역별 행동 리포트
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * GET /api/behavior/report/:buildingId — 건물별 행동 리포트
 */
router.get('/report/:buildingId', async (req, res, next) => {
  try {
    const buildingId = parseInt(req.params.buildingId, 10);
    if (isNaN(buildingId)) {
      return res.status(400).json({ success: false, error: '유효한 buildingId가 필요합니다.' });
    }

    // 기본 통계
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_events,
        COUNT(DISTINCT session_id) as unique_sessions,
        COUNT(CASE WHEN event_type = 'gaze_start' THEN 1 END) as gaze_count,
        COALESCE(AVG(CASE WHEN event_type = 'gaze_end' THEN duration_ms END), 0) as avg_gaze_duration_ms,
        COUNT(CASE WHEN event_type = 'pin_click' THEN 1 END) as pin_clicks,
        COUNT(CASE WHEN event_type = 'card_open' THEN 1 END) as card_opens,
        COUNT(CASE WHEN event_type = 'entered_building' THEN 1 END) as entries,
        COUNT(CASE WHEN event_type = 'passed_by' THEN 1 END) as pass_bys
      FROM behavior_events
      WHERE building_id = $1
    `, [buildingId]);

    // 시간대별 관심도 (24시간)
    const hourly = await db.query(`
      SELECT
        EXTRACT(HOUR FROM server_timestamp) as hour,
        COUNT(*) as event_count
      FROM behavior_events
      WHERE building_id = $1
      GROUP BY EXTRACT(HOUR FROM server_timestamp)
      ORDER BY hour
    `, [buildingId]);

    // 최근 7일 트렌드
    const daily = await db.query(`
      SELECT
        DATE(server_timestamp) as date,
        COUNT(*) as event_count,
        COUNT(DISTINCT session_id) as unique_sessions
      FROM behavior_events
      WHERE building_id = $1 AND server_timestamp > NOW() - INTERVAL '7 days'
      GROUP BY DATE(server_timestamp)
      ORDER BY date
    `, [buildingId]);

    const s = stats.rows[0];
    // 전환율 계산
    const conversionRate = s.gaze_count > 0
      ? ((parseInt(s.entries) / parseInt(s.gaze_count)) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        buildingId,
        summary: {
          totalEvents: parseInt(s.total_events),
          uniqueSessions: parseInt(s.unique_sessions),
          gazeCount: parseInt(s.gaze_count),
          avgGazeDurationMs: Math.round(parseFloat(s.avg_gaze_duration_ms)),
          pinClicks: parseInt(s.pin_clicks),
          cardOpens: parseInt(s.card_opens),
          entries: parseInt(s.entries),
          passBys: parseInt(s.pass_bys),
          conversionRate: parseFloat(conversionRate),
        },
        hourlyDistribution: hourly.rows.map(r => ({
          hour: parseInt(r.hour),
          count: parseInt(r.event_count),
        })),
        dailyTrend: daily.rows.map(r => ({
          date: r.date,
          events: parseInt(r.event_count),
          sessions: parseInt(r.unique_sessions),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
