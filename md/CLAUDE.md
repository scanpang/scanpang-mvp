# ScanPang MVP - Claude Code 멀티 에이전트 프로젝트

## 프로젝트 개요
ScanPang(스캔팡)은 카메라로 건물을 비추면 해당 건물의 층별 정보, 입점 현황, 편의시설 등을 즉시 보여주는 AR 기반 실공간 정보 서비스입니다.

### MVP 핵심 목표
**"강남·역삼 일대에서 카메라를 비추면 건물을 인식하고, 층별 정보와 건물 프로필을 보여준다"**

### MVP 대상 지역
- 강남역·역삼역 반경 500m
- 주요 오피스/상업 건물 30~50개

---

## 프로젝트 구조

```
scanpang-mvp/
├── CLAUDE.md                # 이 파일 (team-lead 지시서)
├── backend/                 # API 서버 (Node.js + Express + PostgreSQL + PostGIS)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── buildings.js     # 건물 조회 API
│   │   │   ├── scan.js          # 스캔(행동 로그) API
│   │   │   └── live.js          # LIVE 더미 데이터 API
│   │   ├── models/
│   │   │   ├── building.js      # 건물 모델
│   │   │   ├── floor.js         # 층별 정보 모델
│   │   │   ├── tenant.js        # 입점 업체 모델
│   │   │   └── scanLog.js       # 행동 로그 모델
│   │   ├── services/
│   │   │   ├── geospatial.js    # 좌표 기반 건물 매칭
│   │   │   └── buildingProfile.js # 건물 프로필 조합
│   │   ├── middleware/
│   │   │   └── auth.js          # 간단한 API 키 인증
│   │   ├── db/
│   │   │   ├── migrations/      # DB 마이그레이션
│   │   │   └── seeds/           # 초기 데이터 시드
│   │   └── app.js               # Express 앱 엔트리
│   ├── package.json
│   └── .env.example
├── mobile/                  # React Native 앱 (Expo)
│   ├── src/
│   │   ├── screens/
│   │   │   ├── HomeScreen.js        # 모드 선택 화면
│   │   │   └── ScanScreen.js        # 카메라 + 건물 정보 메인 화면
│   │   ├── components/
│   │   │   ├── CameraView.js        # AR 카메라 뷰 + 건물 핀 오버레이
│   │   │   ├── BuildingPin.js       # 건물 이름 태그
│   │   │   ├── FloorOverlay.js      # 층별 정보 오버레이 (카메라 위)
│   │   │   ├── BuildingCard.js      # 하단 건물 정보 카드
│   │   │   ├── FloorList.js         # 층별 입점 현황 리스트
│   │   │   ├── FacilityChips.js     # 편의시설 칩 (ATM, 편의점 등)
│   │   │   ├── StatsRow.js          # 건물 지표 (총 층수, 입주율 등)
│   │   │   ├── LiveSection.js       # "지금 이 순간" LIVE (더미)
│   │   │   ├── PointBadge.js        # 포인트 표시 (더미)
│   │   │   └── RewardButton.js      # "포인트 받기" 버튼 (더미)
│   │   ├── services/
│   │   │   ├── api.js               # 백엔드 API 클라이언트
│   │   │   ├── geospatial.js        # Geospatial API 연동
│   │   │   └── scanLogger.js        # 행동 데이터 로깅
│   │   ├── hooks/
│   │   │   ├── useNearbyBuildings.js
│   │   │   └── useBuildingDetail.js
│   │   ├── constants/
│   │   │   ├── dummyData.js         # 더미 데이터 (포인트, LIVE)
│   │   │   └── theme.js             # UI 테마 (다크 테마)
│   │   └── utils/
│   │       └── coordinate.js        # 좌표 계산 유틸
│   ├── app.json
│   └── package.json
├── data-pipeline/           # 건물 DB 구축 파이프라인 (Python)
│   ├── collectors/
│   │   ├── building_ledger.py   # 건축물대장 공공API 수집
│   │   ├── naver_places.py      # 네이버 플레이스 매장 정보
│   │   └── google_places.py     # Google Places API 매장 정보
│   ├── processors/
│   │   ├── merger.py            # 데이터 통합/정제
│   │   └── geocoder.py          # 주소 → 좌표 변환
│   ├── loaders/
│   │   └── db_loader.py         # PostgreSQL 적재
│   ├── config.py
│   ├── main.py                  # 파이프라인 실행 엔트리
│   ├── requirements.txt
│   └── .env.example
└── shared/                  # 공통 스키마/타입
    ├── schema.sql               # DB 스키마 (PostgreSQL + PostGIS)
    └── types.ts                 # 공통 TypeScript 타입
```

