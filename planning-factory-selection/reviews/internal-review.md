# Internal Review

## Strengths

1. **Simple Architecture**: useState 기반 유지로 복잡성 최소화
2. **Clear Page Flow**: 2단계 플로우로 사용자 경험 단순화
3. **Component Reuse**: 기존 shadcn/ui 컴포넌트 활용
4. **MES Compatibility**: 기존 DB 스키마 변경 없음

## Suggestions

### 1. Table Component 추가 필요
현재 shadcn/ui에 Table 컴포넌트가 없을 수 있음. 추가 필요:
```bash
npx shadcn@latest add table
```

### 2. Empty State 처리
공장/라인이 없을 때 안내 메시지 필요:
- "등록된 공장이 없습니다"
- "이 공장에 등록된 라인이 없습니다"

### 3. 로딩 UX 개선
테이블 로딩 시 Skeleton 컴포넌트 사용 고려

### 4. 라인 선택 후 상태 유지
RegistryPage에서 뒤로가기 시 이전 공장 선택 상태 유지

## Risk Assessment

| 리스크 | 영향도 | 대응 |
|--------|--------|------|
| API 응답 지연 | 낮음 | 로딩 스피너 |
| 빈 데이터 | 중간 | Empty state UI |
| 기존 코드 충돌 | 낮음 | siteId→lineCode 점진적 변경 |

## Recommendation
계획대로 진행 권장. 추가 제안사항은 구현 중 반영.
