"""Pruebas del endpoint de carga de actas: permisos, validaciones y respuesta."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi.testclient import TestClient  # noqa: E402

import api  # noqa: E402
import documentos_prueba as dp  # noqa: E402
from test_instagram import BaseFalsa  # noqa: E402

PERFILES = {
    "tok-editor": {"id": "e", "nombre": "Editor", "rol": "Editor", "activo": True},
    "tok-lector": {"id": "l", "nombre": "Lector", "rol": "Lector", "activo": True},
}
DOCX = ("application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@pytest.fixture
def cliente(monkeypatch):
    db = BaseFalsa()
    monkeypatch.setattr(api, "supabase", db)

    def perfil(authorization=None):
        t = (authorization or "").replace("Bearer ", "")
        if t not in PERFILES:
            raise api.HTTPException(status_code=401, detail="Sesión no válida o expirada.")
        return PERFILES[t]

    api.app.dependency_overrides[api.usuario_actual] = lambda authorization=api.Header(None): perfil(authorization)
    yield TestClient(api.app), db
    api.app.dependency_overrides.clear()


def subir(c, contenido, nombre="acta.docx", token="tok-editor", **datos):
    return c.post("/api/upload-acta", headers={"Authorization": f"Bearer {token}"},
                  files={"file": (nombre, contenido, DOCX)}, data=datos)


def test_lector_no_puede_subir_actas(cliente):
    c, _ = cliente
    assert subir(c, dp.acta_evento(), token="tok-lector").status_code == 403
    assert c.post("/api/upload-acta", files={"file": ("a.docx", dp.acta_evento(), DOCX)}).status_code == 401


def test_formato_no_admitido(cliente):
    c, _ = cliente
    r = subir(c, b"texto", nombre="acta.txt")
    assert r.status_code == 400 and ".docx o .pdf" in r.json()["detail"]


def test_archivo_muy_grande(cliente):
    c, _ = cliente
    r = subir(c, b"0" * (api.TAMANO_MAXIMO_ACTA + 10))
    assert r.status_code == 413


def test_documento_que_no_es_un_acta_devuelve_el_motivo(cliente):
    c, db = cliente
    r = subir(c, dp.docx_bytes(["Lista de compras", "Pan", "Leche", "Huevos", "Arroz", "Fideos"]))
    assert r.status_code == 400 and "No se reconoce el tipo de acta" in r.json()["detail"]
    assert db.tablas.get("proyectos", []) == []


def test_carga_exitosa_de_un_evento(cliente):
    c, db = cliente
    r = subir(c, dp.acta_evento(), estado_actual="Aprobación Directiva")
    assert r.status_code == 200
    d = r.json()["data"]
    assert d["accion"] == "creado" and d["id"].startswith("PRJ-")
    assert (d["area"], d["responsable"], d["riesgos"], d["campos_faltantes"]) == ("Eventos", "Ana Prueba Uno", 2, [])
    assert db.tablas["proyectos"][0]["estado_actual"] == "Aprobación Directiva"


def test_cargar_dos_veces_el_mismo_archivo_no_duplica(cliente):
    c, db = cliente
    contenido = dp.acta_proyecto()
    assert subir(c, contenido).json()["data"]["accion"] == "creado"
    r = subir(c, contenido)
    assert r.status_code == 200 and r.json()["data"]["accion"] == "sin_cambios"
    assert len(db.tablas["proyectos"]) == 1 and len(db.tablas["compromisos"]) == 5


def test_nueva_version_del_mismo_evento_actualiza(cliente):
    c, db = cliente
    subir(c, dp.acta_evento())
    r = subir(c, dp.acta_evento(fecha="Sábado 24 de octubre de 2026 a las 2 pm"))
    assert r.json()["data"]["accion"] == "actualizado" and len(db.tablas["proyectos"]) == 1


def test_modo_estricto_rechaza_acta_sin_responsable(cliente):
    c, db = cliente
    r = subir(c, dp.acta_evento(responsables=False), modo_estricto="true")
    assert r.status_code == 400 and "Responsable" in r.json()["detail"]
    assert db.tablas.get("proyectos", []) == []


def test_sin_modo_estricto_se_registra_con_responsable_por_asignar(cliente):
    c, db = cliente
    r = subir(c, dp.acta_evento(responsables=False), modo_estricto="false")
    assert r.status_code == 200 and r.json()["data"]["campos_faltantes"] == ["Responsable"]
    assert db.tablas["proyectos"][0]["responsable"] == "Por asignar"


def test_etapa_invalida_usa_planificacion_base(cliente):
    c, db = cliente
    subir(c, dp.acta_evento(), estado_actual="Inventada")
    assert db.tablas["proyectos"][0]["estado_actual"] == "Planificación Base"


def test_error_de_base_de_datos_devuelve_500_con_mensaje(cliente, monkeypatch):
    c, db = cliente

    def falla(*a, **k):
        raise RuntimeError("base caída")
    monkeypatch.setattr(db, "table", falla)
    r = subir(c, dp.acta_evento())
    assert r.status_code == 500 and "Error al registrar el acta" in r.json()["detail"]