---

## 에이전트 팀 구성

### @team-lead (메인 - Opus)
- 전체 아키텍처 관리, 태스크 분배, 의존성 조율
- DB 스키마 설계 (shared/schema.sql)
- 코드 리뷰 및 통합

### @backend-dev (Sonnet)
- Express API 서버 구현
- PostgreSQL + PostGIS 쿼리
- 건물 조회, 행동 로그, LIVE 더미 API

### @frontend-dev (Sonnet)
- React Native(Expo) 모바일 앱
- 카메라 뷰 + 건물 핀 + 정보 카드 UI
- 포인트/리워드/LIVE 더미 UI

### @data-pipeline (Sonnet)
- Python 데이터 수집 스크립트
- 공공데이터 + 네이버/구글 매장 정보 수집
- DB 적재

---

## DB 스키마 (핵심)

```sql
-- PostGIS 확장
CREATE EXTENSION IF NOT EXISTS postgis;

-- 건물 테이블
CREATE TABLE buildings (
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
CREATE TABLE floors (
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
CREATE TABLE facilities (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    facility_type VARCHAR(50) NOT NULL,      -- 'ATM', '편의점', '와이파이', '냉난방', '주차장' 등
    location_info VARCHAR(200),              -- '1F 로비', 'B1-B2' 등
    is_available BOOLEAN DEFAULT TRUE,       -- 현재 이용가능 여부
    status_text VARCHAR(100)                 -- '24시간', '무료', '중앙 공급' 등
);

-- 건물 통계 테이블 (프로토타입의 원형 지표들)
CREATE TABLE building_stats (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    stat_type VARCHAR(50) NOT NULL,          -- 'total_floors', 'occupancy', 'tenants', 'operating', 'residents', 'parking_capacity', 'congestion'
    stat_value VARCHAR(100) NOT NULL,        -- '12층', '87%', '24개', '18개', '1000+', '100+', '2001'
    stat_icon VARCHAR(50),                   -- 아이콘 코드
    display_order INTEGER DEFAULT 0
);

-- LIVE 피드 테이블 (더미 데이터)
CREATE TABLE live_feeds (
    id SERIAL PRIMARY KEY,
    building_id INTEGER REFERENCES buildings(id),
    feed_type VARCHAR(50) NOT NULL,          -- 'event', 'congestion', 'promotion', 'update'
    title VARCHAR(200) NOT NULL,             -- '4F 카페 오늘의 메뉴 업데이트'
    description VARCHAR(500),                -- '아메리카노 20% 할인'
    icon VARCHAR(50),
    icon_color VARCHAR(20),
    time_label VARCHAR(50),                  -- '방금', '현재', '5분 전'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 행동 로그 테이블
CREATE TABLE scan_logs (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL,        -- 앱 세션 ID
    building_id INTEGER REFERENCES buildings(id),
    event_type VARCHAR(50) NOT NULL,         -- 'pin_shown', 'pin_tapped', 'card_viewed', 'floor_tapped', 'reward_tapped'
    duration_ms INTEGER,                     -- 체류 시간 (밀리초)
    distance_meters DECIMAL(10,2),           -- 건물과의 거리
    user_lat DECIMAL(10,7),
    user_lng DECIMAL(10,7),
    device_heading DECIMAL(5,2),             -- 디바이스 방향
    metadata JSONB,                          -- 추가 데이터
    created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_buildings_location ON buildings USING GIST(location);
CREATE INDEX idx_floors_building ON floors(building_id, floor_order);
CREATE INDEX idx_scan_logs_building ON scan_logs(building_id, created_at);
CREATE INDEX idx_scan_logs_session ON scan_logs(session_id);
```

