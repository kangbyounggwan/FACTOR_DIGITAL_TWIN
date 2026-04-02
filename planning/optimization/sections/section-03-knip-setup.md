# Section 03: Knip 도입

## 개요

| 항목 | 내용 |
|------|------|
| **섹션 ID** | section-03-knip-setup |
| **목표** | 미사용 코드 자동 감지 도구 Knip 도입 |
| **예상 소요 시간** | 15-20분 |
| **난이도** | 낮음 |

---

## 1. Background (배경)

### 1.1 현재 문제점

현재 프로젝트에는 미사용 코드를 자동으로 감지하는 체계가 없어 다음과 같은 문제가 발생합니다:

- **레거시 코드 축적**: 더 이상 사용되지 않는 함수, 타입, 컴포넌트가 코드베이스에 남아있음
- **번들 크기 증가**: 미사용 코드가 최종 빌드에 포함될 가능성
- **코드 이해도 저하**: 실제로 사용되는 코드와 사용되지 않는 코드 구분이 어려움
- **의존성 관리 어려움**: 미사용 npm 패키지가 package.json에 남아있음

### 1.2 Knip이란?

Knip은 JavaScript/TypeScript 프로젝트에서 미사용 코드를 찾아주는 도구입니다:

- **미사용 파일 감지**: 프로젝트 어디에서도 import되지 않는 파일
- **미사용 export 감지**: export되었지만 사용되지 않는 함수, 타입, 변수
- **미사용 의존성 감지**: package.json에 있지만 코드에서 사용되지 않는 패키지
- **미사용 devDependencies 감지**: 개발 의존성 중 미사용 패키지

### 1.3 왜 Knip인가?

| 도구 | 특징 |
|------|------|
| ESLint (no-unused-vars) | 로컬 변수만 감지, export 미감지 |
| TypeScript (noUnusedLocals) | 로컬 변수만 감지, export 미감지 |
| **Knip** | export, 의존성, 파일 단위 전체 감지 |

---

## 2. Requirements (완료 조건)

이 섹션이 완료되면 다음 조건을 만족해야 합니다:

- [ ] knip 패키지가 devDependencies에 설치됨
- [ ] knip.json 설정 파일이 frontend 디렉토리에 존재함
- [ ] package.json에 lint:dead 스크립트가 추가됨
- [ ] `npm run lint:dead` 명령어가 오류 없이 실행됨
- [ ] 미사용 코드 목록이 출력됨 (있는 경우)

---

## 3. Dependencies (의존 관계)

### 3.1 Requires (선행 조건)

| 선행 섹션 | 이유 |
|-----------|------|
| 없음 | 독립적으로 수행 가능 |

### 3.2 Blocks (후속 작업)

| 후속 섹션 | 이유 |
|-----------|------|
| Section 04: Legacy Cleanup | Knip 결과를 기반으로 미사용 코드 정리 |

```
Section 01 ─┐
Section 02 ─┼─→ Section 03: Knip Setup ───→ Section 04: Legacy Cleanup
            │
(독립적)    │
```

---

## 4. Implementation Details (구현 상세)

### 4.1 Step 1: Knip 설치

frontend 디렉토리에서 Knip을 devDependency로 설치합니다.

```bash
cd frontend
npm install --save-dev knip
```

**설치 확인:**
```bash
npx knip --version
```

### 4.2 Step 2: knip.json 설정 파일 생성

`frontend/knip.json` 파일을 생성합니다:

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/main.tsx"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": [
    "**/*.d.ts",
    "src/vite-env.d.ts"
  ],
  "ignoreDependencies": [
    "@types/*"
  ]
}
```

**설정 상세 설명:**

| 설정 | 값 | 설명 |
|------|-----|------|
| `$schema` | unpkg.com/knip@5/schema.json | IDE 자동완성 지원 |
| `entry` | `["src/main.tsx"]` | 애플리케이션 진입점 파일 |
| `project` | `["src/**/*.{ts,tsx}"]` | 분석 대상 파일 패턴 |
| `ignore` | `["**/*.d.ts", ...]` | 분석에서 제외할 파일 |
| `ignoreDependencies` | `["@types/*"]` | 무시할 의존성 패턴 (타입 패키지) |

### 4.3 Step 3: package.json scripts 추가

`frontend/package.json`의 scripts 섹션에 다음 스크립트를 추가합니다:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "lint:dead": "knip",
    "lint:dead:fix": "knip --fix",
    "preview": "vite preview"
  }
}
```

**스크립트 설명:**

| 스크립트 | 명령어 | 설명 |
|----------|--------|------|
| `lint:dead` | `knip` | 미사용 코드 검사 (보고만) |
| `lint:dead:fix` | `knip --fix` | 자동 수정 가능한 항목 수정 |

### 4.4 Step 4: 초기 검사 실행

