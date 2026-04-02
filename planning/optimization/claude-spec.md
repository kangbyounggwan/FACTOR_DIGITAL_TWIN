# Frontend Code Optimization - Synthesized Specification

## 1. Overview

### 1.1 Project Context
Factory Digital Twin 프론트엔드 애플리케이션의 코드 품질 향상 및 유지보수성 개선을 위한 최적화 작업.

### 1.2 Background
최근 React Query 마이그레이션 완료 후, 전체 코드베이스 분석을 통해 다음 문제점들이 발견됨:
- 3개 파일에 걸친 색상 정의 중복
- useCrud.ts의 반복적인 에러 핸들링 패턴 (555줄)
- 레거시 useState/useEffect 훅 잔존
- 미사용 코드 관리 체계 부재

### 1.3 Goals
1. 색상 정의 중앙화로 유지보수성 향상
2. useCrud.ts 코드량 50% 감소 (555줄 → ~250줄)
3. Knip 도구 도입으로 미사용 코드 자동 감지 체계 구축
4. 레거시 코드 정리

---

## 2. Scope

### 2.1 In Scope

#### 색상 정의 중앙화
- `lib/colors.ts` 신규 생성
- Tailwind 클래스 기반 색상 정의 유지
- Three.js/SVG용 HEX 매핑 테이블 추가
- 기존 3개 파일의 색상 정의를 중앙 파일로 이전

#### useCrud.ts 리팩토링
- 제너릭 `withErrorHandling` 헬퍼 함수 생성
- 공통 CRUD 패턴 추출
- 기존 mutation 훅들 리팩토링

#### Knip 도입
- knip 패키지 설치
- knip.json 설정 파일 생성
- package.json scripts 추가
- 초기 미사용 코드 검사 및 정리

#### 레거시 코드 정리
- 미사용 `useEquipment` 훅 검토 (MOCK 데이터 포함)
- 미사용 타입 정의 제거 (`EquipmentFull` 등)

### 2.2 Out of Scope
- 번들 최적화 (manualChunks, visualizer)
- React Query useMutation으로의 전환
- 페이지 컴포넌트 분리 (LayoutEditorPage, AdminPage)
- 백엔드 코드 수정

---

## 3. Technical Decisions

### 3.1 색상 포맷 전략

**결정:** Tailwind 클래스 기반 유지 + HEX 매핑

**구조:**
```typescript
// lib/colors.ts
export const EQUIPMENT_COLORS = {
  SMT_LINE: {
    tailwind: 'bg-emerald-600',
    hex: '#059669',
    threeHex: 0x059669,
  },
  // ...
}

// 유틸 함수
export const getEquipmentColor = (type: string, format: 'tailwind' | 'hex' | 'three') => ...
```

**적용 파일:**
- EquipmentList.tsx: `getEquipmentColor(type, 'tailwind')`
- LayoutCanvas.tsx: `getEquipmentColor(type, 'hex')`
- Scene3D.tsx: `getEquipmentColor(type, 'three')`

### 3.2 useCrud.ts 리팩토링 전략

**결정:** 제너릭 hook 패턴

**구조:**
```typescript
// hooks/useCrudMutation.ts
export function useCrudMutation<T, C, U>(config: CrudConfig<T, C, U>) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const withErrorHandling = <F extends (...args: any[]) => Promise<any>>(fn: F) => ...

  return {
    saving,
    error,
    create: withErrorHandling(config.create),
    update: withErrorHandling(config.update),
    remove: withErrorHandling(config.remove),
  }
}
```

### 3.3 Knip 설정

**설정 파일:**
```json
// knip.json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/main.tsx"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": ["**/*.test.ts", "**/*.d.ts"]
}
```

**Scripts:**
```json
// package.json
{
  "scripts": {
    "lint:dead": "knip",
    "lint:dead:fix": "knip --fix"
  }
}
```

---

## 4. Files to Modify

### 4.1 New Files
- `src/lib/colors.ts` - 색상 정의 중앙화
- `src/hooks/useCrudMutation.ts` - 제너릭 CRUD 훅
- `knip.json` - Knip 설정

### 4.2 Modified Files
- `src/components/EquipmentList.tsx` - 색상 import 변경
- `src/components/LayoutCanvas.tsx` - 색상 import 변경
- `src/components/Scene3D.tsx` - 색상 import 변경
- `src/hooks/useCrud.ts` - 제너릭 훅 사용으로 리팩토링
- `package.json` - knip 의존성 및 스크립트 추가

### 4.3 Files to Review/Delete
- `src/hooks/useEquipment.ts` - MOCK 데이터 및 레거시 훅 검토
- `src/lib/api.ts` - 미사용 타입 제거

---

## 5. Success Criteria

### 5.1 색상 중앙화
- [ ] 모든 색상 정의가 `lib/colors.ts`에 위치
- [ ] 기존 3개 파일의 로컬 색상 정의 제거됨
- [ ] 앱 동작에 시각적 변화 없음

### 5.2 useCrud.ts 리팩토링
- [ ] 코드 라인 수 50% 감소 (555줄 → ~280줄 이하)
- [ ] 모든 CRUD 기능 정상 동작
- [ ] 타입 안전성 유지

### 5.3 Knip 도입
- [ ] `npm run lint:dead` 명령어 동작
- [ ] 미사용 export/import 0개 (또는 의도적 제외 목록화)

### 5.4 전체
- [ ] `npm run build` 성공
- [ ] 기존 기능 모두 정상 동작
- [ ] 번들 크기 증가 없음

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| 색상 변환 시 미세한 차이 | Low | 기존 HEX 값 정확히 보존 |
| CRUD 리팩토링 중 버그 | Medium | 각 mutation 함수별 테스트 |
| Knip false positive | Low | ignore 패턴 적절히 설정 |
