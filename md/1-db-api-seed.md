# ScanPang 구현 1차 — DB + API + 시드 데이터

이번 작업: 건물 프로필 통합 DB 구축 + API 엔드포인트 + 테스트용 시드 데이터.
프론트엔드는 아직 건들지 마. DB와 API부터 완성하고 확인.

---

## STEP 1: DB 마이그레이션 (PostgreSQL)

기존 buildings 테이블을 확장하고, 연관 테이블 8개를 새로 생성.
이미 있는 테이블/컬럼은 건너뛰도록 IF NOT EXISTS 사용.

```sql
-- 1. buildings 테이블 확장 (기존 컬럼 유지, 없는 것만 추가)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS sub_type TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS total_floors INTEGER;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS basement_floors INTEGER DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS built_year INTEGER;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS parking_count INTEGER;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 2. building_stats (건물 통계 — 바텀시트 개요 탭)
CREATE TABLE IF NOT EXISTS building_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  occupancy_rate INTEGER,
  tenant_count INTEGER,
  operating_count INTEGER,
  resident_count TEXT,
  daily_footfall TEXT,
  avg_rating DECIMAL(2,1),
  review_count INTEGER,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(building_id)
);

-- 3. floors (층별 정보 — X레이 투시 핵심)
CREATE TABLE IF NOT EXISTS floors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  floor_number TEXT NOT NULL,
  floor_order INTEGER NOT NULL,
  tenant_name TEXT,
  tenant_type TEXT,
  is_vacant BOOLEAN DEFAULT FALSE,
  icons TEXT,
  has_reward BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'unknown',
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_floors_building ON floors(building_id);

-- 4. amenities (편의시설 — 바텀시트 태그)
CREATE TABLE IF NOT EXISTS amenities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  location TEXT,
  is_free BOOLEAN DEFAULT FALSE,
  hours TEXT
);

-- 5. real_estate_listings (부동산 매물)
CREATE TABLE IF NOT EXISTS real_estate_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  listing_type TEXT NOT NULL,
  room_type TEXT,
  unit_number TEXT,
  size_pyeong DECIMAL(5,1),
  size_sqm DECIMAL(6,1),
  deposit INTEGER,
  monthly_rent INTEGER,
  sale_price INTEGER,
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. restaurants (맛집/카페)
CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  floor_id UUID REFERENCES floors(id),
  name TEXT NOT NULL,
  category TEXT,
  sub_category TEXT,
  signature_menu TEXT,
  price_range TEXT,
  wait_teams INTEGER DEFAULT 0,
  rating DECIMAL(2,1),
  review_count INTEGER,
  hours TEXT,
  is_open BOOLEAN DEFAULT TRUE
);

-- 7. tourism_info (관광 정보)
CREATE TABLE IF NOT EXISTS tourism_info (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  attraction_name TEXT,
  attraction_name_en TEXT,
  category TEXT,
  description TEXT,
  admission_fee TEXT,
  hours TEXT,
  congestion TEXT DEFAULT 'unknown',
  rating DECIMAL(2,1),
  review_count INTEGER
);

-- 8. live_feeds (실시간 피드 — 모든 탭 공통)
CREATE TABLE IF NOT EXISTS live_feeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  feed_type TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT,
  icon TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_feeds_building ON live_feeds(building_id, created_at DESC);

-- 9. promotions (프로모션/광고)
CREATE TABLE IF NOT EXISTS promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  reward_points INTEGER,
  condition_text TEXT,
  media_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## STEP 2: 백엔드 API

### 2-1. GET /api/buildings/:id/profile

건물의 모든 프로필 데이터를 한 번에 반환하는 통합 API.

```javascript
// 응답 구조:
{
  building: { id, name, address, type, sub_type, total_floors, basement_floors, built_year, parking_count, description, lat, lng },
  stats: { occupancy_rate, tenant_count, operating_count, resident_count, avg_rating, review_count } | null,
  floors: [{ floor_number, floor_order, tenant_name, tenant_type, is_vacant, icons, has_reward, status }],  // floor_order DESC 정렬
  amenities: [{ type, label, location, is_free, hours }],
  realEstate: [{ listing_type, room_type, unit_number, size_pyeong, size_sqm, deposit, monthly_rent, sale_price, is_active }],
  restaurants: [{ name, category, sub_category, signature_menu, wait_teams, rating, is_open }],
  tourism: { attraction_name, attraction_name_en, category, description, admission_fee, hours, congestion, rating, review_count } | null,
  liveFeeds: [{ feed_type, title, subtitle, icon, created_at }],  // expires_at 안 지난 것만, 최근 10개
  promotion: { title, reward_points, condition_text } | null,     // is_active인 것 1개
  meta: {
    hasFloors: boolean,
    hasRestaurants: boolean,
    hasRealEstate: boolean,
    hasTourism: boolean,
    dataCompleteness: number  // 0~100, 채워진 테이블 비율
  }
}
```

구현 사항:
- 9개 테이블을 각각 쿼리해서 조합 (JOIN보다 개별 쿼리가 유지보수 쉬움)
- floors: floor_order DESC 정렬 (RF가 맨 위)
- liveFeeds: expires_at IS NULL OR expires_at > NOW(), created_at DESC LIMIT 10
- promotion: is_active = true LIMIT 1
- meta.dataCompleteness: stats/floors/amenities/restaurants 중 데이터가 있는 비율 계산
- 건물 ID가 없으면 404

### 2-2. POST /api/buildings/:id/scan-complete

게이지 완료 시 프론트에서 호출할 API.

```javascript
// Request body:
{
  confidence: 82,
  sensorData: { gps: {...}, compass: {...}, ... },
  cameraFrame: "base64..."  // 선택
}