설치 및 설정이 완료되면 검사를 실행합니다:

```bash
cd frontend
npm run lint:dead
```

**예상 출력 형식:**

```
Unused files (2)
src/components/OldComponent.tsx
src/utils/deprecated.ts

Unused exports (3)
EquipmentFull  src/lib/api.ts:515:1
oldFunction    src/utils/helpers.ts:42:1

Unused dependencies (1)
some-unused-package

Unused devDependencies (0)
```

### 4.5 Step 5: 결과 분석 및 대응

Knip 실행 결과에 따라 다음과 같이 대응합니다:

#### 4.5.1 미사용 export 발견 시

```bash
# 상세 정보 확인
npx knip --reporter compact
```

발견된 미사용 export 목록을 Section 04에서 정리합니다.

#### 4.5.2 False Positive 발생 시

특정 항목이 실제로는 사용되지만 Knip이 감지하지 못하는 경우:

**방법 1: knip.json에 ignore 패턴 추가**
```json
{
  "ignore": [
    "**/*.d.ts",
    "src/vite-env.d.ts",
    "src/special-file.ts"
  ]
}
```

**방법 2: 특정 export 무시**
```json
{
  "ignoreExportsUsedInFile": true
}
```

**방법 3: 코드에 주석으로 무시**
```typescript
// knip-ignore
export function specialFunction() { ... }
```

---

## 5. Acceptance Criteria (검수 기준)

### 5.1 필수 체크리스트

- [ ] `frontend/node_modules/knip` 디렉토리 존재
- [ ] `frontend/knip.json` 파일 존재
- [ ] `frontend/package.json`에 `lint:dead` 스크립트 존재
- [ ] `npm run lint:dead` 실행 시 오류 없음
- [ ] 실행 결과가 콘솔에 출력됨 (미사용 항목이 없어도 정상)

### 5.2 검증 명령어

```bash
cd frontend

# 1. 패키지 설치 확인
npm list knip

# 2. 설정 파일 확인
cat knip.json

# 3. 스크립트 확인
npm run lint:dead --dry-run 2>/dev/null || echo "Script exists"

# 4. 실행 테스트
npm run lint:dead
```

### 5.3 성공 기준

| 항목 | 성공 조건 |
|------|-----------|
| 패키지 설치 | `npm list knip` 결과에 버전 표시 |
| 설정 파일 | knip.json이 유효한 JSON이고 entry 포함 |
| 스크립트 | `npm run lint:dead` 실행 가능 |
| 출력 | 미사용 코드 목록 또는 "No issues found" 메시지 |

---

## 6. Files to Create/Modify (파일 목록)

### 6.1 생성 파일

| 파일 경로 | 설명 |
|-----------|------|
| `frontend/knip.json` | Knip 설정 파일 |

### 6.2 수정 파일

| 파일 경로 | 수정 내용 |
|-----------|-----------|
| `frontend/package.json` | scripts에 lint:dead, lint:dead:fix 추가 |

### 6.3 파일 전체 내용

#### frontend/knip.json (신규 생성)

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  "entry": ["src/main.tsx"],
  "project": ["src/**/*.{ts,tsx}"],
  "ignore": [
    "**/*.d.ts",
    "src/vite-env.d.ts"
  ],
  "ignoreDependencies": [
    "@types/*"
  ]
}
```

#### frontend/package.json (수정 - scripts 섹션만)

기존 scripts에 다음 2줄 추가:

```json
"lint:dead": "knip",
"lint:dead:fix": "knip --fix"
```

---

## 7. Troubleshooting (문제 해결)

### 7.1 일반적인 오류

#### 오류: "Cannot find module 'knip'"

```bash
# 해결: 패키지 재설치
cd frontend
npm install --save-dev knip
```

#### 오류: "Entry file not found"

```bash
# 해결: knip.json의 entry 경로 확인
# src/main.tsx가 실제로 존재하는지 확인
ls src/main.tsx
```

#### 오류: "Parse error in knip.json"

```bash
# 해결: JSON 유효성 검사
npx jsonlint knip.json
```

### 7.2 False Positive 처리

특정 파일이나 export가 실제로는 사용되지만 Knip이 감지하지 못하는 경우:

```json
// knip.json에 추가
{
  "ignore": [
    "src/dynamically-imported/**/*"
  ],
  "ignoreDependencies": [
    "postcss",
    "autoprefixer"
  ]
}
```

---

## 8. 다음 단계

이 섹션 완료 후:

1. Knip 실행 결과를 기록
2. 발견된 미사용 코드 목록을 Section 04에 전달
3. Section 04: Legacy Cleanup 진행

**예상 발견 항목:**
- `EquipmentFull` 타입 (api.ts) - 삭제 대상
- `useEquipment` 훅의 MOCK 데이터 - 검토 필요
