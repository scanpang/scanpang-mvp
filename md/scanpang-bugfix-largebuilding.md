# ScanPang 바텀시트 버그픽스 + 더미데이터 변경

> **이 문서는 Claude Code에게 전달할 프롬프트입니다.**
> 바텀시트의 스크롤 버그를 수정하고, 더미 데이터를 대형 건물로 교체하여 모든 콘텐츠 모듈을 시연할 수 있도록 합니다.

---

## 1. 버그 수정: 바텀시트 하단 스크롤 잘림

### 현상
- 바텀시트를 FULL 상태로 확장해도 **하단 카드들이 잘려서 보이지 않음**
- 스크롤이 특정 지점에서 멈추거나 마지막 카드가 화면 밖으로 잘림
- 특히 카드가 5개 이상일 때 하단 리워드 카드까지 도달 불가

### 원인 추정
- `RecyclerView`(또는 `NestedScrollView`)의 높이가 바텀시트 내부에서 제한됨
- `BottomSheetBehavior`의 `peekHeight` 또는 `maxHeight` 설정 문제
- 바텀시트 내부 콘텐츠 영역에 `paddingBottom`이 부족하여 마지막 카드가 시스템 네비게이션 바 뒤로 숨겨짐

### 수정 방법

**1) 바텀시트 내부 RecyclerView에 하단 패딩 추가:**
```kotlin
// L3 인사이트 카드 피드 RecyclerView
recyclerView.apply {
    clipToPadding = false  // 중요: 패딩 영역도 스크롤 가능하게
    setPadding(0, 0, 0, 120.dpToPx())  // 하단 여유 공간 (네비바 + 여백)
}
```

**2) NestedScrollView 사용 시:**
```kotlin
// NestedScrollView가 BottomSheet 안에서 정상 스크롤되도록
nestedScrollView.apply {
    isNestedScrollingEnabled = true
    // 하단 패딩 추가
    setPadding(0, 0, 0, 120.dpToPx())
    clipToPadding = false
}
```

**3) BottomSheetBehavior 설정 확인:**
```kotlin
val behavior = BottomSheetBehavior.from(bottomSheet)
behavior.apply {
    isFitToContents = false  // 콘텐츠 크기에 맞추지 않고 전체 확장 허용
    halfExpandedRatio = 0.55f
    state = BottomSheetBehavior.STATE_HALF_EXPANDED
}
```

**4) 바텀시트 레이아웃에서 L3 영역이 남은 공간을 모두 차지하도록:**
```xml
<!-- L3 인사이트 카드 피드 영역 -->
<androidx.recyclerview.widget.RecyclerView
    android:id="@+id/feedRecyclerView"
    android:layout_width="match_parent"
    android:layout_height="0dp"
    android:layout_weight="1"
    android:clipToPadding="false"
    android:paddingBottom="120dp"
    android:overScrollMode="never" />
```

### 검증
- 카드 6개 이상 표시 시 마지막 카드(리워드)까지 스크롤 가능한지 확인
- PEEK → HALF → FULL 각 상태에서 스크롤 동작 정상 확인
- 카드 펼침(아코디언) 후에도 스크롤 정상 확인

---

## 2. 더미 데이터 변경: 소형(S) → 대형(L) 건물

### 변경 이유
- 현재 더미 데이터가 **2층 소형 상가(Grade S)** 기준
- Grade S에서는 맛집·X-Ray·건물개요 정도만 표시 가능
- **대형 건물(Grade L)**로 변경하면 상권·유동인구, 부동산, 관광, 안전·에너지, 블로그 등 **모든 모듈을 시연** 가능

### 기존 더미 데이터 (삭제)
```kotlin
// ❌ 이 데이터를 아래 새 데이터로 교체
val demoBuilding = Building(
    name = "청국장과보리밥 이매점",
    address = "경기 성남시 분당구 이매동 288-19",
    floors = 2,
    area = 206.0,
    builtYear = 2003,
    grade = BuildingGrade.S
)
```

