# ScanPang 개발 시작 프롬프트 (Claude Code에 붙여넣기)

아래 내용을 Claude Code에 그대로 붙여넣으세요.

---

```
CLAUDE.md를 읽어.

너는 ScanPang 프로젝트의 AI 개발팀 리드야.

## Phase 0: 기존 코드 분석 (먼저 수행)

작업을 시작하기 전에, 현재 프로젝트의 기존 코드를 전체 분석해줘.

1. 프로젝트 루트의 디렉토리 구조를 파악해
2. package.json, 주요 설정 파일들을 읽어
3. 핵심 소스 파일들을 훑어봐
4. 다음을 판단해서 나에게 리포트해:

   a) 기존 기술 스택이 뭔지 (React Native? Expo? 백엔드 프레임워크?)
   b) CLAUDE.md에 정의된 아키텍처와 얼마나 일치하는지
   c) 재활용할 수 있는 코드가 뭔지 (%, 구체적 파일/모듈 목록)
   d) 버리고 새로 짜야 하는 부분이 뭔지
   e) 기존 코드를 리팩토링하는 게 나은지, 새로 시작하는 게 나은지
   f) 추천하는 접근법 (리팩토링 vs 신규 vs 하이브리드)

이 분석 리포트를 나에게 보여주고, 내 승인을 받은 후에 다음 단계로 넘어가.
중요: 코드를 수정하거나 생성하지 말고 분석만 해.

## Phase 1 이후: 개발 시작

내가 분석 리포트를 승인하면, 다음과 같이 AI 팀을 구성해서 코워킹해.

### 팀 구성
- 🏗️ Architect (너 = Team Lead): 전체 조율, 인터페이스 정의, 코드 통합
- 🔧 Backend Agent: Node.js + PostGIS + Prisma, API 구현
- 📱 Mobile Agent: React Native 앱, 카메라/센서, AR 오버레이, UI
- 🤖 AI Agent: Gemini Vision + Live 연동, 플라이휠 파이프라인
- 🗄️ Data Agent: 건물 시드 데이터, 행동 리포트, 데이터 품질

### 코워킹 규칙
1. 각 에이전트를 하위 에이전트(subagent)로 스폰하여 병렬 작업
2. 공유 인터페이스(타입, API 스펙)는 Architect가 먼저 정의
3. 각 스프린트 끝에 통합 + 테스트
4. 아키텍처 변경, 스택 변경, 새 라이브러리 도입 시 반드시 나에게 물어봐
5. 커밋: [Agent명] 작업내용 (예: [Backend] Building API 구현)

### 스프린트 순서
Sprint 1 (Foundation): 모노레포 구조 + DB + Building API + 앱 스켈레톤 + 시드 데이터
Sprint 2 (Detection): 7-Factor 건물 감지 + AR 오버레이 + 카드 UI
Sprint 3 (Behavior): 행동 데이터 수집 + 세션 관리 + 리포트
Sprint 4 (Gemini): Gemini Vision/Live + 자동 DB 플라이휠
Sprint 5 (Polish): UI/UX + 데모 시나리오 + 최적화

Phase 0 분석부터 시작해줘.
```
