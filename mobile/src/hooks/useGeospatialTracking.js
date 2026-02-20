/**
 * useGeospatialTracking - ARCore Geospatial 추적 훅
 *
 * 3-Tier 폴백 체계:
 *   Tier 1: VPS + GPS 융합 (~1m 정확도) — Terrain/Rooftop Anchor, 좁은 FOV(25°)
 *   Tier 2: GPS + IMU 융합 (~5m) — VPS 불가 + ARCore GPS+센서 융합, 중간 FOV(30°)
 *   Tier 3: 기존 7-Factor 폴백 (~10-20m) — ARCore 초기화 실패 시
 *
 * @returns {Object} { geoPose, vpsAvailable, trackingState, isLocalized, isARMode, tier, arError, handlers }
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { checkVPSAvailability } from 'scanpang-arcore';

const useGeospatialTracking = ({ enabled = true } = {}) => {
  // Geospatial pose
  const [geoPose, setGeoPose] = useState(null);
  // VPS 가용 여부
  const [vpsAvailable, setVpsAvailable] = useState(null);
  // Tracking 상태: 'initializing' | 'tracking' | 'limited' | 'stopped'
  const [trackingState, setTrackingState] = useState('initializing');
  // AR 모드 활성 여부 (false = GPS 폴백, Tier 3)
  const [isARMode, setIsARMode] = useState(true);
  // AR 에러
  const [arError, setArError] = useState(null);
  // VPS 체크 완료 여부
  const vpsCheckedRef = useRef(false);

  // 위치 정확도 기반 localized 판정 (horizontalAccuracy < 10m)
  const isLocalized = geoPose != null && geoPose.horizontalAccuracy < 10;

  // 3-Tier 판정
  //   Tier 1: VPS 활성 + localized (정밀 모드)
  //   Tier 2: ARCore tracking 중 + VPS 없음 (GPS+IMU 융합)
  //   Tier 3: ARCore 비활성 (기존 7-Factor)
  const tier = useMemo(() => {
    if (!isARMode) return 3;
    if (trackingState !== 'tracking') return 3;
    if (vpsAvailable && isLocalized) return 1;
    if (trackingState === 'tracking') return 2;
    return 3;
  }, [isARMode, trackingState, vpsAvailable, isLocalized]);

  // Tier별 HUD 정보
  const tierInfo = useMemo(() => {
    switch (tier) {
      case 1: return { label: 'AR 정밀 모드', color: '#10B981', fov: 25 };   // 초록
      case 2: return { label: 'AR 일반 모드', color: '#F59E0B', fov: 30 };   // 노랑
      default: return { label: 'GPS 모드', color: '#888888', fov: 35 };       // 회색
    }
  }, [tier]);

  // ===== ARCameraView 이벤트 핸들러 =====

  const handlePoseUpdate = useCallback((event) => {
    if (!enabled) return;
    const data = event?.nativeEvent || event;
    if (data?.latitude != null) {
      setGeoPose({
        latitude: data.latitude,
        longitude: data.longitude,
        altitude: data.altitude,
        heading: data.heading,
        horizontalAccuracy: data.horizontalAccuracy,
        headingAccuracy: data.headingAccuracy,
        verticalAccuracy: data.verticalAccuracy,
      });

      // 최초 위치 확보 시 VPS 가용성 1회 체크
      if (!vpsCheckedRef.current && data.latitude) {
        vpsCheckedRef.current = true;
        checkVPSAvailability(data.latitude, data.longitude)
          .then(setVpsAvailable)
          .catch(() => setVpsAvailable(false));
      }
    }
  }, [enabled]);

  const handleTrackingStateChanged = useCallback((event) => {
    const data = event?.nativeEvent || event;
    if (data?.state) {
      setTrackingState(data.state);
    }
  }, []);

  const handleReady = useCallback(() => {
    setIsARMode(true);
    setArError(null);
  }, []);

  const handleError = useCallback((event) => {
    const data = event?.nativeEvent || event;
    setArError(data?.error || 'unknown_error');
    setIsARMode(false);
  }, []);

  // 비활성화 시 상태 리셋
  useEffect(() => {
    if (!enabled) {
      setGeoPose(null);
      setTrackingState('initializing');
      vpsCheckedRef.current = false;
    }
  }, [enabled]);

  return {
    geoPose,
    vpsAvailable,
    trackingState,
    isLocalized,
    isARMode,
    tier,
    tierInfo,
    arError,
    // ARCameraView에 전달할 이벤트 핸들러
    handlePoseUpdate,
    handleTrackingStateChanged,
    handleReady,
    handleError,
  };
};

export default useGeospatialTracking;
