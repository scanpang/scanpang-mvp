/**
 * 7-Factor Building Detection Engine
 *
 * 7가지 팩터를 통합하여 건물별 confidence score 계산:
 * 1. GPS 좌표 + 거리
 * 2. 나침반 방위각
 * 3. 자이로스코프 (기기 기울기)
 * 4. 가속도계 (이동 상태)
 * 5. 카메라 각도
 * 6. 서버 시각 (네온사인, 조명, 그림자)
 * 7. Gemini Vision 분석 결과 (Phase 1: stub)
 */

// 가중치 (합계 = 1.0)
const WEIGHTS = {
  gpsDistance: 0.25,      // Factor 1: GPS 거리
  compassBearing: 0.25,   // Factor 2: 나침반 방위각 일치
  gyroscope: 0.08,        // Factor 3: 기울기 안정성
  accelerometer: 0.07,    // Factor 4: 이동 상태
  cameraAngle: 0.10,      // Factor 5: 카메라 각도
  serverTime: 0.10,       // Factor 6: 서버 시각 컨텍스트
  geminiVision: 0.15,     // Factor 7: Gemini Vision (Phase 1: 기본값)
};

/**
 * Factor 1: GPS 거리 점수 (0~1)
 * 가까울수록 높은 점수
 */
function scoreGpsDistance(distanceMeters) {
  if (distanceMeters == null || distanceMeters < 0) return 0;
  if (distanceMeters <= 30) return 1.0;
  if (distanceMeters <= 100) return 0.9 - (distanceMeters - 30) * 0.003;
  if (distanceMeters <= 300) return 0.7 - (distanceMeters - 100) * 0.002;
  if (distanceMeters <= 500) return 0.3 - (distanceMeters - 300) * 0.001;
  return Math.max(0, 0.1 - (distanceMeters - 500) * 0.0002);
}

/**
 * Factor 2: 나침반 방위각 일치도 (0~1)
 * 디바이스 heading과 건물 bearing의 차이가 작을수록 높은 점수
 */
function scoreCompassBearing(deviceHeading, buildingBearing) {
  if (deviceHeading == null || buildingBearing == null) return 0.5;
  let diff = Math.abs(buildingBearing - deviceHeading);
  if (diff > 180) diff = 360 - diff;
  // 0° 차이 = 1.0, 30° = 0.7, 60° = 0.3, 90°+ = 0
  if (diff <= 15) return 1.0;
  if (diff <= 30) return 1.0 - (diff - 15) * 0.02;
  if (diff <= 60) return 0.7 - (diff - 30) * 0.013;
  if (diff <= 90) return 0.3 - (diff - 60) * 0.01;
  return 0;
}

/**
 * Factor 3: 자이로스코프 안정성 (0~1)
 * 기기가 안정적으로 들려있을수록 높은 점수
 * beta ~0 (수직), gamma ~0 (좌우 균형)
 */
function scoreGyroscope(gyroData) {
  if (!gyroData) return 0.6; // 데이터 없으면 중간값
  const { alpha, beta, gamma } = gyroData;
  // beta: 전후 기울기 (-180~180), 0~45도가 카메라 들고 있는 자세
  const betaScore = beta != null ? Math.max(0, 1 - Math.abs(beta - 30) / 60) : 0.5;
  // gamma: 좌우 기울기 (-90~90), 0에 가까울수록 안정
  const gammaScore = gamma != null ? Math.max(0, 1 - Math.abs(gamma) / 45) : 0.5;
  return betaScore * 0.6 + gammaScore * 0.4;
}

/**
 * Factor 4: 가속도계 이동 상태 (0~1)
 * 정지 상태에서 높은 점수 (안정적 스캔)
 */
function scoreAccelerometer(accelData) {
  if (!accelData) return 0.6;
  const { x, y, z } = accelData;
  // 중력 제거 후 이동 magnitude
  const gravity = 9.81;
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const movement = Math.abs(magnitude - gravity);
  // movement < 0.5 = 정지, > 3.0 = 걷기
  if (movement < 0.3) return 1.0;
  if (movement < 1.0) return 0.8;
  if (movement < 2.0) return 0.6;
  return Math.max(0.2, 0.6 - (movement - 2.0) * 0.1);
}