---

## API 엔드포인트 명세

### 1. 주변 건물 조회
```
GET /api/buildings/nearby?lat={lat}&lng={lng}&radius={meters}&heading={degrees}
```
- 유저 좌표 + 방향 기반으로 반경 내 건물 목록 반환
- 응답: 건물 ID, 이름, 좌표, 거리, 방향(좌/우/정면)

### 2. 건물 상세 프로필
```
GET /api/buildings/:id/profile
```
- 건물 상세 정보 + 층별 정보 + 편의시설 + 통계 + LIVE 피드
- 프로토타입 하단 카드의 모든 데이터를 한 번에 반환

### 3. 건물 층별 정보
```
GET /api/buildings/:id/floors
```
- 층별 입점 현황 (프로토타입 카메라 뷰 위 오버레이용)

### 4. 행동 로그 저장
```
POST /api/scan/log
Body: { session_id, building_id, event_type, duration_ms, distance_meters, user_lat, user_lng, device_heading, metadata }
```

### 5. LIVE 피드 (더미)
```
GET /api/buildings/:id/live
```
- "지금 이 순간" 섹션용 더미 데이터 반환

---

## 더미 데이터 설계

### 포인트/리워드 (프론트엔드에서 하드코딩)
```javascript
const DUMMY_POINTS = {
  totalPoints: 1200,
  rewardBuildings: {
    // 특정 층을 탭하면 "포인트 받기" 버튼 표시
    // 탭하면 포인트 +50 애니메이션 (로컬 상태만 변경)
    pointsPerScan: 50,
    dailyLimit: 500
  }
};
```

### LIVE 피드 (DB 시드 데이터)
각 건물당 2~3개의 더미 LIVE 피드:
- "B1 식당가 점심시간 혼잡 | 대기시간 약 15분 예상"
- "4F 카페 오늘의 메뉴 업데이트 | 아메리카노 20% 할인"
- "2F 금융센터(은행) 현재 대기 3팀"
- "1F 로비 택배 보관함 이용 가능"

---

## UI 디자인 가이드 (프로토타입 기준)