// 이 API가 하는 일:
// 1. behavioral_events 테이블에 'scan_complete' 이벤트 기록
// 2. confidence >= 0.5이면: flywheel 소싱 카운트 증가
// 3. confidence >= 0.8이면: building_profiles 자동 검증 처리
// 4. cameraFrame이 있으면 Gemini Vision 분석 요청 (비동기, 결과를 나중에 DB에 저장)
// 5. 응답: GET /api/buildings/:id/profile과 동일한 구조 반환
//    → 프론트에서 바텀시트에 바로 사용

// Response: 위의 profile 응답과 동일
```

---

## STEP 3: 시드 데이터

현재 위치(이매동) 주변 건물 중 가장 가까운 2~3개에 더미 데이터를 넣어줘.
실제 데이터가 아니어도 됨. 바텀시트 테스트용.

```javascript
// scripts/seed-building-profiles.js 또는 마이그레이션에 포함

// 1. 기존 buildings 테이블에서 가장 가까운 건물 2~3개의 ID를 가져와서
// 2. 각 건물에 대해:

// 건물 A (예: C동 또는 가장 가까운 건물)
// - building_stats: { occupancy_rate: 85, tenant_count: 12, operating_count: 8, resident_count: '200+' }
// - floors 5개: RF 옥상, 5F 사무실, 4F 카페, 3F 편의점, 2F 주민센터, 1F 로비
// - amenities 3개: ATM/1F로비, 편의점/3F, 주차장/B1
// - restaurants 2개: 1층카페 (즉각입장), 3층 편의점 (즉각입장)
// - live_feeds 2개: "4F 카페 신메뉴 출시 / 아이스 아메리카노 할인", "1F 택배함 도착 알림"
// - promotions 1개: "건물 스캔하고 100P 받기"

// 건물 B (예: B동)
// - building_stats: { occupancy_rate: 92, tenant_count: 18, operating_count: 14 }
// - floors 8개
// - amenities 4개
// - restaurants 3개 (대기 팀수 포함)
// - real_estate_listings 2개: 원룸 월세, 투룸 전세
// - live_feeds 3개

// 시드 삽입 후 GET /api/buildings/:id/profile 호출해서 데이터 잘 나오는지 확인
```

---

## 완료 확인

- [ ] 마이그레이션 에러 없이 실행됨
- [ ] 모든 테이블 생성 확인 (\dt 또는 SELECT)
- [ ] GET /api/buildings/:id/profile 호출 시 올바른 JSON 반환
- [ ] 시드 데이터가 있는 건물: 모든 필드에 데이터 있음
- [ ] 시드 데이터가 없는 건물: 빈 배열/null로 반환, 에러 안 남
- [ ] POST /api/buildings/:id/scan-complete 호출 시 profile 반환 + 이벤트 기록
- [ ] meta.hasFloors, meta.hasRestaurants 등이 데이터 유무에 따라 정확히 true/false
