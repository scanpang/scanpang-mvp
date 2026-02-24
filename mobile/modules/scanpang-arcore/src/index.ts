import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';

// 네이티브 모듈
const ScanPangARCoreModule = requireNativeModule('ScanPangARCore');

// 네이티브 뷰 (ARCameraView)
export const ARCameraView = requireNativeViewManager('ScanPangARCore');

// 타입 정의
export interface GeospatialPose {
  latitude: number;
  longitude: number;
  altitude: number;
  heading: number;
  horizontalAccuracy: number;
  headingAccuracy: number;
  verticalAccuracy: number;
  depthMeters?: number;      // 화면 중앙 깊이 (미터), undefined=측정 불가
  depthSupported?: boolean;  // 기기 Depth API 지원 여부
}

export interface TrackingStateEvent {
  state: 'initializing' | 'tracking' | 'limited' | 'stopped';
}

export interface ARReadyEvent {
  status: string;
}

export interface ARErrorEvent {
  error: string;
}

// ML Kit 객체 감지 결과
export interface DetectedObjectInfo {
  left: number;     // 0~1 정규화 바운딩박스
  top: number;
  right: number;
  bottom: number;
  trackingId: number;
  labels: string[];
  confidence: number;
}

export interface ObjectDetectionEvent {
  detections: DetectedObjectInfo[];
  imageWidth: number;
  imageHeight: number;
  timestamp: number;
}

// API 함수

/** ARCore Geospatial 지원 여부 (동기) */
export function isARCoreSupported(): boolean {
  return ScanPangARCoreModule.isARCoreSupported();
}

/** 현재 Geospatial pose 조회 */
export async function getGeospatialPose(): Promise<GeospatialPose | null> {
  return await ScanPangARCoreModule.getGeospatialPose();
}

/** VPS 가용성 체크 */
export async function checkVPSAvailability(lat: number, lng: number): Promise<boolean> {
  return await ScanPangARCoreModule.checkVPSAvailability(lat, lng);
}

