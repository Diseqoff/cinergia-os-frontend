"""Pruebas de los endpoints de Instagram con permisos, sin red."""

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest

os.environ.setdefault("SUPABASE_URL", "https://proyecto.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.firma")
os.environ["CRON_SECRET"] = "secreto-cron-de-prueba"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient  # noqa: E402

import api  # noqa: E402
import instagram as ig  # noqa: E402
from test_instagram import TOKEN, ApiFalsa, BaseFalsa, media  # noqa: E402

PERFILES = {
    "tok-admin": {"id": "a", "nombre": "Admin", "rol": "SuperAdmin", "activo": True},
    "tok-editor": {"id": "e", "nombre": "Editor", "rol": "Editor", "activo": True},
    "tok-lector": {"id": "l", "nombre": "Lector", "rol": "Lector", "activo": True},
}


@pytest.fixture
def cliente(monkeypatch):
    db = BaseFalsa()
    falsa = ApiFalsa()
    falsa.medias = [media(1)]
    falsa.insights_media = {"1": {"reach": 10}}
    monkeypatch.setattr(api, "supabase", db)

    def perfil(authorization=None):
        t = (authorization or "").replace("Bearer ", "")
        if t not in PERFILES:
            raise api.HTTPException(status_code=401, detail="Sesión no válida o expirada.")
        return PERFILES[t]

    # Se reemplaza solo la verificación de sesión; los roles se evalúan con el código real
    api.app.dependency_overrides[api.usuario_actual] = lambda authorization=api.Header(None): perfil(authorization)

    original = ig.ClienteInstagram.__init__

    def con_transporte(self, token, ig_user_id=None, transport=None):
        original(self, token, ig_user_id, transport or httpx.MockTransport(falsa))

    monkeypatch.setattr(ig.ClienteInstagram, "__init__", con_transporte)
    c = TestClient(api.app)
    c.db, c.falsa = db, falsa
    yield c
    api.app.dependency_overrides.clear()


def h(t):
    return {"Authorization": f"Bearer {t}"}


def test_token_solo_superadmin(cliente):
    assert cliente.post("/api/instagram/token", json={"access_token": TOKEN}).status_code == 401
    assert cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-editor")).status_code == 403
    assert cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-lector")).status_code == 403
    r = cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    assert r.status_code == 200 and r.json()["data"]["usuario"] == "cinergia"
    assert TOKEN not in r.text


def test_token_con_formato_malo_devuelve_400(cliente):
    r = cliente.post("/api/instagram/token", json={"access_token": "corto"}, headers=h("tok-admin"))
    assert r.status_code == 400


def test_sincronizar_permisos_y_resultado_en_segundo_plano(cliente):
    cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    assert cliente.post("/api/instagram/sincronizar", headers=h("tok-lector")).status_code == 403
    r = cliente.post("/api/instagram/sincronizar", headers=h("tok-editor"))
    assert r.status_code == 202, r.text
    assert r.json()["status"] == "started"
    # la tarea de fondo ya corrió: el resultado queda en la base
    assert len(cliente.db.tablas["publicaciones"]) == 1
    estado = cliente.db.tablas["instagram_conexion"][0]
    assert estado["ultima_sincronizacion"] and not estado.get("ultimo_error")


def test_sincronizar_limite_de_frecuencia_por_ultimo_intento(cliente):
    cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    assert cliente.post("/api/instagram/sincronizar", headers=h("tok-editor")).status_code == 202
    r = cliente.post("/api/instagram/sincronizar", headers=h("tok-editor"))
    assert r.status_code == 429 and "5 minutos" in r.json()["detail"]
    # pasados 5 minutos vuelve a permitirse
    cliente.db.tablas["instagram_conexion"][0]["ultimo_intento"] = (
        datetime.now(timezone.utc) - timedelta(minutes=6)
    ).isoformat()
    assert cliente.post("/api/instagram/sincronizar", headers=h("tok-editor")).status_code == 202


def test_sincronizar_sin_conexion_devuelve_409(cliente):
    r = cliente.post("/api/instagram/sincronizar", headers=h("tok-editor"))
    assert r.status_code == 409 and "no está conectado" in r.json()["detail"]


def test_sincronizar_con_actualizacion_en_curso_devuelve_409(cliente):
    cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    assert api._candado_instagram.acquire(blocking=False)
    try:
        r = cliente.post("/api/instagram/sincronizar", headers=h("tok-editor"))
        assert r.status_code == 409 and "en curso" in r.json()["detail"]
    finally:
        api._candado_instagram.release()


def test_sincronizar_error_de_instagram_queda_en_el_estado(cliente):
    cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    cliente.falsa.error_global = {"message": "Invalid OAuth access token", "code": 190}
    r = cliente.post("/api/instagram/sincronizar", headers=h("tok-editor"))
    assert r.status_code == 202
    estado = cliente.db.tablas["instagram_conexion"][0]
    assert estado["ultimo_error"]
    assert TOKEN not in str(estado)


def test_cron_requiere_clave(cliente):
    cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    assert cliente.post("/api/instagram/cron").status_code == 401
    assert cliente.post("/api/instagram/cron", headers={"X-Cron-Secret": "otra"}).status_code == 401
    r = cliente.post("/api/instagram/cron", headers={"X-Cron-Secret": "secreto-cron-de-prueba"})
    assert r.status_code == 200 and r.json()["data"]["publicaciones"] == 1


def test_cron_con_encabezado_no_ascii_devuelve_401(cliente):
    cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    r = cliente.post("/api/instagram/cron", headers={"X-Cron-Secret": "clave-ñ".encode("utf-8")})
    assert r.status_code == 401


def test_cron_deshabilitado_sin_clave_configurada(cliente, monkeypatch):
    monkeypatch.setattr(api, "CRON_SECRET", "")
    assert cliente.post("/api/instagram/cron", headers={"X-Cron-Secret": ""}).status_code == 503


def test_cron_deshabilitado_con_clave_corta(cliente, monkeypatch):
    monkeypatch.setattr(api, "CRON_SECRET", "corta")
    assert cliente.post("/api/instagram/cron", headers={"X-Cron-Secret": "corta"}).status_code == 503


def test_cron_con_error_de_instagram_devuelve_502(cliente):
    cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    cliente.falsa.error_global = {"message": "Invalid OAuth access token", "code": 190}
    r = cliente.post("/api/instagram/cron", headers={"X-Cron-Secret": "secreto-cron-de-prueba"})
    assert r.status_code == 502


def test_desconectar_solo_superadmin(cliente):
    cliente.post("/api/instagram/token", json={"access_token": TOKEN}, headers=h("tok-admin"))
    assert cliente.delete("/api/instagram/token", headers=h("tok-editor")).status_code == 403
    assert cliente.delete("/api/instagram/token", headers=h("tok-admin")).status_code == 200
    assert cliente.db.tablas["instagram_credenciales"] == []
