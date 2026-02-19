/**
 * useSensorData - 통합 센서 데이터 수집 훅
 *
 * 수집하는 센서:
 * - Gyroscope (자이로스코프): 기기 회전 속도
 * - Accelerometer (가속도계): 기기 가속도
 * - DeviceMotion: 기기 기울기 (pitch/roll/yaw)
 *
 * 7-Factor 중 Factor 3, 4, 5에 해당
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Gyroscope, Accelerometer } from 'expo-sensors';

// 센서 업데이트 간격 (ms)
const GYRO_INTERVAL = 500;
const ACCEL_INTERVAL = 500;

/**
 * @param {Object} options
 * @param {boolean} options.enabled - 센서 활성화 여부
 * @param {number} options.gyroInterval - 자이로 업데이트 간격 (ms)
 * @param {number} options.accelInterval - 가속도계 업데이트 간격 (ms)
 * @returns {Object} { gyroscope, accelerometer, cameraAngle, isStable, motionState }
 */
const useSensorData = ({
  enabled = true,
  gyroInterval = GYRO_INTERVAL,
  accelInterval = ACCEL_INTERVAL,
} = {}) => {
  // 자이로스코프: {x, y, z} → 회전 속도
  const [gyroscope, setGyroscope] = useState(null);
  // 가속도계: {x, y, z} → 가속도 (중력 포함)
  const [accelerometer, setAccelerometer] = useState(null);
  // 카메라 각도: pitch(상하), yaw(좌우), roll(틸트)
  const [cameraAngle, setCameraAngle] = useState(null);
  // 안정성 상태
  const [isStable, setIsStable] = useState(false);
  // 이동 상태: 'stationary', 'walking', 'moving_fast'
  const [motionState, setMotionState] = useState('stationary');

  const gyroSubRef = useRef(null);
  const accelSubRef = useRef(null);
  const isMountedRef = useRef(true);

  // 이동 감지용 버퍼
  const accelBufferRef = useRef([]);
  const BUFFER_SIZE = 5;

  // 가속도계 데이터로 이동 상태 판별
  const classifyMotion = useCallback((accelData) => {
    if (!accelData) return;

    const { x, y, z } = accelData;
    const gravity = 9.81;
    const magnitude = Math.sqrt(x * x + y * y + z * z);
    const movement = Math.abs(magnitude - gravity);

    // 버퍼에 추가
    accelBufferRef.current.push(movement);
    if (accelBufferRef.current.length > BUFFER_SIZE) {
      accelBufferRef.current.shift();
    }

    // 평균 이동량으로 상태 판별
    const avg = accelBufferRef.current.reduce((a, b) => a + b, 0) / accelBufferRef.current.length;

    if (avg < 0.5) {
      setMotionState('stationary');
      setIsStable(true);
    } else if (avg < 2.0) {
      setMotionState('walking');
      setIsStable(false);
    } else {
      setMotionState('moving_fast');
      setIsStable(false);
    }
  }, []);

  // 가속도계로부터 카메라 각도 추정
  const estimateCameraAngle = useCallback((accelData) => {
    if (!accelData) return;
    const { x, y, z } = accelData;

    // pitch: 위아래 각도 (0=수평, 90=수직위, -90=수직아래)
    const pitch = Math.atan2(-x, Math.sqrt(y * y + z * z)) * (180 / Math.PI);
    // roll: 좌우 기울기
    const roll = Math.atan2(y, z) * (180 / Math.PI);

    setCameraAngle({
      pitch: Math.round(pitch * 10) / 10,
      yaw: 0, // yaw는 나침반 heading으로 대체 (여기서는 0)
      roll: Math.round(roll * 10) / 10,
    });
  }, []);

  // Gyroscope 리스너
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    (async () => {
      const available = await Gyroscope.isAvailableAsync();
      if (!available || !mounted) return;

      Gyroscope.setUpdateInterval(gyroInterval);
      gyroSubRef.current = Gyroscope.addListener((data) => {
        if (isMountedRef.current) {
          // expo-sensors의 gyro는 rad/s → deg/s 변환
          setGyroscope({
            alpha: Math.round(data.z * 57.2958 * 10) / 10,
            beta: Math.round(data.x * 57.2958 * 10) / 10,
            gamma: Math.round(data.y * 57.2958 * 10) / 10,
          });
        }
      });
    })();

    return () => {
      mounted = false;
      gyroSubRef.current?.remove();
    };
  }, [enabled, gyroInterval]);

  // Accelerometer 리스너
  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    (async () => {
      const available = await Accelerometer.isAvailableAsync();
      if (!available || !mounted) return;

      Accelerometer.setUpdateInterval(accelInterval);
      accelSubRef.current = Accelerometer.addListener((data) => {
        if (isMountedRef.current) {
          // expo-sensors의 accel은 G단위 → m/s² 변환
          const accel = {
            x: Math.round(data.x * 9.81 * 100) / 100,
            y: Math.round(data.y * 9.81 * 100) / 100,
            z: Math.round(data.z * 9.81 * 100) / 100,
          };
          setAccelerometer(accel);
          classifyMotion(accel);
          estimateCameraAngle(accel);
        }
      });
    })();

    return () => {
      mounted = false;
      accelSubRef.current?.remove();
    };
  }, [enabled, accelInterval, classifyMotion, estimateCameraAngle]);

  // 클린업
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * 현재 센서 데이터 스냅샷 (BehaviorTracker 등에서 사용)
   */
  const getSnapshot = useCallback(() => ({
    gyroscope,
    accelerometer,
    cameraAngle,
    isStable,
    motionState,
    timestamp: Date.now(),
  }), [gyroscope, accelerometer, cameraAngle, isStable, motionState]);

  return {
    gyroscope,
    accelerometer,
    cameraAngle,
    isStable,
    motionState,
    getSnapshot,
  };
};

export default useSensorData;
