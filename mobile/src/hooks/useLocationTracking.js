/**
 * useLocationTracking - GPS + 나침반 위치 추적 훅
 *
 * - GPS: BestForNavigation, 1초 간격
 * - 나침반: Location.watchHeadingAsync (OS 센서 퓨전 heading)
 * - GPS 정확도 30m 초과 시 isLocalized = false
 *
 * @returns {Object} { geoPose, isLocalized, accuracyInfo, gpsError }
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Location from 'expo-location';

// heading 변화 임계값 (3° 미만 변화 무시)
const HEADING_CHANGE_THRESHOLD = 3;
// GPS 정확도 임계값 (30m 초과 → 미localized)
const GPS_ACCURACY_THRESHOLD = 30;

const useLocationTracking = ({ enabled = true } = {}) => {
  const [geoPose, setGeoPose] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  const locationSubRef = useRef(null);
  const headingSubRef = useRef(null);
  const headingRef = useRef(null);       // 최신 heading
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
      hasVPS: false,
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
      headingAccuracy: prev?.headingAccuracy ?? 15,
      verticalAccuracy: accuracy ? accuracy * 2 : 100,
    }));
    setGpsError(null);
  }, []);

  // OS heading 업데이트 (센서 퓨전: 자이로+가속도+자기장)
  const handleHeadingUpdate = useCallback((headingData) => {
    if (!isMountedRef.current || !headingData) return;

    // trueHeading = 진북 기준 (GPS 보정), magHeading = 자북 기준
    const newHeading = headingData.trueHeading >= 0
      ? headingData.trueHeading
      : headingData.magHeading;

    if (newHeading == null || newHeading < 0) return;

    headingRef.current = newHeading;

    // 임계값 이상 변화 시에만 geoPose 갱신
    const lastH = lastHeadingRef.current;
    let diff = lastH != null ? Math.abs(newHeading - lastH) % 360 : 999;
    if (diff > 180) diff = 360 - diff;

    if (lastH === null || diff >= HEADING_CHANGE_THRESHOLD) {
      lastHeadingRef.current = newHeading;
      setGeoPose(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          heading: newHeading,
          headingAccuracy: headingData.accuracy ?? 15,
        };
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

  // OS Heading 구독 (센서 퓨전)
  useEffect(() => {
    if (!enabled) return;

    let sub = null;
    (async () => {
      try {
        sub = await Location.watchHeadingAsync(handleHeadingUpdate);
        headingSubRef.current = sub;
      } catch (e) {
        console.warn('[useLocationTracking] heading 구독 실패:', e.message);
      }
    })();

    return () => {
      sub?.remove();
      headingSubRef.current?.remove();
      headingSubRef.current = null;
    };
  }, [enabled, handleHeadingUpdate]);

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
