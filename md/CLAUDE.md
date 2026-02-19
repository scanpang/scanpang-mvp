# CLAUDE.md — ScanPang AR Platform

## 프로젝트 개요

ScanPang은 Vision AI 기반 AR 플랫폼으로, 유저가 카메라로 건물을 비추면 건물 위에 핀/라벨을 AR로 증강 표시하고, 건물 정보를 제공하며, 동시에 유저의 공간 행동데이터를 수집하여 분석 리포트를 생성하는 서비스입니다.

### 핵심 가치
- **기존 업체 (Placer.ai 등)**: "어디 갔나" (GPS 위치 데이터)
- **ScanPang**: "뭘 봤나, 얼마나 봤나, 왜 안 들어갔나" (시각적 주목 데이터)
- 이 데이터는 세계 어디에도 없는 새로운 레이어이며, DOOH/부동산/리테일/도시계획 시장에 동시 판매 가능

### 개발 전략: Option C (하이브리드)
- **Phase 1 (현재, Claude Code)**: 웹/앱 + 건물 DB + 행동데이터 수집 + Gemini 연동 + 자동 DB 플라이휠
- **Phase 2 (이후, Unity 개발자)**: AR 렌더링을 ARCore Geospatial API(VPS)로 교체
- Phase 1의 백엔드/DB/파이프라인은 Phase 2에서 그대로 재사용

### MVP 타겟
- D.Camp Batch 7 데모
- 투자자 IR 시연
- 정부 R&D 중간보고
- 세 가지를 동시에 만족시켜야 함

---

## 기술 스택

### Frontend (Mobile)
- React Native (Expo)
- react-native-camera / expo-camera
- expo-location, expo-sensors (나침반, 가속도계, 자이로스코프)
- react-native-maps
- Bottom Sheet UI (건물 정보 카드)

### Backend
- Node.js (Express 또는 Fastify)
- PostgreSQL + PostGIS (공간 쿼리)
- Prisma ORM
- Render 배포 (기존 scanpang-backend 확장)

### AI / Data
- Google Gemini API (Vision + Live)
- 건물 인식: GPS + 나침반 + 서버 시각 기반 매칭 (Phase 1) → YOLO + Geospatial VPS (Phase 2)
- 자동 DB 구축: Gemini Vision으로 카메라 프레임 분석 → 건물 정보 추출 → DB 저장

### 7-Factor 검증 시스템
1. GPS 좌표 + 거리
2. 나침반 방위각
3. 자이로스코프 (기기 기울기)
4. 가속도계 (이동 상태)
5. 카메라 각도
6. **서버 시각** (시간대별 건물 외관 변화 — 네온사인, 조명, 그림자 방향으로 A/B 건물 구분)
7. Gemini Vision 분석 결과

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                     MOBILE APP (React Native)                    │
│                                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ Camera     │ │ Sensors    │ │ Building   │ │ Behavior     │ │
│  │ View +     │ │ GPS/Compass│ │ Card UI    │ │ Tracker      │ │
│  │ AR Overlay │ │ Gyro/Accel │ │ (Bottom    │ │ (자동 수집)  │ │
│  │            │ │ + 서버시각 │ │  Sheet)    │ │              │ │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬───────┘ │
│        │              │              │                │         │
│  ┌─────┴──────────────┴──────────────┴────────────────┴───────┐ │
│  │              Building Detection Engine                      │ │
│  │  GPS+나침반+서버시각 → 반경 건물 조회 → 방향/거리 계산      │ │
│  │  → 7-Factor 검증 → 건물 확정 → 핀 배치                     │ │
│  └────────────────────────┬────────────────────────────────────┘ │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────────────┐ │
│  │              Gemini Live Integration                         │ │
│  │  카메라 스트림 → 실시간 건물 분석/설명                       │ │
│  │  음성 인터랙션 → 질문/답변                                   │ │
│  │  라이브 정보 감지 → DB 자동 강화                             │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────┘
                            │ REST API + WebSocket
┌───────────────────────────┼──────────────────────────────────────┐
│                     BACKEND (Node.js / Render)                    │
│                                                                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │
│  │ Building   │ │ Behavior   │ │ Gemini     │ │ Flywheel     │  │
│  │ API        │ │ Data API   │ │ Proxy      │ │ Pipeline     │  │
│  │ (CRUD +    │ │ (이벤트    │ │ (Vision +  │ │ (소싱→검증   │  │
│  │  Geo검색)  │ │  스트리밍) │ │  Live)     │ │  →저장)      │  │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬───────┘  │
│        │              │              │                │          │
│  ┌─────┴──────────────┴──────────────┴────────────────┴───────┐  │
│  │              PostgreSQL + PostGIS                            │  │
│  │  buildings | behavior_events | building_profiles |           │  │
│  │  user_sessions | detection_logs | sourced_info              │  │
│  └─────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

---

## DB 스키마

