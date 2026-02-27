# ScanPang 바텀시트 리뉴얼 프롬프트

> **이 문서는 Claude Code에게 전달할 프롬프트입니다.**
> 현재 바텀시트의 고정 5탭 구조를 하이브리드 피드 구조로 전환합니다.

---

## 1. 프로젝트 컨텍스트

### 현재 상태 (AS-IS)
- 네이티브 Kotlin 앱 (Android)
- ARCore Geospatial API + VPS로 건물 인식
- 건물 스캔 → 다크테마 바텀시트 표시
- **고정 5탭** 구조 (X레이/맛집/부동산/관광/개요)
- 모든 건물에 동일한 탭 노출 → 빈 탭 문제
- 광고 = 배너 + 리워드 영상만 존재

### 목표 상태 (TO-BE)
- **하이브리드 피드** 구조로 전환
- 건물 규모별 스마트 로딩 (S/M/L)
- 관심사 기반 카드 정렬
- 네이티브 광고가 피드에 자연 삽입
- 다국어 지원 (EN/JP/CN)

---

## 2. 바텀시트 레이어 구조

### L1: 건물 DNA (최상단, 항상 표시)
```
┌─────────────────────────────────────────┐
│  ── (드래그 핸들)                          │
│                                         │
│  청국장과보리밥 이매점              ✕     │
│  📍 경기 성남시 분당구 이매동 288-19 · 0m  │
│                                         │
│  ┌─ AI ──────────────────────────────┐  │
│  │ 1층 청국장과보리밥 평점 4.1        │  │
│  │ — 영업중, 웨이팅 약 15분           │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

**구현 사항:**
- 건물명: `TextView`, 17sp, fontWeight 800, color `#F1F5F9`
- 주소: `TextView`, 11sp, color `rgba(255,255,255,0.3)`
- AI 요약 박스: 그라디언트 배경 `(#8B5CF6 10%, #3B82F6 6%)`, border `1px solid rgba(139,92,246,0.15)`, borderRadius 8dp
- AI 뱃지: "AI" 라벨, 9sp, 배경 `rgba(139,92,246,0.2)`, color `#A78BFA`
- 닫기 버튼: 28×28dp 원형, `rgba(255,255,255,0.06)` 배경

**AI 요약 생성 규칙:**
- 템플릿 기반 (LLM 호출 아님)
- 패턴: `"{주요업종} {평점} — {영업상태}, {특이사항}"`
- 숫자는 API 원본 그대로 사용
- null/0 값이면 해당 구문 생략
- 다국어: 디바이스 언어 감지 → 영어/일어/중어 자동 전환

### L2: 퀵 칩 + 필터 (L1 바로 아래)
```
┌─────────────────────────────────────────┐
│  🟢영업중3  ⭐4.1  🅿️주차  🎫쿠폰       │  ← 퀵 인사이트 칩
│                                         │
│  [전체] [🍽맛집] [🏠부동산] [👁X-Ray] [📰블로그] │  ← 카테고리 필터
└─────────────────────────────────────────┘
```

**퀵 인사이트 칩:**
- 수평 스크롤 `RecyclerView`
- 각 칩: padding `5×9dp`, borderRadius 6dp, 배경 `rgba(255,255,255,0.04)`
- 아이콘 + 텍스트, 11sp, color `rgba(255,255,255,0.6)`
- 건물 데이터에서 동적 생성 (영업중 업체 수, 평균 평점, 주차 유무, 매물 수 등)

**카테고리 필터:**
- 수평 스크롤, 칩 형태
- 선택된 필터: 배경 `rgba(139,92,246,0.2)`, color `#A78BFA`
- 비선택: 배경 `rgba(255,255,255,0.04)`, color `rgba(255,255,255,0.3)`
- 필터 선택 시 L3 피드 필터링 (AD/리워드 카드는 필터와 무관하게 표시)

