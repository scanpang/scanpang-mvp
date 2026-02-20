/**
 * Geospatial Building Detection Engine
 *
 * ARCore Geospatial API 기반 건물 감지 엔진
 * 기존 7-Factor 엔진 대체 (isLocalized === true일 때 사용)
 *
 * Factor 구성:
 * 1. Geospatial 위치 정확도 (0.35) — horizontalAccuracy 기반
 * 2. Heading 일치도 (0.30) — ARCore heading vs building bearing
 * 3. 거리 점수 (0.15) — GPS 거리 함수 재사용
 * 4. 서버 시각 (0.05) — 기존 로직 축소
 * 5. Gemini Vision (0.15) — 기존 스텁 유지
 */

// 가중치 (합계 = 1.0)
const WEIGHTS = {
  geospatialAccuracy: 0.35,
  headingMatch: 0.30,
  distance: 0.15,
  serverTime: 0.05,
  geminiVision: 0.15,
};

// Geospatial 모드 파라미터 (기존보다 좁은 각도)
export const GEO_PARAMS = {
  FOCUS_ANGLE: 25,            // ±25° (기존 ±35°) — ARCore heading 정확도 반영
  SWITCH_CONFIRM: 3,          // 3틱(150ms) (기존 5틱)
  FOCUS_RESET: 6,             // 6틱(300ms) (기존 8틱)
  STICKINESS_BONUS: 4,        // 4° (기존 5°)
  SWITCH_THRESHOLD: 2,        // 2° (기존 3°)
};

/**
 * Factor 1: Geospatial 위치 정확도 (0~1)
 * horizontalAccuracy가 좋을수록 높은 점수
 */
function scoreGeospatialAccuracy(horizontalAccuracy) {
  if (horizontalAccuracy == null || horizontalAccuracy < 0) return 0.3;
  if (horizontalAccuracy < 2) return 1.0;     // <2m: 최고
  if (horizontalAccuracy < 5) return 0.9;     // <5m: 우수
  if (horizontalAccuracy < 10) return 0.8;    // <10m: 양호
  if (horizontalAccuracy < 20) return 0.5;    // <20m: 보통
  return 0.3;                                  // >20m: 낮음
}

/**
 * Factor 2: Heading 일치도 (0~1)
 * ARCore heading이 나침반보다 정확하므로 더 좁은 허용 각도
 */
function scoreHeadingMatch(deviceHeading, buildingBearing, headingAccuracy) {
  if (deviceHeading == null || buildingBearing == null) return 0.5;
  let diff = Math.abs(buildingBearing - deviceHeading);
  if (diff > 180) diff = 360 - diff;

  // headingAccuracy 기반 동적 허용 각도
  const accuracyFactor = headingAccuracy != null && headingAccuracy < 5 ? 1.0 : 0.8;

  if (diff <= 10) return 1.0 * accuracyFactor;
  if (diff <= 20) return (0.85 + (20 - diff) * 0.015) * accuracyFactor;
  if (diff <= 35) return (0.6 + (35 - diff) * (0.25 / 15)) * accuracyFactor;
  if (diff <= 60) return (0.3 + (60 - diff) * (0.3 / 25)) * accuracyFactor;
  if (diff <= 90) return 0.1;
  return 0;
}

/**
 * Factor 3: 거리 점수 (0~1)
 * 200m 반경 기준 (기존 detectionEngine과 동일)
 */
function scoreDistance(distanceMeters) {
  if (distanceMeters == null || distanceMeters < 0) return 0;
  if (distanceMeters <= 20) return 1.0;
  if (distanceMeters <= 50) return 0.95 + (50 - distanceMeters) / 600;
  if (distanceMeters <= 100) return 0.8 + (100 - distanceMeters) * 0.003;
  if (distanceMeters <= 150) return 0.6 + (150 - distanceMeters) * 0.004;
  if (distanceMeters <= 200) return 0.4 + (200 - distanceMeters) * 0.004;
  return Math.max(0.05, 0.4 - (distanceMeters - 200) * 0.003);
}

/**
 * Factor 4: 서버 시각 컨텍스트 (0~1) — 축소 반영
 */
function scoreServerTime(timeContext, building) {
  if (!timeContext) return 0.7;
  let score = 0.7;
  if (timeContext.neonActive && building?.neonSignHours) score += 0.2;
  if (timeContext.isDaytime && timeContext.shadowDirection) score += 0.1;
  return Math.min(1.0, score);
}

/**
 * Factor 5: Gemini Vision (0~1) — 기존 스텁 유지
 */
function scoreGeminiVision(geminiResult) {
  if (!geminiResult) return 0.5;
  if (geminiResult.buildingIdentified === false) return 0.2;
  if (typeof geminiResult.confidence === 'number') {
    return Math.max(0.1, Math.min(1.0, geminiResult.confidence));
  }
  return 0.5;
}

/**
 * Geospatial 기반 건물 confidence 계산
 *
 * @param {Object} building - 건물 데이터 (distance, bearing 포함)
 * @param {Object} geoPose - { heading, horizontalAccuracy, headingAccuracy }
 * @param {Object} timeContext - 서버 시각 컨텍스트
 * @param {Object} geminiResult - Gemini 분석 결과
 * @returns {Object} { confidence, confidencePercent, factors, level }
 */
export function calculateGeospatialConfidence(
  building, geoPose = {}, timeContext = null, geminiResult = null
) {
  const factors = {
    geospatialAccuracy: scoreGeospatialAccuracy(geoPose.horizontalAccuracy),
    headingMatch: scoreHeadingMatch(
      geoPose.heading, building.bearing, geoPose.headingAccuracy
    ),
    distance: scoreDistance(building.distance),
    serverTime: scoreServerTime(timeContext, building),
    geminiVision: scoreGeminiVision(geminiResult),
  };

  // 가중 합산
  let confidence = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    confidence += (factors[key] || 0) * weight;
  }
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    confidence: Math.round(confidence * 100) / 100,
    confidencePercent: Math.round(confidence * 100),
    factors,
    level: confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
  };
}

/**
 * FOV 기반 건물 필터링
 * ARCore heading 정확도를 반영한 좁은 시야각
 *
 * @param {Array} buildings - 건물 배열
 * @param {number} heading - 현재 heading
 * @param {number} fov - 시야각 (기본 25°)
 * @returns {Array} 시야 내 건물
 */
export function filterByFOV(buildings, heading, fov = GEO_PARAMS.FOCUS_ANGLE) {
  return buildings.filter(b => {
    const bearing = b.bearing ?? 0;
    let diff = bearing - heading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return Math.abs(diff) <= fov;
  });
}

/**
 * Geospatial 기반 건물 매칭 + 랭킹
 *
 * @param {Object} geoPose - Geospatial pose 데이터
 * @param {Array} nearbyBuildings - nearby API 결과
 * @param {Object} timeContext - 서버 시각
 * @param {Map|Object} geminiResults - buildingId → gemini 결과
 * @returns {Array} confidence 기준 정렬된 건물 배열
 */
export function matchBuildings(geoPose, nearbyBuildings, timeContext, geminiResults = null) {
  return nearbyBuildings
    .map(building => {
      const geminiResult = geminiResults?.get?.(building.id) || geminiResults?.[building.id] || null;
      const result = calculateGeospatialConfidence(building, geoPose, timeContext, geminiResult);
      return { ...building, ...result };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

export default {
  calculateGeospatialConfidence,
  filterByFOV,
  matchBuildings,
  WEIGHTS,
  GEO_PARAMS,
};
