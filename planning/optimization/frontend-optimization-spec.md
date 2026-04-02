# Frontend Code Optimization Spec

## 목표
프론트엔드 코드 최적화를 통해 코드베이스의 품질과 유지보수성을 향상시킨다.

## 배경
최근 React Query 마이그레이션을 진행하면서 여러 훅들을 수정했다. 이 과정에서:
- `useFactories.ts` - useState/useEffect → React Query
- `useEquipment.ts` - useState/useEffect → React Query
- `useLayouts.ts` - useState/useEffect → React Query

이제 전체 코드베이스를 분석하여 최적화가 필요한 부분을 찾아야 한다.

## 범위

### 1. 중복 함수/코드 분석
- 여러 컴포넌트에서 반복되는 유틸리티 함수
- 비슷한 로직을 가진 커스텀 훅들
- 타입 정의 중복

### 2. 미사용 코드 정리
- import 되었지만 사용되지 않는 모듈
- 정의되었지만 호출되지 않는 함수
- 더 이상 사용되지 않는 컴포넌트
- 레거시 Mock 데이터

### 3. React Query 마이그레이션 검증
- 모든 데이터 fetching 훅이 React Query를 사용하는지 확인
- 캐싱 전략이 일관성 있게 적용되었는지 검증
- staleTime, gcTime 설정의 적절성 확인

### 4. 코드 구조 개선
- 컴포넌트 간 공유 로직 통합
- 상수/색상 정의 중앙화
- 타입 정의 정리

## 분석 대상 파일
- `frontend/src/hooks/*.ts`
- `frontend/src/components/*.tsx`
- `frontend/src/pages/*.tsx`
- `frontend/src/lib/*.ts`

## 기대 결과
- 코드 중복 제거로 번들 크기 감소
- 일관된 데이터 fetching 패턴
- 유지보수가 용이한 코드 구조
