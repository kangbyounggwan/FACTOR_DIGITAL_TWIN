# Section 06: Pipeline Page Update

## Background
PipelinePage가 lineCode props를 사용하도록 수정하고, 완료 콜백을 추가합니다.

## Dependencies
- **Requires**: Section 04
- **Blocks**: 없음 (병렬 진행 가능)

## Files to Modify
- `frontend/src/pages/PipelinePage.tsx`

## Implementation

### 1. Props 인터페이스 변경

```typescript
// 기존
interface Props { siteId: string }

// 변경
interface Props {
  lineCode: string
  onComplete: () => void
  onBack: () => void
}
```

### 2. 컴포넌트 시그니처 변경

```typescript
// 기존
export default function PipelinePage({ siteId }: Props) {

// 변경
export default function PipelinePage({ lineCode, onComplete, onBack }: Props) {
```

### 3. siteId 참조 변경

```typescript
// 기존
const [jobId, _] = await startPipeline(file, siteId, voxelSize)

// 변경
const [jobId, _] = await startPipeline(file, lineCode, voxelSize)
```

### 4. 완료 콜백 추가

```typescript
// status 변경 감지
useEffect(() => {
  if (status === 'done') {
    // 2초 후 자동으로 RegistryPage로 이동
    const timer = setTimeout(() => {
      onComplete()
    }, 2000)
    return () => clearTimeout(timer)
  }
}, [status, onComplete])
```

### 5. 완료 UI 업데이트 (선택적)

```tsx
{status === 'done' && (
  <Card>
    <CardContent className="py-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Badge variant="default" className="text-lg px-4 py-2">
          처리 완료
        </Badge>
        <p className="text-muted-foreground">
          2초 후 설비 등록 화면으로 이동합니다...
        </p>
        <Button onClick={onComplete}>
          지금 이동
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

### 6. 사이트 정보 표시 수정

```tsx
{/* 기존 site_id 표시 → lineCode 표시 */}
<Card>
  <CardHeader className="pb-3">
    <CardTitle className="font-mono text-sm uppercase tracking-widest font-normal">
      대상 라인
    </CardTitle>
  </CardHeader>
  <CardContent>
    <p className="font-mono text-lg">{lineCode}</p>
  </CardContent>
</Card>
```

## Acceptance Criteria
- [ ] lineCode props로 파이프라인 실행됨
- [ ] 기존 업로드/처리 기능 정상 동작
- [ ] 처리 완료 시 onComplete 콜백 호출됨
- [ ] "지금 이동" 버튼으로 즉시 이동 가능
- [ ] 대상 라인 코드가 정확히 표시됨
