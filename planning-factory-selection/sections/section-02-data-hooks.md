# Section 02: Data Hooks

## Background
공장/라인 데이터 로딩을 위한 커스텀 훅을 생성합니다. 기존 useEquipment 패턴을 따릅니다.

## Dependencies
- **Requires**: Section 01 (API Layer)
- **Blocks**: Section 03

## Files to Create
- `frontend/src/hooks/useFactories.ts`

## Implementation

### 새 파일: `src/hooks/useFactories.ts`

```typescript
import { useState, useEffect, useCallback } from 'react'
import { Factory, ProductionLine, fetchFactories, fetchFactoryLines } from '@/lib/api'

export function useFactories() {
  const [factories, setFactories] = useState<Factory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchFactories()
      setFactories(data)
    } catch (e) {
      setError(e as Error)
      setFactories([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return { factories, loading, error, reload: load }
}

export function useFactoryLines(factoryCode: string | null) {
  const [lines, setLines] = useState<ProductionLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const load = useCallback(async () => {
    if (!factoryCode) {
      setLines([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const data = await fetchFactoryLines(factoryCode)
      setLines(data)
    } catch (e) {
      setError(e as Error)
      setLines([])
    } finally {
      setLoading(false)
    }
  }, [factoryCode])

  useEffect(() => {
    load()
  }, [load])

  return { lines, loading, error, reload: load }
}
```

## Acceptance Criteria
- [ ] useFactories 훅이 공장 목록을 로드함
- [ ] useFactoryLines 훅이 라인 목록을 로드함
- [ ] loading 상태가 정확히 동작함
- [ ] error 상태가 정확히 동작함
- [ ] factoryCode가 null이면 빈 배열 반환