### L3: 인사이트 카드 피드 (스크롤 영역)
```
┌─────────────────────────────────────────┐
│  ▎🍽 맛집 · 카페                    ⭐4.1 │  ← 모듈 카드 (접힘)
│  │  8개 업체 중 3곳 영업중                 │
│  └─────────────────────────────────────│
│                                         │
│  ▎📢 오늘의 프로모션                  AD  │  ← 네이티브 광고 카드
│  │  청국장과보리밥 · 스캔 고객 10% 할인   │
│  └─────────────────────────────────────│
│                                         │
│  ▎👁 X-Ray 투시                    LIVE  │  ← 모듈 카드 (접힘)
│  │  1층 전체 F&B · 음식점4 + 카페3       │
│  └─────────────────────────────────────│
│                                         │
│  ▎🏠 부동산 · 시세                 매물2  │  ← 모듈 카드 (접힘)
│  │  월세 100~130만 · 보증금 2~3천        │
│  └─────────────────────────────────────│
│                                         │
│  ▎🎁 스캔 완료! +100P             +P    │  ← 리워드 카드
│  │  ▶ 광고 보고 추가 50P 받기            │
│  └─────────────────────────────────────│
└─────────────────────────────────────────┘
```

**모듈 카드 공통 스펙:**
- 컨테이너: borderRadius 12dp, padding `10×12dp`
- 좌측 컬러 바: width 3dp, height 24dp, borderRadius 2dp
- 이모지: 16sp
- 제목: 12sp, fontWeight 700, color `#F1F5F9`
- 서브텍스트: 10sp, color `rgba(255,255,255,0.4)`, ellipsis
- 뱃지(선택): 9sp, fontWeight 700, padding `2×7dp`, borderRadius 5dp
- 펼침 화살표: ▼, 10sp, 180도 회전 애니메이션

**카드 타입별 배경:**
- 일반 카드: `rgba(255,255,255,0.02)`, border `rgba(255,255,255,0.04)`
- 펼침 상태: `rgba(255,255,255,0.05)`, border `rgba(255,255,255,0.1)`
- AD 카드: `linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.02))`, border `rgba(245,158,11,0.25)`
- 프리미엄 카드: `linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))`, border `rgba(245,158,11,0.2)`
- 리워드 카드: `linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02))`, border `rgba(99,102,241,0.25)`

**카드 펼침 시 (L4 전환):**
- 카드 터치 → 아코디언 방식으로 확장
- 내부에 상세 아이템 리스트 표시
- 프리미엄 카드: 하단에 "💎 프리미엄 잠금 해제" CTA 버튼
- AD 카드: 하단에 "⭐ 쿠폰 받기 +50P" CTA 버튼
- 리워드 카드: 하단에 "▶ 광고 보고 50P 받기" CTA 버튼

### L4: 딥다이브 / 프리미엄
- 카드 내부에서 "전체보기" 터치 → 풀스크린 전환
- 유료 콘텐츠(등기부, 상권분석 등)는 잠금 상태로 표시
- 잠금 아이콘 + 가격 표시 → 결제 플로우 연결

---

## 3. 건물 등급별 스마트 로딩

### 등급 판별 기준
```kotlin
enum class BuildingGrade {
    S, // 1~2층 소형 상가, 대지면적 < 200㎡
    M, // 3~10층 중형 빌딩
    L  // 11층+ 대형 랜드마크, 복합시설
}

fun classifyBuilding(floors: Int, area: Double, isLandmark: Boolean): BuildingGrade {
    return when {
        isLandmark || floors >= 11 -> BuildingGrade.L
        floors >= 3 -> BuildingGrade.M
        else -> BuildingGrade.S
    }
}
```

### 등급별 API 호출 세트

