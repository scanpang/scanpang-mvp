import { requireNativeViewManager } from 'expo-modules-core';

// 네이티브 뷰 (CameraX 프리뷰 + YOLO 감지)
export const ARCameraView = requireNativeViewManager('ScanPangARCore');

// YOLO 감지 결과 타입
export interface DetectionInfo {
  left: number;     // 0~1 정규화 바운딩박스
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  confidence: number;
}

export interface ObjectDetectionEvent {
  detections: DetectionInfo[];
  timestamp: number;
}

export interface ReadyEvent {
  status: string;
}

export interface ErrorEvent {
  error: string;
}
