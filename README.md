# FACTOR Digital Twin

LiDAR 스캔 → 전처리 → DB 적재 → 3D 설비 등록 웹앱

## 프로젝트 구조

```
factor-digital-twin/
├── .vscode/               ← VS Code 설정 (settings, launch, tasks, extensions)
├── backend/
│   ├── app/
│   │   ├── main.py        ← FastAPI 진입점
│   │   ├── api/           ← equipment / pipeline / sites 라우터
│   │   ├── core/          ← config, supabase 클라이언트
│   │   ├── schemas/       ← Pydantic 스키마
│   │   └── services/      ← LiDAR 전처리 파이프라인
│   │       ├── pipeline.py
│   │       ├── loaders.py
│   │       ├── filters.py
│   │       ├── normalize.py
│   │       ├── segment.py
│   │       ├── tagger.py
│   │       ├── exporter.py
│   │       └── upload_to_supabase.py
│   ├── tests/
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── RegistryPage.tsx   ← 3D 설비 등록 메인
│   │   │   └── PipelinePage.tsx   ← 파이프라인 실행
│   │   ├── components/
│   │   │   ├── Scene3D.tsx        ← React Three Fiber 3D 뷰어
│   │   │   ├── EquipmentList.tsx  ← 왼쪽 설비 목록
│   │   │   └── RegPanel.tsx       ← 오른쪽 등록 패널
│   │   ├── hooks/
│   │   │   └── useEquipment.ts    ← 데이터 훅 (mock/real 전환)
│   │   └── lib/
│   │       └── api.ts             ← API 클라이언트
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
└── infra/
    └── schema.sql         ← Supabase 테이블 DDL
```

## 빠른 시작

### 1. 백엔드

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # SUPABASE_URL, SUPABASE_SERVICE_KEY 입력
uvicorn app.main:app --reload    # http://localhost:8000/docs
```

### 2. 프론트엔드

```bash
cd frontend
npm install
cp .env.example .env             # VITE_USE_MOCK=true 로 시작
npm run dev                      # http://localhost:5173
```

### 3. Supabase DB 초기화

```bash
# Supabase 대시보드 → SQL Editor에서 실행
psql $SUPABASE_URL -f infra/schema.sql
```

### 4. LiDAR 파이프라인 (CLI)

```bash
cd backend
python app/services/pipeline.py scan.e57 ./data/output --site-id JM_PCB_001
python app/services/upload_to_supabase.py ./data/output JM_PCB_001
```

## VS Code 단축키

| 작업 | 방법 |
|------|------|
| 백엔드 서버 시작 | `Ctrl+Shift+B` |
| 프론트엔드 서버 | Tasks → `frontend: 개발 서버` |
| 파이프라인 디버그 | F5 → `Pipeline: LiDAR 전처리` |
| 테스트 실행 | Tasks → `test: 백엔드 테스트` |

## 환경변수 실제 연동

프론트엔드 `.env`에서 `VITE_USE_MOCK=false` 로 변경하면  
`/api/*` 요청이 `localhost:8000` 백엔드를 통해 Supabase로 직접 연결됩니다.