| 등급 | 호출 API | 응답 목표 | 표시 모듈 |
|------|----------|-----------|-----------|
| **S** | 건축물대장, Google Places, 기본 시세 | < 1초 | 건물개요, 맛집, X-Ray (간략) |
| **M** | S + 실거래가, 상권정보, 블로그 | 1~2초 | S + 부동산, 상권, 블로그 |
| **L** | M + 유동인구, 에너지, 안전 | 2~4초 | M + 유동인구, 에너지, 안전 |

### 단계적 로딩 UX
```
300ms: L1 건물 DNA 표시 (건물명, 주소 — 로컬 DB or 캐시)
500ms: L2 퀵 칩 표시 (건축물대장 기본 정보)
800ms~: L3 카드 순차 로딩 (각 API 응답마다 카드 추가)
        → 스켈레톤 → 실제 카드 전환 애니메이션
```

**스켈레톤 UI:**
- 카드 모양의 Shimmer 애니메이션
- 배경: `rgba(255,255,255,0.03)` → `rgba(255,255,255,0.06)` 반복
- 2~3개 스켈레톤 카드 미리 표시

---

## 4. 네이티브 광고 슬롯 5종

### SLOT 1: X-Ray 층별 하이라이트
- **위치:** X-Ray 모듈 내 특정 층
- **형태:** 해당 층 오렌지 하이라이트 + ⭐P 뱃지 + "▶ 포인트 받기" CTA
- **광고주:** 건물 내 입주 업체
- **과금:** CPV 50~100원

### SLOT 2: 맛집 카드 내 프로모션
- **위치:** 맛집·카페 모듈 상단
- **형태:** 일반 맛집 카드와 동일 레이아웃 + "프로모션" 태그 + 쿠폰 버튼
- **광고주:** 건물 내/주변 음식점
- **과금:** CPC 100~300원

### SLOT 3: 피드 사이 스폰서드 카드
- **위치:** 인사이트 카드 2~3번째 사이
- **형태:** 인사이트 카드와 동일한 UI + "AD" 라벨
- **제한:** 건물 반경 200m 내 업체만
- **과금:** CPM 5,000~15,000원

### SLOT 4: 부동산 모듈 내 중개사 광고
- **위치:** 부동산·시세 모듈 하단
- **형태:** 중개사 정보 + 전화/채팅 CTA
- **광고주:** 부동산 중개업소
- **과금:** CPC 500~1,000원

### SLOT 5: 스캔 완료 리워드
- **위치:** 피드 최하단
- **형태:** "+100P" 완료 메시지 + "▶ 광고 보고 추가 50P 받기"
- **광고주:** 리워드 영상 네트워크 (애드몹 등)
- **과금:** CPV 30~50원

### 광고 노출 규칙
- 1피드 최대 2광고 (AD 카드 기준)
- 컨텍스트 매칭 필수: 맛집 모듈에 부동산 광고 X
- 위치 반경 200m 제한
- AD 라벨 필수 표시 (법적 요건)
- 포인트 연동: 광고 인터랙션 → 포인트 적립

---

## 5. 카드 정렬 알고리즘

### 기본 정렬 (관심사 데이터 없을 때)
건물 타입에 따른 기본 순서:
```kotlin
fun getDefaultOrder(building: Building): List<ModuleType> {
    return when {
        building.hasRestaurants -> listOf(FOOD, XRAY, REAL_ESTATE, OVERVIEW)
        building.hasListings -> listOf(REAL_ESTATE, XRAY, FOOD, OVERVIEW)
        building.isLandmark -> listOf(TOURISM, XRAY, OVERVIEW, FOOD)
        else -> listOf(OVERVIEW, XRAY, FOOD, REAL_ESTATE)
    }
}
```

### 개인화 정렬 (3회 스캔 이후)
```kotlin
fun getPersonalizedOrder(
    building: Building,
    userHistory: UserHistory
): List<ModuleType> {
    // 사용자가 가장 많이 펼친 모듈 순서대로 정렬
    val moduleEngagement = userHistory.getModuleEngagementRank()
    return moduleEngagement
        .filter { building.hasDataFor(it) }  // 데이터 있는 모듈만
        .plus(getDefaultOrder(building))       // 나머지는 기본 순서
        .distinct()
}
```

