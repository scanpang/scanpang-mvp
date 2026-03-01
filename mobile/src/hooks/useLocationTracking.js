/**
 * useLocationTracking - GPS + 커스텀 네이티브 heading 위치 추적 훅
 *
 * - GPS: BestForNavigation, 1초 간격
 * - heading: ScanPangHeading 네이티브 모듈 (TYPE_ROTATION_VECTOR + remapCoordinateSystem)
 *   → 세로 들기(카메라 자세) 보정 포함
 * - GPS 정확도 30m 초과 시 isLocalized = false
 *
 * @returns {Object} { geoPose, isLocalized, accuracyInfo, gpsError }
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import * as Location from 'expo-location';
import { startWatching, stopWatching, addHeadingListener } from 'scanpang-heading';

// heading 변화 임계값 (3° 미만 변화 무시)
const HEADING_CHANGE_THRESHOLD = 3;
// GPS 정확도 임계값 (30m 초과 → 미localized)
const GPS_ACCURACY_THRESHOLD = 30;

const useLocationTracking = ({ enabled = true } = {}) => {
  const [geoPose, setGeoPose] = useState(null);
  const [gpsError, setGpsError] = useState(null);

  const locationSubRef = useRef(null);
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

  // 네이티브 heading 업데이트 (TYPE_ROTATION_VECTOR + remapCoordinateSystem)
  const handleHeadingUpdate = useCallback((event) => {
    if (!isMountedRef.current || !event) return;

    const newHeading = event.heading;
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
          headingAccuracy: 5, // 네이티브 ROTATION_VECTOR는 고정밀
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

  // 네이티브 Heading 구독 (ScanPangHeading: ROTATION_VECTOR + remapCoordinateSystem)
  useEffect(() => {
    if (!enabled) return;

    const subscription = addHeadingListener(handleHeadingUpdate);
    startWatching();

    return () => {
      stopWatching();
      subscription.remove();
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
