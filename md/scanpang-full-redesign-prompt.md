# ScanPang 앱 전면 리디자인 + 프로덕션 구현

## 기술 스택
- React 19.1.0 / React Native 0.81.5 / Expo SDK 54
- 네비게이션: React Navigation (Stack)
- 빌드/배포: EAS Build

---

## 핵심 변경사항 요약

1. **SCAN / XRAY 모드를 하나로 통합** — 별도 모드 선택 없이 "스캔하기" 한 번이면 카메라 ON → 건물 감지 → 외관 정보 + 층별 투시 정보를 하나의 플로우에서 제공
2. **홈 화면 → 화이트톤 클린 UI로 전면 리디자인**
3. **카메라(AR) 화면 → 전체화면 카메라 + 하단 건물 정보 패널 바텀시트**

---

## 화면 1: 홈 화면 (HomeScreen)

### 디자인 시스템
```
// theme/colors.ts
export const Colors = {
  // 배경
  bgWhite: '#FFFFFF',
  bgGray: '#F8F9FA',
  bgBlueGradientStart: '#2563EB',
  bgBlueGradientEnd: '#4F46E5',

  // 텍스트
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textWhite: '#FFFFFF',

  // 브랜드
  primaryBlue: '#2563EB',
  primaryBlueLight: '#EFF6FF',
  accentAmber: '#F59E0B',
  accentAmberLight: '#FFFBEB',
  successGreen: '#10B981',
  liveRed: '#EF4444',

  // 카드/보더
  borderLight: '#F3F4F6',
  borderDefault: '#E5E7EB',
  cardShadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
};
```

### 레이아웃 (위에서 아래, ScrollView)

**상단 네비게이션 바**
- 좌측: "ScanPang" 로고 (primaryBlue, 18px bold)
- 우측: 포인트 pill 뱃지 — 흰 배경 + primaryBlue border, "🪙 1,200 P" (탭 → 포인트 상세)
- 배경: bgWhite, 하단 borderLight 1px

**인사 + 현황 카드 (StatusCard)**
- 블루 그라데이션 카드 (borderRadius 20)
- 내용:
  - "📍 강남역 주변" (14px, rgba(255,255,255,0.7)) — GPS 기반 동적
  - "좋은 저녁이에요!" (22px bold white) — 시간대별 분기
  - "주변에 스캔 가능한 건물 12개" (15px, rgba(255,255,255,0.85)) — API 연동
  - 하단 3칸 스탯 (반투명 흰 배경 rgba(255,255,255,0.15), borderRadius 12):
    - 오늘 스캔: 5 | 획득 포인트: 250 | 남은 한도: 250/500 (미니 프로그레스바 포함)

**스캔 시작 버튼 (메인 CTA) — 기존 SCAN/XRAY 2개 버튼 제거, 1개로 통합**
```
┌─────────────────────────────────────────┐
│  📷                                      │
│  스캔 시작하기                             │
│  카메라를 건물에 비추면 내부 정보까지       │
│  한번에 확인할 수 있어요                   │
│                              시작 →      │
└─────────────────────────────────────────┘
```
- 흰 카드, 높이 ~120px, primaryBlue 좌측 4px accent bar
- 아이콘: 카메라 아이콘 (40px, primaryBlue)
- "스캔 시작하기" (18px bold textPrimary)
- 설명: "카메라를 건물에 비추면 내부 정보까지 한번에 확인할 수 있어요" (14px textSecondary)
- 우하단: "시작 →" (primaryBlue, 15px bold)
- 탭 → `navigation.navigate('ScanCamera')` — 카메라 전체화면으로 전환
- press 시 scale(0.98) + bgGray 배경 변경 (150ms)

**주변 건물 미리보기 (NearbyBuildings)**
- 섹션 타이틀: "주변 건물" (18px bold) + "모두 보기 >" (14px primaryBlue)
- 가로 FlatList (horizontal, showsHorizontalScrollIndicator: false, snapToInterval)
- 카드: 너비 150px, 흰 배경
  - 상단: 건물 썸네일 (borderRadius 12, 높이 100px)
  - 건물명 (15px bold)
  - 카테고리 (13px textSecondary)
  - 거리 + 상태 dot (🟢 100m 이내, 🟡 100~300m, 🔵 300m+)
- 빈 상태: Skeleton placeholder (3개 회색 박스, shimmer 애니메이션)

**최근 활동 (RecentActivity)**
- 섹션 타이틀: "최근 활동" + "전체 기록 >"
- 리스트 최대 3건
  - 건물 아이콘 + 건물명 + 획득 포인트(successGreen) + 시간(textTertiary)
