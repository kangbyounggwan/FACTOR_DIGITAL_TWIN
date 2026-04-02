# Interview Transcript

## Q1: 라우팅 방식
**질문**: 라우팅 방식을 어떻게 할까요?
**답변**: 기존 useState 유지
- React Router DOM 도입 없이 현재 방식 유지
- 최소 변경으로 구현

## Q2: UI 스타일
**질문**: 공장/라인 선택 UI 스타일은?
**답변**: 테이블 리스트
- 카드 그리드가 아닌 테이블 형태
- 공장/라인을 행으로 표시

## Q3: MES 연동
**질문**: Digital Twin ↔ MES 데이터 연동 범위는?
**답변**: equipment_scans만
- Digital Twin은 스캔 데이터만 관리
- MES equipments 테이블과 별도 운영
- 추후 equipment_id로 연결 가능

## Q4: 페이지 흐름
**질문**: 페이지 흐름을 어떻게 구성할까요?
**답변**: 공장+라인 통합 → 3D뷰어 (2단계)
- 1페이지: 공장 선택 + 라인 선택 통합
- 2페이지: 3D 뷰어 (기존 RegistryPage)

## Q5: 업로드 방식
**질문**: PLY 파일 업로드 방식은?
**답변**: 기존 PipelinePage 활용
- 별도 업로드 페이지 없이 PipelinePage 사용
- 공장/라인 선택 후 PipelinePage로 이동

## Q6: 권한
**질문**: 권한 기반 공장 필터링이 필요한가요?
**답변**: 아니오 - 모든 공장 표시
- 인증 없이 모든 공장 조회 가능
- 권한 기반 필터링은 추후 구현

---

## Summary of Decisions

| 항목 | 결정 |
|------|------|
| 라우팅 | useState 기반 (현행 유지) |
| UI | 테이블 리스트 |
| 페이지 수 | 2페이지 (선택 → 뷰어) |
| 업로드 | PipelinePage 재사용 |
| 인증 | 불필요 (전체 공개) |
| MES 연동 | equipment_scans만 |