### 새 더미 데이터 (적용)
```kotlin
val demoBuilding = Building(
    name = "강남 파이낸스 센터",
    address = "서울 강남구 역삼동 테헤란로 152",
    floors = 32,
    area = 68500.0,
    builtYear = 2001,
    grade = BuildingGrade.L,
    isLandmark = true
)

val demoCards = listOf(
    // ── 맛집 · 카페 ──
    InsightCard(
        moduleType = FOOD, emoji = "🍽", title = "맛집 · 카페",
        highlight = "32개 업체 중 18곳 영업중 · 평균 ⭐ 4.2",
        badge = Badge("⭐ 4.2", "#EAB308"),
        tier = FREE, colorAccent = "#EAB308",
        detailItems = listOf(
            DetailItem("스타벅스 R 강남파이낸스점", "1층 · 커피전문점", "⭐ 4.3", "영업중", "#22C55E"),
            DetailItem("도쿄라멘 역삼점", "B1층 · 일식", "⭐ 4.5", "영업중", "#22C55E"),
            DetailItem("봉추찜닭 강남점", "B1층 · 한식", "⭐ 4.0", "영업중", "#22C55E"),
            DetailItem("써브웨이 강남파이낸스점", "1층 · 샌드위치", "⭐ 3.8", "브레이크타임", "#F59E0B"),
            DetailItem("맥도날드 강남파이낸스점", "B1층 · 패스트푸드", "⭐ 3.5", "영업중", "#22C55E")
        )
    ),

    // ── 네이티브 광고 1: 맛집 프로모션 ──
    InsightCard(
        moduleType = AD, emoji = "🔥", title = "📢 오늘의 프로모션",
        highlight = "도쿄라멘 · 스캔 고객 15% 할인 + 음료 무료",
        badge = Badge("AD", "#F59E0B"),
        tier = AD, colorAccent = "#F59E0B"
    ),

    // ── X-Ray 투시 ──
    InsightCard(
        moduleType = XRAY, emoji = "👁", title = "X-Ray 투시",
        highlight = "B2~32F · 금융 40% · F&B 25% · 사무실 30% · 공실 5%",
        badge = Badge("LIVE", "#8B5CF6"),
        tier = FREE, colorAccent = "#8B5CF6",
        detailItems = listOf(
            DetailItem("B2~B1", "주차장 · 푸드코트", "F&B 12곳", "영업중 8", "#22C55E"),
            DetailItem("1F", "로비 · 커피숍 · 은행", "금융 3곳", "영업중", "#22C55E"),
            DetailItem("2F", "은행 · 증권사", "금융센터", "⭐P", "#F59E0B"),
            DetailItem("3~5F", "보험 · 자산운용", "금융 8곳", "영업중", "#22C55E"),
            DetailItem("6~25F", "일반 사무실", "IT/금융 혼합", "입주율 95%", "#3B82F6"),
            DetailItem("26~30F", "프리미엄 오피스", "대형 법무법인", "입주율 100%", "#22C55E"),
            DetailItem("31~32F", "스카이라운지 · 레스토랑", "F&B 2곳", "영업중", "#22C55E")
        )
    ),

    // ── 부동산 · 시세 ──
    InsightCard(
        moduleType = REAL_ESTATE, emoji = "🏠", title = "부동산 · 시세",
        highlight = "사무실 매물 5건 · 평당 월세 8.2~12만 · 보증금 3억~",
        badge = Badge("매물 5", "#22C55E"),
        tier = FREE, colorAccent = "#22C55E",
        detailItems = listOf(
            DetailItem("12F 사무실 45평", "보증금 3억 / 월 420만", "평당 9.3만", "즉시입주", "#22C55E"),
            DetailItem("18F 사무실 60평", "보증금 5억 / 월 600만", "평당 10만", "2월 입주", "#3B82F6"),
            DetailItem("8F 사무실 30평", "보증금 2억 / 월 270만", "평당 9만", "즉시입주", "#22C55E"),
            DetailItem("B1 상가 15평", "보증금 1.5억 / 월 180만", "평당 12만", "협의", "#F59E0B"),
            DetailItem("3F 사무실 80평", "보증금 7억 / 월 720만", "평당 9만", "3월 입주", "#3B82F6")
        )
    ),

    // ── 등기부 · 소유권 (프리미엄) ──
    InsightCard(
        moduleType = REGISTRY, emoji = "🔐", title = "등기부 · 소유권 분석",
        highlight = "소유자, 근저당, 전세권, 가압류 확인",
        badge = Badge("💎 PRO", "#F59E0B"),
        tier = PREMIUM, colorAccent = "#F59E0B"
    ),

    // ── 상권 · 유동인구 (프리미엄) ──
    InsightCard(
        moduleType = COMMERCE, emoji = "📊", title = "상권 · 유동인구",
        highlight = "일 유동인구 45,200명 · 점심 피크 12~13시 · 주말 -35%",
        badge = Badge("💎 PRO", "#F59E0B"),
        tier = PREMIUM, colorAccent = "#F59E0B",
        detailItems = listOf(
            DetailItem("일 평균 유동인구", "45,200명", "역삼동 상위 5%", "🔥", "#EF4444"),
            DetailItem("피크 시간대", "12:00~13:00", "점심 직장인 몰림", "피크", "#F59E0B"),
            DetailItem("주요 연령대", "30~40대", "직장인 비율 78%", "비즈니스", "#3B82F6"),
            DetailItem("주말 대비", "-35%", "평일 중심 상권", "평일형", "#8B5CF6"),
            DetailItem("F&B 포화도", "72%", "신규 진입 주의", "⚠️", "#F59E0B")
        )
    ),

    // ── 네이티브 광고 2: 중개사 ──
    InsightCard(
        moduleType = AD, emoji = "🏠", title = "📢 강남 전문 중개사",
        highlight = "역삼동 한빛공인중개사 · 파이낸스센터 전문 · 즉시 상담",
        badge = Badge("AD", "#F59E0B"),
        tier = AD, colorAccent = "#F59E0B"
    ),

    // ── 관광 · 문화 ──
    InsightCard(
        moduleType = TOURISM, emoji = "✈️", title = "관광 · 문화",
        highlight = "강남역 도보 8분 · 테헤란로 IT벨리 · 코엑스 근접",
        badge = Badge("📸", "#EC4899"),
        tier = FREE, colorAccent = "#EC4899",
        detailItems = listOf(
            DetailItem("강남역", "도보 8분", "2호선/신분당선", "🚇", "#3B82F6"),
            DetailItem("코엑스", "도보 15분", "컨벤션/쇼핑", "🏬", "#8B5CF6"),
            DetailItem("봉은사", "도보 10분", "전통사찰", "🏛️", "#22C55E"),
            DetailItem("테헤란로 IT벨리", "현 위치", "한국 실리콘밸리", "💻", "#0EA5E9")
        )
    ),

    // ── 건물 스토리 ──
    InsightCard(
        moduleType = STORY, emoji = "📖", title = "건물 스토리",
        highlight = "2001년 준공 · 강남 금융중심 랜드마크 · 32층 스카이라운지",
        badge = Badge("🔖 Story", "#8B5CF6"),
        tier = FREE, colorAccent = "#8B5CF6"
    ),

    // ── 블로그 · 리뷰 ──
    InsightCard(
        moduleType = BLOG, emoji = "📰", title = "블로그 · 리뷰",
        highlight = "네이버 블로그 187건 · 인스타 #강남파이낸스센터",
        badge = Badge("187건", "#3B82F6"),
        tier = FREE, colorAccent = "#3B82F6"
    ),

    // ── 안전 · 에너지 ──
    InsightCard(
        moduleType = SAFETY, emoji = "🛡️", title = "안전 · 에너지",
        highlight = "내진 1등급 · 에너지효율 B+ · 소방검사 적합",
        badge = Badge("안전", "#22C55E"),
        tier = FREE, colorAccent = "#22C55E",
        detailItems = listOf(
            DetailItem("내진 설계", "1등급", "2017년 보강 완료", "✅", "#22C55E"),
            DetailItem("에너지 효율", "B+ 등급", "연간 에너지 비용 절감", "⚡", "#F59E0B"),
            DetailItem("소방 검사", "적합", "2024년 12월 검사", "🔥", "#22C55E"),
            DetailItem("승강기 검사", "적합", "32인승 × 12대", "🛗", "#22C55E")
        )
    ),

    // ── 건물 개요 ──
    InsightCard(
        moduleType = OVERVIEW, emoji = "🏢", title = "건물 개요",
        highlight = "32층 · 68,500㎡ · 2001년 · 업무시설 · 주차 820대",
        badge = null,
        tier = FREE, colorAccent = "#6366F1",
        detailItems = listOf(
            DetailItem("용도", "업무시설 (오피스)", "근린생활시설 병합", "🏢", "#6366F1"),
            DetailItem("규모", "지상 32층 / 지하 7층", "총 68,500㎡", "📐", "#3B82F6"),
            DetailItem("준공", "2001년", "2017년 리모델링", "🏗️", "#8B5CF6"),
            DetailItem("주차", "820대", "지하 B3~B7", "🅿️", "#22C55E"),
            DetailItem("엘리베이터", "12대", "32인승 고속", "🛗", "#0EA5E9")
        )
    ),

    // ── 스캔 리워드 ──
    InsightCard(
        moduleType = REWARD, emoji = "🎁", title = "스캔 완료! +100P",
        highlight = "▶ 광고 보고 추가 50P",
        badge = Badge("+P", "#6366F1"),
        tier = REWARD, colorAccent = "#6366F1"
    ),
)
```

