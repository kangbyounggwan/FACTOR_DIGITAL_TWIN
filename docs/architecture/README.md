# Factory Digital Twin - C4 Architecture Documentation

> C4 모델 기반 아키텍처 문서 (Mermaid 다이어그램)

## 다이어그램 목록

| Level | 파일 | 설명 | 대상 |
|-------|------|------|------|
| **L1 Context** | [c4-context.md](c4-context.md) | 시스템 컨텍스트 - 사용자, 외부 시스템 관계 | 전체 |
| **L2 Container** | [c4-containers.md](c4-containers.md) | 컨테이너 - Frontend, Backend, Supabase 배포 단위 | 기술팀 |
| **L3 Component** | [c4-components-backend.md](c4-components-backend.md) | Backend API 내부 컴포넌트 (라우터, 서비스) | 개발자 |
| **L3 Component** | [c4-components-frontend.md](c4-components-frontend.md) | Frontend SPA 내부 컴포넌트 (페이지, 훅, UI) | 개발자 |
| **Dynamic** | [c4-dynamic-pipeline.md](c4-dynamic-pipeline.md) | LiDAR 스캔 → 설비 등록 데이터 흐름 | 기술팀 |
| **Dynamic** | [c4-dynamic-layout-editing.md](c4-dynamic-layout-editing.md) | 2D 레이아웃 편집 → 저장 데이터 흐름 | 기술팀 |

## 기술 스택 요약

```
Frontend:  React 18 + TypeScript + Vite + TanStack Query
3D:        React Three Fiber + Three.js
2D:        SVG (custom LayoutCanvas)
UI:        Radix UI + Tailwind CSS
Backend:   FastAPI (Python 3.11) + uvicorn
Pipeline:  Open3D + NumPy + pye57 + laspy
Database:  Supabase (PostgreSQL + PostgREST + Storage)
```

## 시스템 버전

- **API**: v0.2.3
- **문서 생성일**: 2026-04-04