```sql
-- 건물 기본 정보
CREATE TABLE buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  altitude FLOAT,
  heading_from_north FLOAT, -- 건물 정면 방위각
  category VARCHAR(100),
  thumbnail_url TEXT,
  floor_count INT,
  neon_sign_hours JSONB, -- 네온사인 점등 시간대 {"on": "18:00", "off": "06:00"}
  metadata JSONB, -- 기타 확장 정보
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 건물 상세 프로필 (플라이휠로 지속 강화)
CREATE TABLE building_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id),
  category VARCHAR(100), -- 업종, 용도
  description TEXT,
  business_hours JSONB,
  contact JSONB,
  photos JSONB, -- 유저/AI가 수집한 사진들
  live_info JSONB, -- Gemini가 감지한 실시간 정보
  confidence_score FLOAT DEFAULT 0, -- 데이터 신뢰도
  source VARCHAR(50), -- 'public_data', 'user_camera', 'gemini_analysis'
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 행동 데이터 이벤트
CREATE TABLE behavior_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  user_id UUID,
  building_id UUID REFERENCES buildings(id),
  event_type VARCHAR(50) NOT NULL, -- 'gaze_start', 'gaze_end', 'pin_click', 'card_open', 'card_close', 'zoom_in', 'photo_taken', 'ar_interaction', 'entered_building', 'passed_by'
  duration_ms INT, -- 해당 이벤트 지속 시간
  -- 7-Factor 데이터
  gps_lat FLOAT,
  gps_lng FLOAT,
  gps_accuracy FLOAT,
  compass_heading FLOAT,
  gyroscope JSONB, -- {alpha, beta, gamma}
  accelerometer JSONB, -- {x, y, z}
  camera_angle JSONB, -- {pitch, yaw, roll}
  server_timestamp TIMESTAMPTZ NOT NULL, -- 서버 시각 (7번째 factor)
  client_timestamp TIMESTAMPTZ, -- 클라이언트 시각
  -- 메타데이터
  device_info JSONB,
  weather JSONB, -- 날씨 정보 (API 연동)
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 유저 세션
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  start_location GEOGRAPHY(POINT, 4326),
  gaze_path JSONB, -- [{building_id, duration_ms, timestamp}, ...] 시선 경로
  buildings_viewed INT DEFAULT 0,
  buildings_entered INT DEFAULT 0,
  total_gaze_duration_ms INT DEFAULT 0,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gemini 소싱 정보 (플라이휠 파이프라인)
CREATE TABLE sourced_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id),
  source_type VARCHAR(50), -- 'gemini_vision', 'user_report', 'public_api'
  raw_data JSONB, -- Gemini 원본 분석 결과
  extracted_info JSONB, -- 추출된 구조화 정보
  confidence FLOAT,
  verified BOOLEAN DEFAULT FALSE,
  verified_by VARCHAR(50), -- 'auto', 'manual', 'cross_reference'
  session_id UUID, -- 어떤 유저 세션에서 수집됐는지
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 공간 인덱스
CREATE INDEX idx_buildings_location ON buildings USING GIST(location);
CREATE INDEX idx_behavior_events_building ON behavior_events(building_id);
CREATE INDEX idx_behavior_events_session ON behavior_events(session_id);
CREATE INDEX idx_behavior_events_type ON behavior_events(event_type);
CREATE INDEX idx_behavior_events_timestamp ON behavior_events(server_timestamp);
```

---

## API 엔드포인트

### Building API
```
GET    /api/buildings/nearby?lat=&lng=&radius=&server_time=  -- 반경 내 건물 조회 (서버 시각 포함)
GET    /api/buildings/:id                                      -- 건물 상세 정보
GET    /api/buildings/:id/profile                              -- 건물 프로필 (플라이휠 데이터)
POST   /api/buildings                                          -- 건물 등록 (관리자)
PATCH  /api/buildings/:id                                      -- 건물 수정
```

### Behavior Data API
```
POST   /api/behavior/event                                     -- 단일 이벤트 기록
POST   /api/behavior/batch                                     -- 배치 이벤트 기록 (오프라인 버퍼)
POST   /api/behavior/session/start                             -- 세션 시작
PATCH  /api/behavior/session/:id/end                           -- 세션 종료 + 시선경로 저장
GET    /api/behavior/report/:buildingId                        -- 건물별 행동 리포트
GET    /api/behavior/report/area?lat=&lng=&radius=             -- 지역별 행동 리포트
```

### Gemini Proxy API
```
POST   /api/gemini/analyze-frame                               -- 카메라 프레임 건물 분석
POST   /api/gemini/live/start                                  -- Gemini Live 세션 시작
POST   /api/gemini/live/audio                                  -- 음성 메시지 전송
GET    /api/gemini/live/stream                                 -- SSE 스트림 (실시간 응답)
```

### Flywheel API
```
POST   /api/flywheel/source                                    -- 소싱된 정보 제출
GET    /api/flywheel/pending                                   -- 검증 대기 정보 목록
PATCH  /api/flywheel/verify/:id                                -- 정보 검증 처리
GET    /api/flywheel/stats                                     -- 플라이휠 통계
```

