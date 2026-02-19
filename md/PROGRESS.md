# ScanPang Development Progress

## 마지막 업데이트: 2026-02-20

## 완료된 스프린트

### Sprint 1: Foundation (완료)
- shared/schema.sql 확장 (behavior_events, user_sessions, sourced_info, building_profiles 테이블)
- backend/src/db/migrations/002_extend_schema.js
- backend/src/routes/behavior.js (6 endpoints)
- backend/src/routes/time.js (2 endpoints)
- backend/src/routes/flywheel.js (4 endpoints)
- backend/src/db/seeds/003_gangnam_extended.js (32 buildings)
- backend/src/app.js 라우터 등록
- render.yaml 업데이트

### Sprint 2: Core Detection (완료)
- mobile/src/services/detectionEngine.js (7-Factor confidence scoring)
- mobile/src/hooks/useSensorData.js (자이로/가속도계/카메라 각도)
- mobile/src/services/behaviorTracker.js (세션 관리 + 자동 gaze tracking + 오프라인 버퍼)
- mobile/src/services/api.js (getServerTime, getServerTimeContext 추가)
- ScanCameraScreen.js 통합 (confidence badge, sensor overlay, behaviorTracker 연동)

### Sprint 3: Behavior Data (완료)
- ScanCameraScreen 이벤트 트래킹 완성 (card_open/close, floor_tap, reward, pin_click)
- mobile/src/screens/BehaviorReportScreen.js 신규 생성
- api.js에 getBehaviorReport, getAreaBehaviorReport 추가
- App.js에 BehaviorReport 스크린 등록
- ScanCameraScreen 바텀시트에 "리포트" 버튼 추가
- HomeScreen NearbyBuildings long-press → 리포트 진입
- AppState 리스너 추가 (백그라운드 flush, 포그라운드 복구)

### Sprint 4: Gemini + Flywheel (완료)
- **Backend Gemini Proxy API** (`backend/src/routes/gemini.js`)
  - POST /api/gemini/analyze-frame (카메라 프레임 → Gemini Vision 분석)
  - POST /api/gemini/live/start (Live 대화 세션 시작)
  - POST /api/gemini/live/audio (텍스트 메시지 전송)
  - GET /api/gemini/live/stream (SSE 스트리밍 응답)
  - 분석 결과 → flywheel 자동 소싱 (confidence ≥ 0.5)
  - @google/generative-ai 패키지 설치 (gemini-2.0-flash 모델)
- **Mobile Gemini 연동**
  - api.js: analyzeFrame, startGeminiLive, sendGeminiMessage, getGeminiStreamUrl 추가
  - api.js: getFlywheelStats, getFlywheelPending 추가
  - detectionEngine.js: scoreGeminiVision stub → 실제 분석 결과 반영
  - rankBuildings에 geminiResults Map 파라미터 추가
  - ScanCameraScreen: 15초 간격 프레임 분석, cameraRef, geminiResults state
- **Gemini Live UI** (`mobile/src/components/GeminiLiveChat.js`)
  - 바텀시트 내 AI 대화 컴포넌트
  - 빠른 질문 버튼 4개 (건물 정보, 영업시간, 맛집, 층수)
  - 채팅 말풍선 UI (user/ai/system)
  - 세션 자동 생성, 키보드 대응
- **Flywheel Dashboard** (`mobile/src/screens/FlywheelDashboardScreen.js`)
  - 핵심 통계 (총 소싱, 검증률, 커버리지, 24h 활동)
  - 검증 현황 (완료/대기/프로필)
  - 소스별 분포 바 차트
  - 데이터 품질 (평균 신뢰도 서클)
  - 검증 대기 목록 미리보기
  - Flywheel 인사이트 텍스트
- **네비게이션 연결**
  - App.js: FlywheelDashboard 스크린 등록
  - HomeScreen: Flywheel Dashboard 진입 카드 추가

## 다음 스프린트

### Sprint 5: Polish + Demo
- 성능 최적화
- UI 폴리시
- 데모 시나리오 구성

## 핵심 결정사항
1. JavaScript 유지 (TypeScript는 Phase 2)
2. raw pg 유지 (Prisma skip)
3. flat 디렉토리 구조 유지 (monorepo skip)
4. Gemini Live는 Phase 1에서 텍스트 기반 (음성은 Phase 2)
5. Gemini 프레임 분석은 15초 간격, 안정 시에만 실행
6. GEMINI_API_KEY는 Render 환경변수로 설정 필요