- 빈 상태: "아직 스캔 기록이 없어요" + 미니 스캔 버튼

---

## 화면 2: 카메라/AR 화면 (ScanCameraScreen) ← 핵심 화면

### 구조: 전체화면 카메라 + 오버레이 UI + 하단 바텀시트

기존에 SCAN 모드와 XRAY 모드가 분리되어 있던 것을 **하나의 화면에서 통합 제공**한다.
스캔하기 버튼 탭 → 즉시 카메라 ON → 전체화면 카메라가 배경.

### 레이어 구조 (z-index 순서)
```
[Layer 0] 카메라 프리뷰 — 전체화면, StatusBar 영역까지 확장
[Layer 1] 상단 오버레이 바 — 반투명 그라데이션 위에 UI
[Layer 2] AR 건물 라벨 — 카메라 위에 플로팅
[Layer 3] 하단 건물 정보 바텀시트 — 드래그 가능
```

### Layer 1: 상단 오버레이 바
```
[←]  [● 일반 모드]  [⭐ 1,200]        [위치 확인중...]  [🏛]
```
- 배경: 투명 → 다크(rgba(0,0,0,0.4)) 상단 그라데이션 (SafeArea 포함)
- 좌측: 뒤로가기 (←) 아이콘 버튼 (흰색, 36px 원형 반투명 배경)
- "● 일반 모드" pill (흰 텍스트 14px, 초록 dot, 반투명 다크 배경 pill)
- "⭐ 1,200" 포인트 (노란별 + 흰 텍스트)
- 우측: "● 위치 확인중..." (GPS 상태 표시), 건물 아이콘 버튼

### Layer 2: AR 건물 라벨 (카메라 위 플로팅)
레퍼런스 좌측 이미지처럼:
- 각 감지된 건물에 **카드형 라벨** 표시
- 라벨 구조:
  ```
  ┌───────────────────┐
  │ 역삼 스퀘어         │
  │ 복합 문화 공간       │
  │ 📍 150m            │
  └───────────────────┘
       ◉ (위치 핀)
  ```
- 라벨: 흰 배경 (borderRadius 12, 패딩 12px), 미세 그림자
- 건물명: 16px bold #111827
- 카테고리: 13px #6B7280
- 거리: 13px #6B7280, 위치 아이콘 포함
- 하단 핀 아이콘: 흰 원형(비선택) 또는 주황 원형(선택됨) — 레퍼런스처럼 ◉ 형태
- **포인트 획득 가능 건물**: 라벨 우상단에 "+P" 주황 뱃지 표시

**라벨 겹침 방지:**
- 라벨 간 최소 간격 체크 → 겹치면 y축 오프셋 조정
- 먼 거리 건물은 라벨 크기 축소 (scale 0.85)
- 3개 이상 겹치면 가장 가까운 것만 전체 표시, 나머지는 축약 (건물명만)

**건물 감지 전 상태:**
- 화면 중앙에 "건물을 향해 카메라를 비추세요" (흰 텍스트, 반투명 배경 pill)
- 건물 1개라도 감지되면 이 텍스트 fade-out

**라벨 탭 시:**
- 해당 건물 핀이 주황색으로 활성화
- 하단 바텀시트가 올라오며 건물 상세 정보 표시

### Layer 3: 하단 건물 정보 바텀시트 (BottomSheet)

레퍼런스 우측 이미지처럼 구현. react-native-reanimated + react-native-gesture-handler 기반 바텀시트.

**3단계 snap points:**
- **collapsed (숨김):** 건물 미감지 시
- **peek (25%):** 건물 탭 시 — 건물명 + 거리 + 빠른 정보 태그만 표시
- **half (55%):** 위로 드래그 시 — 건물 상세 + 층별 정보 시작
- **full (90%):** 더 드래그 시 — 전체 층별 투시 + 라이브 정보

**바텀시트 내부 구조:**

