<!-- SECTION_MANIFEST
section-01-backend-debug
section-02-frontend-debug
section-03-bug-fix
section-04-testing
END_MANIFEST -->

# Implementation Sections Index

Layout Save/Load Bug Fix

Generated: 2026-04-01

---

## Dependency Graph

| Section | Depends On | Blocks | Priority |
|---------|------------|--------|----------|
| section-01-backend-debug | - | 03 | Critical |
| section-02-frontend-debug | - | 03 | Critical |
| section-03-bug-fix | 01, 02 | 04 | Critical |
| section-04-testing | 03 | - | High |

---

## Execution Order

```
01-backend-debug  ──┐
                    ├──▶ 03-bug-fix ──▶ 04-testing
02-frontend-debug ──┘
```

**Section 1, 2는 병렬 실행 가능**

---

## Section Summaries

### Section 1: Backend API Debug

Backend `/layouts/{layout_id}` 엔드포인트 검증:
- UUID → scan_code 변환 확인
- 응답 데이터 로깅 추가
- 테스트 엔드포인트 생성

**파일**: `backend/app/api/layouts.py`

### Section 2: Frontend State Debug

Frontend `handleLayoutSelect` 함수 디버깅:
- 상태 변경 로깅 추가
- localPositions/localSizes 추적
- equipmentWithLocalPositions 갱신 확인

**파일**: `frontend/src/pages/LayoutEditorPage.tsx`

### Section 3: Bug Fix

디버깅 결과 기반 버그 수정:
- 가설 A: API 응답 형식 수정
- 가설 B: 상태 업데이트 강제
- 가설 C: 키 매칭 로직 수정
- 가설 D: 비동기 타이밍 수정

**파일**: 원인에 따라 결정

### Section 4: Testing

수정 검증:
- 수동 테스트 시나리오 실행
- Network 탭 API 응답 확인
- React DevTools 상태 확인

**파일**: 없음 (수동 검증)

---

## Acceptance Criteria (전체)

- [ ] 레이아웃 선택 시 캔버스에 위치 즉시 반영
- [ ] 저장 후 재선택 시 위치 유지
- [ ] 새로고침 시 초기 상태로 리셋
- [ ] 콘솔에 오류 없음
