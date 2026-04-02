# Interview Transcript

## Q1: 색상 정의 중앙화 시 어떤 포맷을 기본으로 사용할까요?

**Options:**
- HEX string (Recommended) - '#059669' 형식, 변환 유틸 함수로 Three.js/Tailwind 지원
- RGB object - { r: 5, g: 150, b: 105 }, 가장 유연한 변환
- Tailwind class 유지 - 현재 구조 유지, Three.js용 별도 매핑

**Answer:** Tailwind class 유지

**Implication:**
- EquipmentList.tsx의 Tailwind 클래스 기반 구조를 유지
- Scene3D.tsx, LayoutCanvas.tsx용 HEX 값은 별도 매핑 객체로 관리
- lib/colors.ts에 Tailwind → HEX 매핑 테이블 생성

---

## Q2: useCrud.ts 리팩토링 범위는?

**Options:**
- 제너릭 hook 생성 (Recommended) - 공통 패턴을 추출하여 555줄 → ~250줄로 감소
- 현재 구조 유지 - 동작하는 코드는 건드리지 않음
- React Query mutation으로 전환 - useMutation 훅으로 완전 마이그레이션

**Answer:** 제너릭 hook 생성 (Recommended)

**Implication:**
- withErrorHandling 헬퍼 함수 생성
- useCrudMutation 제너릭 훅 구현
- 기존 useCompanyMutations, useFactoryMutations, useLineMutations 리팩토링

---

## Q3: 번들 최적화를 진행할까요?

**Options:**
- manualChunks 설정 (Recommended) - vendor 라이브러리 분리로 캐싱 효율 향상
- visualizer만 추가 - 분석 도구만 추가하고 최적화는 나중에
- 번들 최적화 제외 - 현재 상태로 유지

**Answer:** 번들 최적화 제외

**Implication:**
- vite.config.ts 변경 없음
- 추후 필요 시 별도 태스크로 진행

---

## Q4: Knip으로 미사용 코드 검사를 프로젝트에 추가할까요?

**Options:**
- 추가 (Recommended) - package.json scripts에 knip 검사 추가
- 추가 안함 - 수동으로 미사용 코드 관리

**Answer:** 추가 (Recommended)

**Implication:**
- knip 패키지 설치
- package.json에 "lint:dead" 스크립트 추가
- knip.json 설정 파일 생성
- 초기 검사 실행 및 미사용 코드 정리

---

## Summary

| 항목 | 결정 | 우선순위 |
|------|------|----------|
| 색상 중앙화 | Tailwind 유지 + HEX 매핑 | High |
| useCrud 리팩토링 | 제너릭 hook 생성 | High |
| 번들 최적화 | 제외 | - |
| Knip 추가 | 추가 | Medium |
