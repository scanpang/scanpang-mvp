/**
 * useLocationTracking - GPS + 나침반 위치 추적 훅
 *
 * ARCore Geospatial 대체: expo-location + expo-sensors
 * - GPS: BestForNavigation, 1초 간격
 * - 나침반: Magnetometer → heading (EMA 스무딩)
 * - GPS 정확도 30m 초과 시 isLocalized = false
 *
 * @returns {Object} { geoPose, isLocalized, accuracyInfo, gpsError }
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';

// EMA 스무딩 계수 (0~1, 높을수록 최신값 반영)
const EMA_ALPHA = 0.3;
// heading 변화 임계값 (5° 미만 변화 무시)
const HEADING_CHANGE_THRESHOLD = 5;
// GPS 정확도 임계값 (30m 초과 → 미localized)
const GPS_ACCURACY_THRESHOLD = 30;

/**
 * Magnetometer raw → heading 계산
 */
const computeHeading = (x, y) => {
  let angle = Math.atan2(y, x) * (180 / Math.PI);
  return (angle + 360) % 360;
};

/**
 * 각도 EMA 스무딩 (순환 각도 보정)
 */
const smoothAngle = (prev, current, alpha) => {
  if (prev === null) return current;
  let diff = current - prev;
  // -180~+180 보정
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  const smoothed = prev + alpha * diff;
  return (smoothed + 360) % 360;
};

const useLocationTracking = ({ enabled = true } = {}) => {
  const [geoPose, setGeoPose] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  const locationSubRef = useRef(null);
  const magnetSubRef = useRef(null);
  const headingRef = useRef(null);       // EMA 스무딩된 heading
  const lastHeadingRef = useRef(null);   // 마지막 geoPose에 반영된 heading
  const isMountedRef = useRef(true);

  // GPS 정확도 30m 이하 + geoPose 존재 시 localized
  const isLocalized = geoPose != null && (geoPose.horizontalAccuracy ?? 999) <= GPS_ACCURACY_THRESHOLD;

  // 정확도 정보 (HUD 표시용)
  const accuracyInfo = useMemo(() => {
    const hAcc = geoPose?.horizontalAccuracy ?? null;
    const hdAcc = geoPose?.headingAccuracy ?? null;
    return {
      hAcc,
      hdAcc,
      hasVPS: false,  // VPS 없음
      modeLabel: 'GPS',
      modeColor: isLocalized ? '#10B981' : '#888888',
    };
  }, [geoPose, isLocalized]);

  // GPS 위치 업데이트 핸들러
  const handleLocationUpdate = useCallback((location) => {
    if (!isMountedRef.current) return;
    const { latitude, longitude, altitude, accuracy } = location.coords;

    setGeoPose(prev => ({
      latitude,
      longitude,
      altitude: altitude ?? 0,
      heading: headingRef.current ?? prev?.heading ?? 0,
      horizontalAccuracy: accuracy ?? 50,
      headingAccuracy: 15, // 나침반 기본 정확도
      verticalAccuracy: accuracy ? accuracy * 2 : 100,
    }));
    setGpsError(null);
  }, []);

  // Magnetometer heading 업데이트
  const handleMagnetometer = useCallback((data) => {
    if (!isMountedRef.current || !data) return;

    const rawHeading = computeHeading(data.x, data.y);
    const smoothed = smoothAngle(headingRef.current, rawHeading, EMA_ALPHA);
    headingRef.current = smoothed;

    // 임계값 이상 변화 시에만 geoPose 갱신
    const lastH = lastHeadingRef.current;
    if (lastH === null || Math.abs(smoothed - lastH) >= HEADING_CHANGE_THRESHOLD) {
      lastHeadingRef.current = smoothed;
      setGeoPose(prev => {
        if (!prev) return prev;
        return { ...prev, heading: smoothed };
      });
    }
  }, []);

  // GPS 구독
  useEffect(() => {
    if (!enabled) return;

    let sub = null;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setGpsError('permission_denied');
          return;
        }

        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000,
            distanceInterval: 1,
          },
          handleLocationUpdate,
        );
        locationSubRef.current = sub;
      } catch (e) {
        if (isMountedRef.current) {
          setGpsError(e.message || 'location_error');
        }
      }
    })();

    return () => {
      sub?.remove();
      locationSubRef.current?.remove();
      locationSubRef.current = null;
    };
  }, [enabled, handleLocationUpdate]);

  // Magnetometer 구독
  useEffect(() => {
    if (!enabled) return;

    Magnetometer.setUpdateInterval(100); // 100ms 간격
    const sub = Magnetometer.addListener(handleMagnetometer);
    magnetSubRef.current = sub;

    return () => {
      magnetSubRef.current?.remove();
      magnetSubRef.current = null;
    };
  }, [enabled, handleMagnetometer]);

  // 비활성화 시 상태 리셋
  useEffect(() => {
    if (!enabled) {
      setGeoPose(null);
      setGpsError(null);
      headingRef.current = null;
      lastHeadingRef.current = null;
    }
  }, [enabled]);

  // 마운트 관리
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  return {
    geoPose,
    isLocalized,
    accuracyInfo,
    gpsError,
  };
};

export default useLocationTracking;
