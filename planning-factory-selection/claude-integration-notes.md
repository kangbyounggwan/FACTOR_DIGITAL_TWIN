# Integration Notes

## Integrated Suggestions

### 1. Table Component
**통합함**: Section 3에 shadcn/ui Table 설치 단계 추가

### 2. Empty State
**통합함**: FactoryLinePage에 빈 상태 UI 추가
- 공장 없음: "등록된 공장이 없습니다"
- 라인 없음: "이 공장에 등록된 라인이 없습니다"

### 3. 상태 유지
**통합함**: App.tsx에서 selectedFactory/selectedLine 상태 유지

## Not Integrated

### Skeleton Loading
**통합 안 함**: 현재 단순 로딩 스피너로 충분
- 추후 UX 개선 시 별도 작업으로 진행

## Plan Updates

1. Section 3에 `npx shadcn@latest add table` 단계 추가
2. FactoryLinePage에 Empty state 컴포넌트 추가
3. App.tsx 상태 관리에 선택 상태 유지 로직 반영
