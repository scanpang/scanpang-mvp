/**
 * 건물 조회 API 라우터
 * - POST /identify            : 레이캐스팅 건물 식별 (역지오코딩)
 * - GET /nearby              : 주변 건물 조회 (카카오 primary + OSM 폴백 + DB 보조)
 * - GET /:id/profile         : 건물 상세 프로필 (1차 빠른 응답)
 * - GET /:id/profile/enrich  : 건축물대장 + 네이버블로그 보강 (2차)
 * - GET /:id/profile/lazy    : Google Places / 실거래가 (탭 열 때)
 * - GET /:id/floors          : 층별 정보
 * - POST /:id/scan-complete  : 스캔 완료 이벤트 처리
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const geospatial = require('../services/geospatial');
const buildingProfile = require('../services/buildingProfile');
const osmBuildings = require('../services/osmBuildings');
const kakaoLocal = require('../services/kakaoLocal');
const publicData = require('../services/publicData');
const naverSearch = require('../services/naverSearch');
const googlePlaces = require('../services/googlePlaces');

/**
 * GET /api/buildings/nearby
 * 주변 건물 조회 (카카오 primary + OSM 폴백 + DB 보조)
 */
router.get('/nearby', async (req, res, next) => {
  try {
    const { lat, lng, radius, heading } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'lat, lng 파라미터가 필요합니다.',
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng) || parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 좌표값입니다.',
      });
    }

    const parsedRadius = Math.min(radius ? parseInt(radius, 10) : 200, 5000);
    const parsedHeading = heading ? parseFloat(heading) : null;

    let primaryResults = [];
    let source = 'kakao';

    // 1. 카카오 primary
    try {
      primaryResults = await kakaoLocal.searchNearbyPlaces(parsedLat, parsedLng, parsedRadius);
    } catch (err) {
      console.warn('[nearby] 카카오 조회 실패:', err.message);
    }

    // 2. 카카오 실패/빈 결과 시 OSM 폴백
    if (!primaryResults.length) {
      source = 'osm';
      let osmResults = osmBuildings.getCachedNearby(parsedLat, parsedLng, parsedRadius);
      if (!osmResults) {
        try {
          osmResults = await osmBuildings.fetchNearbyFromOSM(parsedLat, parsedLng, parsedRadius);
        } catch (err) {
          console.warn('[nearby] OSM 조회 실패:', err.message);
          osmResults = [];
        }
      }
      primaryResults = osmResults;
    }

    // 3. DB: 보조 소스
    let dbBuildings = [];
    try {
      dbBuildings = await geospatial.findNearbyBuildings(parsedLat, parsedLng, parsedRadius, parsedHeading);
    } catch (err) {
      console.warn('[nearby] DB 조회 실패 (무시):', err.message);
    }

    // heading 필터 적용 (±90°)
    if (parsedHeading !== null && primaryResults.length > 0) {
      primaryResults = primaryResults.filter((b) => {
        const diff = geospatial.angleDifference(parsedHeading, b.bearing);
        return diff <= 90;
      });
    }

    // 중복 제거: DB 건물 50m 이내 primary 건물은 제외
    const uniquePrimary = primaryResults.filter((p) => {
      return !dbBuildings.some((dbB) => {
        const dist = haversineQuick(dbB.lat, dbB.lng, p.lat, p.lng);
        return dist < 50;
      });
    });

    // 병합: DB 건물 우선 + primary 보충, 거리순 정렬
    const merged = [...dbBuildings, ...uniquePrimary]
      .sort((a, b) => (a.distanceMeters || a.distance || 0) - (b.distanceMeters || b.distance || 0))
      .slice(0, 30);

    res.json({
      success: true,
      data: merged,
      meta: {
        count: merged.length,
        dbCount: dbBuildings.length,
        primaryCount: uniquePrimary.length,
        source,
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
 * POST /api/buildings/identify
 * 레이캐스팅 건물 식별: heading 방향으로 가까운 거리부터 역지오코딩,
 * 첫 번째 buildingName 히트 = 유저가 보고 있는 건물
 * Body: { lat, lng, heading, depthMeters?, horizontalAccuracy?, headingAccuracy? }
 */
router.post('/identify', async (req, res, next) => {
  try {
    const { lat, lng, heading, depthMeters, horizontalAccuracy, headingAccuracy } = req.body;

    if (lat == null || lng == null || heading == null) {
      return res.status(400).json({
        success: false,
        error: 'lat, lng, heading 파라미터가 필요합니다.',
      });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedHeading = parseFloat(heading);

    if (isNaN(parsedLat) || isNaN(parsedLng) || isNaN(parsedHeading)) {
      return res.status(400).json({
        success: false,
        error: '유효하지 않은 값입니다.',
      });
    }

    const hasDepth = depthMeters != null && depthMeters >= 0.5 && depthMeters <= 30;

    // 레이캐스팅: 가까운 거리부터 순차 역지오코딩
    // depth 있으면 depth 거리를 맨 앞에 삽입
    const RAY_DISTANCES = [5, 10, 20, 30, 40, 50, 60];
    let distances = [...RAY_DISTANCES];
    if (hasDepth) {
      // depth 거리를 맨 앞에 추가 (중복 제거)
      distances = [depthMeters, ...RAY_DISTANCES.filter(d => Math.abs(d - depthMeters) > 3)];
    }

    // 전방 좌표 계산
    const coords = distances.map(d => ({
      ...kakaoLocal.calculateForwardCoord(parsedLat, parsedLng, parsedHeading, d),
      distance: d,
    }));

    // 순차 역지오코딩: 첫 buildingName 히트에서 중단
    let hitBuilding = null;
    for (const coord of coords) {
      try {
        const addr = await kakaoLocal.coordToAddress(coord.lat, coord.lng);
        if (addr && addr.buildingName) {
          // 건물명 히트 — 이 건물이 시야 최전방 건물
          hitBuilding = {
            ...addr,
            forwardLat: coord.lat,
            forwardLng: coord.lng,
            distance: coord.distance,
            source: hasDepth && coord.distance === depthMeters ? 'depth' : 'raycast',
          };
          break;
        }
      } catch (e) {
        // 개별 실패는 무시, 다음 거리로
        continue;
      }
    }

    // 히트 없으면 roadAddress라도 있는 첫 결과 사용
    if (!hitBuilding) {
      for (const coord of coords) {
        try {
          const addr = await kakaoLocal.coordToAddress(coord.lat, coord.lng);
          if (addr && (addr.roadAddress || addr.address)) {
            hitBuilding = {
              ...addr,
              forwardLat: coord.lat,
              forwardLng: coord.lng,
              distance: coord.distance,
              source: 'raycast_road',
            };
            break;
          }
        } catch (e) {
          continue;
        }
      }
    }

    // 결과 변환
    const buildings = [];
    if (hitBuilding) {
      const c = hitBuilding;
      const id = `geo_${c.forwardLat.toFixed(6)}_${c.forwardLng.toFixed(6)}`;
      buildings.push({
        id,
        name: c.buildingName || c.roadAddress || c.address || '건물',
        address: c.address,
        roadAddress: c.roadAddress,
        buildingName: c.buildingName,
        zoneNo: c.zoneNo,
        lat: c.forwardLat,
        lng: c.forwardLng,
        distance: Math.round(c.distance),
        distanceMeters: Math.round(c.distance),
        bearing: Math.round(parsedHeading),
        source: c.source,
        regionCode: {
          bCode: c.bCode,
          hCode: c.hCode,
          sigunguCd: c.sigunguCd,
          bjdongCd: c.bjdongCd,
          region1: c.region1,
          region2: c.region2,
          region3: c.region3,
        },
      });
    }

    res.json({
      success: true,
      data: buildings,
      meta: {
        count: buildings.length,
        hasDepth,
        depthMeters: hasDepth ? depthMeters : null,
        heading: parsedHeading,
        horizontalAccuracy: horizontalAccuracy || null,
        source: hitBuilding?.source || 'none',
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/buildings/:id/profile
 * 건물 상세 프로필 (1차 빠른 응답)
 */
router.get('/:id/profile', async (req, res, next) => {
  try {
    const rawId = req.params.id;

    // geo_ 건물 처리 (identify 엔드포인트에서 생성된 건물)
    if (rawId.startsWith('geo_')) {
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);
      const name = req.query.name || '건물';

      // regionCode는 query param으로 전달받거나 새로 조회
      let regionCode = null;
      if (req.query.sigunguCd && req.query.bjdongCd) {
        regionCode = {
          sigunguCd: req.query.sigunguCd,
          bjdongCd: req.query.bjdongCd,
          bCode: req.query.bCode || '',
          roadAddress: req.query.roadAddress || req.query.address || '',
          address: req.query.address || '',
        };
      } else if (!isNaN(lat) && !isNaN(lng)) {
        regionCode = await kakaoLocal.coordToAddress(lat, lng);
      }

      // 건물 내 업소 검색
      let inBuildingPlaces = [];
      if (!isNaN(lat) && !isNaN(lng) && name) {
        try {
          inBuildingPlaces = await kakaoLocal.searchByKeyword(name, lat, lng, 100);
          if (regionCode?.roadAddress) {
            inBuildingPlaces = kakaoLocal.filterByAddress(inBuildingPlaces, regionCode.roadAddress);
          }
        } catch (e) {
          // 무시
        }
      }

      const geoData = {
        id: rawId,
        name,
        address: req.query.address || regionCode?.address || '',
        roadAddress: req.query.roadAddress || regionCode?.roadAddress || '',
        lat, lng,
        category: '',
        categoryDetail: '',
      };

      const profile = buildingProfile.buildProfile_Phase1(geoData, null, inBuildingPlaces);

      if (regionCode) {
        profile.meta.regionCode = regionCode;
      }

      return res.json({ success: true, data: profile });
    }

    // 카카오 건물 처리
    if (rawId.startsWith('kakao_')) {
      const kakaoId = rawId.replace('kakao_', '');
      const lat = parseFloat(req.query.lat);
      const lng = parseFloat(req.query.lng);

      // DB 매칭 시도
      const dbProfile = await buildingProfile.getProfileByExternalId(rawId);

      // 카카오 키워드 검색 (건물 내 업소)
      let inBuildingPlaces = [];
      let regionCode = null;
      if (!isNaN(lat) && !isNaN(lng)) {
        const [kwResults, addrResult] = await Promise.allSettled([
          kakaoLocal.searchByKeyword(req.query.name || '', lat, lng, 100),
          kakaoLocal.coordToAddress(lat, lng),
        ]);

        inBuildingPlaces = kwResults.status === 'fulfilled' ? kwResults.value : [];
        regionCode = addrResult.status === 'fulfilled' ? addrResult.value : null;

        // 주소 기반 필터 (같은 건물)
        if (regionCode?.roadAddress) {
          inBuildingPlaces = kakaoLocal.filterByAddress(inBuildingPlaces, regionCode.roadAddress);
        }
      }

      const kakaoData = {
        id: rawId,
        name: req.query.name || '건물',
        address: req.query.address || regionCode?.address || '',
        roadAddress: regionCode?.roadAddress || req.query.address || '',
        lat, lng,
        category: req.query.category || '',
        categoryDetail: req.query.categoryDetail || '',
      };

      const profile = buildingProfile.buildProfile_Phase1(kakaoData, dbProfile, inBuildingPlaces);

      // regionCode 추가 (enrich에서 필요)
      if (regionCode) {
        profile.meta.regionCode = regionCode;
      }

      return res.json({ success: true, data: profile });
    }

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
      // enrich 가능 여부 추가
      profile.meta.enrichAvailable = true;
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

    // DB 프로필에도 enrich 가능 여부 추가
    profile.meta.enrichAvailable = true;

    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/buildings/:id/profile/enrich
 * 2차 보강: 건축물대장 + 네이버블로그 (Promise.allSettled)
 */
router.get('/:id/profile/enrich', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { lat, lng, name, address, sigunguCd, bjdongCd, bun, ji } = req.query;

    // 건축물대장 + 네이버블로그 병렬 호출
    const [summaryResult, floorsResult, reviewResult, imageResult] = await Promise.allSettled([
      // 건축물대장 총괄표제부
      (sigunguCd && bjdongCd)
        ? publicData.getBuildingSummary(sigunguCd, bjdongCd, bun || '', ji || '')
        : Promise.resolve(null),
      // 건축물대장 층별개요
      (sigunguCd && bjdongCd)
        ? publicData.getBuildingFloors(sigunguCd, bjdongCd, bun || '', ji || '')
        : Promise.resolve([]),
      // 네이버 블로그 리뷰
      naverSearch.getBuildingReviews(name || '', address || ''),
      // 카카오 이미지 (네이버 이미지 API 지원 종료 → 카카오 대체)
      kakaoLocal.searchBuildingImage(name || ''),
    ]);

    const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
    const publicFloors = floorsResult.status === 'fulfilled' ? floorsResult.value : [];
    const reviews = reviewResult.status === 'fulfilled' ? reviewResult.value : { reviews: [], summary: '' };
    const thumbnailUrl = imageResult.status === 'fulfilled' ? imageResult.value : null;

    // 건축물대장 데이터를 BuildingProfileSheet 호환 형식으로 변환
    const enrichData = {};

    if (summary) {
      enrichData.buildingInfo = {
        total_floors: summary.grndFlrCnt || null,
        basement_floors: summary.ugrndFlrCnt || null,
        built_year: summary.useAprDay ? parseInt(summary.useAprDay.substring(0, 4)) : null,
        type: summary.mainPurpsCdNm || '',
        structure: summary.strctCdNm || '',
        totalArea: summary.totArea || null,
        buildingArea: summary.archArea || null,
        bcRat: summary.bcRat || null,
        vlRat: summary.vlRat || null,
        parking_count: summary.totalParking || null,
        households: summary.hhldCnt || null,
      };

      // 스탯 업데이트
      const statsRaw = [];
      if (summary.grndFlrCnt) statsRaw.push({ type: 'total_floors', value: `지상${summary.grndFlrCnt}층/지하${summary.ugrndFlrCnt || 0}층`, displayOrder: 1 });
      if (summary.totArea) statsRaw.push({ type: 'area', value: `${Math.round(summary.totArea)}㎡`, displayOrder: 2 });
      if (summary.totalParking) statsRaw.push({ type: 'parking', value: `${summary.totalParking}대`, displayOrder: 3 });
      if (summary.hhldCnt) statsRaw.push({ type: 'households', value: `${summary.hhldCnt}세대`, displayOrder: 4 });
      if (statsRaw.length > 0) enrichData.stats = { raw: statsRaw };
    }

    // 건축물대장 층별 정보 → floors 형식 변환
    if (publicFloors.length > 0) {
      enrichData.floors = publicFloors.map(f => ({
        floor_number: f.flrGbCdNm.includes('지하') ? `B${f.flrNo}` : `${f.flrNo}F`,
        floor_order: f.flrGbCdNm.includes('지하') ? -f.flrNo : f.flrNo,
        tenant_name: f.mainPurpsCdNm || '정보 없음',
        tenant_type: f.mainPurpsCdNm || '',
        is_vacant: false,
        icons: '',
        has_reward: false,
        status: 'active',
        area: f.area || null,
      }));
    }

    // 네이버 블로그 리뷰
    if (reviews.reviews.length > 0) {
      enrichData.blogReviews = reviews.reviews;
      enrichData.reviewSummary = reviews.summary;
    }

    // 썸네일 이미지
    if (thumbnailUrl) {
      enrichData.thumbnail_url = thumbnailUrl;
    }

    res.json({
      success: true,
      data: enrichData,
      meta: {
        hasBuildingSummary: !!summary,
        hasPublicFloors: publicFloors.length > 0,
        hasBlogReviews: reviews.reviews.length > 0,
        hasThumbnail: !!thumbnailUrl,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/buildings/:id/profile/lazy
 * Lazy 탭: Google Places / 실거래가 (유저 액션 시만)
 */
router.get('/:id/profile/lazy', async (req, res, next) => {
  try {
    const { tab, lat, lng, name, sigunguCd } = req.query;

    if (tab === 'food') {
      // Google Places: 주변 음식점
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);

      const [restaurants, cafes] = await Promise.allSettled([
        (!isNaN(parsedLat) && !isNaN(parsedLng))
          ? googlePlaces.searchNearby(parsedLat, parsedLng, 300, 'restaurant')
          : Promise.resolve([]),
        (!isNaN(parsedLat) && !isNaN(parsedLng))
          ? googlePlaces.searchNearby(parsedLat, parsedLng, 300, 'cafe')
          : Promise.resolve([]),
      ]);

      const allPlaces = [
        ...(restaurants.status === 'fulfilled' ? restaurants.value : []),
        ...(cafes.status === 'fulfilled' ? cafes.value : []),
      ];

      // Google Places → restaurants 형식 변환
      const googleRestaurants = allPlaces.map(p => ({
        name: p.name,
        category: '',
        sub_category: '',
        signature_menu: null,
        price_range: null,
        wait_teams: null,
        rating: p.rating,
        review_count: p.userRatingCount,
        is_open: p.isOpen,
        google_place_id: p.placeId,
      }));

      return res.json({
        success: true,
        data: { restaurants: googleRestaurants },
        meta: { source: 'google_places', count: googleRestaurants.length },
      });
    }

    if (tab === 'estate') {
      // 상업용 부동산 실거래가
      const trades = sigunguCd
        ? await publicData.getTradePrice(sigunguCd)
        : [];

      // 지번 기반 필터 (같은 동/지번)
      let filtered = trades;
      if (name && trades.length > 0) {
        const nameNorm = name.replace(/\s+/g, '');
        filtered = trades.filter(t => {
          const dong = (t.dongName || '').replace(/\s+/g, '');
          const use = (t.buildingUse || '').replace(/\s+/g, '');
          return dong.includes(nameNorm) || nameNorm.includes(dong) || use.includes(nameNorm);
        });
        // 정확 매칭 없으면 전체 반환 (주변 시세 참고용)
        if (filtered.length === 0) filtered = trades.slice(0, 10);
      }

      const realEstate = filtered.map(t => ({
        listing_type: '실거래',
        room_type: t.buildingUse || '상업용',
        building_type: t.buildingType || '',
        unit_number: t.floor ? `${t.floor}층` : '',
        size_pyeong: t.area ? Math.round(t.area / 3.305785) : null,
        size_sqm: t.area || null,
        sale_price: parseInt(t.dealAmount) || null,
        deal_date: `${t.dealYear}.${t.dealMonth}.${t.dealDay}`,
        dong_name: t.dongName,
        jibun: t.jibun,
        land_use: t.landUse,
        dealing_type: t.dealingType,
        build_year: t.buildYear,
      }));

      return res.json({
        success: true,
        data: { realEstate },
        meta: { source: 'public_data', count: realEstate.length },
      });
    }

    if (tab === 'tourism') {
      // Google Places: 관광/문화
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);

      // 텍스트 검색으로 건물 자체의 Google 정보 가져오기
      let placeInfo = null;
      if (name) {
        const found = await googlePlaces.findPlaceFromText(name, parsedLat, parsedLng);
        if (found?.placeId) {
          placeInfo = await googlePlaces.getPlaceDetails(found.placeId);
        }
      }

      return res.json({
        success: true,
        data: {
          tourism: placeInfo ? {
            attraction_name: placeInfo.name,
            category: (placeInfo.types || []).join(', '),
            rating: placeInfo.rating,
            review_count: placeInfo.userRatingCount,
            hours: (placeInfo.openingHours || []).join('\n'),
            description: (placeInfo.reviews || []).slice(0, 2).map(r => r.text).join(' '),
            google_reviews: placeInfo.reviews,
          } : null,
        },
        meta: { source: 'google_places', hasData: !!placeInfo },
      });
    }

    return res.status(400).json({
      success: false,
      error: 'tab 파라미터가 필요합니다 (food, estate, tourism)',
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

    // OSM/카카오/geo 건물 처리
    if (rawId.startsWith('osm_') || rawId.startsWith('kakao_') || rawId.startsWith('geo_')) {
      // 층별 정보 없음 → 빈 배열
      return res.json({
        success: true,
        data: [],
        meta: { buildingId: rawId, count: 0 },
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
 */
router.post('/:id/scan-complete', async (req, res, next) => {
  try {
    const rawId = req.params.id;
    const { confidence, sensorData, cameraFrame } = req.body;

    // 카카오/OSM/geo 건물은 프로필만 반환
    if (rawId.startsWith('kakao_') || rawId.startsWith('osm_') || rawId.startsWith('geo_')) {
      // scan-complete에서도 프로필 반환
      if (rawId.startsWith('osm_')) {
        const osmData = osmBuildings.getOsmBuildingData(rawId);
        if (!osmData) {
          return res.status(404).json({ success: false, error: '건물 데이터가 만료되었습니다.' });
        }
        const profile = osmBuildings.generateOsmProfile(osmData);
        profile.meta.enrichAvailable = true;
        return res.json({ success: true, data: profile });
      }
      // 카카오/geo 건물: 빈 프로필 (모바일에서 profile API 별도 호출)
      return res.json({
        success: true,
        data: null,
        meta: { message: 'GET /profile API를 사용해주세요.' },
      });
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
    const normalizedConfidence = (confidence || 0) / 100;
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

    // 4. 프로필 반환
    const profile = await buildingProfile.getProfile(buildingId);
    if (!profile) {
      return res.status(404).json({ success: false, error: '건물을 찾을 수 없습니다.' });
    }
    profile.meta.enrichAvailable = true;

    res.json({ success: true, data: profile });
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