```
━━━━━ (드래그 핸들, 가운데 40px 회색 바)

역삼 스퀘어                    [LIVE 투시]  [✕]
📍 내 위치에서 120m

┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│🏧 ATM │ │🏪편의점│ │📶와이파이│ │🌡냉난방 │
│1F 로비 │ │2F 24h │ │ 무료  │ │중앙공급│
└──────┘ └──────┘ └──────┘ └──────┘
          ← 가로 스크롤 →

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ 🏢     │ │  ⏱    │ │  🏬   │ │  🕐   │
│ 총 층수 │ │ 입주율  │ │ 테넌트 │ │ 영업중  │
│  12층  │ │  87%  │ │  24개  │ │  18개  │
└────────┘ └────────┘ └────────┘ └────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[층별 투시 - 기존 XRAY 기능을 여기에 통합]

RF │ 옥상정원           🌿 ☀️
12F│ SKY라운지           🍽
11F│ 스타트업 A사         👥 🖥
10F│ 스타트업 B사         👥 🖥
 9F│ IT 솔루션           💻
 8F│ 법률사무소           ⚖️       ← 골드 하이라이트 (광고/프로모션)
 7F│ 회계법인            💰       ← 골드 하이라이트
 6F│ 공실               (빈 상태 회색)
 5F│ 피트니스센터         🏋️

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

● 지금 이 순간  LIVE

┌─────────────────────────────────────────┐
│ ⭐ 4F 카페 오늘의 메뉴 업데이트    방금    │
│    아메리카노 20% 할인                    │
├─────────────────────────────────────────┤
│ 📢 1F 로비 택배 도착 알림         3분 전   │
└─────────────────────────────────────────┘
```

**바텀시트 내부 구현 상세:**

