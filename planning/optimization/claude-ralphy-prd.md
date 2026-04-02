# Frontend Code Optimization PRD

## How to Use

```bash
ralphy --prd claude-ralphy-prd.md
```

---

## Context (컨텍스트)

### 목적

Factory Digital Twin 프론트엔드 코드의 품질과 유지보수성을 향상시키기 위한 최적화 작업입니다.

### 범위

이 PRD는 4개의 독립적인 섹션으로 구성되어 있으며, 각 섹션은 특정 최적화 목표를 가지고 있습니다:

1. **색상 정의 중앙화** - 3개 파일에 분산된 색상 정의를 단일 파일로 통합
2. **useCrud 리팩토링** - 555줄의 CRUD 훅을 제너릭 패턴으로 리팩토링하여 ~200줄로 감소
3. **Knip 도입** - 미사용 코드 자동 감지 도구 설정
4. **레거시 코드 정리** - Knip 결과를 기반으로 미사용 코드 제거

### 작업 환경

- **프로젝트 경로:** `c:\Users\USER\factor-digital-twin\factor-digital-twin`
- **프론트엔드 경로:** `frontend/`
- **예상 총 작업 시간:** 2-3시간

### 의존성 관계

```
Section 01 ─┐
            ├─→ (독립적)
Section 02 ─┘

Section 03: Knip Setup ───→ Section 04: Legacy Cleanup
            (선행 필수)
```

---

## Task Checklist (작업 체크리스트)

### Section 01: Colors Centralization

**상세 문서:** `sections/section-01-colors-centralization.md`

- [ ] `frontend/src/lib/colors.ts` 파일 생성 (색상 정의 + 유틸리티 함수)
- [ ] `EquipmentList.tsx`에서 로컬 색상 정의 제거 및 import 변경
- [ ] `LayoutCanvas.tsx`에서 로컬 색상 정의 제거 및 import 변경
- [ ] `Scene3D.tsx`에서 로컬 색상 정의 제거 및 import 변경
- [ ] `npm run build` 검증

---

### Section 02: useCrud Refactoring

**상세 문서:** `sections/section-02-usecrud-refactoring.md`

- [ ] `frontend/src/hooks/useCrudMutation.ts` 파일 생성 (제너릭 CRUD mutation 훅)
- [ ] `useCompanyMutations` 리팩토링 (useCrudMutation 사용)
- [ ] `useFactoryMutations` 리팩토링 (useCrudMutation 사용)
- [ ] `useLineMutations` 리팩토링 (useCrudMutation 사용)
- [ ] `useEquipmentMutations` 리팩토링 (useCrudMutation 사용)
- [ ] `npm run build` 검증
- [ ] Admin 페이지 CRUD 기능 동작 확인

---

### Section 03: Knip Setup

**상세 문서:** `sections/section-03-knip-setup.md`

- [ ] knip 패키지 설치 (`npm install --save-dev knip`)
- [ ] `frontend/knip.json` 설정 파일 생성
- [ ] `package.json`에 `lint:dead`, `lint:dead:fix` 스크립트 추가
- [ ] `npm run lint:dead` 실행 및 결과 확인
- [ ] 미사용 코드 목록 기록

---

### Section 04: Legacy Cleanup

**상세 문서:** `sections/section-04-legacy-cleanup.md`

- [ ] Knip 결과 분석 완료
- [ ] `EquipmentFull` 타입 삭제 (`frontend/src/lib/api.ts`)
- [ ] `useEquipment` 훅 사용처 확인 및 결정 (유지/삭제)
- [ ] 추가 미사용 코드 정리 (Knip 결과 기반)
- [ ] `npm run build` 검증
- [ ] 모든 페이지 기능 동작 확인

---

## Section Documents (섹션 상세 문서)

각 섹션의 상세한 구현 가이드는 아래 문서를 참조하세요:

| 섹션 | 파일 경로 | 주요 내용 |
|------|-----------|-----------|
| Section 01 | `sections/section-01-colors-centralization.md` | 색상 정의 파일 전체 코드, 변경 위치, Acceptance Criteria |
| Section 02 | `sections/section-02-usecrud-refactoring.md` | useCrudMutation 전체 코드, 리팩토링 전후 비교, API 호환성 |
| Section 03 | `sections/section-03-knip-setup.md` | knip.json 설정, 스크립트 추가, 트러블슈팅 |
| Section 04 | `sections/section-04-legacy-cleanup.md` | Knip 결과 분석 방법, 삭제 대상 코드, 롤백 계획 |

---

## Verification (검증)

### 빌드 검증

각 섹션 완료 후 빌드 성공 확인:

```bash
cd frontend
npm run build
```

### 기능 검증

전체 작업 완료 후 다음 기능 테스트:

- [ ] Admin 페이지: 회사/공장/라인 CRUD
- [ ] LayoutEditorPage: 2D 캔버스 렌더링
- [ ] FactoryLinePage: 3D 뷰어 렌더링
- [ ] RegistryPage: 설비 등록 기능

---

## Notes (참고사항)

1. **순서 의존성:** Section 03이 완료되어야 Section 04를 진행할 수 있습니다.
2. **롤백:** 각 섹션 문서에 롤백 계획이 포함되어 있습니다.
3. **색상 기준:** Section 01에서 LayoutCanvas.tsx의 색상을 기준으로 통일합니다.
4. **API 호환성:** Section 02에서 기존 훅의 반환 타입이 동일하게 유지되어야 합니다.
