# Section 01: API Layer

## Background
공장/라인 데이터를 백엔드에서 조회하기 위한 API 함수와 타입을 추가합니다.

## Dependencies
- **Requires**: 없음
- **Blocks**: Section 02, 03

## Files to Modify
- `frontend/src/lib/api.ts`

## Implementation

### 1. 타입 정의 추가

```typescript
// lib/api.ts에 추가

export interface Factory {
  id: string
  code: string
  name: string
  address: string | null
  company_name: string | null
}

export interface ProductionLine {
  id: string
  code: string
  name: string
  description: string | null
  location: string | null
  equipment_count: number
}
```

### 2. API 함수 추가

```typescript
// lib/api.ts에 추가

// Factory API
export const fetchFactories = () =>
  api.get<Factory[]>('/factories').then(r => r.data)

export const fetchFactoryLines = (factoryCode: string) =>
  api.get<ProductionLine[]>(`/factories/${factoryCode}/lines`).then(r => r.data)
```

## Acceptance Criteria
- [ ] Factory 인터페이스가 정의됨
- [ ] ProductionLine 인터페이스가 정의됨
- [ ] fetchFactories 함수가 동작함
- [ ] fetchFactoryLines 함수가 동작함
- [ ] 브라우저 콘솔에서 API 호출 테스트 성공
