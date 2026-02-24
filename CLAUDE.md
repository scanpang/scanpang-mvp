# ScanPang 프로젝트 규칙

## 컨텍스트 관리 (필수)
- 대화가 길어져서 컨텍스트가 부족해질 것 같으면 (자동 압축이 발생하거나, 복잡한 작업이 계속될 때):
  1. 현재 작업 상태, 진행 상황, 남은 작업을 `C:\Users\AA\.claude\projects\C--users-aa-desktop-dev-scanpang\memory\MEMORY.md`에 저장
  2. 사용자에게 "컨텍스트가 부족합니다. 메모리에 저장했으니 /clear 후 이어서 작업하세요" 안내
  3. 새 세션 시작 시 반드시 MEMORY.md를 참조하여 이전 작업 이어서 진행

## 언어
- 사용자와 한국어로 대화
- 코드 주석도 한국어

## 커밋 컨벤션
- 형식: `[type] 한국어 설명`
- type: feat, fix, refactor, chore, docs
- 예: `[feat] 건물 감지 아키텍처 전환`

## 프로젝트 구조
- `backend/` — Express.js + PostgreSQL (Supabase)
- `mobile/` — React Native + Expo (EAS Build)
- APK 빌드: `npx eas build --platform android --profile preview --non-interactive`

## 자주 쓰는 명령
- 푸시: `git push` (main 브랜치)
- APK: preview 프로필 = 배포용 API + 릴리스 서명 APK