1. **헤더 영역**
   - 건물명: 22px bold white
   - 거리: 14px rgba(255,255,255,0.7), 위치 아이콘
   - 우측: "LIVE 투시" pill 버튼 (primaryBlue 배경, 흰 텍스트, borderRadius 20) + 닫기(✕) 버튼
   - 배경: 다크(#1A1F2E) — AR 카메라 화면 위에 올라오는 시트이므로 다크 유지

2. **빠른 정보 태그 (가로 스크롤)**
   - 각 태그: 반투명 다크 pill (rgba(255,255,255,0.1) 배경, borderRadius 12)
   - 초록 dot = 이용 가능, 회색 dot = 이용 불가
   - 아이콘 + 위치/층 + 상세 (13px)

3. **건물 스탯 4칸 그리드**
   - 2x2 또는 4-column
   - 각 칸: 아이콘(primaryBlue, 32px) + 라벨(12px textTertiary) + 값(18px bold white)
   - 총 층수, 입주율(% 표시 + 미니 원형 프로그레스), 테넌트 수, 영업중 수

4. **층별 투시 리스트 (기존 XRAY 기능 통합)**
   - 층 번호: 좌측 고정, 색상 배경 pill (RF=빨강, 고층=주황, 중층=파랑, 저층=남색)
   - 테넌트명: 16px white
   - 우측: 카테고리 아이콘들 (사람, 식당, 컴퓨터 등)
   - **광고/프로모션 층:** 골드 하이라이트 배경 (rgba(245,158,11,0.15)), "+P" 뱃지
   - **공실 층:** 회색 텍스트, "공실" 표시
   - 각 층 탭 → 해당 층 상세 정보 expand (테넌트 상세, 연락처, 프로모션 등)

5. **"지금 이 순간" LIVE 섹션**
   - 초록 dot + "지금 이 순간" (18px bold) + LIVE 빨간 뱃지
   - 실시간 건물 내 이벤트/알림 리스트
   - 각 아이템: 아이콘 + 내용 + 시간

---

## 네비게이션 플로우

```
HomeScreen (화이트 UI)
    │
    ├── "스캔 시작하기" 탭
    │       ↓
    │   ScanCameraScreen (전체화면 카메라)
    │       ├── 건물 라벨 탭 → 바텀시트 올라옴
    │       ├── 바텀시트 내 층별 탭 → 층 상세 expand
    │       ├── "LIVE 투시" 탭 → 바텀시트 full expand
    │       └── ← 뒤로가기 → HomeScreen
    │
    ├── 주변 건물 카드 탭 → ScanCameraScreen (해당 건물 포커스)
    ├── 포인트 탭 → PointHistoryScreen
    └── 최근 활동 탭 → ScanHistoryScreen
```

**Stack Navigator 설정:**
```typescript
// navigation/AppNavigator.tsx
const Stack = createNativeStackNavigator();

<Stack.Navigator>
  <Stack.Screen
    name="Home"
    component={HomeScreen}
    options={{ headerShown: false }}
  />
  <Stack.Screen
    name="ScanCamera"
    component={ScanCameraScreen}
    options={{
      headerShown: false,
      animation: 'fade',           // 카메라 전환은 fade가 자연스러움
      statusBarHidden: true,       // 전체화면
      gestureEnabled: true,
    }}
  />
  <Stack.Screen name="PointHistory" component={PointHistoryScreen} />
  <Stack.Screen name="ScanHistory" component={ScanHistoryScreen} />
</Stack.Navigator>
```

---

## 기존 코드에서 제거/변경할 것

### 제거
- `SCAN` / `XRAY` 모드 선택 버튼 및 관련 state 전체 제거
- `scanMode`, `setScanMode`, `mode === 'SCAN'` / `mode === 'XRAY'` 분기 로직 전부 제거
- 다크 네이비 배경 (#0F172A 등) 홈 화면에서 제거 (카메라 화면 바텀시트는 다크 유지)
- 화면 중앙 빈 공간
- 하단 고정 스탯 바 (StatusCard로 통합)
- SCAN/XRAY 버튼 아래 의미 불명 프로그레스 바
- 개발자용 에러 토스트 ([API] AxiosError 등) — 프로덕션에서는 사용자 친화적 메시지만

### 변경
- 기존 `ScanScreen` 또는 `XrayScreen` → `ScanCameraScreen` 하나로 통합
- 기존 층별 안내 팝업 (화면 2/3 가리던 것) → 바텀시트 형태로 교체
- 건물 감지 시 "건물을 향해 카메라를 비추세요" 텍스트 → 감지 후 fade-out
- 에러 처리: retry 3회 + 사용자 메시지 매핑 (AxiosError → "네트워크 연결을 확인해주세요")

---

## 필수 패키지 (없으면 설치)

```bash
npx expo install react-native-reanimated react-native-gesture-handler
npx expo install @gorhom/bottom-sheet
npx expo install expo-camera expo-location
npx expo install react-native-safe-area-context
```

## 컴포넌트 파일 구조

```
src/
├── theme/
│   └── colors.ts                    # 컬러 상수
├── screens/
│   ├── HomeScreen.tsx               # 화이트톤 홈
│   ├── ScanCameraScreen.tsx         # 전체화면 카메라 + AR + 바텀시트
│   ├── PointHistoryScreen.tsx
│   └── ScanHistoryScreen.tsx
├── components/
│   ├── home/
│   │   ├── StatusCard.tsx           # 블루 그라데이션 인사 카드
│   │   ├── ScanStartCard.tsx        # 스캔 시작 CTA
│   │   ├── NearbyBuildings.tsx      # 주변 건물 가로 스크롤
│   │   └── RecentActivity.tsx       # 최근 활동
│   ├── camera/
│   │   ├── ARBuildingLabel.tsx      # 카메라 위 건물 라벨
│   │   ├── CameraOverlayBar.tsx     # 상단 오버레이
│   │   └── BuildingBottomSheet.tsx  # 건물 정보 바텀시트
│   ├── bottomsheet/
│   │   ├── BuildingHeader.tsx       # 건물명 + 거리 + 버튼
│   │   ├── QuickInfoTags.tsx        # ATM, 편의점 등 태그
│   │   ├── BuildingStats.tsx        # 4칸 스탯 그리드
│   │   ├── FloorList.tsx            # 층별 투시 리스트
│   │   └── LiveFeed.tsx             # 실시간 이벤트
│   └── common/
│       ├── SkeletonLoader.tsx       # Shimmer 스켈레톤
│       ├── PointBadge.tsx           # 포인트 pill
│       └── ErrorFallback.tsx        # 에러 시 사용자 친화적 UI
├── utils/
│   ├── errorMessages.ts             # AxiosError → 사용자 메시지 매핑
│   ├── greeting.ts                  # 시간대별 인사 메시지
│   └── api.ts                       # retry 로직 포함 API wrapper
└── navigation/
    └── AppNavigator.tsx
```

## 애니메이션 스펙
- 홈 → 카메라 전환: `fade` (300ms)
- StatusCard: 진입 시 fade-in + translateY(-20 → 0) (300ms ease-out)
- ScanStartCard: StatusCard 이후 150ms 딜레이 fade-in
- NearbyBuildings: snap scroll (카드 너비 + gap 기준)
- 바텀시트: spring 애니메이션 (damping: 50, stiffness: 300)
- AR 라벨: 건물 감지 시 scale(0 → 1) + fade-in (200ms)
- 가이드 텍스트: 건물 감지 시 fade-out (300ms)
- 층별 리스트 아이템: staggered fade-in (각 50ms 딜레이)

## 최종 품질 기준
- 토스/카카오뱅크 수준의 화이트 클린 UI (홈)
- 네이버 지도/카카오맵 수준의 AR 카메라 UX
- 투자자 시연, D.Camp 배치 심사에서 바로 보여줄 수 있는 프로덕션 완성도
- 빈 화면, 개발자 에러, 미완성 UI 전무
