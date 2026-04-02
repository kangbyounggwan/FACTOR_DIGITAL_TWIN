# Frontend Code Optimization - Section Index

```
SECTION_MANIFEST:
- section-01-colors-centralization.md
- section-02-usecrud-refactoring.md
- section-03-knip-setup.md
- section-04-legacy-cleanup.md
```

---

## Overview

이 프로젝트는 Factory Digital Twin 프론트엔드 코드의 품질과 유지보수성을 향상시키기 위한 최적화 작업입니다.

**총 섹션:** 4개
**예상 작업 시간:** 2-3시간
**의존성:** 순차적 실행 권장 (Section 1 → 2 → 3 → 4)

---

## Section Dependencies

```
Section 1: Colors Centralization
    ↓ (독립적)
Section 2: useCrud Refactoring
    ↓ (독립적)
Section 3: Knip Setup
    ↓
Section 4: Legacy Cleanup (Knip 결과 활용)
```

---

## Section Summary

### Section 01: Colors Centralization
**파일:** `section-01-colors-centralization.md`
**목표:** 3개 파일에 분산된 색상 정의를 lib/colors.ts로 중앙화
**영향 파일:**
- 신규: `src/lib/colors.ts`
- 수정: `EquipmentList.tsx`, `LayoutCanvas.tsx`, `Scene3D.tsx`

### Section 02: useCrud Refactoring
**파일:** `section-02-usecrud-refactoring.md`
**목표:** 555줄의 useCrud.ts를 제너릭 훅으로 리팩토링하여 ~200줄로 감소
**영향 파일:**
- 신규: `src/hooks/useCrudMutation.ts`
- 수정: `src/hooks/useCrud.ts`

### Section 03: Knip Setup
**파일:** `section-03-knip-setup.md`
**목표:** 미사용 코드 자동 감지 도구 Knip 도입
**영향 파일:**
- 신규: `knip.json`
- 수정: `package.json`

### Section 04: Legacy Cleanup
**파일:** `section-04-legacy-cleanup.md`
**목표:** Knip으로 발견된 미사용 코드 및 레거시 훅 정리
**영향 파일:**
- 검토: `src/hooks/useEquipment.ts`
- 검토: `src/lib/api.ts`

---

## Execution Order

1. **Section 01** - 색상 중앙화 (독립적으로 완료 가능)
2. **Section 02** - useCrud 리팩토링 (독립적으로 완료 가능)
3. **Section 03** - Knip 설정 (Section 04 전에 완료 필요)
4. **Section 04** - 레거시 정리 (Knip 결과 기반)

각 섹션 완료 후 `npm run build`로 검증 권장.
