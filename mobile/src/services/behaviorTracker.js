/**
 * BehaviorTracker - 자동 행동 데이터 수집 서비스
 *
 * 기능:
 * - 세션 관리 (시작/종료)
 * - Gaze tracking (시선 추적)
 * - 이벤트 자동 수집
 * - 오프라인 버퍼 + 배치 전송
 * - 7-Factor 센서 데이터 첨부
 * - BHDB 듀얼 전송 (BHDB 우선, Render 폴백)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { apiClient } from './api';
import { BHDB_API_URL, BHDB_API_KEY } from '../constants/config';

const BEHAVIOR_QUEUE_KEY = '@scanpang_behavior_queue';
const MAX_QUEUE_SIZE = 200;
const BATCH_SIZE = 50;
const FLUSH_INTERVAL = 30000; // 30초마다 배치 전송

// BHDB 전용 axios 인스턴스
const bhdbClient = axios.create({
  baseURL: BHDB_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${BHDB_API_KEY}`,
  },
});

class BehaviorTracker {
  constructor() {
    this.sessionId = null;
    this.bhdbSessionId = null; // BHDB에서 발급받은 UUID 세션
    this.isTracking = false;
    this.gazeState = new Map(); // buildingId → { startTime, lastSeen }
    this.eventQueue = [];
    this.flushTimer = null;
    this.sensorSnapshot = null;
    this.userLocation = null;
  }

  /**
   * 세션 시작
   */
  async startSession(options = {}) {
    const { userId, startLat, startLng, deviceInfo } = options;

    // BHDB 우선 시도
    try {
      const bhdbRes = await bhdbClient.post('/session/start', {
        userId,
        startLat,
        startLng,
        deviceInfo,
      });
      this.bhdbSessionId = bhdbRes?.data?.sessionId || null;
      this.sessionId = this.bhdbSessionId;
    } catch {
      this.bhdbSessionId = null;
    }

    // BHDB 실패 시 기존 Render 폴백
    if (!this.sessionId) {
      try {
        const response = await apiClient.post('/behavior/session/start', {
          userId,
          startLat,
          startLng,
          deviceInfo,
        });
        this.sessionId = response?.data?.sessionId || `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      } catch {
        this.sessionId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      }
    }

    this.isTracking = true;
    this.gazeState.clear();
    this.startAutoFlush();

    return this.sessionId;
  }

  /**
   * 세션 종료
   */
  async endSession() {
    if (!this.sessionId) return;

    // 진행 중인 gaze 종료
    for (const [buildingId] of this.gazeState) {
      this.endGaze(buildingId);
    }

    // 남은 이벤트 전송
    await this.flush();

    // 서버에 세션 종료 알림
    const gazePath = this.buildGazePath();
    const endPayload = {
      gazePath,
      buildingsViewed: gazePath.length,
      buildingsEntered: 0,
      totalGazeDurationMs: gazePath.reduce((sum, g) => sum + g.durationMs, 0),
      endLat: this.userLocation?.lat || null,
      endLng: this.userLocation?.lng || null,
    };

    // BHDB 종료
    if (this.bhdbSessionId) {
      try {
        await bhdbClient.patch(`/session/${this.bhdbSessionId}/end`, endPayload);
      } catch {
        // 실패 시 무시
      }
    }

    // Render 종료 (폴백)
    try {
      await apiClient.patch(`/behavior/session/${this.sessionId}/end`, endPayload);
    } catch {
      // 실패 시 무시
    }

    this.stopAutoFlush();
    this.isTracking = false;
    this.sessionId = null;
    this.bhdbSessionId = null;
    this.gazeState.clear();
  }

  /**
   * 센서 데이터 업데이트 (ScanCameraScreen에서 주기적 호출)
   */
  updateSensorData(snapshot) {
    this.sensorSnapshot = snapshot;
  }

  /**
   * 위치 업데이트
   */
  updateLocation(lat, lng, accuracy) {
    this.userLocation = { lat, lng, accuracy: accuracy || null };
  }

  /**
   * Gaze 시작 (건물이 화면에 보이기 시작)
   */
  startGaze(buildingId) {
    if (!this.isTracking || !buildingId) return;
    if (this.gazeState.has(buildingId)) {
      // 이미 추적 중 → lastSeen 업데이트
      this.gazeState.get(buildingId).lastSeen = Date.now();
      return;
    }

    this.gazeState.set(buildingId, {
      startTime: Date.now(),
      lastSeen: Date.now(),
    });

    this.trackEvent('gaze_start', { buildingId });
  }

  /**
   * Gaze 종료 (건물이 화면에서 사라짐)
   */
  endGaze(buildingId) {
    if (!this.isTracking || !buildingId) return;
    const state = this.gazeState.get(buildingId);
    if (!state) return;

    const durationMs = Date.now() - state.startTime;
    this.gazeState.delete(buildingId);

    if (durationMs > 500) { // 0.5초 이상만 기록
      this.trackEvent('gaze_end', { buildingId, durationMs });
    }
  }

  /**
   * 화면에 보이는 건물 목록 업데이트 (매 프레임)
   * 이전에 보였는데 지금 안 보이는 건물 → gaze_end
   */
  updateVisibleBuildings(visibleBuildingIds) {
    if (!this.isTracking) return;

    const visibleSet = new Set(visibleBuildingIds);

    // 새로 보이는 건물 → gaze_start
    for (const id of visibleBuildingIds) {
      this.startGaze(id);
    }

    // 안 보이게 된 건물 → gaze_end (3초 유예)
    for (const [id, state] of this.gazeState) {
      if (!visibleSet.has(id) && Date.now() - state.lastSeen > 3000) {
        this.endGaze(id);
      }
    }
  }

  /**
   * 이벤트 기록 (자동으로 7-Factor 데이터 첨부)
   */
  trackEvent(eventType, data = {}) {
    if (!this.isTracking || !this.sessionId) return;

    const event = {
      sessionId: this.bhdbSessionId || this.sessionId,
      eventType,
      buildingId: data.buildingId || null,
      durationMs: data.durationMs || null,
      gpsLat: this.userLocation?.lat || null,
      gpsLng: this.userLocation?.lng || null,
      gpsAccuracy: this.userLocation?.accuracy || null,
      compassHeading: this.sensorSnapshot?.heading || null,
      gyroscope: this.sensorSnapshot?.gyroscope || null,
      accelerometer: this.sensorSnapshot?.accelerometer || null,
      cameraAngle: this.sensorSnapshot?.cameraAngle || null,
      clientTimestamp: new Date().toISOString(),
      metadata: data.metadata || null,
    };

    this.eventQueue.push(event);

    // 큐 오버플로 시 즉시 flush 트리거 후 FIFO 유지
    if (this.eventQueue.length > MAX_QUEUE_SIZE) {
      this.flush();
      // flush 후에도 초과 시 오래된 이벤트부터 드롭
      if (this.eventQueue.length > MAX_QUEUE_SIZE) {
        this.eventQueue = this.eventQueue.slice(-MAX_QUEUE_SIZE);
      }
    }

    // 배치 사이즈 도달 시 즉시 전송
    if (this.eventQueue.length >= BATCH_SIZE) {
      this.flush();
    }
  }

  /**
   * 배치 전송 (BHDB 우선, 실패 시 Render 폴백)
   */
  async flush() {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0, BATCH_SIZE);

    // BHDB 전송 시도
    try {
      await bhdbClient.post('/batch', { events: batch });
      return; // 성공 시 종료
    } catch {
      // BHDB 실패 → Render 폴백
    }

    // Render 폴백
    try {
      await apiClient.post('/behavior/batch', { events: batch });
    } catch {
      // 둘 다 실패 시 로컬 스토리지에 저장
      await this.saveToStorage(batch);
    }
  }

  /**
   * 오프라인 저장
   */
  async saveToStorage(events) {
    try {
      const raw = await AsyncStorage.getItem(BEHAVIOR_QUEUE_KEY);
      const stored = raw ? JSON.parse(raw) : [];
      stored.push(...events);
      if (stored.length > MAX_QUEUE_SIZE) stored.splice(0, stored.length - MAX_QUEUE_SIZE);
      await AsyncStorage.setItem(BEHAVIOR_QUEUE_KEY, JSON.stringify(stored));
    } catch {
      // 무시
    }
  }

  /**
   * 오프라인 저장된 이벤트 전송 시도 (BHDB 우선)
   */
  async flushStoredEvents() {
    try {
      const raw = await AsyncStorage.getItem(BEHAVIOR_QUEUE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (stored.length === 0) return;

      const remaining = [];
      for (let i = 0; i < stored.length; i += BATCH_SIZE) {
        const chunk = stored.slice(i, i + BATCH_SIZE);
        try {
          await bhdbClient.post('/batch', { events: chunk });
        } catch {
          // BHDB 실패 → Render 폴백
          try {
            await apiClient.post('/behavior/batch', { events: chunk });
          } catch {
            remaining.push(...chunk);
          }
        }
      }
      await AsyncStorage.setItem(BEHAVIOR_QUEUE_KEY, JSON.stringify(remaining));
    } catch {
      // 무시
    }
  }

  /**
   * 자동 배치 전송 시작
   */
  startAutoFlush() {
    this.stopAutoFlush();
    this.flushTimer = setInterval(() => {
      this.flush();
      this.flushStoredEvents();
    }, FLUSH_INTERVAL);
  }

  /**
   * 자동 배치 전송 중지
   */
  stopAutoFlush() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Gaze path 빌드 (세션 종료 시 사용)
   */
  buildGazePath() {
    // gazeState에 남아있는 항목들로 경로 구성
    const path = [];
    for (const [buildingId, state] of this.gazeState) {
      path.push({
        buildingId,
        durationMs: Date.now() - state.startTime,
        timestamp: new Date(state.startTime).toISOString(),
      });
    }
    return path;
  }
}

// 싱글톤 인스턴스
export const behaviorTracker = new BehaviorTracker();
export default behaviorTracker;
