# ScanPang 페르소나 시스템 구현

> **이 문서는 Claude Code에게 전달할 프롬프트입니다.**
> 바텀시트 리뉴얼 이후, 6페르소나 기반 개인화 시스템을 추가합니다.

---

## 1. 현재 상태 (AS-IS)

- 바텀시트 하이브리드 피드 구조 구현 완료
- L1~L4 레이어, 카드 접힘/펼침, 스켈레톤 UI 동작 중
- **모든 사용자에게 동일한 카드 순서·퀵칩·AI 요약 표시**
- 페르소나 개념 없음

## 2. 목표 상태 (TO-BE)

- 앱 최초 실행 시 **페르소나 선택 팝업** 표시
- 선택된 페르소나가 **메인 UI 상단 파란색 카드에 표시** (탭하여 변경 가능)
- 페르소나별로 **카드 순서, 퀵 칩, AI 요약 톤**이 자동 차별화

---

## 3. 페르소나 선택 팝업 (온보딩)

### 트리거
- 앱 최초 실행 시 1회만 표시
- `SharedPreferences`에 `selected_persona` 키가 없으면 팝업 노출
- 선택 완료 후 다시 표시하지 않음

### UI 스펙
```
┌─────────────────────────────────────────┐
│                                         │
│     🔍 ScanPang                         │
│     어떤 정보가 가장 궁금하세요?          │
│                                         │
│  ┌──────────┐  ┌──────────┐             │
│  │ 🌏       │  │ 🍔       │             │
│  │ 외국인    │  │ 맛집     │             │
│  │ 관광객    │  │ 탐색러    │             │
│  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐             │
│  │ 💰       │  │ 🏪       │             │
│  │ 부동산    │  │ 자영업자   │             │
│  │ 탐색자    │  │ 예비창업   │             │
│  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐             │
│  │ 📸       │  │ 📊       │             │
│  │ 도시      │  │ 상권     │             │
│  │ 탐험가    │  │ 분석가    │             │
│  └──────────┘  └──────────┘             │
│                                         │
│        [ 나중에 선택할게요 ]              │
│                                         │
└─────────────────────────────────────────┘
```

**구현 사항:**
- `Dialog` 또는 `BottomSheetDialogFragment`로 구현
- 배경: `#08080D` (앱 다크테마와 동일)
- 카드 그리드: 2열 3행, 각 카드 borderRadius 14dp
- 각 카드: 배경 `rgba(255,255,255,0.04)`, border `1px solid rgba(255,255,255,0.06)`
- 선택 시: 배경 `rgba(139,92,246,0.15)`, border `rgba(139,92,246,0.4)` + 체크 아이콘
- 이모지: 28sp, 중앙 정렬
- 라벨: 12sp, fontWeight 700, color `#F1F5F9`
- 서브라벨: 10sp, color `rgba(255,255,255,0.4)`
- "나중에 선택할게요" 버튼: 텍스트 버튼, 11sp, color `rgba(255,255,255,0.3)` → 기본 페르소나(도시 탐험가)로 설정

### 데이터 저장
```kotlin
// SharedPreferences에 저장
fun savePersona(context: Context, persona: PersonaType) {
    context.getSharedPreferences("scanpang_prefs", Context.MODE_PRIVATE)
        .edit()
        .putString("selected_persona", persona.name)
        .apply()
}

fun getPersona(context: Context): PersonaType {
    val saved = context.getSharedPreferences("scanpang_prefs", Context.MODE_PRIVATE)
        .getString("selected_persona", null)
    return saved?.let { PersonaType.valueOf(it) } ?: PersonaType.EXPLORER
}
```

---

## 4. 메인 UI 상단 페르소나 카드

### 위치
- 메인 화면(AR 카메라 뷰) 상단에 기존 파란색 정보 카드 영역
- 현재 선택된 페르소나의 이모지 + 이름 표시

### UI 스펙
```
┌─────────────────────────────────────────┐
│  🍔 맛집 탐색러                    ▾    │
└─────────────────────────────────────────┘
```

**구현 사항:**
- 기존 상단 파란색 카드 영역에 페르소나 정보 추가
- 이모지 + 이름: 13sp, fontWeight 700, color `#F1F5F9`
- 우측 ▾ 드롭다운 아이콘: 10sp, color `rgba(255,255,255,0.4)`
- **탭 → 페르소나 변경 바텀시트** 표시 (온보딩 팝업과 동일한 6개 그리드)
- 변경 시 바텀시트의 카드 순서·퀵칩·AI 요약이 즉시 반영

---

## 5. 페르소나 정의 (enum + 설정 데이터)

