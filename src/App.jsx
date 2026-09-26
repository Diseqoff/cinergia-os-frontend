import React, { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  AREAS, ETAPAS, TIPOS_COMPROMISO, ETIQUETA_FECHA_SOLICITUD,
  calcularTablero, aFecha, formatoFechaCorta, estadoCompromiso, siguienteEtapa, diasEnEtapa,
} from "./kpis";
import {
  LayoutGrid, BarChart3, Megaphone, Search, Bell, LogOut,
  ChevronDown, FileText, ChevronLeft, ChevronRight, X,
  TrendingUp, TrendingDown, Minus, Users, Layers, Zap, CheckCircle2,
  ShieldCheck, RefreshCw, FolderPlus, Database, Settings2,
  Calendar as CalendarIcon, Star, Award, Building2, Timer, Filter,
  MapPin, DollarSign, ClipboardList, Activity, Plus, UploadCloud
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";

/* ------------------------------------------------------------------ */
/* Tokens & datos                                                     */
/* ------------------------------------------------------------------ */

// Motor de ingestión de actas y administración de cuentas (FastAPI).
// VITE_API_URL define el servidor; sin esa variable se usa el de producción.
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://cinergia-os-frontend.onrender.com";

const PANEL = "#121214";

const CHART = {
  blue: "#2563eb",
  blueSoft: "#60a5fa",
  emerald: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  muted: "#71717a",
  grid: "#27272a",
  text: "#a1a1aa",
};

const AREA_COLOR = {
  Eventos: CHART.blue,
  Marketing: CHART.amber,
  Proyectos: CHART.emerald,
  "Gestión de Oportunidades": CHART.red,
  Reportes: CHART.muted
};

const AREAS_DISPONIBLES = ["Todas", ...AREAS];

const ICONO_AUDITORIA = {
  proyecto: { Icon: FolderPlus, color: "text-blue-500", dot: "bg-blue-600" },
  etapa: { Icon: RefreshCw, color: "text-blue-500", dot: "bg-blue-600" },
  compromiso: { Icon: CheckCircle2, color: "text-emerald-500", dot: "bg-emerald-500" },
  cierre: { Icon: ShieldCheck, color: "text-emerald-500", dot: "bg-emerald-500" },
  marketing: { Icon: Megaphone, color: "text-amber-500", dot: "bg-amber-500" },
};

const ICONO_IMPACTO = { personas: Users, convenios: Building2, voluntariado: Timer, social: Award };
const ICONO_TRANSVERSAL = { tr_externos: ClipboardList, tr_satisfaccion: Star, tr_puntualidad: Timer, tr_planes: ShieldCheck };

async function llamarApi(ruta, { method = "GET", body, formData } = {}) {
  const { data } = await supabase.auth.getSession();
  const headers = { Authorization: `Bearer ${data.session?.access_token || ""}` };
  if (body) headers["Content-Type"] = "application/json";
  let resp;
  try {
    resp = await fetch(`${API_BASE_URL}${ruta}`, {
      method,
      headers,
      body: formData || (body ? JSON.stringify(body) : undefined),
    });
  } catch {
    throw new Error("No hay conexión con el servidor de CINERGIA OS.");
  }
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(json.detail || "El servidor rechazó la solicitud.");
  return json;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function areaClasses(area) {
  if (area === "Eventos") return { text: "text-blue-500", dot: "bg-blue-600" };
  if (area === "Marketing") return { text: "text-amber-500", dot: "bg-amber-500" };
  if (area === "Gestión de Oportunidades") return { text: "text-red-500", dot: "bg-red-600" };
  if (area === "Reportes") return { text: "text-zinc-400", dot: "bg-zinc-500" };
  return { text: "text-emerald-500", dot: "bg-emerald-500" };
}

function statusClasses(estado) {
  if (estado === "En Ejecución" || estado === "Ejecución Activa" || estado === "Revisión / QA") return { text: "text-blue-400", dot: "bg-blue-500", bg: "rgba(37,99,235,0.14)" };
  if (estado === "Finalizado" || estado === "Cierre Operativo") return { text: "text-emerald-400", dot: "bg-emerald-500", bg: "rgba(16,185,129,0.14)" };
  if (estado === "Sin datos") return { text: "text-zinc-400", dot: "bg-zinc-500", bg: "rgba(113,113,122,0.14)" };
  if (estado === "Crítico") return { text: "text-red-400", dot: "bg-red-500", bg: "rgba(239,68,68,0.14)" };
  if (estado === "Atención") return { text: "text-amber-400", dot: "bg-amber-500", bg: "rgba(245,158,11,0.14)" };
  if (estado === "Óptimo") return { text: "text-emerald-400", dot: "bg-emerald-500", bg: "rgba(16,185,129,0.14)" };
  return { text: "text-amber-400", dot: "bg-amber-500", bg: "rgba(245,158,11,0.14)" };
}

/* ------------------------------------------------------------------ */
/* Subcomponentes de UI                                               */
/* ------------------------------------------------------------------ */

function StatusBadge({ estado }) {
  const s = statusClasses(estado);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${s.text}`}
      style={{ backgroundColor: s.bg }}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {estado}
    </span>
  );
}

function ChartTooltip({ active, payload, label, unit = "" }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      className="rounded-lg border border-zinc-800 px-3 py-2 text-xs shadow-xl"
      style={{ backgroundColor: PANEL }}
    >
      {label && <p className="mb-1 font-mono text-zinc-500">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="font-mono font-medium text-zinc-200">
          {p.name ? `${p.name}: ` : ""}
          {typeof p.value === "number" ? p.value.toLocaleString("es-PE") : p.value}
          {unit}
        </p>
      ))}
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="mb-8">
      <p className="mb-2 font-mono text-xs font-medium uppercase tracking-widest text-blue-500">
        {eyebrow}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">{title}</h1>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-zinc-500">{subtitle}</p>
    </div>
  );
}

function ProjectCard({ p, onVerActa }) {
  const a = areaClasses(p.area);
  return (
    <div
      className="group flex flex-col gap-3 rounded-xl border border-zinc-800 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700"
      style={{ backgroundColor: PANEL }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-zinc-500">{p.id}</p>
          <h3 className="mt-1 truncate text-base font-semibold text-zinc-100">{p.nombre}</h3>
        </div>
        <StatusBadge estado={p.estado} />
      </div>

      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <span className={`h-1.5 w-1.5 rounded-full ${a.dot}`} />
        <span className={a.text}>{p.area}</span>
        <span className="text-zinc-700">•</span>
        <CalendarIcon className="h-3.5 w-3.5" />
        <span className="font-mono">{p.fecha}</span>
      </div>

      <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
        <div className="text-xs text-zinc-500">
          Responsable
          <span className="mt-0.5 block text-sm font-medium text-zinc-300">{p.responsable}</span>
        </div>
        <button
          onClick={() => onVerActa(p)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <FileText className="h-3.5 w-3.5" />
          Ver Acta
        </button>
      </div>
    </div>
  );
}

function KpiCard({ Icon, label, value, suffix, delta, trend }) {
  const trendColor = trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-zinc-500";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <div className="rounded-xl border border-zinc-800 p-4" style={{ backgroundColor: PANEL }}>
      <div className="flex items-start justify-between">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</p>
        <div className="rounded-lg border border-zinc-800 p-1.5" style={{ backgroundColor: "rgba(37,99,235,0.08)" }}>
          <Icon className="h-3.5 w-3.5 text-blue-500" />
        </div>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-semibold tabular-nums text-zinc-100">{value}</span>
        {suffix && <span className="font-mono text-sm text-zinc-500">{suffix}</span>}
      </div>
      <div className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${trendColor}`}>
        <TrendIcon className="h-3.5 w-3.5" />
        <span className="font-mono">{delta}</span>
        <span className="font-normal text-zinc-600">vs periodo anterior</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer / Slide-over "Ver Acta" (ACTUALIZADO A SSOT)                */
/* ------------------------------------------------------------------ */

const CAMPO_FORM = "w-full rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-600";
const ETIQUETA_FORM = "text-[10px] text-zinc-500 uppercase mb-1";

function ActaDrawer({ proyecto, onClose, compromisos, historial, cierre, puedeEditar, onCambio, onRegistrarCierre }) {
  const abierto = !!proyecto;
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [nuevo, setNuevo] = useState({ descripcion: "", tipo: "hito", fecha_limite: "", fecha_solicitud: "", responsable: "", externo: false, correcciones: 0 });

  const propios = useMemo(
    () => (proyecto ? compromisos.filter((c) => c.proyecto_id === proyecto.id) : [])
      .sort((a, b) => (aFecha(a.fecha_limite) || new Date(8.64e15)) - (aFecha(b.fecha_limite) || new Date(8.64e15))),
    [compromisos, proyecto]
  );

  const siguiente = proyecto ? siguienteEtapa(proyecto.estado_actual) : null;
  const diasEtapa = proyecto ? diasEnEtapa(historial, proyecto.id) : null;
  const entregados = propios.filter((c) => c.fecha_entrega).length;
  const vencidos = propios.filter((c) => !c.fecha_entrega && aFecha(c.fecha_limite) && aFecha(c.fecha_limite) < new Date()).length;
  const riesgos = proyecto
    ? (Array.isArray(proyecto.riesgos) && proyecto.riesgos.length
        ? proyecto.riesgos.map((r) => `${r.riesgo} → ${r.mitigacion}`)
        : Array.isArray(proyecto.compromisos) ? proyecto.compromisos : [])
    : [];
  const metas = proyecto && Array.isArray(proyecto.metas) ? proyecto.metas : [];

  const ejecutar = async (accion) => {
    setError("");
    setProcesando(true);
    try {
      await accion();
      await onCambio?.();
    } catch (e) {
      setError(e.message || "No se pudo completar la acción.");
    } finally {
      setProcesando(false);
    }
  };

  const avanzarEtapa = () => ejecutar(async () => {
    const { error: e } = await supabase.rpc("registrar_etapa", { p_proyecto: proyecto.id, p_etapa: siguiente });
    if (e) throw e;
  });

  const alternarEntrega = (c) => ejecutar(async () => {
    const entregado = !c.fecha_entrega;
    const { error: e } = await supabase
      .from("compromisos")
      .update({ fecha_entrega: entregado ? new Date().toISOString() : null, completado: entregado })
      .eq("id", c.id);
    if (e) throw e;
  });

  const guardarCompromiso = () => ejecutar(async () => {
    if (!nuevo.descripcion.trim()) throw new Error("La descripción del compromiso es obligatoria.");
    if (!nuevo.fecha_limite) throw new Error("La fecha límite es obligatoria para medir la puntualidad.");
    const fila = {
      proyecto_id: proyecto.id,
      descripcion: nuevo.descripcion.trim(),
      tipo: nuevo.tipo,
      area: proyecto.area,
      responsable: nuevo.responsable.trim() || proyecto.responsable,
      externo: nuevo.externo,
      fecha_limite: new Date(nuevo.fecha_limite).toISOString(),
      correcciones: nuevo.tipo === "insumo_reportes" ? Number(nuevo.correcciones) || 0 : 0,
      completado: false,
    };
    if (nuevo.fecha_solicitud) fila.fecha_solicitud = new Date(nuevo.fecha_solicitud).toISOString();
    const { error: e } = await supabase.from("compromisos").insert(fila);
    if (e) throw e;
    setNuevo({ descripcion: "", tipo: "hito", fecha_limite: "", fecha_solicitud: "", responsable: "", externo: false, correcciones: 0 });
    setAgregando(false);
  });

  const cerrar = () => {
    setError("");
    setAgregando(false);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex ${abierto ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!abierto}
    >
      <div
        onClick={cerrar}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`relative flex h-full w-full transition-transform duration-300 ease-out ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* PANEL IZQUIERDO: Ficha técnica */}
        {proyecto && (
          <div className="hidden lg:flex flex-1 flex-col justify-center p-8 pointer-events-none overflow-y-auto">
            <div className="max-w-4xl w-full mx-auto pointer-events-auto my-auto">
              
              <div className="rounded-xl border border-zinc-800 p-8 shadow-2xl bg-zinc-950/80 backdrop-blur-xl flex flex-col gap-6">
                
                <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                  <h2 className="text-2xl font-bold text-zinc-100 uppercase tracking-wide">Ficha Técnica Operativa</h2>
                  <p className="font-mono text-xs text-zinc-500">DOC-REF: {proyecto.id}</p>
                </div>

                <div>
                  <div className="bg-blue-900/20 border border-blue-500/30 px-3 py-1.5 mb-3 rounded">
                    <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">Información General</h3>
                  </div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-8 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Nombre del Proyecto</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">{proyecto.nombre}</div>
                    </div>
                    <div className="col-span-4 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Área Ejecutora</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200 flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${areaClasses(proyecto.area).dot}`} /> {proyecto.area}
                      </div>
                    </div>
                    <div className="col-span-12 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Descripción / Alcance</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-400 min-h-[60px] whitespace-pre-wrap">
                        {proyecto.resumen || "Sin descripción registrada en el acta."}
                      </div>
                    </div>
                    {proyecto.objetivo_general && (
                      <div className="col-span-12 flex flex-col">
                        <label className="text-[10px] text-zinc-500 uppercase mb-1">Objetivo General</label>
                        <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-400">{proyecto.objetivo_general}</div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div className="bg-emerald-900/20 border border-emerald-500/30 px-3 py-1.5 mb-3 rounded">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Planificación y Recursos</h3>
                  </div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Fecha de Ejecución</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">{formatoFechaCorta(proyecto.fecha_programada || proyecto.fecha)}</div>
                    </div>
                    <div className="col-span-4 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Sede / Locación</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">{proyecto.sede || "Por definir"}</div>
                    </div>
                    <div className="col-span-4 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Aforo / Capacidad</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">{proyecto.aforo_estimado ?? proyecto.staff_requerido ?? "N/A"}</div>
                    </div>
                    <div className="col-span-6 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Responsables Directos</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">{proyecto.responsable}</div>
                    </div>
                    <div className="col-span-6 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Link de Participantes · Excel</label>
                      {proyecto.enlace_excel && proyecto.enlace_excel.includes("http") ? (
                        <a href={proyecto.enlace_excel} target="_blank" rel="noreferrer" className="border border-zinc-800 bg-blue-900/10 px-3 py-2 rounded text-sm text-blue-400 hover:text-blue-300 underline cursor-pointer truncate transition-colors block">
                          Abrir Directorio Externo
                        </a>
                      ) : (
                        <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-500 truncate">
                          {proyecto.enlace_excel || "N/A"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-amber-900/20 border border-amber-500/30 px-3 py-1.5 mb-3 rounded">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Métricas de Éxito · KPIs Objetivo</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {metas.length > 0 ? metas.map((m, i) => (
                      <div key={i} className="flex items-center justify-between border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 rounded-lg text-sm text-zinc-300">
                        <span>{m.metrica}</span>
                        <span className="font-mono font-medium text-amber-400">{m.objetivo}</span>
                      </div>
                    )) : (
                      <div className="border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 rounded-lg text-sm text-zinc-500">
                        El acta no registra métricas de éxito.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded border border-blue-500 bg-blue-500/20">
                    <CheckCircle2 className="h-3 w-3 text-blue-400" />
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    Cinergia OS actúa como Fuente Única de Verdad. Estos datos fueron extraídos del acta original. El seguimiento de compromisos, etapas y cierre se registra en el panel lateral.
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* PANEL DERECHO: Seguimiento operativo */}
        <div
          className="flex h-full w-full max-w-sm flex-col border-l border-zinc-800 shadow-2xl shrink-0 ml-auto"
          style={{ backgroundColor: PANEL }}
          role="dialog"
          aria-modal="true"
        >
          {proyecto && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5 shrink-0">
                <div>
                  <p className="font-mono text-xs text-zinc-500">Documento Legal</p>
                  <h2 className="mt-1 text-lg font-semibold text-zinc-100 truncate w-48">{proyecto.nombre}</h2>
                </div>
                <button
                  onClick={cerrar}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-100 transition-colors focus-visible:outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="mb-6 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <StatusBadge estado={proyecto.estado_actual || "Planificación Base"} />
                    {diasEtapa != null && (
                      <span className="font-mono text-[11px] text-zinc-500">{diasEtapa} {diasEtapa === 1 ? "día" : "días"} en la etapa</span>
                    )}
                  </div>
                  {puedeEditar && siguiente && (
                    <button
                      onClick={avanzarEtapa}
                      disabled={procesando}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-blue-500 hover:text-blue-400 disabled:opacity-50"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                      Avanzar a {siguiente}
                    </button>
                  )}
                </div>

                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                    <ClipboardList className="h-4 w-4 text-blue-500" /> Resumen Operativo
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    {propios.length > 0 ? (
                      <>
                        <strong className="text-zinc-300">{entregados} de {propios.length}</strong> compromisos entregados
                        {vencidos > 0 && <> · <span className="text-red-400">{vencidos} vencido{vencidos === 1 ? "" : "s"}</span></>}.
                      </>
                    ) : (
                      "Sin compromisos registrados. Los KPIs de tiempo del área se calculan a partir de ellos."
                    )}
                  </p>
                </div>

                <div className="mb-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-zinc-200">Compromisos y Entregables</h3>
                    {puedeEditar && !agregando && (
                      <button onClick={() => setAgregando(true)} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                        <Plus className="h-3.5 w-3.5" /> Agregar
                      </button>
                    )}
                  </div>

                  {agregando && (
                    <div className="mb-3 flex flex-col gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                      <div className="flex flex-col">
                        <label className={ETIQUETA_FORM}>Descripción</label>
                        <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} className={CAMPO_FORM} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <label className={ETIQUETA_FORM}>Tipo</label>
                          <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} className={`${CAMPO_FORM} appearance-none`}>
                            {TIPOS_COMPROMISO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div className="flex flex-col">
                          <label className={ETIQUETA_FORM}>Fecha límite</label>
                          <input type="datetime-local" value={nuevo.fecha_limite} onChange={(e) => setNuevo({ ...nuevo, fecha_limite: e.target.value })} className={CAMPO_FORM} />
                        </div>
                      </div>
                      {ETIQUETA_FECHA_SOLICITUD[nuevo.tipo] && (
                        <div className="flex flex-col">
                          <label className={ETIQUETA_FORM}>{ETIQUETA_FECHA_SOLICITUD[nuevo.tipo]}</label>
                          <input type="datetime-local" value={nuevo.fecha_solicitud} onChange={(e) => setNuevo({ ...nuevo, fecha_solicitud: e.target.value })} className={CAMPO_FORM} />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col">
                          <label className={ETIQUETA_FORM}>Responsable</label>
                          <input value={nuevo.responsable} onChange={(e) => setNuevo({ ...nuevo, responsable: e.target.value })} placeholder={proyecto.responsable} className={CAMPO_FORM} />
                        </div>
                        {nuevo.tipo === "insumo_reportes" ? (
                          <div className="flex flex-col">
                            <label className={ETIQUETA_FORM}>Correcciones</label>
                            <input type="number" min="0" value={nuevo.correcciones} onChange={(e) => setNuevo({ ...nuevo, correcciones: e.target.value })} className={CAMPO_FORM} />
                          </div>
                        ) : (
                          <label className="flex items-end gap-2 pb-2 text-xs text-zinc-400 cursor-pointer">
                            <input type="checkbox" checked={nuevo.externo} onChange={(e) => setNuevo({ ...nuevo, externo: e.target.checked })} className="accent-blue-600" />
                            Entregable externo
                          </label>
                        )}
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <button onClick={() => setAgregando(false)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100">Cancelar</button>
                        <button onClick={guardarCompromiso} disabled={procesando} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60">Guardar</button>
                      </div>
                    </div>
                  )}

                  <ul className="flex flex-col gap-2.5">
                    {propios.length > 0 ? propios.map((c) => {
                      const est = estadoCompromiso(c);
                      const tipo = TIPOS_COMPROMISO.find((t) => t.value === c.tipo)?.label || "Hito";
                      return (
                        <li key={c.id} className="flex items-start gap-2.5 text-sm text-zinc-400">
                          <button
                            onClick={() => puedeEditar && alternarEntrega(c)}
                            disabled={!puedeEditar || procesando}
                            aria-label={c.fecha_entrega ? "Marcar como pendiente" : "Marcar como entregado"}
                            className="mt-0.5 shrink-0 disabled:cursor-default"
                          >
                            <CheckCircle2 className={`h-4 w-4 ${c.fecha_entrega ? "text-emerald-500" : "text-zinc-700 hover:text-zinc-500"}`} />
                          </button>
                          <div className="min-w-0">
                            <p className={c.fecha_entrega ? "text-zinc-300" : ""}>{c.descripcion}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
                              {tipo}{c.externo ? " · Externo" : ""} · Límite {c.fecha_limite ? formatoFechaCorta(c.fecha_limite) : "sin fecha"} · <span className={est.clase}>{est.etiqueta}</span>
                            </p>
                          </div>
                        </li>
                      );
                    }) : (
                      <li className="text-sm text-zinc-600 italic">Sin compromisos registrados.</li>
                    )}
                  </ul>
                </div>

                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-200">Riesgos y Mitigación</h3>
                  <ul className="flex flex-col gap-2.5">
                    {riesgos.length > 0 ? (
                      riesgos.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-400">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                          {item}
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-zinc-600 italic">No se registraron planes de mitigación en el acta.</li>
                    )}
                  </ul>
                </div>

                <div className="mb-2">
                  <h3 className="mb-3 text-sm font-semibold text-zinc-200">Resultados de Cierre</h3>
                  {cierre ? (
                    <div className="flex flex-col gap-2">
                      {[
                        ["Ejecución real", formatoFechaCorta(cierre.fecha_real_ejecucion)],
                        ["Asistentes reales", cierre.asistentes_reales ?? "Sin dato"],
                        ["Satisfacción de participantes", cierre.satisfaccion_participantes != null ? `${Number(cierre.satisfaccion_participantes).toFixed(1)}/5` : "Sin dato"],
                        ["Memoria técnica", cierre.fecha_entrega_memoria ? formatoFechaCorta(cierre.fecha_entrega_memoria) : "Pendiente"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-xs">
                          <span className="text-zinc-500">{k}</span>
                          <span className="font-mono text-zinc-200">{v}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-600 italic">Sin cierre registrado.</p>
                  )}
                  {puedeEditar && (
                    <button
                      onClick={() => onRegistrarCierre?.(proyecto)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500 hover:text-emerald-400"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {cierre ? "Editar cierre" : "Registrar cierre"}
                    </button>
                  )}
                </div>

                {error && (
                  <div className="mt-4 rounded-lg border border-red-900/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>
                )}

                <div className="mt-8 border-t border-zinc-800 pt-6">
                  {proyecto.archivo_url ? (
                    <a 
                      href={proyecto.archivo_url} 
                      download 
                      target="_blank" 
                      rel="noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 shadow-lg shadow-blue-500/20"
                    >
                      <FileText className="h-4 w-4" />
                      Descargar Acta Original · DOCX
                    </a>
                  ) : (
                    <button disabled className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-4 py-3 text-sm font-medium text-zinc-500 cursor-not-allowed">
                      <FileText className="h-4 w-4" />
                      Archivo no disponible
                    </button>
                  )}
                  {proyecto.archivo_hash && (
                    <p className="mt-2 text-center text-[10px] text-zinc-500 font-mono">SHA-256: {proyecto.archivo_hash.substring(0, 20)}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-zinc-800 px-6 py-4 shrink-0">
                <button
                  onClick={cerrar}
                  className="w-full rounded-lg border border-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:border-zinc-700 hover:text-zinc-100 transition-colors focus-visible:outline-none"
                >
                  Cerrar panel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* NUEVO: Modal Central de Creación e Importación de Proyecto         */
/* ------------------------------------------------------------------ */

function NuevoProyectoModal({ abierto, onClose, onCreado, modoEstricto }) {
  const [estadoProyecto, setEstadoProyecto] = useState(ETAPAS[0]);

  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [avisoSubida, setAvisoSubida] = useState("");

  const [nombreManual, setNombreManual] = useState("");
  const [areaManual, setAreaManual] = useState("");
  const [responsableManual, setResponsableManual] = useState("");
  const [fechaManual, setFechaManual] = useState("");
  const [aforoManual, setAforoManual] = useState("");
  const [enlaceExcelManual, setEnlaceExcelManual] = useState("");
  const [guardandoManual, setGuardandoManual] = useState(false);
  const [errorManual, setErrorManual] = useState("");

  const limpiarYCerrar = () => {
    setEstadoProyecto(ETAPAS[0]);
    setSubiendo(false);
    setErrorSubida("");
    setAvisoSubida("");
    setNombreManual("");
    setAreaManual("");
    setResponsableManual("");
    setFechaManual("");
    setAforoManual("");
    setEnlaceExcelManual("");
    setGuardandoManual(false);
    setErrorManual("");
    onClose();
  };

  const handleSubirActa = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("estado_actual", estadoProyecto);
    formData.append("modo_estricto", modoEstricto ? "true" : "false");
    if (enlaceExcelManual) formData.append("enlace_excel", enlaceExcelManual);

    setSubiendo(true);
    setErrorSubida("");
    setAvisoSubida("");

    try {
      const resultado = await llamarApi("/api/upload-acta", { method: "POST", formData });
      await onCreado?.();
      const faltantes = resultado.data?.campos_faltantes || [];
      if (faltantes.length) {
        setAvisoSubida(`Proyecto ${resultado.data.id} registrado. Completar en el acta: ${faltantes.join(", ")}.`);
      } else {
        limpiarYCerrar();
      }
    } catch (error) {
      setErrorSubida(error.message);
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  };

  const handleRegistroManual = async () => {
    setErrorManual("");

    if (!nombreManual.trim() || !areaManual || !responsableManual.trim() || !fechaManual) {
      setErrorManual("Nombre, área, responsable y fecha de ejecución son obligatorios.");
      return;
    }

    setGuardandoManual(true);
    try {
      const nuevoId = `PRJ-${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const aforo = parseInt(aforoManual, 10);
      const { error } = await supabase.from("proyectos").insert({
        id: nuevoId,
        nombre: nombreManual.trim(),
        area: areaManual,
        responsable: responsableManual.trim(),
        estado_actual: estadoProyecto,
        fecha_programada: fechaManual,
        fecha: formatoFechaCorta(fechaManual),
        aforo_estimado: Number.isNaN(aforo) ? null : aforo,
        staff_requerido: Number.isNaN(aforo) ? null : String(aforo),
        enlace_excel: enlaceExcelManual || null,
        compromisos: [],
      });
      if (error) throw error;

      const { error: errorEtapa } = await supabase.rpc("registrar_etapa", { p_proyecto: nuevoId, p_etapa: estadoProyecto });
      if (errorEtapa) throw errorEtapa;

      await onCreado?.();
      limpiarYCerrar();
    } catch (error) {
      setErrorManual("No se pudo registrar: " + error.message);
    } finally {
      setGuardandoManual(false);
    }
  };

  if (!abierto) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      aria-hidden={!abierto}
    >
      {/* Overlay oscuro con blur */}
      <div
        onClick={limpiarYCerrar}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
      />

      {/* Contenedor Principal Centrado */}
      <div 
        className="relative flex w-full max-w-4xl flex-col rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        style={{ backgroundColor: PANEL }}
        role="dialog" 
        aria-modal="true"
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-inner">
              <Plus className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">Gestor Operativo</p>
              <h2 className="text-xl font-bold text-zinc-100">Registrar Nuevo Proyecto</h2>
            </div>
          </div>
          <button
            onClick={limpiarYCerrar}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 transition-colors focus-visible:outline-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Cuerpo Dividido (Grid) */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* COLUMNA IZQUIERDA: Ingestión Automatizada */}
            <div className="flex flex-col gap-6">
              <div>
                <div className="bg-blue-900/20 border border-blue-500/30 px-3 py-1.5 mb-4 rounded inline-block">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-widest">1. Importación de Acta (Parser)</h3>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-zinc-400">
                  Sube el documento oficial en formato Word (.docx). El motor de Python extraerá automáticamente los datos clave para evitar la entrada manual.
                </p>
                
                <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-zinc-700 border-dashed rounded-xl transition-all bg-zinc-900/30 group ${subiendo ? "opacity-60 cursor-wait" : "cursor-pointer hover:bg-zinc-900/60 hover:border-blue-500"}`}>
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <div className="mb-4 rounded-full bg-zinc-800 p-4 group-hover:bg-blue-500/20 transition-colors">
                      <UploadCloud className="w-8 h-8 text-zinc-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    {subiendo ? (
                      <p className="mb-2 text-sm text-zinc-300">Procesando acta…</p>
                    ) : (
                      <>
                        <p className="mb-2 text-sm text-zinc-300"><span className="font-semibold text-white">Haz clic para subir</span> o arrastra el archivo</p>
                        <p className="text-xs text-zinc-500 font-mono">Solo archivos .docx soportados</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept=".docx"
                    disabled={subiendo}
                    onChange={handleSubirActa}
                  />
                </label>
              </div>

              {errorSubida && (
                <div className="rounded-lg border border-red-900/30 bg-red-500/10 p-3 text-xs text-red-400">
                  {errorSubida}
                </div>
              )}

              {avisoSubida && (
                <div className="rounded-lg border border-amber-900/30 bg-amber-500/10 p-3 text-xs text-amber-400">
                  {avisoSubida}
                </div>
              )}

              <div className="rounded-lg border border-amber-900/30 bg-amber-500/10 p-4">
                 <p className="text-xs text-amber-400/90 leading-relaxed">
                   <strong>Nota de Estandarización:</strong> El parser buscará la estructura oficial. Si el acta no contiene los campos obligatorios (Ej. Título, Área, Responsable), será rechazada por el Modo Estricto.
                 </p>
              </div>
            </div>

            {/* COLUMNA DERECHA: Datos Complementarios Manuales */}
            <div className="flex flex-col gap-6 border-t border-zinc-800 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              <div>
                <div className="bg-emerald-900/20 border border-emerald-500/30 px-3 py-1.5 mb-4 rounded inline-block">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">2. Datos Complementarios (No extraíbles)</h3>
                </div>
                <p className="mb-5 text-sm text-zinc-400">
                  Completa la información operativa que no está contenida en el documento estático.
                </p>

                <div className="flex flex-col gap-5">
                  
                  {/* Selector de Estado */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Fase Operativa · Etapa</label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {ETAPAS.map((estado) => (
                        <button
                          key={estado}
                          onClick={() => setEstadoProyecto(estado)}
                          className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all focus-visible:outline-none ${
                            estadoProyecto === estado
                              ? "border-blue-500 bg-blue-500/20 text-blue-400 shadow-[0_0_15px_-3px_rgba(59,130,246,0.3)]"
                              : "border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                          }`}
                        >
                          {estado}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Link del Excel */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Link de Participantes (Excel / Sheets)</label>
                    <input
                      type="url"
                      value={enlaceExcelManual}
                      onChange={(e) => setEnlaceExcelManual(e.target.value)}
                      placeholder="https://onedrive.live.com/..."
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-sm text-zinc-200 outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 placeholder:text-zinc-600"
                    />
                    <p className="text-[10px] text-zinc-500">Pega aquí el enlace al documento externo con la lista de ponentes o equipo de apoyo.</p>
                  </div>

                  {/* Fallback de Datos Base (En caso de que falle el parser, o no haya acta) */}
                  <div className="mt-2 pt-4 border-t border-zinc-800">
                     <p className="text-xs font-medium text-zinc-500 mb-3 flex items-center gap-2">
                       <Settings2 className="h-3 w-3" /> Datos Base · Carga Manual sin Acta
                     </p>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity">
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="text"
                            value={nombreManual}
                            onChange={(e) => setNombreManual(e.target.value)}
                            placeholder="Nombre del Proyecto"
                            className="w-full rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <select
                            value={areaManual}
                            onChange={(e) => setAreaManual(e.target.value)}
                            className="w-full rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-600 appearance-none"
                          >
                            <option value="">Área Responsable...</option>
                            {AREAS_DISPONIBLES.filter(a => a !== "Todas").map(area => (
                              <option key={area} value={area}>{area}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <input
                            type="text"
                            value={responsableManual}
                            onChange={(e) => setResponsableManual(e.target.value)}
                            placeholder="Responsable Directo"
                            className="w-full rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="date"
                            value={fechaManual}
                            onChange={(e) => setFechaManual(e.target.value)}
                            aria-label="Fecha de ejecución"
                            className="w-full rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="number"
                            min="0"
                            value={aforoManual}
                            onChange={(e) => setAforoManual(e.target.value)}
                            placeholder="Aforo estimado"
                            className="w-full rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-xs text-zinc-200 outline-none focus:border-zinc-600"
                          />
                        </div>
                     </div>
                     {errorManual && (
                       <p className="mt-2 text-[11px] text-red-400">{errorManual}</p>
                     )}
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Pie de botones */}
        <div className="border-t border-zinc-800 bg-zinc-950/80 p-6 flex items-center justify-end gap-4 shrink-0">
          <button
            onClick={limpiarYCerrar}
            className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleRegistroManual}
            disabled={guardandoManual}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-500 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] transition-all disabled:opacity-60 disabled:cursor-wait"
          >
            <CheckCircle2 className="h-4 w-4" />
            {guardandoManual ? "Registrando…" : "Registrar Proyecto"}
          </button>
        </div>

      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer "Ver Semáforo" (PANEL DIVIDIDO: IZQUIERDA Y DERECHA)        */
/* ------------------------------------------------------------------ */

function SemaforoDrawer({ data, onClose }) {
  const abierto = !!data;

  const evolucion = data?.evolucion || [];
  const sinEvolucion = evolucion.every((p) => p.valor == null);

  return (
    <div
      className={`fixed inset-0 z-50 flex ${abierto ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!abierto}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          abierto ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`relative flex h-full w-full transition-transform duration-300 ease-out ${
          abierto ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          className="flex h-full w-full max-w-md flex-col border-r border-zinc-800 shadow-2xl shrink-0"
          style={{ backgroundColor: PANEL }}
          role="dialog"
          aria-modal="true"
        >
          {data && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5 shrink-0">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: data.bg }}>
                    <Activity className={`h-5 w-5 ${data.text}`} />
                  </div>
                  <div>
                    <p className="font-mono text-xs text-zinc-500">Métricas de Área</p>
                    <h2 className="mt-0.5 text-lg font-semibold text-zinc-100">{data.area}</h2>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Cerrar panel"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
                <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4 bg-zinc-900/30">
                  <span className="text-sm font-medium text-zinc-300">Estado Actual</span>
                  <StatusBadge estado={data.estado} />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-zinc-200">Motivo de Estado</h3>
                  <p className="text-sm leading-relaxed text-zinc-400">{data.detalle}</p>
                  {data.estado === "Crítico" && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-red-900/30 bg-red-500/10 p-3 text-xs text-red-400">
                      <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>Alerta Crítica: Requiere activar plan correctivo inmediato.</p>
                    </div>
                  )}
                  {data.estado === "Atención" && (
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-900/30 bg-amber-500/10 p-3 text-xs text-amber-400">
                      <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>Zona de Riesgo: Se requiere monitoreo reforzado.</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-zinc-200">KPIs Registrados</h3>
                  <div className="grid grid-cols-1 gap-2.5">
                    {data.kpis?.map((kpi, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 p-3">
                        <div className="min-w-0">
                          <span className="text-sm text-zinc-400">{kpi.label}</span>
                          <p className="font-mono text-[10px] text-zinc-600">Meta {kpi.meta}</p>
                        </div>
                        <span className={`shrink-0 font-mono text-sm font-medium ${kpi.nivel ? kpi.text : "text-zinc-500"}`}>{kpi.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-800 px-6 py-4 shrink-0">
                <button
                  onClick={onClose}
                  className="w-full rounded-lg border border-zinc-800 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100"
                >
                  Cerrar reporte
                </button>
              </div>
            </>
          )}
        </div>

        {data && (
          <div className="hidden lg:flex flex-1 flex-col justify-center p-12 pointer-events-none">
            <div className="max-w-5xl w-full mx-auto pointer-events-auto">
              <h2 className="text-3xl font-bold text-white mb-2">Evolución de Rendimiento: {data.area}</h2>
              <p className="text-zinc-400 mb-8 text-lg">Tendencia semanal de {data.kpiPrincipal}, el KPI principal que define el semáforo del área.</p>
              
              <div className="relative h-[450px] w-full rounded-2xl border border-white/10 p-8 shadow-2xl bg-zinc-950/50 backdrop-blur-md">
                {sinEvolucion && (
                  <p className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
                    Sin registros para {data.kpiPrincipal} en las últimas 4 semanas.
                  </p>
                )}
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={evolucion} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`grad-big-${data.area}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={data.color} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={data.color} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="semana" stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 12 }} tickLine={false} axisLine={false} />
                    <YAxis stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 12 }} tickLine={false} axisLine={false} domain={[0, 100]} />
                    <Tooltip content={<ChartTooltip unit="%" />} cursor={{ stroke: CHART.grid }} />
                    <Area 
                      type="monotone" 
                      dataKey="valor" 
                      name={data.kpiPrincipal} 
                      stroke={data.color} 
                      strokeWidth={4} 
                      fill={`url(#grad-big-${data.area})`} 
                      dot={{ r: 6, fill: data.color, strokeWidth: 0 }}
                      activeDot={{ r: 8, fill: "#fff", stroke: data.color, strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell: Sidebar + TopBar                                           */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { key: "macro", label: "Panel Macro", Icon: LayoutGrid },
  { key: "portafolio", label: "Portafolio Operativo", Icon: Layers },
  { key: "calendario", label: "Cronograma PE", Icon: CalendarIcon },
  { key: "analitica-proyectos", label: "Analítica de Proyectos", Icon: BarChart3 },
  { key: "analitica-marketing", label: "Analítica de Marketing", Icon: Megaphone },
];

function Sidebar({ vistaActiva, setVistaActiva }) {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-transparent z-10">
      <div className="flex items-center gap-3 border-b border-white/5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500">
          <span className="font-mono text-sm font-bold text-white">C</span>
        </div>
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold tracking-wide text-zinc-100">
            CINERGIA OS
          </p>
          <p className="truncate text-xs leading-tight text-zinc-500">Centro de Mando</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-5">
        <p className="mb-1 px-2 font-mono text-xs font-medium uppercase tracking-widest text-zinc-600">
          Navegación
        </p>
        {NAV_ITEMS.map((item) => {
          const active = vistaActiva === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setVistaActiva(item.key)}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                active ? "text-zinc-100 bg-blue-500/10" : "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-200"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-500" />
              )}
              <item.Icon className={`h-4 w-4 shrink-0 ${active ? "text-blue-500" : ""}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/5 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">
            Status · Operativo
          </span>
        </div>
        <p className="mt-1.5 font-mono text-xs text-zinc-700">build v2.6.0-PE</p>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* TopBar Dinámico y Funcional                                        */
/* ------------------------------------------------------------------ */

function TopBar({ query, setQuery, placeholder, onLogout, perfil, alertas, actividad, onAbrirConfig, onAbrirAccesos, onCambiarCredenciales }) {
  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notificacionesDinamicas = [
    ...alertas.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      detalle: a.detalle,
      color: a.nivel === "rojo" ? "text-red-400" : "text-amber-400",
      dot: a.nivel === "rojo" ? "bg-red-500" : "bg-amber-500",
    })),
    ...actividad.slice(0, 4).map((e, idx) => ({
      id: `act-${idx}`,
      titulo: e.titulo,
      detalle: `${e.detalle} · ${e.hora}`,
      color: "text-blue-400",
      dot: "bg-blue-500",
    })),
  ];
  const hayCriticas = alertas.some((a) => a.nivel === "rojo");
  const iniciales = (perfil?.nombre || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join("") || "C";
  const esSuperAdmin = perfil?.rol === "SuperAdmin";
  const puedeConfigurar = perfil?.rol === "SuperAdmin" || perfil?.rol === "Editor";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-white/5 px-6 bg-transparent z-10">
      <div className="flex max-w-md flex-1 items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-950/50 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-zinc-600" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || "Buscar proyectos, actas, cronograma…"}
          className="w-full bg-transparent text-sm text-zinc-300 placeholder-zinc-600 outline-none"
        />
        {query ? (
          <button onClick={() => setQuery("")} className="shrink-0 font-mono text-xs text-zinc-600 hover:text-zinc-300">✕</button>
        ) : (
          <kbd className="hidden shrink-0 rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-600 sm:inline-block">⌘K</kbd>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4 relative">
        
        {/* Campana de Notificaciones Dinámica */}
        <div>
          <button 
            onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); }}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800/60 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            <Bell className="h-4 w-4" />
            {notificacionesDinamicas.length > 0 && (
              <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full animate-pulse ${hayCriticas ? "bg-red-500" : alertas.length ? "bg-amber-500" : "bg-blue-500"}`} />
            )}
          </button>

          {showNotif && (
            <div className="absolute right-32 top-full mt-2 w-80 rounded-xl border border-zinc-800 shadow-2xl z-50 p-4" style={{ backgroundColor: PANEL }}>
              <div className="flex items-center justify-between mb-3 border-b border-zinc-800 pb-2">
                <h3 className="text-sm font-semibold text-zinc-200">Alertas y Actividad</h3>
                <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">{alertas.length} alertas</span>
              </div>
              <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                {notificacionesDinamicas.length === 0 ? (
                  <p className="text-xs text-zinc-500 text-center py-4">Sin alertas ni actividad registrada.</p>
                ) : (
                  notificacionesDinamicas.map(notif => (
                    <div key={notif.id} className="flex items-start gap-3 rounded-lg hover:bg-zinc-900/50 p-2 transition-colors">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notif.dot}`} />
                      <div>
                        <p className={`text-xs font-semibold ${notif.color}`}>{notif.titulo}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">{notif.detalle}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-zinc-800/60" />

        {/* Menú de Usuario */}
        <div>
          <button 
            onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-900/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-500">
              <span className="font-mono text-xs font-bold text-white">{iniciales}</span>
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-zinc-200">{perfil?.nombre || "Sesión activa"}</p>
              <p className="text-xs leading-tight text-zinc-500">{perfil ? `${perfil.rol} · ${perfil.area_asignada}` : "Sesión activa"}</p>
            </div>
            <ChevronDown className={`hidden h-3.5 w-3.5 text-zinc-600 sm:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute right-24 top-full mt-2 w-56 rounded-xl border border-zinc-800 shadow-2xl z-50 p-2" style={{ backgroundColor: PANEL }}>
              {puedeConfigurar && (
                <button 
                  onClick={() => { onAbrirConfig(); setShowUserMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100"
                >
                  <Settings2 className="h-4 w-4" /> Configuración OS
                </button>
              )}
              {esSuperAdmin && (
                <button 
                  onClick={() => { onAbrirAccesos(); setShowUserMenu(false); }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100"
                >
                  <ShieldCheck className="h-4 w-4" /> Accesos de Área
                </button>
              )}
              <button 
                onClick={() => { onCambiarCredenciales(); setShowUserMenu(false); }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100"
              >
                <Users className="h-4 w-4" /> Cambiar usuario y contraseña
              </button>
            </div>
          )}
        </div>

        {/* Botón de Desconexión Real */}
        <button 
          onClick={onLogout}
          className="flex items-center gap-1.5 rounded-lg border border-red-900/30 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/10 bg-red-500/5"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Desconectar</span>
        </button>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Vista 1 · Panel Macro (Control Directivo)                          */
/* ------------------------------------------------------------------ */

function VistaPanelMacro({ tablero, onVerActa, onAbrirSemaforo }) {
  const prestigio = tablero.prestigio;
  const proyectoPrestigio = prestigio?.proyecto;
  return (
    <div>
      <SectionHeader
        eyebrow="Módulo / Control Directivo"
        title="Panel Macro"
        subtitle="Vista consolidada del estado general de Cinergia: salud por área, impacto organizacional y el proyecto insignia del mes."
      />

      <div
        className="mb-8 relative flex flex-col lg:flex-row items-center gap-6 overflow-hidden rounded-xl border border-zinc-800 p-6"
        style={{
          backgroundImage: "linear-gradient(155deg, rgba(37,99,235,0.12) 0%, rgba(18,18,20,1) 45%, rgba(16,185,129,0.08) 100%)",
        }}
      >
        <div className="flex-1 w-full">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-emerald-500">
              <Star className="h-4 w-4 text-white" />
            </div>
            <p className="font-mono text-xs font-medium uppercase tracking-widest text-blue-400">
              Proyecto de Prestigio del Mes
            </p>
          </div>
          
          {proyectoPrestigio ? (
            <>
              <h4 className="text-2xl font-bold text-zinc-100">{proyectoPrestigio.nombre}</h4>
              
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-400 border border-blue-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                  {proyectoPrestigio.area}
                </span>
                <span className="flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="font-mono">{formatoFechaCorta(proyectoPrestigio.fecha_programada || proyectoPrestigio.fecha)}</span>
                </span>
                <span className="text-zinc-700">•</span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-zinc-500" />
                  {proyectoPrestigio.responsable}
                </span>
              </div>
              
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
                {proyectoPrestigio.resumen || proyectoPrestigio.objetivo_general || "Sin resumen registrado en el acta."}
              </p>
            </>
          ) : (
            <>
              <h4 className="text-2xl font-bold text-zinc-100">Sin proyecto programado</h4>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
                No hay proyectos con fecha de ejecución en este mes ni próximos. Se selecciona automáticamente el proyecto del mes con mayor aforo estimado.
              </p>
            </>
          )}
        </div>

        {proyectoPrestigio && (
          <div className="w-full lg:w-auto flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-zinc-800 pt-5 lg:pt-0 lg:pl-8">
            {prestigio.metricas.map((m) => (
              <div key={m.label} className="flex flex-col">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">{m.label}</span>
                <span className="font-mono text-xl font-semibold text-zinc-200">{m.value}</span>
              </div>
            ))}
            
            <button 
              onClick={() => onVerActa(proyectoPrestigio)}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500"
            >
              <FileText className="h-3.5 w-3.5" />
              Ver Detalle Operativo
            </button>
          </div>
        )}
      </div>

      <h3 className="mb-4 text-sm font-semibold text-zinc-200">Semáforo de Rendimiento</h3>
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {tablero.semaforo.map((s) => (
          <button
            key={s.area}
            onClick={() => onAbrirSemaforo(s)}
            className="group flex w-full text-left items-center gap-4 rounded-xl border border-zinc-800 p-4 transition-all duration-200 hover:bg-zinc-900/50 hover:border-zinc-700 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            style={{ backgroundColor: PANEL }}
          >
            <span className="relative flex h-3 w-3 shrink-0">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: s.color }}
              />
              <span className="relative inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {s.area}
                </p>
                <span className={`text-[10px] font-bold uppercase tracking-wide ${s.text}`}>
                  {s.estado}
                </span>
              </div>
              <p className="text-xs text-zinc-400 truncate" title={s.detalle}>
                {s.detalle}
              </p>
            </div>
          </button>
        ))}
      </div>

      <div className="mb-8">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">Impacto Organizacional {new Date().getFullYear()}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tablero.impacto.map((m) => {
            const Icono = ICONO_IMPACTO[m.clave] || Award;
            return (
              <div key={m.clave} className="rounded-xl border border-zinc-800 p-4" style={{ backgroundColor: PANEL }}>
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800" style={{ backgroundColor: "rgba(16,185,129,0.08)" }}>
                  <Icono className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-2xl font-semibold text-zinc-100">{m.valor == null ? "—" : Number(m.valor).toLocaleString("es-PE")}</span>
                  {m.suffix && m.valor != null && <span className="font-mono text-xs text-zinc-500">{m.suffix}</span>}
                </div>
                <p className="mt-1 text-xs leading-snug text-zinc-500">{m.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">KPIs Transversales · Últimos 30 días</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tablero.transversales.map((k) => {
            const Icono = ICONO_TRANSVERSAL[k.kpi] || Activity;
            return (
              <div key={k.kpi} className="rounded-xl border border-zinc-800 p-4" style={{ backgroundColor: PANEL }}>
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800" style={{ backgroundColor: "rgba(16,185,129,0.08)" }}>
                  <Icono className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`font-mono text-2xl font-semibold ${k.nivel ? k.text : "text-zinc-100"}`}>{k.valorNumerico == null ? "—" : k.value}</span>
                </div>
                <p className="mt-1 text-xs leading-snug text-zinc-500">{k.label} · Meta {k.meta}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista 2 · Portafolio Operativo ACTUALIZADO PARA RECIBIR BASE DE DATOS */
/* ------------------------------------------------------------------ */

function VistaPortafolio({ query, onVerActa, onAgregarProyecto, datosProyectos, puedeEditar }) {
  const [areaFiltro, setAreaFiltro] = useState("Todas");

  const proyectosFiltrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Filtramos los datos inyectados por prop
    return datosProyectos.filter((p) => {
      const matchArea = areaFiltro === "Todas" || p.area === areaFiltro;
      const matchQuery =
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.responsable && p.responsable.toLowerCase().includes(q));
      return matchArea && matchQuery;
    });
  }, [query, areaFiltro, datosProyectos]);

  return (
    <div>
      <SectionHeader
        eyebrow="Módulo / Portafolio"
        title="Portafolio Operativo"
        subtitle="Directorio en tiempo real de todos los proyectos activos, finalizados y en planificación dentro de Cinergia."
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/50 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-1.5 text-xs text-zinc-500">
            <Filter className="h-3.5 w-3.5" />
            Filtrar por área
          </div>
          {AREAS_DISPONIBLES.map((a) => {
            const active = areaFiltro === a;
            return (
              <button
                key={a}
                onClick={() => setAreaFiltro(a)}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>

        {puedeEditar && (
          <button 
            onClick={onAgregarProyecto}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 shadow-lg shadow-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            Agregar Proyecto
          </button>
        )}
      </div>

      {(query || areaFiltro !== "Todas") && (
        <p className="mb-4 font-mono text-xs text-zinc-500">
          {proyectosFiltrados.length} resultado{proyectosFiltrados.length !== 1 ? "s" : ""}
          {query ? ` para “${query}”` : ""}
          {areaFiltro !== "Todas" ? ` · ${areaFiltro}` : ""}
        </p>
      )}

      {proyectosFiltrados.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {proyectosFiltrados.map((p) => (
            <ProjectCard key={p.id} p={p} onVerActa={onVerActa} />
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 py-20 text-center"
          style={{ backgroundColor: PANEL }}
        >
          <p className="text-sm font-medium text-zinc-300">Sin coincidencias</p>
          <p className="text-xs text-zinc-500">Ningún proyecto coincide con los filtros aplicados. Ajusta la búsqueda o el área.</p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista 3 · Cronograma PE (Calendario)                                */
/* ------------------------------------------------------------------ */

const MESES_NOMBRE = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function VistaCalendario({ onVerActa, proyectos }) {
  const hoy = new Date();
  const [cursor, setCursor] = useState({ year: hoy.getFullYear(), month: hoy.getMonth() });

  const proyectosPorFecha = useMemo(
    () => proyectos
      .map((p) => ({ p, f: aFecha(p.fecha_programada) || aFecha(p.fecha) }))
      .filter((x) => x.f)
      .map(({ p, f }) => ({ ...p, day: f.getDate(), month: f.getMonth(), year: f.getFullYear() })),
    [proyectos]
  );

  const celdas = useMemo(() => {
    const { year, month } = cursor;
    const primerDia = new Date(year, month, 1);
    const offset = (primerDia.getDay() + 6) % 7;
    const diasEnMes = new Date(year, month + 1, 0).getDate();

    const celdasArr = [];
    for (let i = 0; i < offset; i++) celdasArr.push(null);
    for (let d = 1; d <= diasEnMes; d++) {
      const proyectosDelDia = proyectosPorFecha.filter(
        (p) => p.year === year && p.month === month && p.day === d
      );
      celdasArr.push({ day: d, proyectos: proyectosDelDia });
    }
    while (celdasArr.length % 7 !== 0) celdasArr.push(null);
    return celdasArr;
  }, [cursor, proyectosPorFecha]);

  function cambiarMes(delta) {
    setCursor((prev) => {
      let month = prev.month + delta;
      let year = prev.year;
      if (month < 0) { month = 11; year -= 1; }
      if (month > 11) { month = 0; year += 1; }
      return { year, month };
    });
  }

  return (
    <div>
      <SectionHeader
        eyebrow="Módulo / Cronograma"
        title="Cronograma PE"
        subtitle="Calendario mensual con todos los proyectos de Cinergia mapeados en sus fechas de ejecución."
      />

      <div className="rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">
            {MESES_NOMBRE[cursor.month]} <span className="text-zinc-500">{cursor.year}</span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => cambiarMes(-1)}
              aria-label="Mes anterior"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor({ year: hoy.getFullYear(), month: hoy.getMonth() })}
              className="rounded-lg border border-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Hoy
            </button>
            <button
              onClick={() => cambiarMes(1)}
              aria-label="Mes siguiente"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="pb-2 text-center font-mono text-xs uppercase tracking-wider text-zinc-600">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {celdas.map((celda, i) =>
            celda ? (
              <div
                key={i}
                className="flex min-h-[104px] flex-col gap-1.5 rounded-lg border border-zinc-800 p-2 transition-colors hover:border-zinc-700"
                style={{ backgroundColor: celda.proyectos.length ? "rgba(255,255,255,0.02)" : "transparent" }}
              >
                <span className="font-mono text-xs text-zinc-500">{celda.day}</span>
                <div className="flex flex-1 flex-col gap-1">
                  {celda.proyectos.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onVerActa(p)}
                      className="w-full truncate rounded px-1.5 py-1 text-left text-xs font-medium text-zinc-200 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                      style={{ backgroundColor: `${AREA_COLOR[p.area]}26`, borderLeft: `2px solid ${AREA_COLOR[p.area]}` }}
                      title={p.nombre}
                    >
                      {p.nombre}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div key={i} className="min-h-[104px] rounded-lg border border-transparent" />
            )
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-zinc-800 pt-4">
          {AREAS_DISPONIBLES.filter((a) => a !== "Todas").map((a) => (
            <div key={a} className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: AREA_COLOR[a] }} />
              {a}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista 4 · Analítica de Proyectos (CONECTADA A SUPABASE)            */
/* ------------------------------------------------------------------ */

function VistaAnaliticaProyectos({ tablero }) {
  const [areaSeleccionada, setAreaSeleccionada] = useState("Todas");
  const [datosTiempos, setDatosTiempos] = useState([]);

  // Extraer los cálculos matemáticos desde la vista de Supabase
  useEffect(() => {
    async function fetchTiempos() {
      const { data, error } = await supabase.from('vista_tiempos_etapas').select('*');
      if (!error && data) {
        setDatosTiempos(data);
      }
    }
    fetchTiempos();
  }, []);

  // Motor de cálculo dinámico para el gráfico
  const pipelineActivo = useMemo(() => {
    // 1. Filtrar por el área seleccionada
    const filtrados = areaSeleccionada === "Todas" 
      ? datosTiempos 
      : datosTiempos.filter(d => d.area === areaSeleccionada);
      
    // 2. Agrupar por etapa y sumar los días
    const agrupados = filtrados.reduce((acc, curr) => {
      if (!acc[curr.etapa]) {
        acc[curr.etapa] = { totalDias: 0, count: 0 };
      }
      acc[curr.etapa].totalDias += curr.dias_transcurridos;
      acc[curr.etapa].count += 1;
      return acc;
    }, {});

    // 3. Definir el orden lógico del pipeline y promediar
    const orden = ["Planificación Base", "Aprobación Directiva", "Ejecución Activa", "Revisión / QA", "Cierre Operativo"];
    
    return orden.map(etapa => ({
      etapa,
      dias: agrupados[etapa] ? Math.round(agrupados[etapa].totalDias / agrupados[etapa].count) : 0
    }));
  }, [datosTiempos, areaSeleccionada]);

  const distribucionAnalitica = tablero.distribucion
    .filter((d) => ["Eventos", "Marketing", "Proyectos"].includes(d.name))
    .map((d) => ({ ...d, color: AREA_COLOR[d.name] }));
  const k = tablero.kpiProyectos;

  const colorActivo = areaSeleccionada === "Todas" ? CHART.emerald : (AREA_COLOR[areaSeleccionada] || CHART.emerald);

  return (
    <div>
      <SectionHeader
        eyebrow="Módulo / Analítica"
        title="Analítica de Proyectos"
        subtitle="Indicadores de ejecución del núcleo operativo (Eventos, Marketing, Proyectos)."
      />

      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard Icon={CheckCircle2} label="Hitos en Fecha" value={k.hitos.value} suffix={k.hitos.suffix} delta={k.hitos.delta} trend={k.hitos.trend} />
        <KpiCard Icon={Zap} label="Proyectos Activos" value={k.activos.value} suffix={k.activos.suffix} delta={k.activos.delta} trend={k.activos.trend} />
        <KpiCard Icon={Timer} label="Tiempo de Cierre" value={k.tiempoCierre.value} suffix={k.tiempoCierre.suffix} delta={k.tiempoCierre.delta} trend={k.tiempoCierre.trend} />
        <KpiCard Icon={Layers} label="Total de Proyectos" value={k.total.value} suffix={k.total.suffix} delta={k.total.delta} trend={k.total.trend} />
      </div>

      <div className="mb-5 rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">Carga de Lanzamientos / Flujo</h3>
        <p className="mb-4 text-xs text-zinc-500">Proyectos activos al cierre de cada mes durante {new Date().getFullYear()}</p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tablero.cargaLanzamientos} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="flujoGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART.blue} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={CHART.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="mes" stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip unit=" proyectos" />} cursor={{ stroke: CHART.grid }} />
              <Area
                type="monotone"
                name="Proyectos en flujo"
                dataKey="proyectos"
                stroke={CHART.blue}
                strokeWidth={2.5}
                fill="url(#flujoGradient)"
                dot={{ r: 3.5, fill: CHART.blue, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-zinc-200">Pipeline Operativo</h3>
            {areaSeleccionada !== "Todas" && (
              <button 
                onClick={() => setAreaSeleccionada("Todas")}
                className="font-mono text-[10px] text-blue-400 hover:underline focus-visible:outline-none"
              >
                Ver Vista General ✕
              </button>
            )}
          </div>
          <p className="mb-4 text-xs text-zinc-500">
            Días promedio por etapa {areaSeleccionada !== "Todas" ? `(${areaSeleccionada})` : "(General)"}
          </p>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={pipelineActivo}
                layout="vertical"
                margin={{ top: 5, right: 24, left: 8, bottom: 0 }}
              >
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="etapa"
                  stroke={CHART.grid}
                  tick={{ fill: CHART.text, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={140}
                />
                <Tooltip content={<ChartTooltip unit=" días" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar 
                  dataKey="dias" 
                  name="Días promedio" 
                  fill={colorActivo} 
                  radius={[0, 6, 6, 0]} 
                  barSize={18} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Filtrando métricas reales para: <span className="text-zinc-200 font-medium">{areaSeleccionada}</span>
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
          <h3 className="mb-1 text-sm font-semibold text-zinc-200">Distribución Núcleo Operativo</h3>
          <p className="mb-4 text-xs text-zinc-500">Haz clic en un área para aislar sus datos en el pipeline</p>
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div style={{ height: 220, width: 220 }} className="shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribucionAnalitica} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">
                    {distribucionAnalitica.map((entry, i) => (
                      <Cell 
                        key={i} 
                        fill={entry.color} 
                        className="cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none"
                        onClick={() => setAreaSeleccionada(entry.name)}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip unit=" proyectos" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex w-full flex-col gap-3">
              {distribucionAnalitica.map((m) => {
                const isSelected = areaSeleccionada === m.name;
                return (
                  <button
                    key={m.name}
                    onClick={() => setAreaSeleccionada(isSelected ? "Todas" : m.name)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all text-left w-full focus-visible:outline-none ${
                      isSelected ? "border-blue-500/50 bg-blue-500/10" : "border-zinc-800 hover:border-zinc-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="truncate text-sm text-zinc-300">{m.name}</span>
                    </div>
                    <span className="font-mono text-sm font-medium text-zinc-100">{m.value}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">Registro de Auditoría</h3>
        <p className="mb-4 text-xs text-zinc-500">Actividad reciente del sistema</p>
        <ol className="grid grid-cols-1 gap-x-8 border-l border-zinc-800 pl-5 md:grid-cols-2">
          {tablero.auditoria.length === 0 && (
            <li className="mb-5 text-xs text-zinc-500">Sin actividad registrada.</li>
          )}
          {tablero.auditoria.map((evento, i) => {
            const log = { ...evento, ...(ICONO_AUDITORIA[evento.tipo] || ICONO_AUDITORIA.proyecto) };
            return (
            <li key={i} className="relative mb-5">
              <span
                className={`absolute top-1 h-2.5 w-2.5 rounded-full ${log.dot}`}
                style={{ left: "-21px", boxShadow: `0 0 0 4px ${PANEL}` }}
              />
              <div className="flex items-center gap-1.5">
                <log.Icon className={`h-3.5 w-3.5 ${log.color}`} />
                <p className="text-xs font-semibold text-zinc-200">{log.titulo}</p>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{log.detalle}</p>
              <p className="mt-1 font-mono text-xs text-zinc-600">{log.hora}</p>
            </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista 5 · Analítica de Marketing                                   */
/* ------------------------------------------------------------------ */

function VistaAnaliticaMarketing({ tablero, puedeEditar, onRegistrarMetricas }) {
  const m = tablero.marketing;
  return (
    <div>
      <SectionHeader
        eyebrow="Módulo / Analítica"
        title="Analítica de Marketing"
        subtitle="Desempeño de la marca Cinergia en redes y comparación entre alcance digital y asistencia real a eventos."
      />

      {puedeEditar && (
        <div className="mb-6 flex justify-end border-b border-zinc-800/50 pb-4">
          <button
            onClick={onRegistrarMetricas}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 shadow-lg shadow-blue-500/20"
          >
            <Plus className="h-4 w-4" />
            Registrar Métricas del Mes
          </button>
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard Icon={Zap} label="Engagement Rate" value={m.engagement.value} suffix={m.engagement.suffix} delta={m.engagement.delta} trend={m.engagement.trend} />
        <KpiCard Icon={TrendingUp} label="Crecimiento de Seguidores" value={m.seguidores.value} suffix={m.seguidores.suffix} delta={m.seguidores.delta} trend={m.seguidores.trend} />
        <KpiCard Icon={Users} label="Alcance Mensual" value={m.alcance.value} delta={m.alcance.delta} trend={m.alcance.trend} />
        <KpiCard Icon={Megaphone} label="Eventos Promocionados" value={m.promocionados.value} suffix="" delta={m.promocionados.delta} trend={m.promocionados.trend} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
          <h3 className="mb-1 text-sm font-semibold text-zinc-200">Alcance Digital por Evento</h3>
          <p className="mb-4 text-xs text-zinc-500">Alcance en redes sociales, en miles de personas</p>
          <div className="relative" style={{ height: 300 }}>
            {m.alcancePorEvento.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">Sin cierres con alcance digital registrado.</p>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.alcancePorEvento} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="evento" stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={56} />
                <YAxis stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit="k alcance" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="alcanceK" name="Alcance (miles)" fill={CHART.blue} radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
          <h3 className="mb-1 text-sm font-semibold text-zinc-200">Asistencia Real por Evento</h3>
          <p className="mb-4 text-xs text-zinc-500">Personas que asistieron presencialmente</p>
          <div className="relative" style={{ height: 300 }}>
            {m.asistenciaPorEvento.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">Sin cierres con asistencia real registrada.</p>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.asistenciaPorEvento} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="evento" stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={56} />
                <YAxis stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit=" pax" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="asistencia" name="Asistencia" fill={CHART.emerald} radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {m.pendienteDeCierre && (
            <p className="mt-3 text-xs text-zinc-500">
              <span className="text-amber-400">{m.pendienteDeCierre.nombre}</span> aún no registra asistencia real.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Módulo: Accesos de Área (RBAC)                                     */
/* ------------------------------------------------------------------ */

function AccesosDrawer({ abierto, onClose, usuarios, perfil, onCambio }) {
  const [invitando, setInvitando] = useState(false);
  const [form, setForm] = useState({ dni: "", nombre: "", area_asignada: AREAS[0], rol: "Lector" });
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState({ tipo: "", texto: "" });

  const ejecutar = async (accion, exito) => {
    setMensaje({ tipo: "", texto: "" });
    setProcesando(true);
    try {
      await accion();
      await onCambio?.();
      setMensaje({ tipo: "ok", texto: exito });
    } catch (e) {
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setProcesando(false);
    }
  };

  const invitar = () => ejecutar(async () => {
    if (!/^\d{8}$/.test(form.dni)) throw new Error("El DNI debe tener 8 dígitos.");
    if (!form.nombre.trim()) throw new Error("El nombre es obligatorio.");
    await llamarApi("/api/admin/usuarios", { method: "POST", body: { ...form, nombre: form.nombre.trim() } });
    setForm({ dni: "", nombre: "", area_asignada: AREAS[0], rol: "Lector" });
    setInvitando(false);
  }, "Cuenta creada. Primer ingreso con el DNI como usuario y contraseña.");

  const aplicarAccion = (u, accion) => {
    if (!accion) return;
    if (accion === "Restablecer") {
      return ejecutar(() => llamarApi(`/api/admin/usuarios/${u.id}/restablecer`, { method: "POST" }),
        `Credenciales de ${u.nombre} restablecidas al DNI.`);
    }
    const cuerpo = accion === "Revocar" ? { activo: false } : accion === "Reactivar" ? { activo: true } : { rol: accion };
    return ejecutar(() => llamarApi(`/api/admin/usuarios/${u.id}`, { method: "PATCH", body: cuerpo }),
      `Acceso de ${u.nombre} actualizado.`);
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${abierto ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!abierto}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${abierto ? "opacity-100" : "opacity-0"}`} />
      
      <div className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-zinc-800 shadow-2xl transition-transform duration-300 ease-out ${abierto ? "translate-x-0" : "translate-x-full"}`} style={{ backgroundColor: PANEL }}>
        
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 border border-red-500/20">
              <ShieldCheck className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="font-mono text-xs text-zinc-500">Seguridad</p>
              <h2 className="mt-0.5 text-lg font-semibold text-zinc-100">Accesos de Área</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Personal Autorizado</h3>
            {!invitando && (
              <button onClick={() => setInvitando(true)} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300">
                <Plus className="h-3.5 w-3.5" /> Invitar
              </button>
            )}
          </div>

          {invitando && (
            <div className="flex flex-col gap-2.5 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col">
                  <label className={ETIQUETA_FORM}>DNI</label>
                  <input inputMode="numeric" maxLength={8} value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value.replace(/\D/g, "") })} className={CAMPO_FORM} />
                </div>
                <div className="flex flex-col">
                  <label className={ETIQUETA_FORM}>Rol</label>
                  <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })} className={`${CAMPO_FORM} appearance-none`}>
                    <option value="Lector">Lector</option>
                    <option value="Editor">Editor</option>
                    <option value="SuperAdmin">SuperAdmin</option>
                  </select>
                </div>
              </div>
              <div className="flex flex-col">
                <label className={ETIQUETA_FORM}>Nombre completo</label>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={CAMPO_FORM} />
              </div>
              <div className="flex flex-col">
                <label className={ETIQUETA_FORM}>Área</label>
                <select value={form.area_asignada} onChange={(e) => setForm({ ...form, area_asignada: e.target.value })} className={`${CAMPO_FORM} appearance-none`}>
                  {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setInvitando(false)} className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-100">Cancelar</button>
                <button onClick={invitar} disabled={procesando} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-60">Crear cuenta</button>
              </div>
            </div>
          )}

          {mensaje.texto && (
            <div className={`rounded-lg border p-3 text-xs ${mensaje.tipo === "error" ? "border-red-900/30 bg-red-500/10 text-red-400" : "border-emerald-900/30 bg-emerald-500/10 text-emerald-400"}`}>
              {mensaje.texto}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {usuarios.length === 0 && (
              <p className="text-xs text-zinc-500">Sin cuentas registradas.</p>
            )}
            {usuarios.map((u) => (
              <div key={u.id} className={`flex flex-col gap-3 rounded-lg border border-zinc-800 p-4 bg-zinc-900/30 ${u.activo === false ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-mono text-zinc-300">
                      {u.nombre.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{u.nombre}</p>
                      <p className="text-[11px] text-zinc-500">
                        {u.area_asignada}{u.usuario ? ` · @${u.usuario}` : ""}
                        {u.activo === false ? " · Acceso revocado" : u.debe_cambiar_credenciales ? " · Primer ingreso pendiente" : ""}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider ${
                    u.rol === 'SuperAdmin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                    u.rol === 'Editor' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                    'bg-zinc-800 text-zinc-400'
                  }`}>
                    {u.rol}
                  </span>
                </div>
                {u.id !== perfil?.id && (
                  <div className="border-t border-zinc-800 pt-3 flex justify-between">
                    <select
                      value=""
                      disabled={procesando}
                      onChange={(e) => aplicarAccion(u, e.target.value)}
                      className="bg-transparent text-xs text-zinc-400 outline-none cursor-pointer"
                    >
                      <option value="">Gestionar acceso...</option>
                      {u.rol !== "Editor" && <option value="Editor">Hacer Editor</option>}
                      {u.rol !== "Lector" && <option value="Lector">Hacer Lector</option>}
                      {u.rol !== "SuperAdmin" && <option value="SuperAdmin">Hacer SuperAdmin</option>}
                      <option value="Restablecer">Restablecer credenciales al DNI</option>
                      {u.activo === false
                        ? <option value="Reactivar">Reactivar acceso</option>
                        : <option value="Revocar">Revocar acceso</option>}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Módulo: Configuración Global OS (FUNCIONAL)                        */
/* ------------------------------------------------------------------ */

function ConfiguracionDrawer({ abierto, onClose, proyectos, onSync, modoEstricto, setModoEstricto }) {
  const [syncing, setSyncing] = useState(false);
  const [aviso, setAviso] = useState("");

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSync();
    } finally {
      setSyncing(false);
    }
  };

  const handleExportCSV = () => {
    setAviso("");
    if (!proyectos || proyectos.length === 0) {
      setAviso("La base de datos no tiene proyectos para exportar.");
      return;
    }

    const celda = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const headers = ["ID", "Nombre", "Área", "Etapa", "Responsable", "Fecha de Ejecución", "Aforo Estimado"];
    const csvContent = [
      headers.join(","),
      ...proyectos.map((p) => [p.id, p.nombre, p.area, p.estado_actual, p.responsable, p.fecha_programada || p.fecha, p.aforo_estimado].map(celda).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Cinergia_Backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`fixed inset-0 z-50 flex ${abierto ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!abierto}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${abierto ? "opacity-100" : "opacity-0"}`} />
      
      <div className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-zinc-800 shadow-2xl transition-transform duration-300 ease-out ${abierto ? "translate-x-0" : "translate-x-full"}`} style={{ backgroundColor: PANEL }}>
        
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700">
              <Settings2 className="h-5 w-5 text-zinc-300" />
            </div>
            <div>
              <p className="font-mono text-xs text-zinc-500">Sistema</p>
              <h2 className="mt-0.5 text-lg font-semibold text-zinc-100">Configuración OS</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-8">
          
          <div>
            <h3 className="mb-4 text-sm font-semibold text-zinc-200">Motor de Ingestión (Python)</h3>
            <div 
              onClick={() => setModoEstricto(!modoEstricto)}
              className="flex items-center justify-between p-3 border border-zinc-800 rounded-lg bg-zinc-900/30 cursor-pointer hover:bg-zinc-800/40 transition-colors"
            >
              <div>
                <p className="text-sm text-zinc-300">Modo Estricto de Parser</p>
                <p className="text-[11px] text-zinc-500">Rechazar actas si falta el nombre, el área o el responsable.</p>
              </div>
              <div className={`w-10 h-5 rounded-full relative transition-colors ${modoEstricto ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${modoEstricto ? 'right-1' : 'left-1'}`}></div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-zinc-200">Base de Datos</h3>
            <div className="flex flex-col gap-3">
              <button 
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center justify-between p-3 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-colors text-left text-sm text-zinc-300 disabled:opacity-50"
              >
                <span>{syncing ? "Sincronizando con Supabase..." : "Forzar Sincronización Manual"}</span>
                <RefreshCw className={`h-4 w-4 text-zinc-500 ${syncing ? 'animate-spin' : ''}`} />
              </button>
              
              <button 
                onClick={handleExportCSV}
                className="flex items-center justify-between p-3 border border-zinc-800 rounded-lg hover:bg-zinc-800/50 transition-colors text-left text-sm text-zinc-300"
              >
                <span>Exportar Backup (CSV)</span>
                <Database className="h-4 w-4 text-zinc-500" />
              </button>
              {aviso && <p className="text-[11px] text-amber-400">{aviso}</p>}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pantalla de Autenticación (Login) con Lluvia Digital               */
/* ------------------------------------------------------------------ */

function PantallaLogin() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [entrando, setEntrando] = useState(false);

  // Generamos 20 estelas con posiciones y velocidades aleatorias
  const estelas = useMemo(() => {
    return Array.from({ length: 20 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${Math.random() * 3 + 2}s`,
      animationDelay: `${Math.random() * 2}s`,
      opacity: Math.random() * 0.5 + 0.2
    }));
  }, []);

  const handleIngreso = async (e) => {
    e.preventDefault();
    setError("");
    setEntrando(true);

    const { data: email, error: errorBusqueda } = await supabase.rpc("email_para_login", { identificador: usuario.trim() });
    const { error: authError } = !errorBusqueda && email
      ? await supabase.auth.signInWithPassword({ email, password })
      : { error: true };

    setEntrando(false);

    if (authError) {
      setError("Credenciales inválidas. Acceso denegado.");
      setTimeout(() => setError(""), 3000);
    }
  };

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-zinc-950 px-4 overflow-hidden"
         style={{ backgroundImage: "radial-gradient(#1c1c1f 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
      
      {/* Estilos inyectados para la animación de la lluvia */}
      <style>
        {`
          @keyframes digitalRain {
            0% { transform: translateY(-100vh); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { transform: translateY(100vh); opacity: 0; }
          }
          .estela {
            position: absolute;
            top: -100px;
            width: 1px;
            height: 120px;
            background: linear-gradient(transparent, rgba(59, 130, 246, 0.8), rgba(16, 185, 129, 0.8));
            animation: digitalRain linear infinite;
            z-index: 0;
          }
        `}
      </style>

      {/* Renderizado de las estelas */}
      <div className="absolute inset-0 pointer-events-none">
        {estelas.map((estela) => (
          <div 
            key={estela.id} 
            className="estela"
            style={{ 
              left: estela.left, 
              animationDuration: estela.animationDuration,
              animationDelay: estela.animationDelay,
              opacity: estela.opacity
            }} 
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)] backdrop-blur-xl">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 shadow-lg shadow-blue-500/20">
            <span className="font-mono text-2xl font-bold text-white">C</span>
          </div>
          <h1 className="text-xl font-bold text-zinc-100 tracking-tight">CINERGIA OS</h1>
          <p className="text-sm text-zinc-500">Centro de Mando Operativo</p>
        </div>

        <form onSubmit={handleIngreso} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">DNI o Usuario</label>
            <input
              type="text"
              autoComplete="username"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ej. 71234567"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 relative z-20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-zinc-400">Clave de Seguridad</label>
            <input 
              type="password" 
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 relative z-20" 
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-900/30 bg-red-500/10 p-3 text-center text-xs text-red-400">
              Credenciales inválidas. Acceso denegado.
            </div>
          )}

          <button
            type="submit"
            disabled={entrando}
            className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500 relative z-20 disabled:opacity-60 disabled:cursor-wait"
          >
            {entrando ? "Verificando…" : "Ingresar al Sistema"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Credenciales propias: primer ingreso y cambio voluntario           */
/* ------------------------------------------------------------------ */

function TarjetaCredenciales({ perfil, obligatorio, onListo, onCancelar }) {
  const [usuario, setUsuario] = useState(perfil?.usuario || "");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    const u = usuario.trim().toLowerCase();
    if (!/^[a-z0-9._]{4,30}$/.test(u) || /^\d+$/.test(u)) {
      setError("El usuario debe tener entre 4 y 30 caracteres: letras, números, punto o guion bajo, y no puede ser solo números.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (perfil?.dni && password === perfil.dni) {
      setError("La contraseña no puede ser el DNI.");
      return;
    }
    if (password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setGuardando(true);
    try {
      const { error: errorClave } = await supabase.auth.updateUser({ password });
      if (errorClave) {
        throw new Error(/different/i.test(errorClave.message) ? "La contraseña nueva debe ser distinta a la actual." : errorClave.message);
      }
      const { error: errorUsuario } = await supabase.rpc("actualizar_mi_usuario", { nuevo_usuario: u });
      if (errorUsuario) throw new Error(errorUsuario.message);
      await onListo?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  };

  const campo = "w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50";

  return (
    <div className="relative z-10 w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950/80 p-8 shadow-[0_0_50px_-12px_rgba(59,130,246,0.25)] backdrop-blur-xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-emerald-500 shadow-lg shadow-blue-500/20">
          <ShieldCheck className="h-6 w-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-zinc-100 tracking-tight">{obligatorio ? "Configura tu acceso" : "Usuario y contraseña"}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {obligatorio
            ? "Primer ingreso: define el usuario y la contraseña que usarás desde ahora. El DNI deja de funcionar como contraseña."
            : "Actualiza tus credenciales de acceso a CINERGIA OS."}
        </p>
      </div>

      <form onSubmit={guardar} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">Usuario</label>
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" placeholder="Ej. ana.rodriguez" className={campo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">Nueva contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" className={campo} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400">Confirmar contraseña</label>
          <input type="password" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} autoComplete="new-password" className={campo} />
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/30 bg-red-500/10 p-3 text-center text-xs text-red-400">{error}</div>
        )}

        <button type="submit" disabled={guardando} className="mt-2 w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500 disabled:opacity-60 disabled:cursor-wait">
          {guardando ? "Guardando…" : "Guardar y continuar"}
        </button>
        {obligatorio ? (
          <button type="button" onClick={() => supabase.auth.signOut()} className="text-xs text-zinc-500 hover:text-zinc-300">Desconectar</button>
        ) : (
          <button type="button" onClick={onCancelar} className="text-xs text-zinc-500 hover:text-zinc-300">Cancelar</button>
        )}
      </form>
    </div>
  );
}

function PantallaPrimerIngreso({ perfil, onListo }) {
  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-zinc-950 px-4 overflow-hidden"
         style={{ backgroundImage: "radial-gradient(#1c1c1f 1px, transparent 1px)", backgroundSize: "28px 28px" }}>
      <TarjetaCredenciales perfil={perfil} obligatorio onListo={onListo} />
    </div>
  );
}

function ModalCredenciales({ abierto, perfil, onClose, onListo }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <TarjetaCredenciales perfil={perfil} onCancelar={onClose} onListo={async () => { await onListo?.(); onClose(); }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modal genérico de registro · mismo diseño del registro de proyecto */
/* ------------------------------------------------------------------ */

function ModalRegistro({ abierto, onClose, eyebrow, titulo, Icono, children, onGuardar, guardando, error, textoGuardar }) {
  if (!abierto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div onClick={onClose} className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300" />
      <div
        className="relative flex max-h-full w-full max-w-4xl flex-col rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden"
        style={{ backgroundColor: PANEL }}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20 shadow-inner">
              <Icono className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">{eyebrow}</p>
              <h2 className="text-xl font-bold text-zinc-100">{titulo}</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-100 transition-colors focus-visible:outline-none">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {children}
          {error && (
            <div className="mt-6 rounded-lg border border-red-900/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</div>
          )}
        </div>

        <div className="border-t border-zinc-800 bg-zinc-950/80 p-6 flex items-center justify-end gap-4 shrink-0">
          <button onClick={onClose} className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors">
            Cancelar
          </button>
          <button
            onClick={onGuardar}
            disabled={guardando}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-500 shadow-[0_0_20px_-5px_rgba(59,130,246,0.5)] transition-all disabled:opacity-60 disabled:cursor-wait"
          >
            <CheckCircle2 className="h-4 w-4" />
            {guardando ? "Guardando…" : textoGuardar}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampoNumero({ label, value, onChange, step = "1", min = "0", max }) {
  return (
    <div className="flex flex-col">
      <label className={ETIQUETA_FORM}>{label}</label>
      <input type="number" step={step} min={min} max={max} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={CAMPO_FORM} />
    </div>
  );
}

function CampoFecha({ label, value, onChange }) {
  return (
    <div className="flex flex-col">
      <label className={ETIQUETA_FORM}>{label}</label>
      <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} className={CAMPO_FORM} />
    </div>
  );
}

function TituloBloque({ color, children }) {
  const estilos = {
    blue: "bg-blue-900/20 border-blue-500/30 text-blue-400",
    emerald: "bg-emerald-900/20 border-emerald-500/30 text-emerald-400",
  };
  return (
    <div className={`border px-3 py-1.5 mb-4 rounded inline-block ${estilos[color]}`}>
      <h3 className="text-xs font-bold uppercase tracking-widest">{children}</h3>
    </div>
  );
}

const CIERRE_VACIO = {
  fecha_real_ejecucion: "", asistentes_reales: "", satisfaccion_participantes: "", satisfaccion_aliados: "",
  fecha_entrega_memoria: "", inicio_difusion: "", incidencias_mayores: "0", aliados_confirmados: "0",
  menciones_externas: "0", alcance_digital: "", registro_audiovisual: false, horas_voluntariado: "",
  impacto_social: false, observaciones: "",
};

function formularioCierre(proyecto, cierre) {
  const base = { ...CIERRE_VACIO };
  if (cierre) {
    Object.keys(base).forEach((k) => {
      if (cierre[k] != null) base[k] = typeof base[k] === "boolean" ? !!cierre[k] : String(cierre[k]);
    });
  } else if (proyecto) {
    base.fecha_real_ejecucion = proyecto.fecha_programada || "";
  }
  return base;
}

function CierreModal({ proyecto, cierre, onClose, onGuardado }) {
  const abierto = !!proyecto;
  const [form, setForm] = useState(() => formularioCierre(proyecto, cierre));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v) => (v === "" || v == null ? null : Number(v));

  const guardar = async () => {
    setError("");
    if (!form.fecha_real_ejecucion) {
      setError("La fecha real de ejecución es obligatoria.");
      return;
    }
    for (const k of ["satisfaccion_participantes", "satisfaccion_aliados"]) {
      const v = num(form[k]);
      if (v != null && (v < 1 || v > 5)) {
        setError("Las satisfacciones se registran en escala de 1 a 5.");
        return;
      }
    }
    setGuardando(true);
    try {
      const { error: e } = await supabase.from("cierres_evento").upsert({
        proyecto_id: proyecto.id,
        fecha_real_ejecucion: form.fecha_real_ejecucion,
        asistentes_reales: num(form.asistentes_reales),
        satisfaccion_participantes: num(form.satisfaccion_participantes),
        satisfaccion_aliados: num(form.satisfaccion_aliados),
        fecha_entrega_memoria: form.fecha_entrega_memoria || null,
        inicio_difusion: form.inicio_difusion || null,
        incidencias_mayores: num(form.incidencias_mayores) ?? 0,
        aliados_confirmados: num(form.aliados_confirmados) ?? 0,
        menciones_externas: num(form.menciones_externas) ?? 0,
        alcance_digital: num(form.alcance_digital),
        registro_audiovisual: form.registro_audiovisual,
        horas_voluntariado: num(form.horas_voluntariado),
        impacto_social: form.impacto_social,
        observaciones: form.observaciones.trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "proyecto_id" });
      if (e) throw e;
      await onGuardado?.();
      onClose();
    } catch (e) {
      setError("No se pudo guardar el cierre: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalRegistro
      abierto={abierto}
      onClose={onClose}
      eyebrow={proyecto ? `${proyecto.id} · ${proyecto.area}` : ""}
      titulo={proyecto ? `Cierre · ${proyecto.nombre}` : ""}
      Icono={ShieldCheck}
      onGuardar={guardar}
      guardando={guardando}
      error={error}
      textoGuardar={cierre ? "Actualizar Cierre" : "Registrar Cierre"}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <TituloBloque color="blue">1. Ejecución y Participación</TituloBloque>
          <div className="grid grid-cols-2 gap-3">
            <CampoFecha label="Fecha real de ejecución" value={form.fecha_real_ejecucion} onChange={set("fecha_real_ejecucion")} />
            <CampoNumero label="Asistentes reales" value={form.asistentes_reales} onChange={set("asistentes_reales")} />
            <CampoNumero label="Satisfacción participantes 1 a 5" step="0.1" min="1" max="5" value={form.satisfaccion_participantes} onChange={set("satisfaccion_participantes")} />
            <CampoNumero label="Satisfacción aliados 1 a 5" step="0.1" min="1" max="5" value={form.satisfaccion_aliados} onChange={set("satisfaccion_aliados")} />
            <CampoNumero label="Incidencias mayores" value={form.incidencias_mayores} onChange={set("incidencias_mayores")} />
            <CampoNumero label="Horas de voluntariado" step="0.5" value={form.horas_voluntariado} onChange={set("horas_voluntariado")} />
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-zinc-800 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <TituloBloque color="emerald">2. Difusión y Resultados</TituloBloque>
          <div className="grid grid-cols-2 gap-3">
            <CampoFecha label="Inicio de difusión" value={form.inicio_difusion} onChange={set("inicio_difusion")} />
            <CampoFecha label="Entrega de memoria técnica" value={form.fecha_entrega_memoria} onChange={set("fecha_entrega_memoria")} />
            <CampoNumero label="Aliados o patrocinadores" value={form.aliados_confirmados} onChange={set("aliados_confirmados")} />
            <CampoNumero label="Menciones externas" value={form.menciones_externas} onChange={set("menciones_externas")} />
            <CampoNumero label="Alcance digital" value={form.alcance_digital} onChange={set("alcance_digital")} />
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={form.registro_audiovisual} onChange={(e) => set("registro_audiovisual")(e.target.checked)} className="accent-blue-600" />
              Registro visual o audiovisual completo
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
              <input type="checkbox" checked={form.impacto_social} onChange={(e) => set("impacto_social")(e.target.checked)} className="accent-blue-600" />
              Impacto social directo
            </label>
          </div>
          <div className="flex flex-col">
            <label className={ETIQUETA_FORM}>Observaciones y aprendizajes</label>
            <textarea rows={3} value={form.observaciones} onChange={(e) => set("observaciones")(e.target.value)} className={`${CAMPO_FORM} resize-none`} />
          </div>
        </div>
      </div>
    </ModalRegistro>
  );
}

function MetricasMarketingModal({ abierto, onClose, onGuardado, registros }) {
  const mesActual = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  const formularioDe = (mes) => {
    const existente = registros.find((r) => (r.periodo || "").slice(0, 7) === mes);
    return {
      seguidores: existente?.seguidores ?? "",
      alcance: existente?.alcance ?? "",
      interacciones: existente?.interacciones ?? "",
      publicaciones_planificadas: existente?.publicaciones_planificadas ?? "",
      publicaciones_realizadas: existente?.publicaciones_realizadas ?? "",
      menciones_medios: existente?.menciones_medios ?? "0",
    };
  };
  const [periodo, setPeriodo] = useState(mesActual);
  const [form, setForm] = useState(() => formularioDe(mesActual()));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const cambiarPeriodo = (mes) => {
    setPeriodo(mes);
    setForm(formularioDe(mes));
  };

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const num = (v) => (v === "" || v == null ? null : Number(v));

  const guardar = async () => {
    setError("");
    if (!periodo || num(form.seguidores) == null) {
      setError("El mes y el total de seguidores son obligatorios.");
      return;
    }
    setGuardando(true);
    try {
      const { error: e } = await supabase.from("metricas_marketing").upsert({
        periodo: `${periodo}-01`,
        seguidores: num(form.seguidores),
        alcance: num(form.alcance),
        interacciones: num(form.interacciones),
        publicaciones_planificadas: num(form.publicaciones_planificadas),
        publicaciones_realizadas: num(form.publicaciones_realizadas),
        menciones_medios: num(form.menciones_medios) ?? 0,
      }, { onConflict: "periodo" });
      if (e) throw e;
      await onGuardado?.();
      onClose();
    } catch (e) {
      setError("No se pudieron guardar las métricas: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalRegistro
      abierto={abierto}
      onClose={onClose}
      eyebrow="Área de Marketing"
      titulo="Métricas del Mes"
      Icono={Megaphone}
      onGuardar={guardar}
      guardando={guardando}
      error={error}
      textoGuardar="Guardar Métricas"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <TituloBloque color="blue">1. Redes Sociales</TituloBloque>
          <div className="flex flex-col">
            <label className={ETIQUETA_FORM}>Mes</label>
            <input type="month" value={periodo} onChange={(e) => cambiarPeriodo(e.target.value)} className={CAMPO_FORM} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero label="Seguidores al cierre del mes" value={form.seguidores} onChange={set("seguidores")} />
            <CampoNumero label="Alcance del mes" value={form.alcance} onChange={set("alcance")} />
            <CampoNumero label="Interacciones del mes" value={form.interacciones} onChange={set("interacciones")} />
            <CampoNumero label="Menciones en medios" value={form.menciones_medios} onChange={set("menciones_medios")} />
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-zinc-800 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <TituloBloque color="emerald">2. Calendario Editorial</TituloBloque>
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero label="Publicaciones planificadas" value={form.publicaciones_planificadas} onChange={set("publicaciones_planificadas")} />
            <CampoNumero label="Publicaciones realizadas" value={form.publicaciones_realizadas} onChange={set("publicaciones_realizadas")} />
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            Las piezas de comunicación con fecha de entrega se registran como compromisos del proyecto correspondiente, con tipo Pieza de comunicación. De ahí se calculan la puntualidad y la anticipación de 72 h.
          </p>
        </div>
      </div>
    </ModalRegistro>
  );
}

/* ------------------------------------------------------------------ */
/* App PRINCIPAL: EL CEREBRO DE LA OPERACIÓN                          */
/* ------------------------------------------------------------------ */

export default function CinergiaOS() {
  const [sesion, setSesion] = useState(null);
  const [cargandoSesion, setCargandoSesion] = useState(true);
  const estaAutenticado = !!sesion;

  const [perfilConsultado, setPerfilConsultado] = useState({ id: null, fila: null });

  const [vistaActiva, setVistaActiva] = useState("macro");
  const [query, setQuery] = useState("");
  const [actaAbiertaId, setActaAbiertaId] = useState(null);
  const [semaforoArea, setSemaforoArea] = useState(null);
  const [creandoProyecto, setCreandoProyecto] = useState(false);
  const [cierreDe, setCierreDe] = useState(null);
  const [metricasAbiertas, setMetricasAbiertas] = useState(false);
  const [credencialesAbiertas, setCredencialesAbiertas] = useState(false);
  const [configAbierta, setConfigAbierta] = useState(false);
  const [accesosAbiertos, setAccesosAbiertos] = useState(false);
  const [modoEstricto, setModoEstrictoEstado] = useState(() => {
    try {
      return localStorage.getItem("cinergia_modo_estricto") !== "false";
    } catch {
      return true;
    }
  });

  const [datos, setDatos] = useState({
    proyectos: [], compromisos: [], historial: [], cierres: [], marketing: [], umbrales: [], usuarios: [],
  });
  const [errorDatos, setErrorDatos] = useState("");

  const setModoEstricto = (valor) => {
    setModoEstrictoEstado(valor);
    try {
      localStorage.setItem("cinergia_modo_estricto", String(valor));
    } catch {
      /* almacenamiento local no disponible */
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSesion(data.session);
      setCargandoSesion(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nuevaSesion) => {
      setSesion(nuevaSesion);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const usuarioId = sesion?.user?.id;

  const cargarPerfil = useCallback(async () => {
    if (!usuarioId) return;
    const { data } = await supabase.from("usuarios_directiva").select("*").eq("id", usuarioId).maybeSingle();
    setPerfilConsultado({ id: usuarioId, fila: data && data.activo !== false ? data : null });
  }, [usuarioId]);

  const fetchData = useCallback(async () => {
    const consultas = await Promise.all([
      supabase.from("proyectos").select("*").order("created_at", { ascending: false }),
      supabase.from("compromisos").select("*"),
      supabase.from("historial_etapas").select("*"),
      supabase.from("cierres_evento").select("*"),
      supabase.from("metricas_marketing").select("*").order("periodo", { ascending: true }),
      supabase.from("kpi_umbrales").select("*"),
      supabase.from("usuarios_directiva").select("*").order("nombre", { ascending: true }),
    ]);
    const fallida = consultas.find((c) => c.error);
    setErrorDatos(fallida ? `No se pudieron cargar todos los datos: ${fallida.error.message}` : "");
    const [proyectos, compromisos, historial, cierres, marketing, umbrales, usuarios] = consultas.map((c) => c.data || []);
    setDatos({
      proyectos: proyectos.map((p) => ({
        ...p,
        estado: p.estado_actual,
        fecha: p.fecha_programada ? formatoFechaCorta(p.fecha_programada) : p.fecha,
      })),
      compromisos, historial, cierres, marketing, umbrales, usuarios,
    });
  }, []);

  const recargarTodo = useCallback(async () => {
    await Promise.all([cargarPerfil(), fetchData()]);
  }, [cargarPerfil, fetchData]);

  useEffect(() => {
    if (!usuarioId) return;
    recargarTodo();
  }, [usuarioId, recargarTodo]);

  const tablero = useMemo(
    () => calcularTablero(
      { proyectos: datos.proyectos, compromisos: datos.compromisos, historial: datos.historial, cierres: datos.cierres, marketing: datos.marketing },
      datos.umbrales
    ),
    [datos]
  );

  const perfilListo = perfilConsultado.id === usuarioId;
  const perfil = perfilListo ? perfilConsultado.fila : null;
  const puedeEditar = perfil?.rol === "Editor" || perfil?.rol === "SuperAdmin";
  const actaAbierta = datos.proyectos.find((p) => p.id === actaAbiertaId) || null;
  const semaforoAbierto = tablero.semaforo.find((s) => s.area === semaforoArea) || null;
  const abrirActa = (p) => setActaAbiertaId(p ? p.id : null);
  const placeholders = {
    macro: "Buscar proyectos, actas, cronograma…",
    portafolio: "Buscar por nombre, ID o responsable…",
  };

  if (cargandoSesion || (estaAutenticado && !perfilListo)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-sm text-zinc-500">
        Verificando sesión…
      </div>
    );
  }

  if (!estaAutenticado) {
    return <PantallaLogin />;
  }

  if (!perfil) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-4 text-center">
        <p className="text-sm text-zinc-300">Esta cuenta no tiene un acceso activo en CINERGIA OS.</p>
        <p className="text-xs text-zinc-500">Solicita la habilitación al SuperAdmin de la directiva.</p>
        <button onClick={() => supabase.auth.signOut()} className="rounded-lg border border-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:text-zinc-100">
          Desconectar
        </button>
      </div>
    );
  }

  if (perfil.debe_cambiar_credenciales) {
    return <PantallaPrimerIngreso perfil={perfil} onListo={cargarPerfil} />;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-200 antialiased relative" style={{ backgroundImage: "radial-gradient(#1c1c1f 1px, transparent 1px)", backgroundSize: "28px 28px", backgroundPosition: "-10px -10px" }}>
      <Sidebar vistaActiva={vistaActiva} setVistaActiva={setVistaActiva} />

      <div className="flex flex-1 flex-col overflow-hidden relative z-0">
        <TopBar
          query={query} setQuery={setQuery} placeholder={placeholders[vistaActiva] || "Buscar..."}
          onLogout={() => supabase.auth.signOut()}
          perfil={perfil}
          alertas={tablero.alertas}
          actividad={tablero.auditoria}
          onAbrirConfig={() => setConfigAbierta(true)}
          onAbrirAccesos={() => setAccesosAbiertos(true)}
          onCambiarCredenciales={() => setCredencialesAbiertas(true)}
        />

        <main className="flex-1 overflow-y-auto px-8 py-8">
          {errorDatos && (
            <div className="mb-6 rounded-lg border border-red-900/30 bg-red-500/10 p-3 text-xs text-red-400">{errorDatos}</div>
          )}
          {vistaActiva === "macro" && <VistaPanelMacro tablero={tablero} onVerActa={abrirActa} onAbrirSemaforo={(s) => setSemaforoArea(s.area)} />}
          {vistaActiva === "portafolio" && <VistaPortafolio query={query} onVerActa={abrirActa} onAgregarProyecto={() => setCreandoProyecto(true)} datosProyectos={datos.proyectos} puedeEditar={puedeEditar} />}
          {vistaActiva === "calendario" && <VistaCalendario onVerActa={abrirActa} proyectos={datos.proyectos} />}
          {vistaActiva === "analitica-proyectos" && <VistaAnaliticaProyectos tablero={tablero} />}
          {vistaActiva === "analitica-marketing" && <VistaAnaliticaMarketing tablero={tablero} puedeEditar={puedeEditar} onRegistrarMetricas={() => setMetricasAbiertas(true)} />}
        </main>
      </div>

      <ActaDrawer
        proyecto={actaAbierta}
        onClose={() => setActaAbiertaId(null)}
        compromisos={datos.compromisos}
        historial={datos.historial}
        cierre={actaAbierta ? datos.cierres.find((c) => c.proyecto_id === actaAbierta.id) || null : null}
        puedeEditar={puedeEditar}
        onCambio={fetchData}
        onRegistrarCierre={(p) => setCierreDe(p)}
      />
      <SemaforoDrawer data={semaforoAbierto} onClose={() => setSemaforoArea(null)} />
      <NuevoProyectoModal abierto={creandoProyecto} onClose={() => setCreandoProyecto(false)} onCreado={fetchData} modoEstricto={modoEstricto} />
      <CierreModal
        key={cierreDe ? `cierre-${cierreDe.id}` : "cierre-cerrado"}
        proyecto={cierreDe}
        cierre={cierreDe ? datos.cierres.find((c) => c.proyecto_id === cierreDe.id) || null : null}
        onClose={() => setCierreDe(null)}
        onGuardado={fetchData}
      />
      <MetricasMarketingModal key={metricasAbiertas ? "metricas-abierto" : "metricas-cerrado"} abierto={metricasAbiertas} onClose={() => setMetricasAbiertas(false)} onGuardado={fetchData} registros={datos.marketing} />
      <ModalCredenciales abierto={credencialesAbiertas} perfil={perfil} onClose={() => setCredencialesAbiertas(false)} onListo={cargarPerfil} />

      <ConfiguracionDrawer
        abierto={configAbierta}
        onClose={() => setConfigAbierta(false)}
        proyectos={datos.proyectos}
        onSync={recargarTodo}
        modoEstricto={modoEstricto}
        setModoEstricto={setModoEstricto}
      />
      <AccesosDrawer
        abierto={accesosAbiertos}
        onClose={() => setAccesosAbiertos(false)}
        usuarios={datos.usuarios}
        perfil={perfil}
        onCambio={fetchData}
      />
    </div>
  );
}