### Server Time API
```
GET    /api/time                                               -- 서버 시각 반환 (7-Factor용)
GET    /api/time/context?lat=&lng=                             -- 시각 + 위치 기반 컨텍스트 (일출/일몰, 조명 상태)
```

---

## 개발 순서 (우선순위)

### Sprint 1: Foundation (Day 1-3)
1. 프로젝트 초기화 (모노레포 구조)
2. DB 스키마 생성 + PostGIS 설정
3. Building API (CRUD + 공간 검색)
4. 강남역 주변 건물 시드 데이터 (30~50개)
5. React Native 앱 스켈레톤 + 카메라/GPS 연동

### Sprint 2: Core Detection (Day 4-7)
1. Building Detection Engine (GPS + 나침반 + 서버시각 매칭)
2. 7-Factor 검증 로직
3. AR 오버레이 (2D 핀/라벨 — Phase 1)
4. 건물 정보 카드 UI (Bottom Sheet)

### Sprint 3: Behavior Data (Day 8-10)
1. Behavior Tracker (자동 이벤트 수집)
2. 세션 관리 + 시선 경로 기록
3. 행동 데이터 API + 배치 전송
4. 기본 행동 리포트 생성

### Sprint 4: Gemini + Flywheel (Day 11-14)
1. Gemini Vision API 연동 (카메라 프레임 분석)
2. Gemini Live 연동 (실시간 대화)
3. 자동 DB 구축 파이프라인 (소싱 → 검증 → 저장)
4. 플라이휠 통계 대시보드

### Sprint 5: Polish (Day 15-17)
1. UI/UX 완성도 향상
2. 데모 시나리오 구축 (강남역 주변)
3. 행동 리포트 시각화
4. 성능 최적화 + 버그 수정

---

## 코딩 컨벤션

### 디렉토리 구조
```
scanpang/
├── apps/
│   ├── mobile/          # React Native (Expo)
│   │   ├── src/
│   │   │   ├── screens/
│   │   │   ├── components/
│   │   │   ├── services/     # API 호출
│   │   │   ├── hooks/        # 커스텀 훅
│   │   │   ├── store/        # 상태 관리
│   │   │   ├── utils/
│   │   │   └── types/
│   │   └── app.json
│   └── backend/         # Node.js
│       ├── src/
│       │   ├── routes/
│       │   ├── controllers/
│       │   ├── services/
│       │   ├── models/
│       │   ├── middleware/
│       │   ├── utils/
│       │   └── types/
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
├── packages/
│   └── shared/          # 공유 타입, 유틸리티
├── scripts/
│   ├── seed-buildings.ts
│   └── generate-report.ts
├── docs/
│   ├── api.md
│   ├── architecture.md
│   └── behavior-data-spec.md
├── CLAUDE.md            # 이 파일
├── package.json
└── turbo.json
```

### 코드 스타일
- TypeScript strict mode
- ESLint + Prettier
- 함수형 컴포넌트 + Hooks
- API 응답 표준: `{ success: boolean, data?: T, error?: string }`
- 에러 핸들링: try-catch + 커스텀 에러 클래스
- 주석은 한국어 OK, 변수/함수명은 영어

---

## 환경 변수

```env
# Backend
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
PORT=3000

# Mobile
EXPO_PUBLIC_API_URL=https://scanpang-backend.onrender.com
EXPO_PUBLIC_GOOGLE_MAPS_KEY=...
```

---

## 중요 의사결정 기록

1. **Phase 1은 GPS+나침반+서버시각 기반 건물 매칭** — VPS는 Phase 2에서 Unity로 전환 시 적용
2. **서버 시각을 7번째 검증 factor로 추가** — 시간대별 건물 외관 변화(네온사인, 조명, 그림자)로 A/B 건물 구분 정확도 향상
3. **모노레포 구조** — 프론트/백엔드/공유 패키지를 한 repo에서 관리
4. **행동 데이터는 오프라인 버퍼링** — 네트워크 불안정 시 로컬 저장 후 배치 전송
5. **Gemini Live는 서버 프록시 경유** — API 키 보호 + 서버 시각 동기화 + 소싱 데이터 자동 저장

---

## Compact Instructions

컨텍스트가 30% 이하로 떨어지면:
1. 즉시 현재 작업을 마무리해
2. PROGRESS.md에 다음을 저장해:
   - 완료된 작업 목록
   - 변경된 파일 목록
   - 현재 진행 중이던 작업
   - 다음에 해야 할 작업
   - 발생한 이슈/결정사항
3. git commit -m "[checkpoint] 진행상황 저장"
4. 나에게 "컨텍스트가 부족합니다. 새 세션을 시작해주세요." 라고 알려줘

새 세션 시작 시 반드시 CLAUDE.md와 PROGRESS.md를 먼저 읽고 이어서 작업해.
