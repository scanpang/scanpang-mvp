/**
 * Behavior Data API
 * - 행동 이벤트 기록 (단일/배치)
 * - 세션 관리 (시작/종료)
 * - 건물별/지역별 행동 리포트
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

// 유효한 이벤트 타입
const VALID_EVENT_TYPES = [
  'gaze_start', 'gaze_end', 'pin_click', 'card_open', 'card_close',
  'zoom_in', 'photo_taken', 'ar_interaction', 'entered_building', 'passed_by',
];

/**
 * POST /api/behavior/event — 단일 행동 이벤트 기록
 */
router.post('/event', async (req, res, next) => {
  try {
    const {
      sessionId, userId, buildingId, eventType, durationMs,
      gpsLat, gpsLng, gpsAccuracy, compassHeading,
      gyroscope, accelerometer, cameraAngle,
      clientTimestamp, deviceInfo, weather, metadata,
    } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'sessionId와 eventType은 필수입니다.',
      });
    }

    if (!VALID_EVENT_TYPES.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: `유효하지 않은 eventType: ${eventType}`,
      });
    }

    const result = await db.query(`
      INSERT INTO behavior_events (
        session_id, user_id, building_id, event_type, duration_ms,
        gps_lat, gps_lng, gps_accuracy, compass_heading,
        gyroscope, accelerometer, camera_angle,
        server_timestamp, client_timestamp,
        device_info, weather, metadata
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,$14,$15,$16)
      RETURNING id, server_timestamp
    `, [
      sessionId, userId || null, buildingId || null, eventType, durationMs || null,
      gpsLat || null, gpsLng || null, gpsAccuracy || null, compassHeading || null,
      gyroscope ? JSON.stringify(gyroscope) : null,
      accelerometer ? JSON.stringify(accelerometer) : null,
      cameraAngle ? JSON.stringify(cameraAngle) : null,
      clientTimestamp || null,
      deviceInfo ? JSON.stringify(deviceInfo) : null,
      weather ? JSON.stringify(weather) : null,
      metadata ? JSON.stringify(metadata) : null,
    ]);

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        serverTimestamp: result.rows[0].server_timestamp,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/behavior/batch — 배치 이벤트 기록 (오프라인 버퍼)
 */
router.post('/batch', async (req, res, next) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'events 배열이 필요합니다.',
      });
    }

    if (events.length > 100) {
      return res.status(400).json({
        success: false,
        error: '최대 100개까지 배치 전송 가능합니다.',
      });
    }

    let successCount = 0;
    const errors = [];

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (!e.sessionId || !e.eventType || !VALID_EVENT_TYPES.includes(e.eventType)) {
        errors.push({ index: i, error: 'sessionId/eventType 누락 또는 유효하지 않음' });
        continue;
      }

      try {
        await db.query(`
          INSERT INTO behavior_events (
            session_id, user_id, building_id, event_type, duration_ms,
            gps_lat, gps_lng, gps_accuracy, compass_heading,
            gyroscope, accelerometer, camera_angle,
            server_timestamp, client_timestamp, device_info, weather, metadata
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,$14,$15,$16)
        `, [
          e.sessionId, e.userId || null, e.buildingId || null, e.eventType, e.durationMs || null,
          e.gpsLat || null, e.gpsLng || null, e.gpsAccuracy || null, e.compassHeading || null,
          e.gyroscope ? JSON.stringify(e.gyroscope) : null,
          e.accelerometer ? JSON.stringify(e.accelerometer) : null,
          e.cameraAngle ? JSON.stringify(e.cameraAngle) : null,
          e.clientTimestamp || null,
          e.deviceInfo ? JSON.stringify(e.deviceInfo) : null,
          e.weather ? JSON.stringify(e.weather) : null,
          e.metadata ? JSON.stringify(e.metadata) : null,
        ]);
        successCount++;
      } catch (err) {
        errors.push({ index: i, error: err.message });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        total: events.length,
        succeeded: successCount,
        failed: errors.length,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/behavior/session/start — 세션 시작
 */
router.post('/session/start', async (req, res, next) => {
  try {
    const { userId, startLat, startLng, deviceInfo } = req.body;

    const result = await db.query(`
      INSERT INTO user_sessions (user_id, start_lat, start_lng, device_info)
      VALUES ($1, $2, $3, $4)
      RETURNING id, started_at
    `, [
      userId || null,
      startLat || null,
      startLng || null,
      deviceInfo ? JSON.stringify(deviceInfo) : null,
    ]);

    res.status(201).json({
      success: true,
      data: {
        sessionId: result.rows[0].id,
        startedAt: result.rows[0].started_at,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/behavior/session/:id/end — 세션 종료 + 시선경로 저장
 */
router.patch('/session/:id/end', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { gazePath, buildingsViewed, buildingsEntered, totalGazeDurationMs } = req.body;

    const result = await db.query(`
      UPDATE user_sessions SET
        ended_at = NOW(),
        gaze_path = $1,
        buildings_viewed = $2,
        buildings_entered = $3,
        total_gaze_duration_ms = $4
      WHERE id = $5
      RETURNING id, ended_at, buildings_viewed, total_gaze_duration_ms
    `, [
      gazePath ? JSON.stringify(gazePath) : null,
      buildingsViewed || 0,
      buildingsEntered || 0,
      totalGazeDurationMs || 0,
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '세션을 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

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

/**
 * GET /api/behavior/report/area?lat=&lng=&radius= — 지역별 행동 리포트
 */
router.get('/report/area', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = Math.min(parseInt(req.query.radius, 10) || 500, 5000); // 최대 5km

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, error: 'lat, lng 파라미터가 필요합니다.' });
    }

    // 반경 내 건물들의 행동 데이터 집계
    const result = await db.query(`
      SELECT
        b.id as building_id,
        b.name as building_name,
        ST_Distance(b.location::geography, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography) as distance,
        COUNT(be.id) as total_events,
        COUNT(DISTINCT be.session_id) as unique_sessions,
        COALESCE(AVG(CASE WHEN be.event_type = 'gaze_end' THEN be.duration_ms END), 0) as avg_gaze_ms
      FROM buildings b
      LEFT JOIN behavior_events be ON b.id = be.building_id
      WHERE ST_DWithin(
        b.location::geography,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
        $3
      )
      GROUP BY b.id, b.name, b.location
      ORDER BY total_events DESC
      LIMIT 50
    `, [lat, lng, radius]);

    res.json({
      success: true,
      data: {
        center: { lat, lng },
        radius,
        buildings: result.rows.map(r => ({
          buildingId: r.building_id,
          buildingName: r.building_name,
          distance: Math.round(parseFloat(r.distance)),
          totalEvents: parseInt(r.total_events),
          uniqueSessions: parseInt(r.unique_sessions),
          avgGazeMs: Math.round(parseFloat(r.avg_gaze_ms)),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