---

## 6. 다국어 지원 (외국인 관광객)

### 언어 감지 및 전환
```kotlin
fun detectLanguage(): SupportedLanguage {
    val deviceLocale = Locale.getDefault().language
    return when (deviceLocale) {
        "ja" -> SupportedLanguage.JAPANESE
        "zh" -> SupportedLanguage.CHINESE
        "en" -> SupportedLanguage.ENGLISH
        else -> SupportedLanguage.KOREAN
    }
}
```

### 언어별 처리 전략
| 요소 | 한국어 | 영어/일어/중어 |
|------|--------|---------------|
| 건물명 | 원본 | Google Places 다국어 데이터 |
| AI 요약 | 한국어 템플릿 | 언어별 템플릿 (변수 교체) |
| 퀵 칩 | 아이콘+한글 | 아이콘+숫자 (언어 무관) |
| 맛집 정보 | 네이버/카카오 | Google Places 영문 데이터 |
| 관광 정보 | TourAPI 국문 | TourAPI 영문 |
| CTA 버튼 | 한국어 | 해당 언어 |

### 영어 UI 템플릿 예시
```kotlin
// AI 요약
"Korean BBQ street in ${dong} — Local favorite, open now with ${waitTime}min wait"

// 퀵 칩은 아이콘+숫자이므로 번역 불필요
// 🟢 Open 3  ⭐ 4.1  🅿️ Parking  🎫 Coupon

// 모듈 타이틀
"Tourist Info" / "Restaurants · Cafes" / "Building Info" / "X-Ray View"
```

---

## 7. 데이터 모델

### InsightCard
```kotlin
data class InsightCard(
    val id: String,
    val moduleType: ModuleType,
    val emoji: String,
    val title: String,
    val highlight: String,
    val badge: Badge?,
    val tier: CardTier,  // FREE, PREMIUM, AD, REWARD
    val isExpanded: Boolean = false,
    val detailItems: List<DetailItem> = emptyList(),
    val colorAccent: String  // hex color
)

enum class CardTier { FREE, PREMIUM, AD, REWARD }

data class DetailItem(
    val name: String,
    val subtitle: String,
    val rightText: String,
    val status: String,
    val statusColor: String
)

data class Badge(
    val text: String,
    val color: String
)
```

### BottomSheetState
```kotlin
data class BottomSheetState(
    val building: Building,
    val buildingGrade: BuildingGrade,
    val language: SupportedLanguage,
    val aiSummary: String,
    val quickChips: List<QuickChip>,
    val activeFilter: ModuleType?,
    val cards: List<InsightCard>,
    val expandedCardId: String?,
    val isLoading: Boolean,
    val loadedModules: Set<ModuleType>
)
```

---

## 8. 구현 순서 (우선순위)

### Phase 1: 기본 구조 전환 (1주)
1. 기존 5탭 `ViewPager` 제거
2. `RecyclerView` 기반 피드 구조 구현
3. L1 건물 DNA + AI 요약 박스 구현
4. L2 퀵 칩 + 카테고리 필터 구현
5. L3 카드 접힘/펼침 (아코디언) 구현

### Phase 2: 스마트 로딩 (3일)
1. BuildingGrade 분류 로직
2. 등급별 API 호출 세트 구현
3. 단계적 로딩 + 스켈레톤 UI
4. 카드 순차 추가 애니메이션

### Phase 3: 네이티브 광고 (3일)
1. AD 카드 타입 구현 (배경/보더 차별화)
2. 리워드 카드 구현
3. 광고 슬롯 위치 로직 (1피드 최대 2광고)
4. 포인트 적립 연동

### Phase 4: 다국어 (2일)
1. 언어 감지 로직
2. 영어 UI 템플릿 작성
3. Google Places 영문 데이터 연동
4. TourAPI 영문 데이터 연동

