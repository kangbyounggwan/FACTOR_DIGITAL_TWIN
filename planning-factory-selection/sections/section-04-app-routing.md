# Section 04: App Routing

## Background
App.tsx의 페이지 타입을 확장하고 라우팅 로직을 수정합니다. 공장/라인 선택 상태를 관리합니다.

## Dependencies
- **Requires**: Section 03
- **Blocks**: Section 05, 06

## Files to Modify
- `frontend/src/App.tsx`

## Implementation

### 1. 타입 및 import 수정

```typescript
// App.tsx 상단

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Factory, ProductionLine } from '@/lib/api'
import FactoryLinePage from './pages/FactoryLinePage'
import RegistryPage from './pages/RegistryPage'
import PipelinePage from './pages/PipelinePage'
import { ArrowLeft } from 'lucide-react'

// ... queryClient 설정 유지

type Page = 'factory-line' | 'registry' | 'pipeline'
```

### 2. 상태 관리

```typescript
export default function App() {
  const [page, setPage] = useState<Page>('factory-line')
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null)
  const [selectedLine, setSelectedLine] = useState<ProductionLine | null>(null)

  // 라인 선택 → 3D 뷰어로 이동
  const handleSelectLine = (factory: Factory, line: ProductionLine) => {
    setSelectedFactory(factory)
    setSelectedLine(line)
    setPage('registry')
  }

  // 업로드 버튼 → 파이프라인으로 이동
  const handleUpload = (factory: Factory, line: ProductionLine) => {
    setSelectedFactory(factory)
    setSelectedLine(line)
    setPage('pipeline')
  }

  // 뒤로가기 → 공장/라인 선택으로
  const handleBack = () => {
    setPage('factory-line')
    // 선택 상태는 유지 (다시 선택 화면에서 이전 선택 표시)
  }

  // 파이프라인 완료 → 3D 뷰어로
  const handlePipelineComplete = () => {
    setPage('registry')
  }

  // ... render
}
```

### 3. 헤더 수정

```tsx
<header className="flex items-center justify-between px-6 h-14 border-b bg-card flex-shrink-0">
  <div className="flex items-center gap-4">
    {/* 뒤로가기 버튼 (registry/pipeline에서만) */}
    {page !== 'factory-line' && (
      <Button variant="ghost" size="icon" onClick={handleBack}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
    )}

    <span className="font-mono text-sm font-semibold tracking-widest text-primary">
      FACTOR
    </span>

    {/* 현재 선택 표시 */}
    {selectedFactory && selectedLine && page !== 'factory-line' && (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{selectedFactory.name}</span>
        <span className="text-muted-foreground">/</span>
        <span>{selectedLine.name}</span>
      </div>
    )}
  </div>

  <nav className="flex gap-2">
    {page !== 'factory-line' && (
      <>
        <Button
          variant={page === 'registry' ? 'secondary' : 'ghost'}
          onClick={() => setPage('registry')}
          className={cn(
            'text-sm font-mono px-4',
            page === 'registry' && 'border border-border'
          )}
          disabled={!selectedLine}
        >
          설비 등록
        </Button>
        <Button
          variant={page === 'pipeline' ? 'secondary' : 'ghost'}
          onClick={() => setPage('pipeline')}
          className={cn(
            'text-sm font-mono px-4',
            page === 'pipeline' && 'border border-border'
          )}
          disabled={!selectedLine}
        >
          파이프라인
        </Button>
      </>
    )}
  </nav>
</header>
```

### 4. 페이지 렌더링

```tsx
<main className="flex-1 overflow-hidden">
  {page === 'factory-line' && (
    <FactoryLinePage
      onSelectLine={handleSelectLine}
      onUpload={handleUpload}
    />
  )}

  {page === 'registry' && selectedLine && (
    <RegistryPage
      lineCode={selectedLine.code}
      factoryName={selectedFactory?.name}
      lineName={selectedLine.name}
      onBack={handleBack}
    />
  )}

  {page === 'pipeline' && selectedLine && (
    <PipelinePage
      lineCode={selectedLine.code}
      onComplete={handlePipelineComplete}
      onBack={handleBack}
    />
  )}
</main>
```

## Acceptance Criteria
- [ ] 앱 시작 시 factory-line 페이지 표시
- [ ] 공장/라인 선택 후 registry 페이지로 이동
- [ ] 업로드 클릭 시 pipeline 페이지로 이동
- [ ] 뒤로가기 버튼으로 factory-line 복귀
- [ ] 헤더에 현재 선택된 공장/라인 표시
- [ ] 탭 네비게이션이 정상 동작
