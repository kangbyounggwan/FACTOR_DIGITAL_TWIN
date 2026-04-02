# Layout Save/Load Bug Fix - Implementation Plan

Generated: 2026-04-01

---

## Overview

이 문서는 레이아웃 저장/로드 버그를 수정하기 위한 상세 구현 계획입니다.

**핵심 버그**: 레이아웃 선택 시 저장된 설비 위치가 캔버스에 적용되지 않음

**목표**:
1. 레이아웃 선택 시 위치 즉시 적용
2. 디버깅을 통한 근본 원인 파악
3. 테스트 케이스 추가

---

## Section 1: Backend API 검증 및 수정

### 1.1 목표

Backend `GET /layouts/{layout_id}` 엔드포인트가 올바른 형식의 데이터를 반환하는지 검증

### 1.2 작업 내용

1. **API 응답 검증**
   - `layouts.py:get_layout` 함수에 로깅 추가
   - UUID → scan_code 변환 결과 확인
   - 응답 JSON 구조 검증

2. **테스트 엔드포인트 추가**
   ```python
   @router.get("/{layout_id}/debug")
   def debug_layout(layout_id: UUID, db: Client = Depends(get_supabase)):
       """Debug endpoint to check raw data"""
       # Raw layout_equipment 데이터
       # UUID → scan_code 변환 전후 비교
   ```

3. **검증 항목**
   - equipment 배열에 equipment_id가 scan_code 형식인가?
   - centroid_x, centroid_y 값이 올바른가?
   - size_w, size_d 값이 올바른가?

### 1.3 파일 수정

- `backend/app/api/layouts.py`

### 1.4 Acceptance Criteria

- [ ] API 응답에 scan_code 형식의 equipment_id 포함
- [ ] API 응답에 올바른 위치/크기 값 포함
- [ ] 디버그 로그로 변환 과정 확인 가능

---

## Section 2: Frontend 상태 추적 및 디버깅

### 2.1 목표

`handleLayoutSelect` 함수의 실행 흐름과 상태 변경을 추적하여 버그 원인 파악

### 2.2 작업 내용

1. **디버그 로그 추가**
   ```typescript
   const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
     console.log('[Layout] handleLayoutSelect called:', layoutId)
     setSelectedLayoutId(layoutId)

     if (!layoutId) {
       console.log('[Layout] Clearing positions')
       setLocalPositions({})
       setLocalSizes({})
       return
     }

     try {
       console.log('[Layout] Fetching layout data...')
       const layoutDetail = await fetchLayout(layoutId)
       console.log('[Layout] Received:', layoutDetail)

       if (layoutDetail?.equipment) {
         console.log('[Layout] Equipment count:', layoutDetail.equipment.length)

         const newPositions: Record<string, { x: number; y: number }> = {}
         const newSizes: Record<string, { w: number; d: number }> = {}

         for (const eq of layoutDetail.equipment) {
           console.log('[Layout] Processing:', eq.equipment_id, eq.centroid_x, eq.centroid_y)
           newPositions[eq.equipment_id] = { x: eq.centroid_x, y: eq.centroid_y }
           newSizes[eq.equipment_id] = { w: eq.size_w, d: eq.size_d }
         }

         console.log('[Layout] Setting positions:', Object.keys(newPositions).length)
         setLocalPositions(newPositions)
         setLocalSizes(newSizes)
       }
     } catch (error) {
       console.error('[Layout] Error:', error)
     }
   }, [])
   ```

2. **상태 변경 감시**
   ```typescript
   // localPositions 변경 감시
   useEffect(() => {
     console.log('[State] localPositions changed:', Object.keys(localPositions).length)
   }, [localPositions])

   // equipmentWithLocalPositions 변경 감시
   useEffect(() => {
     console.log('[State] equipmentWithLocalPositions updated')
     if (equipmentWithLocalPositions.length > 0) {
       console.log('[State] First equipment position:',
         equipmentWithLocalPositions[0].equipment_id,
         equipmentWithLocalPositions[0].centroid_x,
         equipmentWithLocalPositions[0].centroid_y
       )
     }
   }, [equipmentWithLocalPositions])
   ```