### 테마
- 다크 테마 기반 (배경: #0A0E27 계열)
- 카드 배경: rgba(255,255,255,0.08)
- 주요 액센트: 블루(#4A90D9), 오렌지(#FF8C00), 그린(#00C853)
- 텍스트: 화이트(#FFFFFF), 서브텍스트(#9E9E9E)

### 화면 구조 (ScanScreen)
```
┌─────────────────────────────┐
│ < ● 일반모드  ★1,200  ● 위치확인중  ⊞ │  ← 상단 바
│                                         │
│     [카메라 뷰 영역]                      │
│     ┌──────────────────┐                │
│     │ RF │ 옥상정원   ⛅ │                │  ← 층별 오버레이
│     │ 12F│ SKY라운지  🍴│                │     (건물 위에 반투명 리스트)
│     │ 11F│ 스타트업 A사 │                │
│     │ ...│ ...          │                │
│     └──────────────────┘                │
│                           [강남 파이낸스 │  ← 인접 건물 미니 태그
│                            센터 50m]     │
├─────────────────────────────┤
│ 역삼 스퀘어          LIVE 투시  X │  ← 건물명 + 거리
│ 📍 내 위치에서 120m                │
│                                    │
│ ● ATM   ● 편의점   ● 와이파이  ● 냉난방 │  ← 편의시설 칩
│   1F로비  2F 24시간   무료     중앙공급  │
│                                    │
│ [총 층수] [입주율] [테넌트] [영업중]     │  ← 건물 지표 (원형)
│   12층    87%     24개    18개       │
│                                    │
│ ● 지금 이 순간 LIVE                   │  ← LIVE 피드 (더미)
│ 🔥 4F 카페 오늘의 메뉴 업데이트  방금  │
│    아메리카노 20% 할인                │
└─────────────────────────────┘
```

### 층별 오버레이 규칙
- 카메라 뷰 위에 반투명 배경으로 표시
- 각 층: [층 번호 배지] [업체명] [아이콘들]
- 공실은 회색 처리, 리워드 가능한 층은 오렌지 하이라이트
- 특정 층 탭 → "▶ 포인트 받기" 버튼 슬라이드 (더미)
- 한 번에 최대 8~10개 층 표시, 스크롤로 나머지 확인

### 건물 전환
- 카메라 방향 변경 시 자동 감지 → 다른 건물 핀 활성화
- 인접 건물 미니 태그 탭 → 해당 건물로 카드 전환

---

## 태스크 실행 순서 및 의존성

### Phase 1: 기반 구축 (Day 1~3)
1. **@team-lead**: shared/schema.sql 확정 → 모든 에이전트에 공유
2. **@backend-dev**: Express 프로젝트 초기화 + DB 마이그레이션 실행
3. **@data-pipeline**: 강남·역삼 건물 데이터 수집 시작
4. **@frontend-dev**: Expo 프로젝트 초기화 + 테마/상수 설정

### Phase 2: 핵심 기능 (Day 4~10)
5. **@data-pipeline**: 건물 30~50개 DB 적재 완료 → @backend-dev에 알림
6. **@backend-dev**: 건물 조회 API + 상세 프로필 API 구현
7. **@backend-dev**: 행동 로그 API + LIVE 더미 API 구현
8. **@frontend-dev**: HomeScreen(모드 선택) 구현
9. **@frontend-dev**: ScanScreen 기본 구조 (카메라 뷰 + 하단 카드 레이아웃)

### Phase 3: 연동 + UI 완성 (Day 11~18)
10. **@frontend-dev**: 카메라 뷰에서 Geospatial API 연동 (건물 특정)
    → blockedBy: #5 (건물 DB 필요), #6 (API 필요)
11. **@frontend-dev**: 건물 핀 표시 + 층별 오버레이 구현
12. **@frontend-dev**: 하단 카드 (편의시설 칩 + 통계 + LIVE) 구현
13. **@frontend-dev**: 포인트 배지 + 리워드 버튼 (더미) 구현
14. **@frontend-dev**: 건물 간 전환 로직

### Phase 4: 테스트 + 마무리 (Day 19~25)
15. **@backend-dev**: API 에러 핸들링 + 성능 최적화
16. **@frontend-dev**: 행동 로그 전송 연동
17. **전체**: 강남역 현장 테스트 (실기기)
18. **@team-lead**: 데모 시나리오 정리

---

## 환경 변수 (.env)

### Backend (.env)
```
DATABASE_URL=postgresql://scanpang:password@localhost:5432/scanpang_mvp
PORT=3000
NODE_ENV=development
```

### Data Pipeline (.env)
```
# 공공데이터포털 API 키
DATA_GO_KR_API_KEY=<대표님이 발급>

# 네이버 클라우드 플랫폼
NAVER_CLIENT_ID=<대표님이 발급>
NAVER_CLIENT_SECRET=<대표님이 발급>

# Google
GOOGLE_PLACES_API_KEY=<대표님이 발급>

# DB
DATABASE_URL=postgresql://scanpang:password@localhost:5432/scanpang_mvp
```

### Mobile (.env)
```
API_BASE_URL=http://localhost:3000/api
GOOGLE_GEOSPATIAL_API_KEY=<대표님이 발급>
```

---

## 중요 규칙

1. **모든 에이전트는 shared/schema.sql을 Single Source of Truth로 사용**
2. **프론트엔드는 Geospatial API 연동 전까지 Mock 데이터로 UI 개발 진행**
3. **더미 데이터(포인트/LIVE)는 실제 API와 동일한 구조로 만들어서 나중에 실데이터 교체만 하면 되도록 설계**
4. **한국어 주석 사용 (팀 내 커뮤니케이션 언어)**
5. **커밋 메시지: [영역] 내용 형식 (예: [backend] 건물 조회 API 구현)**
