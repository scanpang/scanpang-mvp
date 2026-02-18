/**
 * 건물 조회 API 라우터
 * - GET /nearby     : 주변 건물 조회 (DB + OSM 병합)
 * - GET /:id/profile : 건물 상세 프로필
 * - GET /:id/floors  : 층별 정보
 */
const express = require('express');
const router = express.Router();
const geospatial = require('../services/geospatial');
const buildingProfile = require('../services/buildingProfile');
const osmBuildings = require('../services/osmBuildings');

/**
 * GET /api/buildings/nearby
 * 주변 건물 조회 (DB + OpenStreetMap 병합)
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

    // DB와 OSM 동시 조회 (하나가 실패해도 다른 쪽 결과 반환)
    const [dbResult, osmResult] = await Promise.allSettled([
      geospatial.findNearbyBuildings(parsedLat, parsedLng, parsedRadius, parsedHeading),
      osmBuildings.fetchNearbyFromOSM(parsedLat, parsedLng, parsedRadius),
    ]);

    const dbBuildings = dbResult.status === 'fulfilled' ? dbResult.value : [];
    let osmResults = osmResult.status === 'fulfilled' ? osmResult.value : [];

    // OSM 결과에 heading 필터 적용
    if (parsedHeading !== null && osmResults.length > 0) {
      osmResults = osmResults.filter((b) => {
        const diff = geospatial.angleDifference(parsedHeading, b.bearing);
        return diff <= 60;
      });
    }

    // 중복 제거: DB 건물 50m 이내 OSM 건물은 제외 (DB 우선)
    const uniqueOsm = osmResults.filter((osm) => {
      return !dbBuildings.some((db) => {
        const dist = haversineQuick(db.lat, db.lng, osm.lat, osm.lng);
        return dist < 50;
      });
    });

    // 병합 + 거리순 정렬
    const merged = [...dbBuildings, ...uniqueOsm]
      .sort((a, b) => (a.distanceMeters || 0) - (b.distanceMeters || 0))
      .slice(0, 30);

    res.json({
      success: true,
      data: merged,
      meta: {
        count: merged.length,
        dbCount: dbBuildings.length,
        osmCount: uniqueOsm.length,
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
 * 건물 상세 프로필 (DB 건물 또는 OSM 건물 더미 프로필)
 */
router.get('/:id/profile', async (req, res, next) => {
  try {
    const rawId = req.params.id;

    // OSM 건물 처리
    if (rawId.startsWith('osm_')) {
      const osmData = osmBuildings.getOsmBuildingData(rawId);
      if (!osmData) {
        return res.status(404).json({
          success: false,
          error: '건물 데이터가 만료되었습니다. 다시 스캔해주세요.',
        });
      }
      const profile = osmBuildings.generateOsmProfile(osmData);
      return res.json({ success: true, data: profile });
    }

    // DB 건물 처리
    const buildingId = parseInt(rawId, 10);

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
    const rawId = req.params.id;

    // OSM 건물 처리
    if (rawId.startsWith('osm_')) {
      const osmData = osmBuildings.getOsmBuildingData(rawId);
      const profile = osmBuildings.generateOsmProfile(osmData || { id: rawId, name: '건물', buildingUse: '건물' });
      return res.json({
        success: true,
        data: profile.floors,
        meta: { buildingId: rawId, count: profile.floors.length },
      });
    }

    // DB 건물 처리
    const buildingId = parseInt(rawId, 10);

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

/**
 * 빠른 Haversine 거리 계산 (중복 판별용)
 */
function haversineQuick(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

module.exports = router;