### 2.3 파일 수정

- `frontend/src/pages/LayoutEditorPage.tsx`

### 2.4 Acceptance Criteria

- [ ] 콘솔에서 전체 실행 흐름 확인 가능
- [ ] 상태 변경 전후 값 비교 가능
- [ ] 버그 원인 파악

---

## Section 3: 버그 수정

### 3.1 예상 원인 및 수정안

#### 가설 A: API 응답 형식 불일치

**원인**: Backend가 잘못된 형식의 데이터 반환
**수정**: `layouts.py` 응답 변환 로직 수정

#### 가설 B: 상태 업데이트 누락

**원인**: `setLocalPositions` 호출 후 리렌더링 안됨
**수정**:
```typescript
// 강제 리렌더링 트리거
const [forceUpdate, setForceUpdate] = useState(0)

// handleLayoutSelect 마지막에 추가
setForceUpdate(prev => prev + 1)
```

#### 가설 C: filteredEquipment와 키 불일치

**원인**: `filteredEquipment`의 `equipment_id`와 `localPositions`의 키가 다름
**수정**: 키 매칭 로직 확인 및 정규화

#### 가설 D: 비동기 타이밍 문제

**원인**: `fetchLayout` 완료 전에 다른 상태 변경 발생
**수정**:
```typescript
// 로딩 상태 추가
const [layoutLoading, setLayoutLoading] = useState(false)

const handleLayoutSelect = useCallback(async (layoutId: string | null) => {
  setLayoutLoading(true)
  try {
    // ... existing logic
  } finally {
    setLayoutLoading(false)
  }
}, [])
```

### 3.2 파일 수정

- `backend/app/api/layouts.py` (가설 A)
- `frontend/src/pages/LayoutEditorPage.tsx` (가설 B, C, D)

### 3.3 Acceptance Criteria

- [ ] 레이아웃 선택 시 위치 즉시 반영
- [ ] 콘솔에 오류 없음
- [ ] 저장 후 재선택 시 위치 유지

---

## Section 4: 테스트 및 검증

### 4.1 수동 테스트 시나리오

1. **기본 로드 테스트**
   - 페이지 로드
   - 레이아웃 선택
   - 캔버스 위치 확인

2. **저장/로드 테스트**
   - 설비 위치 변경
   - 레이아웃 저장
   - 다른 레이아웃 선택
   - 원래 레이아웃 재선택
   - 위치 확인

3. **새로고침 테스트**
   - 레이아웃 선택
   - 페이지 새로고침
   - 초기 상태 확인

### 4.2 네트워크 검증

- DevTools Network 탭에서 API 응답 확인
- `equipment` 배열의 `equipment_id` 형식 확인
- `centroid_x`, `centroid_y` 값 확인

### 4.3 상태 검증

- React DevTools에서 `localPositions` 상태 확인
- `equipmentWithLocalPositions` 계산 결과 확인

### 4.4 Acceptance Criteria

- [ ] 모든 수동 테스트 시나리오 통과
- [ ] API 응답 형식 올바름
- [ ] 상태 변경 올바름

---

## Implementation Order

```
Section 1: Backend API 검증
    ↓
Section 2: Frontend 디버깅
    ↓
Section 3: 버그 수정 (원인에 따라)
    ↓
Section 4: 테스트 및 검증
```

---

## Risk Assessment

| 리스크 | 영향 | 대응 |
|-------|-----|-----|
| API 변경으로 다른 기능 영향 | 중간 | 기존 테스트 케이스 실행 |
| 상태 관리 복잡성 증가 | 낮음 | 디버그 코드는 개발 후 제거 |
| 비동기 레이스 컨디션 | 중간 | 로딩 상태 명시적 관리 |

---

## Success Metrics

1. **기능**: 레이아웃 선택 시 100% 위치 적용
2. **성능**: 레이아웃 로드 500ms 이내
3. **안정성**: 연속 10회 선택/저장 시 오류 없음
