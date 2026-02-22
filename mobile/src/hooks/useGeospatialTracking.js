/**
 * useGeospatialTracking - ARCore Geospatial 추적 훅
 *
 * 단일 정확도 시스템: horizontalAccuracy 기반 자동 FOV 조절
 * GPS 항상 실행 → geoPose 도착 시 자동 우선 적용
 *
 * @returns {Object} { geoPose, vpsAvailable, trackingState, isLocalized, isARMode, accuracyInfo, arError, handlers }
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { checkVPSAvailability } from 'scanpang-arcore';

// ARCore 초기화 타임아웃 (GPS가 항상 기본이므로 AR 실패해도 무관, 여유있게 30초)
const AR_INIT_TIMEOUT = 30000;

const useGeospatialTracking = ({ enabled = true } = {}) => {
  // Geospatial pose
  const [geoPose, setGeoPose] = useState(null);
  // VPS 가용 여부
  const [vpsAvailable, setVpsAvailable] = useState(null);
  // Tracking 상태: 'initializing' | 'tracking' | 'limited' | 'stopped'
  const [trackingState, setTrackingState] = useState('initializing');
  // AR 모드 활성 여부 (false = GPS 폴백)
  const [isARMode, setIsARMode] = useState(true);
  // AR 에러
  const [arError, setArError] = useState(null);
  // VPS 체크 완료 여부 + 재시도 횟수
  const vpsCheckedRef = useRef(false);
  const vpsRetryCountRef = useRef(0);
  // AR 초기화 타임아웃 (onReady 수신 전 폴백)
  const arTimeoutRef = useRef(null);
  const arReadyRef = useRef(false);

  // 위치 정확도 기반 localized 판정 (horizontalAccuracy < 10m)
  const isLocalized = geoPose != null && geoPose.horizontalAccuracy < 10;

  // 정확도 기반 모드/HUD 정보
  const accuracyInfo = useMemo(() => {
    const hAcc = geoPose?.horizontalAccuracy ?? null;
    const hdAcc = geoPose?.headingAccuracy ?? null;
    const hasVPS = vpsAvailable && isLocalized;
    const modeLabel = hasVPS ? 'VPS' : isARMode ? 'AR' : 'GPS';
    const modeColor = hasVPS ? '#10B981' : isARMode ? '#3B82F6' : '#888888';
    return { hAcc, hdAcc, hasVPS, modeLabel, modeColor };
  }, [geoPose, vpsAvailable, isLocalized, isARMode]);

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

      // 위치 확보 시 VPS 가용성 체크 (실패 시 최대 2회 재시도)
      if (!vpsCheckedRef.current && data.latitude) {
        vpsCheckedRef.current = true;
        checkVPSAvailability(data.latitude, data.longitude)
          .then((available) => {
            setVpsAvailable(available);
            vpsRetryCountRef.current = 0; // 성공 시 리셋
          })
          .catch(() => {
            // 세션 미준비 등으로 실패 시 재시도 허용
            if (vpsRetryCountRef.current < 2) {
              vpsRetryCountRef.current += 1;
              vpsCheckedRef.current = false; // 다음 pose에서 재시도
            } else {
              setVpsAvailable(false);
            }
          });
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
    arReadyRef.current = true;
    if (arTimeoutRef.current) {
      clearTimeout(arTimeoutRef.current);
      arTimeoutRef.current = null;
    }
    setIsARMode(true);
    setArError(null);
  }, []);

  const handleError = useCallback((event) => {
    const data = event?.nativeEvent || event;
    setArError(data?.error || 'unknown_error');
    setIsARMode(false);
  }, []);

  // AR 초기화 타임아웃: N초 내 onReady 안 오면 CameraView 폴백
  useEffect(() => {
    if (!enabled) return;
    arReadyRef.current = false;
    arTimeoutRef.current = setTimeout(() => {
      if (!arReadyRef.current) {
        console.warn('[useGeospatialTracking] AR 초기화 타임아웃 → CameraView 폴백');
        setIsARMode(false);
        setArError('ar_init_timeout');
      }
    }, AR_INIT_TIMEOUT);
    return () => {
      if (arTimeoutRef.current) {
        clearTimeout(arTimeoutRef.current);
        arTimeoutRef.current = null;
      }
    };
  }, [enabled]);

  // AR 모드 폴백 시 VPS 상태 확정 (null → false)
  useEffect(() => {
    if (!isARMode && vpsAvailable === null) {
      setVpsAvailable(false);
    }
  }, [isARMode, vpsAvailable]);

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
    accuracyInfo,
    arError,
    // ARCameraView에 전달할 이벤트 핸들러
    handlePoseUpdate,
    handleTrackingStateChanged,
    handleReady,
    handleError,
  };
};

export default useGeospatialTracking;