/**
 * Factor 5: 카메라 각도 (0~1)
 * 카메라가 건물을 향하고 있는지 (수평~약간 위를 보는 자세)
 */
function scoreCameraAngle(cameraAngle) {
  if (!cameraAngle) return 0.6;
  const { pitch } = cameraAngle;
  // pitch: 위아래 각도. 건물을 보려면 0~45도 사이
  if (pitch == null) return 0.6;
  if (pitch >= 0 && pitch <= 45) return 1.0 - Math.abs(pitch - 20) / 50;
  return Math.max(0.1, 0.5 - Math.abs(pitch - 20) / 100);
}

/**
 * Factor 6: 서버 시각 컨텍스트 (0~1)
 * 건물의 네온사인 점등 시간, 조명 상태와 현재 시각 매칭
 */
function scoreServerTime(timeContext, building) {
  if (!timeContext) return 0.7; // 서버 시각 없으면 기본값

  let score = 0.7; // 기본

  // 야간 + 네온사인 있는 건물 → 식별 용이
  if (timeContext.neonActive && building?.neonSignHours) {
    score += 0.2;
  }

  // 주간 + 그림자 방향 → 건물 위치 확인에 도움
  if (timeContext.isDaytime && timeContext.shadowDirection) {
    score += 0.1;
  }

  return Math.min(1.0, score);
}

/**
 * Factor 7: Gemini Vision 분석
 * Gemini API 분석 결과의 confidence를 반영
 * geminiResult: { buildingIdentified, confidence, ... } from /api/gemini/analyze-frame
 */
function scoreGeminiVision(geminiResult) {
  if (!geminiResult) return 0.5; // 분석 전 기본값
  if (geminiResult.buildingIdentified === false) return 0.2;
  if (typeof geminiResult.confidence === 'number') {
    return Math.max(0.1, Math.min(1.0, geminiResult.confidence));
  }
  return 0.5;
}

/**
 * 7-Factor 통합 confidence score 계산
 * @param {Object} building - 건물 데이터 (distance, bearing 포함)
 * @param {Object} sensorData - { heading, gyroscope, accelerometer, cameraAngle }
 * @param {Object} timeContext - 서버 시각 컨텍스트
 * @param {Object} geminiResult - Gemini 분석 결과 (Phase 1: null)
 * @returns {Object} { confidence, factors }
 */
export function calculateConfidence(building, sensorData = {}, timeContext = null, geminiResult = null) {
  const factors = {
    gpsDistance: scoreGpsDistance(building.distance),
    compassBearing: scoreCompassBearing(sensorData.heading, building.bearing),
    gyroscope: scoreGyroscope(sensorData.gyroscope),
    accelerometer: scoreAccelerometer(sensorData.accelerometer),
    cameraAngle: scoreCameraAngle(sensorData.cameraAngle),
    serverTime: scoreServerTime(timeContext, building),
    geminiVision: scoreGeminiVision(geminiResult),
  };

  // 가중 합산
  let confidence = 0;
  for (const [key, weight] of Object.entries(WEIGHTS)) {
    confidence += (factors[key] || 0) * weight;
  }

  // 0~1 범위 클램프
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    confidence: Math.round(confidence * 100) / 100,
    confidencePercent: Math.round(confidence * 100),
    factors,
    level: confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
  };
}

/**
 * 건물 배열에 confidence를 부여하고 정렬
 * @param {Map|Object} geminiResults - buildingId → gemini analysis 결과 맵 (optional)
 */
export function rankBuildings(buildings, sensorData, timeContext, geminiResults = null) {
  return buildings
    .map(building => {
      const geminiResult = geminiResults?.get?.(building.id) || geminiResults?.[building.id] || null;
      const result = calculateConfidence(building, sensorData, timeContext, geminiResult);
      return { ...building, ...result };
    })
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * 가장 높은 confidence의 건물 반환
 */
export function detectPrimaryBuilding(buildings, sensorData, timeContext) {
  const ranked = rankBuildings(buildings, sensorData, timeContext);
  return ranked.length > 0 ? ranked[0] : null;
}

export default {
  calculateConfidence,
  rankBuildings,
  detectPrimaryBuilding,
  WEIGHTS,
};
