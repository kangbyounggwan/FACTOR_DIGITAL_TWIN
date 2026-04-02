# Section 05: Registry Page Update

## Background
RegistryPage가 lineCode props를 사용하도록 수정하고, 네비게이션을 개선합니다.

## Dependencies
- **Requires**: Section 04
- **Blocks**: 없음 (병렬 진행 가능)

## Files to Modify
- `frontend/src/pages/RegistryPage.tsx`

## Implementation

### 1. Props 인터페이스 변경

```typescript
// 기존
interface Props { siteId: string }

// 변경
interface Props {
  lineCode: string
  factoryName?: string
  lineName?: string
  onBack: () => void
}
```

### 2. Hook 호출 변경

```typescript
// 기존
const { equipment, stats, loading, selected, setSelected, save } = useEquipment(siteId)

// 변경
const { equipment, stats, loading, selected, setSelected, save } = useEquipment(lineCode)
```

### 3. 컴포넌트 시그니처 변경

```typescript
// 기존
export default function RegistryPage({ siteId }: Props) {

// 변경
export default function RegistryPage({ lineCode, factoryName, lineName, onBack }: Props) {
```

### 4. 빵부스러기 추가 (선택적)

```tsx
{/* Stats Overlay 위에 또는 별도 위치에 추가 가능 */}
{factoryName && lineName && (
  <div className="absolute top-4 left-4 flex items-center gap-2 text-sm bg-card/90 backdrop-blur-sm px-3 py-2 rounded-lg">
    <Button variant="ghost" size="icon" onClick={onBack} className="h-6 w-6">
      <ArrowLeft className="h-4 w-4" />
    </Button>
    <span className="text-muted-foreground">{factoryName}</span>
    <span className="text-muted-foreground">/</span>
    <span>{lineName}</span>
  </div>
)}
```

**참고**: App.tsx 헤더에서 이미 빵부스러기를 표시하므로, RegistryPage 내부에 추가하지 않아도 됨. onBack은 App.tsx 헤더의 뒤로가기 버튼에서 처리.

### 5. Import 추가 (빵부스러기 사용 시)

```typescript
import { ArrowLeft } from 'lucide-react'
```

## Acceptance Criteria
- [ ] lineCode props로 설비 데이터 로드됨
- [ ] 해당 라인의 설비만 표시됨
- [ ] 기존 기능 (선택, 편집, 3D 뷰) 정상 동작
- [ ] 빈 라인 (설비 없음)일 때 정상 표시
