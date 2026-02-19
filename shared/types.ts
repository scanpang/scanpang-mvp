// ScanPang MVP - 공통 TypeScript 타입

export interface Building {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  total_floors: number;
  basement_floors: number;
  building_use: string;
  occupancy_rate: number;
  total_tenants: number;
  operating_tenants: number;
  parking_info: string;
  completion_year: number;
  thumbnail_url: string;
  // 클라이언트 계산 필드
  distance_meters?: number;
  direction?: 'left' | 'right' | 'front';
}

export interface Floor {
  id: number;
  building_id: number;
  floor_number: string;
  floor_order: number;
  tenant_name: string;
  tenant_category: string;
  tenant_icon: string;
  is_vacant: boolean;
  has_reward: boolean;
  reward_points: number;
}

export interface Facility {
  id: number;
  building_id: number;
  facility_type: string;
  location_info: string;
  is_available: boolean;
  status_text: string;
}

export interface BuildingStat {
  id: number;
  building_id: number;
  stat_type: string;
  stat_value: string;
  stat_icon: string;
  display_order: number;
}

export interface LiveFeed {
  id: number;
  building_id: number;
  feed_type: 'event' | 'congestion' | 'promotion' | 'update';
  title: string;
  description: string;
  icon: string;
  icon_color: string;
  time_label: string;
  is_active: boolean;
}

export interface ScanLog {
  session_id: string;
  building_id: number;
  event_type: 'pin_shown' | 'pin_tapped' | 'card_viewed' | 'floor_tapped' | 'reward_tapped';
  duration_ms?: number;
  distance_meters?: number;
  user_lat: number;
  user_lng: number;
  device_heading?: number;
  metadata?: Record<string, unknown>;
}

export interface BuildingProfile {
  building: Building;
  floors: Floor[];
  facilities: Facility[];
  stats: BuildingStat[];
  liveFeeds: LiveFeed[];
}

export interface NearbyBuildingsResponse {
  buildings: Building[];
  user_lat: number;
  user_lng: number;
  radius: number;
}

// === 행동 데이터 ===

export interface BehaviorEvent {
  sessionId: string;
  userId?: string;
  buildingId?: number;
  eventType: 'gaze_start' | 'gaze_end' | 'pin_click' | 'card_open' | 'card_close' | 'zoom_in' | 'photo_taken' | 'ar_interaction' | 'entered_building' | 'passed_by';
  durationMs?: number;
  // 7-Factor 데이터
  gpsLat?: number;
  gpsLng?: number;
  gpsAccuracy?: number;
  compassHeading?: number;
  gyroscope?: { alpha: number; beta: number; gamma: number };
  accelerometer?: { x: number; y: number; z: number };
  cameraAngle?: { pitch: number; yaw: number; roll: number };
  clientTimestamp?: string;
  deviceInfo?: Record<string, unknown>;
  weather?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UserSession {
  id: string;
  userId?: string;
  startedAt: string;
  endedAt?: string;
  startLat?: number;
  startLng?: number;
  gazePath?: Array<{ buildingId: number; durationMs: number; timestamp: string }>;
  buildingsViewed: number;
  buildingsEntered: number;
  totalGazeDurationMs: number;
  deviceInfo?: Record<string, unknown>;
}

export interface BehaviorReport {
  buildingId: number;
  summary: {
    totalEvents: number;
    uniqueSessions: number;
    gazeCount: number;
    avgGazeDurationMs: number;
    pinClicks: number;
    cardOpens: number;
    entries: number;
    passBys: number;
    conversionRate: number;
  };
  hourlyDistribution: Array<{ hour: number; count: number }>;
  dailyTrend: Array<{ date: string; events: number; sessions: number }>;
}

// === 플라이휠 ===

export interface SourcedInfo {
  id: number;
  buildingId: number;
  sourceType: 'gemini_vision' | 'user_report' | 'public_api';
  rawData?: Record<string, unknown>;
  extractedInfo?: Record<string, unknown>;
  confidence?: number;
  verified: boolean;
  verifiedBy?: 'auto' | 'manual' | 'cross_reference';
  sessionId?: string;
  createdAt: string;
}

export interface FlywheelStats {
  totalSourced: number;
  verifiedCount: number;
  pendingCount: number;
  buildingsCovered: number;
  verificationRate: number;
  sourceBreakdown: {
    geminiVision: number;
    userReport: number;
    publicApi: number;
  };
  avgConfidence: number;
  last24hSourcing: number;
  totalProfiles: number;
}

// === 서버 시각 ===

export interface ServerTimeContext {
  serverTime: string;
  timestamp: number;
  timezone: string;
  location: { lat: number; lng: number };
  sun: { sunrise: string; sunset: string };
  context: {
    period: 'night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk';
    lighting: 'natural' | 'artificial' | 'transitioning';
    neonActive: boolean;
    shadowDirection: string | null;
    currentHour: number;
    isDaytime: boolean;
    description: string;
  };
}
