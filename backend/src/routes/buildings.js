/**
 * 건물 조회 API 라우터
 * - GET /nearby              : 주변 건물 조회 (OSM primary + Naver 보강 + DB 보조)
 * - GET /:id/profile         : 건물 상세 프로필
 * - GET /:id/floors          : 층별 정보
 * - POST /:id/scan-complete  : 스캔 완료 이벤트 처리
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const geospatial = require('../services/geospatial');
const buildingProfile = require('../services/buildingProfile');
const osmBuildings = require('../services/osmBuildings');
const naverBuildings = require('../services/naverBuildings');

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

    const parsedRadius = Math.min(radius ? parseInt(radius, 10) : 200, 5000); // 최대 5km
    const parsedHeading = heading ? parseFloat(heading) : null;

    // 1. OSM: primary 소스 (동기 — 캐시 히트면 즉시, 미스면 fetch 대기)
    let osmResults = osmBuildings.getCachedNearby(parsedLat, parsedLng, parsedRadius);
    if (!osmResults) {
      try {
        osmResults = await osmBuildings.fetchNearbyFromOSM(parsedLat, parsedLng, parsedRadius);
      } catch (err) {
        console.warn('[nearby] OSM 조회 실패:', err.message);
        osmResults = [];
      }
    }

    // 2. DB: 보조 소스 (있으면 우선 적용)
    let dbBuildings = [];
    try {
      dbBuildings = await geospatial.findNearbyBuildings(parsedLat, parsedLng, parsedRadius, parsedHeading);
    } catch (err) {
      // DB 없어도 정상 — OSM이 primary
      console.warn('[nearby] DB 조회 실패 (무시):', err.message);
    }

    // 3. Naver: 이름 보강 (캐시 활용, 실패해도 무시)
    try {
      const naverResults = await naverBuildings.searchNearbyBuildings(parsedLat, parsedLng, parsedRadius);
      if (naverResults.length > 0) {
        osmResults = naverBuildings.enrichWithNaver(osmResults, naverResults);
      }
    } catch {}

    // heading 필터 적용 (도심 나침반 오차 고려: ±90°)
    if (parsedHeading !== null && osmResults.length > 0) {
      osmResults = osmResults.filter((b) => {
        const diff = geospatial.angleDifference(parsedHeading, b.bearing);
        return diff <= 90;
      });
    }

    // 중복 제거: DB 건물 50m 이내 OSM 건물은 제외 (DB 우선)
    const uniqueOsm = osmResults.filter((osm) => {
      return !dbBuildings.some((dbB) => {
        const dist = haversineQuick(dbB.lat, dbB.lng, osm.lat, osm.lng);
        return dist < 50;
      });
    });

    // 병합: DB 건물 우선 + OSM 보충, 거리순 정렬
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
 * POST /api/buildings/:id/scan-complete
 * 게이지 완료 시 프론트에서 호출
 * - behavior_events에 scan_complete 이벤트 기록
 * - confidence >= 0.5: flywheel 소싱 카운트 증가
 * - confidence >= 0.8: building_profiles 자동 검증
 * - 응답: GET /profile과 동일한 구조 반환
 */
router.post('/:id/scan-complete', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { confidence, sensorData, cameraFrame } = req.body;

    // OSM 건물은 scan-complete 미지원
    if (rawId.startsWith('osm_')) {
      const osmData = osmBuildings.getOsmBuildingData(rawId);
      if (!osmData) {
        return res.status(404).json({
          success: false,
          error: '건물 데이터가 만료되었습니다.',
        });
      }
      const profile = osmBuildings.generateOsmProfile(osmData);
      return res.json({ success: true, data: profile });
    }

    const buildingId = parseInt(rawId, 10);
    if (isNaN(buildingId)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 건물 ID입니다.',
      });
    }

    // 1. behavior_events에 scan_complete 이벤트 기록
    const gps = sensorData?.gps || {};
    const compass = sensorData?.compass || {};
    await db.query(
      `INSERT INTO behavior_events
        (session_id, building_id, event_type, gps_lat, gps_lng, gps_accuracy, compass_heading, metadata)
      VALUES
        (gen_random_uuid(), $1, 'scan_complete', $2, $3, $4, $5, $6)`,
      [
        buildingId,
        gps.lat || null,
        gps.lng || null,
        gps.accuracy || null,
        compass.heading || null,
        JSON.stringify({ confidence, hasCameraFrame: !!cameraFrame }),
      ]
    );

    // 2. confidence >= 0.5: flywheel 소싱 카운트 증가
    const normalizedConfidence = (confidence || 0) / 100; // 0-100 → 0-1
    if (normalizedConfidence >= 0.5) {
      await db.query(
        `INSERT INTO sourced_info (building_id, source_type, confidence, raw_data)
        VALUES ($1, 'user_camera', $2, $3)`,
        [
          buildingId,
          normalizedConfidence,
          JSON.stringify({ type: 'scan_complete', confidence }),
        ]
      );
    }

    // 3. confidence >= 0.8: building_profiles 자동 검증
    if (normalizedConfidence >= 0.8) {
      await db.query(
        `UPDATE building_profiles
        SET confidence_score = GREATEST(confidence_score, $2),
            last_verified_at = NOW(),
            updated_at = NOW()
        WHERE building_id = $1`,
        [buildingId, normalizedConfidence]
      );
    }

    // 4. 프로필 반환 (GET /profile과 동일)
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
