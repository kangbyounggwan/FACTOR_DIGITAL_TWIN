# Internal Review - Frontend Optimization Plan

## Overall Assessment: APPROVED

계획이 잘 구성되어 있으며, 실행 가능합니다.

---

## Section 1: 색상 중앙화 - APPROVED

**강점:**
- 명확한 구조와 유틸 함수 설계
- 기존 코드와의 호환성 고려

**권장 개선:**
1. 색상 값 정확성 검증 - 기존 파일의 HEX 값을 정확히 복사했는지 확인 필요
2. Scene3D.tsx의 `EQ_HEX`와 EquipmentList.tsx의 `TYPE_COLORS` 값이 다름 (예: SMT_LINE이 0x00FF88 vs bg-emerald-600). 어떤 값이 정확한지 결정 필요.

---

## Section 2: useCrud.ts 리팩토링 - APPROVED WITH NOTES

**강점:**
- 제너릭 패턴으로 코드 중복 효과적 제거
- 타입 안전성 유지

**권장 개선:**
1. `withErrorHandling` 함수가 useCallback 내부에서 정의되는데, 매 렌더링마다 새 함수 생성될 수 있음. useMemo나 useRef 고려.
2. 반환 타입에서 undefined 가능성 처리 필요 (config에 함수가 없을 때)

**대안 고려:**
- React Query의 `useMutation`으로 완전 전환하면 더 표준적이지만, 현재 범위에서는 제너릭 훅이 적절함.

---

## Section 3: Knip 도입 - APPROVED

**강점:**
- 표준 도구 사용
- 간단한 설정

**권장 개선:**
1. CI/CD 파이프라인에 Knip 검사 추가 고려
2. `--reporter` 옵션으로 출력 형식 지정 가능

---

## Section 4: 레거시 코드 정리 - APPROVED

**강점:**
- 보수적 접근 (확인 후 삭제)

**권장 개선:**
1. useEquipment 훅 삭제 전 grep으로 사용처 확인 필수
2. MOCK 데이터가 개발 환경에서 필요할 수 있으므로 환경 변수 기반 유지 고려

---

## Summary

| Section | Status | Priority |
|---------|--------|----------|
| 색상 중앙화 | Approved | High |
| useCrud 리팩토링 | Approved | High |
| Knip 도입 | Approved | Medium |
| 레거시 정리 | Approved | Low |

**전체 실행 권장:** Yes
