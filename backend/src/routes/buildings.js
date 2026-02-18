/**
 * 건물 조회 API 라우터
 * - GET /nearby     : 주변 건물 조회 (PostGIS 기반)
 * - GET /:id/profile : 건물 상세 프로필
 * - GET /:id/floors  : 층별 정보
 */
const express = require('express');
const router = express.Router();
const geospatial = require('../services/geospatial');
const buildingProfile = require('../services/buildingProfile');

/**
 * GET /api/buildings/nearby
 * 주변 건물 조회 (PostGIS ST_DWithin)
 *
 * Query params:
 *   lat      - 위도 (필수)
 *   lng      - 경도 (필수)
 *   radius   - 검색 반경 미터 (선택, 기본 200)
 *   heading  - 디바이스 방향 0-360 (선택, AR 시야 필터용)
 */
router.get('/nearby', async (req, res, next) => {
  try {
    const { lat, lng, radius, heading } = req.query;

    // 필수 파라미터 검증
    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'lat, lng 파라미터가 필요합니다.',
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    // 유효한 좌표 범위 확인
    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 좌표값입니다.',
      });
    }

    const parsedRadius = radius ? parseInt(radius, 10) : 200;
    const parsedHeading = heading ? parseFloat(heading) : null;

    const buildings = await geospatial.findNearbyBuildings(
      parsedLat,
      parsedLng,
      parsedRadius,
      parsedHeading
    );

    res.json({
      success: true,
      data: buildings,
      meta: {
        count: buildings.length,
        center: { lat: parsedLat, lng: parsedLng },
        radius: parsedRadius,
        heading: parsedHeading,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/buildings/:id/profile
 * 건물 상세 프로필 (건물정보 + 층별 + 편의시설 + 통계 + LIVE)
 */
router.get('/:id/profile', async (req, res, next) => {
  try {
    const buildingId = parseInt(req.params.id, 10);

    if (isNaN(buildingId)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 건물 ID입니다.',
      });
    }

    const profile = await buildingProfile.getProfile(buildingId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: '건물을 찾을 수 없습니다.',
      });
    }

    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/buildings/:id/floors
 * 층별 정보 조회
 */
router.get('/:id/floors', async (req, res, next) => {
  try {
    const buildingId = parseInt(req.params.id, 10);

    if (isNaN(buildingId)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 건물 ID입니다.',
      });
    }

    const floors = await buildingProfile.getFloors(buildingId);

    res.json({
      success: true,
      data: floors,
      meta: {
        buildingId,
        count: floors.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