```kotlin
enum class PersonaType {
    TOURIST,        // 🌏 외국인 관광객
    FOODIE,         // 🍔 맛집 탐색러
    INVESTOR,       // 💰 부동산 탐색자
    ENTREPRENEUR,   // 🏪 자영업자·예비창업자
    EXPLORER,       // 📸 도시 탐험가
    ANALYST         // 📊 상권 분석가
}

data class PersonaConfig(
    val type: PersonaType,
    val emoji: String,
    val nameKo: String,
    val nameEn: String,
    val cardOrder: List<ModuleType>,
    val chipPriority: List<ChipType>,
    val aiSummaryTemplate: String,
    val aiSummaryTone: String  // 강조 키워드 힌트
)
```

---

## 6. 페르소나별 카드 순서 (L3 인사이트 카드 피드)

```kotlin
fun getPersonaCardOrder(persona: PersonaType): List<ModuleType> {
    return when (persona) {
        TOURIST -> listOf(
            TOURISM,        // ✈️ 관광·문화 (영문)
            FOOD,           // 🍽️ 맛집 (번역메뉴)
            OVERVIEW,       // 🏢 건물 정보
            XRAY            // 👁️ X-Ray
        )
        FOODIE -> listOf(
            FOOD,           // 🍽️ 맛집·카페
            XRAY,           // 👁️ X-Ray (층별 맛집)
            BLOG,           // 📰 블로그·리뷰
            OVERVIEW        // 🏢 건물 개요
        )
        INVESTOR -> listOf(
            REAL_ESTATE,    // 🏠 부동산·시세
            REGISTRY,       // 🔐 등기부 (💎 프리미엄)
            OVERVIEW,       // 🏢 건물 개요
            XRAY            // 👁️ X-Ray
        )
        ENTREPRENEUR -> listOf(
            COMMERCE,       // 📊 상권·유동인구 (💎 프리미엄)
            REAL_ESTATE,    // 🏠 부동산·임대료
            XRAY,           // 👁️ X-Ray (경쟁업종)
            SAFETY          // 🛡️ 안전·환경
        )
        EXPLORER -> listOf(
            STORY,          // 📖 건물 스토리
            TOURISM,        // 🏛️ 관광·문화
            BLOG,           // 📰 블로그·리뷰
            XRAY            // 👁️ X-Ray
        )
        ANALYST -> listOf(
            COMMERCE,       // 📊 상권·유동인구 (💎 프리미엄)
            XRAY,           // 👁️ X-Ray 업종분포
            REAL_ESTATE,    // 🏠 부동산·임대시세
            SAFETY          // 🛡️ 안전·에너지
        )
    }
}
```

**규칙:**
- 위 순서는 기본 순서이며, 데이터가 없는 모듈은 자동 스킵
- AD 카드와 REWARD 카드는 페르소나와 무관하게 기존 슬롯 규칙대로 삽입
- 3회 스캔 이후에는 사용자의 실제 인게이지먼트 데이터가 이 순서를 오버라이드 (기존 개인화 정렬 로직 유지)

---

## 7. 페르소나별 퀵 칩 우선순위 (L2)

```kotlin
fun getPersonaChips(persona: PersonaType, building: Building): List<QuickChip> {
    val allChips = building.generateAllChips()  // 건물 데이터 기반 전체 칩 생성

    val priorityOrder = when (persona) {
        TOURIST -> listOf(
            ChipType.OPEN_COUNT,    // 🟢 Open 3
            ChipType.AVG_RATING,    // ⭐ 4.1
            ChipType.PARKING,       // 🅿️ Parking
            ChipType.COUPON         // 🎫 Coupon
        )
        FOODIE -> listOf(
            ChipType.OPEN_COUNT,    // 🟢 영업중 3
            ChipType.AVG_RATING,    // ⭐ 4.1
            ChipType.COUPON,        // 🎫 쿠폰
            ChipType.PARKING        // 🅿️ 주차
        )
        INVESTOR -> listOf(
            ChipType.YIELD,         // 💰 수익률5.2%
            ChipType.LISTING_COUNT, // 📈 매물2
            ChipType.BUILT_YEAR,    // 🏗️ 2003년
            ChipType.REGISTRY       // 🔒 등기부
        )
        ENTREPRENEUR -> listOf(
            ChipType.COMMERCE_GRADE,// 📊 상권B+
            ChipType.FOOT_TRAFFIC,  // 👥 유동2.3K
            ChipType.COMPETITION,   // 🍽️ F&B포화
            ChipType.RENT           // 💰 월세100~
        )
        EXPLORER -> listOf(
            ChipType.BUILT_YEAR,    // 🏗️ 2003년
            ChipType.AREA,          // 📐 206㎡
            ChipType.TENANT_COUNT,  // 🍽️ F&B 7곳
            ChipType.BLOG_COUNT     // 📰 블로그42
        )
        ANALYST -> listOf(
            ChipType.COMMERCE_GRADE,// 📊 상권B+
            ChipType.FOOT_TRAFFIC,  // 👥 유동2.3K
            ChipType.SATURATION,    // 📈 포화87%
            ChipType.RENT_PER_PYEONG// 💰 평당6.6만
        )
    }

    return allChips
        .sortedBy { chip -> 
            val idx = priorityOrder.indexOf(chip.type)
            if (idx >= 0) idx else 999  // 우선순위에 없으면 뒤로
        }
        .take(5)  // 최대 5개
}
```