### 새 AI 요약 (페르소나별)
```kotlin
// 페르소나별 AI 요약 더미 데이터도 함께 교체

val demoAiSummaries = mapOf(
    TOURIST to "Gangnam Finance Center — 32F landmark, restaurants in B1, Starbucks on 1F, 8min walk to Gangnam Stn",
    FOODIE to "B1 도쿄라멘 평점 4.5 — 영업중, 1층 스타벅스R · 점심 피크 12~13시",
    INVESTOR to "사무실 매물 5건 · 평당 월세 8.2~12만 · 입주율 95% · 등기부 확인 가능",
    ENTREPRENEUR to "역삼동 상권 A · F&B 포화도 72% · 일 유동인구 45,200 · B1 상가 평당 12만",
    EXPLORER to "2001년 준공 강남 금융 랜드마크 · 32층 스카이라운지 · 테헤란로 IT벨리의 상징",
    ANALYST to "역삼동 상권 A등급 · 일 유동인구 45,200명 · 직장인 78% · F&B 포화도 72%"
)
```

### 새 퀵 칩 (페르소나별)
```kotlin
val demoQuickChips = mapOf(
    TOURIST to listOf("🟢 Open 18", "⭐ 4.2", "🅿️ 820", "🎫 Coupon", "🚇 8min"),
    FOODIE to listOf("🟢 영업중 18", "⭐ 4.2", "🎫 쿠폰", "🅿️ 820대", "🍽️ 32곳"),
    INVESTOR to listOf("💰 평당8.2~12만", "📈 매물5", "🏗️ 2001년", "🔒 등기부", "📊 입주율95%"),
    ENTREPRENEUR to listOf("📊 상권A", "👥 유동45.2K", "🍽️ 포화72%", "💰 상가12만/평", "🏠 B1공실"),
    EXPLORER to listOf("🏗️ 2001년", "📐 68,500㎡", "🏢 32층", "📰 블로그187", "🏛️ 랜드마크"),
    ANALYST to listOf("📊 상권A", "👥 유동45.2K", "📈 포화72%", "💰 평당8.2~12만", "👔 직장인78%")
)
```

---

## 3. 검증 체크리스트

### 스크롤 버그 수정
- [ ] 바텀시트 FULL 상태에서 마지막 카드(리워드)까지 스크롤 가능
- [ ] 카드 펼침(아코디언) 상태에서도 스크롤 정상
- [ ] PEEK → HALF → FULL 전환 시 스크롤 위치 유지
- [ ] 시스템 네비게이션 바에 카드가 가려지지 않음

### 대형 건물 더미 데이터
- [ ] 건물명: "강남 파이낸스 센터" 정상 표시
- [ ] Grade L로 판별되어 모든 모듈 카드 표시
- [ ] 총 12개 카드 (콘텐츠 9 + AD 2 + 리워드 1) 전부 렌더링
- [ ] 각 카드 펼침 시 detailItems 정상 표시
- [ ] 프리미엄 카드(등기부, 상권)에 💎 PRO 뱃지 + 잠금 UI 표시
- [ ] AD 카드 2개가 적절한 위치에 삽입 (1피드 최대 2광고 규칙 준수)

---

**이 프롬프트를 Claude Code에 전달하여 버그 수정 + 더미 데이터 교체를 진행하세요. 섹션 1(스크롤 버그)부터 처리 후 섹션 2(더미 데이터)를 진행합니다.**
