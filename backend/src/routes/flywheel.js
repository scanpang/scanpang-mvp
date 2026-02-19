/**
 * Flywheel API
 * - 소싱된 정보 제출
 * - 검증 대기 목록 조회
 * - 정보 검증 처리
 * - 플라이휠 통계
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

/**
 * POST /api/flywheel/source — 소싱된 정보 제출
 */
router.post('/source', async (req, res, next) => {
  try {
    const { buildingId, sourceType, rawData, extractedInfo, confidence, sessionId } = req.body;

    if (!buildingId || !sourceType) {
      return res.status(400).json({
        success: false,
        error: 'buildingId와 sourceType은 필수입니다.',
      });
    }

    const validSourceTypes = ['gemini_vision', 'user_report', 'public_api'];
    if (!validSourceTypes.includes(sourceType)) {
      return res.status(400).json({
        success: false,
        error: `유효하지 않은 sourceType: ${sourceType}`,
      });
    }

    const result = await db.query(`
      INSERT INTO sourced_info (building_id, source_type, raw_data, extracted_info, confidence, session_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `, [
      buildingId,
      sourceType,
      rawData ? JSON.stringify(rawData) : null,
      extractedInfo ? JSON.stringify(extractedInfo) : null,
      confidence || null,
      sessionId || null,
    ]);

    // confidence가 0.8 이상이면 자동 검증
    if (confidence && confidence >= 0.8) {
      await db.query(`
        UPDATE sourced_info SET verified = TRUE, verified_by = 'auto'
        WHERE id = $1
      `, [result.rows[0].id]);

      // building_profiles 자동 업데이트
      if (extractedInfo) {
        await db.query(`
          INSERT INTO building_profiles (building_id, source, confidence_score, last_verified_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT (building_id, source) DO UPDATE SET
            confidence_score = GREATEST(building_profiles.confidence_score, $3),
            last_verified_at = NOW(),
            updated_at = NOW()
        `, [buildingId, sourceType, confidence]).catch(() => {
          // unique constraint 없으면 단순 INSERT
          return db.query(`
            INSERT INTO building_profiles (building_id, source, confidence_score, last_verified_at)
            VALUES ($1, $2, $3, NOW())
          `, [buildingId, sourceType, confidence]);
        });
      }
    }

    res.status(201).json({
      success: true,
      data: {
        id: result.rows[0].id,
        createdAt: result.rows[0].created_at,
        autoVerified: confidence >= 0.8,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/flywheel/pending — 검증 대기 정보 목록
 */
router.get('/pending', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const offset = parseInt(req.query.offset, 10) || 0;

    const result = await db.query(`
      SELECT si.*, b.name as building_name, b.address as building_address
      FROM sourced_info si
      LEFT JOIN buildings b ON si.building_id = b.id
      WHERE si.verified = FALSE
      ORDER BY si.confidence DESC NULLS LAST, si.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await db.query(`
      SELECT COUNT(*) as total FROM sourced_info WHERE verified = FALSE
    `);

    res.json({
      success: true,
      data: {
        items: result.rows.map(r => ({
          id: r.id,
          buildingId: r.building_id,
          buildingName: r.building_name,
          buildingAddress: r.building_address,
          sourceType: r.source_type,
          rawData: r.raw_data,
          extractedInfo: r.extracted_info,
          confidence: r.confidence ? parseFloat(r.confidence) : null,
          createdAt: r.created_at,
        })),
        total: parseInt(countResult.rows[0].total),
        limit,
        offset,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/flywheel/verify/:id — 정보 검증 처리
 */
router.patch('/verify/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: '유효한 ID가 필요합니다.' });
    }

    const { verified, verifiedBy } = req.body;

    const result = await db.query(`
      UPDATE sourced_info SET
        verified = $1,
        verified_by = $2
      WHERE id = $3
      RETURNING *
    `, [
      verified !== false,
      verifiedBy || 'manual',
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: '소싱 정보를 찾을 수 없습니다.' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/flywheel/stats — 플라이휠 통계
 */
router.get('/stats', async (req, res, next) => {
  try {
    const stats = await db.query(`
      SELECT
        COUNT(*) as total_sourced,
        COUNT(CASE WHEN verified = TRUE THEN 1 END) as verified_count,
        COUNT(CASE WHEN verified = FALSE THEN 1 END) as pending_count,
        COUNT(DISTINCT building_id) as buildings_covered,
        COUNT(CASE WHEN source_type = 'gemini_vision' THEN 1 END) as gemini_sources,
        COUNT(CASE WHEN source_type = 'user_report' THEN 1 END) as user_sources,
        COUNT(CASE WHEN source_type = 'public_api' THEN 1 END) as api_sources,
        COALESCE(AVG(confidence), 0) as avg_confidence
      FROM sourced_info
    `);

    // 최근 24시간 소싱 속도
    const recent = await db.query(`
      SELECT COUNT(*) as last_24h
      FROM sourced_info
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);

    // 건물 프로필 완성도
    const profiles = await db.query(`
      SELECT COUNT(*) as profile_count
      FROM building_profiles
    `);

    const s = stats.rows[0];
    res.json({
      success: true,
      data: {
        totalSourced: parseInt(s.total_sourced),
        verifiedCount: parseInt(s.verified_count),
        pendingCount: parseInt(s.pending_count),
        buildingsCovered: parseInt(s.buildings_covered),
        verificationRate: s.total_sourced > 0
          ? ((parseInt(s.verified_count) / parseInt(s.total_sourced)) * 100).toFixed(1)
          : 0,
        sourceBreakdown: {
          geminiVision: parseInt(s.gemini_sources),
          userReport: parseInt(s.user_sources),
          publicApi: parseInt(s.api_sources),
        },
        avgConfidence: parseFloat(parseFloat(s.avg_confidence).toFixed(3)),
        last24hSourcing: parseInt(recent.rows[0].last_24h),
        totalProfiles: parseInt(profiles.rows[0].profile_count),
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
