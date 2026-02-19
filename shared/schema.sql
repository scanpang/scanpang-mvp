-- ScanPang MVP - DB Schema (Single Source of Truth)
-- PostgreSQL + PostGIS

-- PostGIS 확장
CREATE EXTENSION IF NOT EXISTS postgis;

-- 건물 테이블
CREATE TABLE IF NOT EXISTS buildings (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,              -- 건물명
    address VARCHAR(500) NOT NULL,           -- 주소
    location GEOMETRY(Point, 4326) NOT NULL, -- 좌표 (PostGIS)
    total_floors INTEGER,                    -- 총 층수
    basement_floors INTEGER DEFAULT 0,       -- 지하 층수
    building_use VARCHAR(100),               -- 건물 용도 (오피스, 상업, 주거 등)
    occupancy_rate DECIMAL(5,2),             -- 입주율 (%)
    total_tenants INTEGER,                   -- 총 입점 업체 수
    operating_tenants INTEGER,               -- 영업중 업체 수
    parking_info VARCHAR(200),               -- 주차 정보
    completion_year INTEGER,                 -- 준공연도
    thumbnail_url VARCHAR(500),              -- 건물 썸네일
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 층별 정보 테이블
CREATE TABLE IF NOT EXISTS floors (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    floor_number VARCHAR(10) NOT NULL,       -- 'B2', 'B1', '1F', '2F', 'RF' 등
    floor_order INTEGER NOT NULL,            -- 정렬용 (B2=-2, 1F=1, RF=99)
    tenant_name VARCHAR(200),                -- 입점 업체명
    tenant_category VARCHAR(100),            -- 업종 카테고리
    tenant_icon VARCHAR(50),                 -- 아이콘 코드
    is_vacant BOOLEAN DEFAULT FALSE,         -- 공실 여부
    has_reward BOOLEAN DEFAULT FALSE,        -- 리워드 가능 여부 (더미)
    reward_points INTEGER DEFAULT 0,         -- 리워드 포인트 (더미)
    created_at TIMESTAMP DEFAULT NOW()
);

-- 편의시설 테이블
CREATE TABLE IF NOT EXISTS facilities (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    facility_type VARCHAR(50) NOT NULL,      -- 'ATM', '편의점', '와이파이', '냉난방', '주차장' 등
    location_info VARCHAR(200),              -- '1F 로비', 'B1-B2' 등
    is_available BOOLEAN DEFAULT TRUE,       -- 현재 이용가능 여부
    status_text VARCHAR(100)                 -- '24시간', '무료', '중앙 공급' 등
);

-- 건물 통계 테이블
CREATE TABLE IF NOT EXISTS building_stats (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    stat_type VARCHAR(50) NOT NULL,          -- 'total_floors', 'occupancy', 'tenants', 'operating', 'residents', 'parking_capacity', 'congestion'
    stat_value VARCHAR(100) NOT NULL,        -- '12층', '87%', '24개', '18개'
    stat_icon VARCHAR(50),                   -- 아이콘 코드
    display_order INTEGER DEFAULT 0
);

-- LIVE 피드 테이블 (더미 데이터)
CREATE TABLE IF NOT EXISTS live_feeds (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    feed_type VARCHAR(50) NOT NULL,          -- 'event', 'congestion', 'promotion', 'update'
    title VARCHAR(200) NOT NULL,
    description VARCHAR(500),
    icon VARCHAR(50),
    icon_color VARCHAR(20),
    time_label VARCHAR(50),                  -- '방금', '현재', '5분 전'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 행동 로그 테이블
CREATE TABLE IF NOT EXISTS scan_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,
    building_id INTEGER REFERENCES buildings(id),
    event_type VARCHAR(50) NOT NULL,         -- 'pin_shown', 'pin_tapped', 'card_viewed', 'floor_tapped', 'reward_tapped'
    duration_ms INTEGER,
    distance_meters DECIMAL(10,2),
    user_lat DECIMAL(10,7),
    user_lng DECIMAL(10,7),
    device_heading DECIMAL(5,2),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 건물 상세 프로필 (플라이휠로 지속 강화)
CREATE TABLE IF NOT EXISTS building_profiles (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id) ON DELETE CASCADE,
    category VARCHAR(100),                      -- 업종, 용도
    description TEXT,
    business_hours JSONB,                       -- {"open": "09:00", "close": "18:00", "days": [...]}
    contact JSONB,                              -- {"phone": "...", "email": "...", "website": "..."}
    photos JSONB,                               -- 유저/AI가 수집한 사진들
    live_info JSONB,                            -- Gemini가 감지한 실시간 정보
    confidence_score DECIMAL(3,2) DEFAULT 0,    -- 데이터 신뢰도 (0~1)
    source VARCHAR(50),                         -- 'public_data', 'user_camera', 'gemini_analysis'
    last_verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 행동 데이터 이벤트 (7-Factor 포함)
CREATE TABLE IF NOT EXISTS behavior_events (
    id SERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    user_id UUID,
    building_id INTEGER REFERENCES buildings(id),
    event_type VARCHAR(50) NOT NULL,            -- 'gaze_start', 'gaze_end', 'pin_click', 'card_open', 'card_close', 'zoom_in', 'photo_taken', 'ar_interaction', 'entered_building', 'passed_by'
    duration_ms INTEGER,
    -- 7-Factor 데이터
    gps_lat DECIMAL(10,7),
    gps_lng DECIMAL(10,7),
    gps_accuracy DECIMAL(8,2),
    compass_heading DECIMAL(5,2),
    gyroscope JSONB,                            -- {alpha, beta, gamma}
    accelerometer JSONB,                        -- {x, y, z}
    camera_angle JSONB,                         -- {pitch, yaw, roll}
    server_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
    client_timestamp TIMESTAMP,
    -- 메타데이터
    device_info JSONB,
    weather JSONB,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 유저 세션
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP,
    start_lat DECIMAL(10,7),
    start_lng DECIMAL(10,7),
    gaze_path JSONB,                            -- [{building_id, duration_ms, timestamp}, ...]
    buildings_viewed INTEGER DEFAULT 0,
    buildings_entered INTEGER DEFAULT 0,
    total_gaze_duration_ms INTEGER DEFAULT 0,
    device_info JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Gemini 소싱 정보 (플라이휠 파이프라인)
CREATE TABLE IF NOT EXISTS sourced_info (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    source_type VARCHAR(50),                    -- 'gemini_vision', 'user_report', 'public_api'
    raw_data JSONB,                             -- Gemini 원본 분석 결과
    extracted_info JSONB,                       -- 추출된 구조화 정보
    confidence DECIMAL(3,2),
    verified BOOLEAN DEFAULT FALSE,
    verified_by VARCHAR(50),                    -- 'auto', 'manual', 'cross_reference'
    session_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_buildings_location ON buildings USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id, floor_order);
CREATE INDEX IF NOT EXISTS idx_scan_logs_building ON scan_logs(building_id, created_at);
CREATE INDEX IF NOT EXISTS idx_scan_logs_session ON scan_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_building ON behavior_events(building_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_session ON behavior_events(session_id);
CREATE INDEX IF NOT EXISTS idx_behavior_events_type ON behavior_events(event_type);
CREATE INDEX IF NOT EXISTS idx_behavior_events_timestamp ON behavior_events(server_timestamp);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sourced_info_building ON sourced_info(building_id);
CREATE INDEX IF NOT EXISTS idx_sourced_info_verified ON sourced_info(verified);
CREATE INDEX IF NOT EXISTS idx_building_profiles_building ON building_profiles(building_id);
