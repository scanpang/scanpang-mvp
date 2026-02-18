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