### Phase 5: 개인화 (2일)
1. 모듈 인게이지먼트 트래킹
2. 개인화 정렬 알고리즘
3. 3회 스캔 후 넛지 표시

---

## 9. 주의사항

### 데이터 안전
- API 응답이 null/0이면 해당 모듈 카드 자체를 숨김 (빈 카드 표시 금지)
- 부동산 가격 정보에는 반드시 출처·기준일 표기
- 등기부 등 개인정보는 서버에 캐시하지 않고 원본 문서 직접 표시

### 성능
- 피드 카드는 `DiffUtil` 기반 `RecyclerView` 사용
- 이미지 lazy loading (Coil/Glide)
- API 병렬 호출 (`coroutineScope { async {} }`)

### UX
- 바텀시트 3단계: PEEK (L1만) → HALF (L1+L2+L3 일부) → FULL (전체)
- 스와이프 다운으로 닫기
- 카드 펼침 시 해당 카드로 자동 스크롤
- AD 카드는 "AD" 또는 "Sponsored" 라벨 반드시 포함 (표시광고법)

### 디자인 토큰
```
배경: #08080D ~ #0A0A0F (다크테마)
카드 배경: rgba(255,255,255,0.02)
텍스트 주: #F1F5F9
텍스트 부: rgba(255,255,255,0.4)
액센트 퍼플: #8B5CF6
액센트 그린: #22C55E
액센트 옐로우: #F59E0B
액센트 레드: #EF4444
광고 오렌지: #F59E0B
프리미엄 골드: #F59E0B
리워드 인디고: #6366F1
```

---

## 10. 데모용 더미 데이터

현재 시드 데이터가 아직 삽입되지 않았으므로, 바텀시트 개발 시 아래 더미 데이터를 하드코딩해서 사용하세요:

```kotlin
val demoBuilding = Building(
    name = "청국장과보리밥 이매점",
    address = "경기 성남시 분당구 이매동 288-19",
    floors = 2,
    area = 206.0,
    builtYear = 2003,
    grade = BuildingGrade.S
)

val demoCards = listOf(
    InsightCard(moduleType = FOOD, emoji = "🍽", title = "맛집 · 카페",
        highlight = "8개 업체 중 3곳 영업중", badge = Badge("⭐ 4.1", "#EAB308"),
        tier = FREE, colorAccent = "#EAB308"),
    InsightCard(moduleType = AD, emoji = "🔥", title = "📢 오늘의 프로모션",
        highlight = "청국장과보리밥 · 스캔 고객 10% 할인", badge = Badge("AD", "#F59E0B"),
        tier = AD, colorAccent = "#F59E0B"),
    InsightCard(moduleType = XRAY, emoji = "👁", title = "X-Ray 투시",
        highlight = "1층 전체 F&B · 음식점4 + 카페3", badge = Badge("LIVE", "#8B5CF6"),
        tier = FREE, colorAccent = "#8B5CF6"),
    InsightCard(moduleType = REAL_ESTATE, emoji = "🏠", title = "부동산 · 시세",
        highlight = "월세 100~130만 · 보증금 2~3천", badge = Badge("매물 2", "#22C55E"),
        tier = FREE, colorAccent = "#22C55E"),
    InsightCard(moduleType = OVERVIEW, emoji = "🏢", title = "건물 개요",
        highlight = "1층 근린생활 · 206㎡ · 2003년", badge = null,
        tier = FREE, colorAccent = "#6366F1"),
    InsightCard(moduleType = REWARD, emoji = "🎁", title = "스캔 완료! +100P",
        highlight = "▶ 광고 보고 추가 50P", badge = Badge("+P", "#6366F1"),
        tier = REWARD, colorAccent = "#6366F1"),
)
```

---

**이 프롬프트를 Claude Code에 전달하면 바텀시트 리뉴얼 코드를 생성합니다. Phase 1부터 순서대로 진행하세요.**