**규칙:**
- 칩 데이터가 null/0이면 해당 칩 생성 안 함 (빈 칩 금지)
- TOURIST 페르소나일 때 칩 텍스트는 영문으로 전환 (기존 다국어 로직 활용)
- 최대 5개까지만 표시, 나머지는 스크롤로 접근

---

## 8. 페르소나별 AI 요약 톤/강조 포인트 (L1)

```kotlin
fun generateAiSummary(persona: PersonaType, building: Building, lang: String): String {
    return when (persona) {
        TOURIST -> {
            // 톤: 친절한 가이드, 관광 포인트 강조
            // 영문: "Korean BBQ street in ${dong} — Local favorite, open now with ${wait}min wait"
            // 일문: "${dong}の韓国BBQ通り — 地元人気店、営業中、待ち時間約${wait}分"
            buildTouristSummary(building, lang)
        }
        FOODIE -> {
            // 톤: 맛집 정보 직관적, 영업상태+평점+웨이팅 강조
            // "1층 ${topRestaurant} 평점 ${rating} — ${영업상태}, 웨이팅 약 ${wait}분"
            buildFoodieSummary(building)
        }
        INVESTOR -> {
            // 톤: 투자 관점 숫자 중심, 수익률+시세+등기 강조
            // "월세 ${rent}만 · 수익률 추정 ${yield}% · 등기부 확인 가능"
            buildInvestorSummary(building)
        }
        ENTREPRENEUR -> {
            // 톤: 창업 판단 기준, 상권등급+경쟁+임대료 강조
            // "${dong} 상권 ${grade} · ${category} 과밀 주의 · 월세 ${rent}만~ · ${floor}층 공실 ${vacancy}"
            buildEntrepreneurSummary(building)
        }
        EXPLORER -> {
            // 톤: 건물 이야기, 역사+특징+주변 맥락 강조
            // "${builtYear}년 준공 ${type} · ${dong} ${특징} · ${floor}층 ${업종} 밀집"
            buildExplorerSummary(building)
        }
        ANALYST -> {
            // 톤: 데이터 분석 관점, 상권등급+유동인구+포화도 강조
            // "${dong} 상권등급 ${grade} · 일 유동인구 ${traffic}명 · ${category} 점포 포화도 ${sat}%"
            buildAnalystSummary(building)
        }
    }
}
```

**규칙:**
- LLM 호출 아님 — 모든 요약은 **템플릿 기반** (변수 치환)
- 숫자는 API 원본 그대로 사용
- null/0 값이면 해당 구문 생략 (빈 문장 방지)
- TOURIST 페르소나는 디바이스 언어에 따라 영어/일어/중어 템플릿 사용

---

## 9. 구현 순서

### Step 1: PersonaType enum + PersonaConfig 데이터 클래스 생성
- 위 섹션 5의 코드 구현
- `SharedPreferences` 저장/로드 유틸 함수

### Step 2: 온보딩 팝업 구현
- `PersonaSelectDialog` (DialogFragment)
- 2열 3행 그리드 레이아웃
- 선택 → SharedPreferences 저장 → 다이얼로그 닫기

### Step 3: 메인 UI 상단 페르소나 카드
- 기존 파란색 카드 영역에 페르소나 이모지+이름 추가
- 탭 → `PersonaSelectDialog` 재표시 (변경 모드)

### Step 4: 바텀시트 연동
- `BottomSheetState`에 `persona: PersonaType` 필드 추가
- `getPersonaCardOrder()` 적용하여 L3 카드 순서 변경
- `getPersonaChips()` 적용하여 L2 퀵 칩 순서 변경
- `generateAiSummary()` 적용하여 L1 AI 요약 변경

---

## 10. 주의사항

- 온보딩 팝업은 **앱 최초 실행 시 1회만** 표시. 이후에는 상단 카드 탭으로만 변경
- 페르소나 변경 시 **바텀시트가 열려있으면 즉시 리프레시** (카드 순서·칩·요약 모두)
- "나중에 선택할게요"를 누르면 **EXPLORER(도시 탐험가)**를 기본값으로 설정
- 페르소나 선택은 **온보딩 강제 아님** — 스킵해도 앱 정상 사용 가능
- TOURIST 페르소나는 디바이스 언어 감지와 연동 (영문 디바이스 → 자동으로 TOURIST 추천)

---

**이 프롬프트를 Claude Code에 전달하여 페르소나 시스템을 구현하세요. Step 1부터 순서대로 진행합니다.**
