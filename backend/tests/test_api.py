"""
기본 API 테스트 — pytest + httpx
실행: pytest tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_equipment_list_requires_site(monkeypatch):
    """Supabase 없이도 404 아닌 응답 확인 (mock)"""
    class FakeResp:
        data = []
    class FakeTable:
        def select(self, *a): return self
        def eq(self, *a):     return self
        def order(self, *a):  return self
        def execute(self):    return FakeResp()
    class FakeDB:
        def table(self, *a):  return FakeTable()

    from app.core import supabase as sb
    monkeypatch.setattr(sb, "get_supabase", lambda: FakeDB())

    r = client.get("/api/equipment/JM_PCB_001")
    assert r.status_code == 200
    assert isinstance(r.json(), list)
