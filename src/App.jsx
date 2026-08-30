import React, { useState, useMemo, useEffect } from "react";
// Asegúrate de que la ruta coincida con tu archivo real
import { supabase } from "./supabaseClient"; 
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

// 5 Áreas a nivel global
const PROYECTOS = [
  { id: "PRJ-015", nombre: "Congreso Cinergia 2026", area: "Eventos", estado: "En Ejecución", fecha: "14 Sep 2026", responsable: "Ana Rodríguez" },
  { id: "PRJ-014", nombre: "Lanzamiento Marca Cinergia", area: "Marketing", estado: "Finalizado", fecha: "02 Ago 2026", responsable: "Diego Torres" },
  { id: "PRJ-013", nombre: "Foro Empresarial Andino", area: "Eventos", estado: "Planificación", fecha: "30 Oct 2026", responsable: "Camila Vidal" },
  { id: "PRJ-012", nombre: "Retiro Directiva Anual", area: "Proyectos", estado: "Finalizado", fecha: "18 Jul 2026", responsable: "Marco Reyes" },
  { id: "PRJ-011", nombre: "Feria de Proyectos Sociales", area: "Proyectos", estado: "En Ejecución", fecha: "05 Sep 2026", responsable: "Luisa Campos" },
  { id: "PRJ-010", nombre: "Cinergia Night Networking", area: "Marketing", estado: "Planificación", fecha: "21 Sep 2026", responsable: "Jorge Salas" },
  { id: "PRJ-009", nombre: "Taller de Liderazgo PE", area: "Proyectos", estado: "Finalizado", fecha: "11 Jun 2026", responsable: "Valentina Ruiz" },
  { id: "PRJ-008", nombre: "Cinergia Summit Norte", area: "Eventos", estado: "En Ejecución", fecha: "28 Sep 2026", responsable: "Renzo Aliaga" },
  { id: "PRJ-007", nombre: "Alianza Estratégica IEEE", area: "Gestión de Oportunidades", estado: "En Ejecución", fecha: "15 Oct 2026", responsable: "Luis Torres" },
  { id: "PRJ-006", nombre: "Auditoría Operativa Q3", area: "Reportes", estado: "Finalizado", fecha: "01 Oct 2026", responsable: "María Gómez" },
];

const AREAS_DISPONIBLES = ["Todas", "Eventos", "Marketing", "Proyectos", "Gestión de Oportunidades", "Reportes"];

const MES_INDEX = {
  Ene: 0, Feb: 1, Mar: 2, Abr: 3, May: 4, Jun: 5,
  Jul: 6, Ago: 7, Sep: 8, Oct: 9, Nov: 10, Dic: 11,
};

function parseFechaProyecto(fecha) {
  if (!fecha) return { day: 1, month: 0, year: 2026 };
  const parts = fecha.split(" ");
  if (parts.length !== 3) return { day: 1, month: 0, year: 2026 };
  return { day: parseInt(parts[0], 10), month: MES_INDEX[parts[1]] || 0, year: parseInt(parts[2], 10) };
}

const PROYECTOS_POR_FECHA = PROYECTOS.map((p) => ({ ...p, ...parseFechaProyecto(p.fecha) }));

/* --- Panel Macro (5 Semáforos) --- */
const SEMAFORO = [
  { 
    area: "Eventos", estado: "Óptimo", detalle: "3 de 3 hitos on-time este trimestre", color: CHART.emerald, text: "text-emerald-400", bg: "rgba(16,185,129,0.14)",
    kpis: [{label: "Cumplimiento Cronograma", value: "98%"}, {label: "Asistencia vs Aforo", value: "85%"}, {label: "Satisfacción", value: "4.6/5.0"}]
  },
  { 
    area: "Marketing", estado: "Atención", detalle: "Retraso leve en 1 entregable de campaña", color: CHART.amber, text: "text-amber-400", bg: "rgba(245,158,11,0.14)",
    kpis: [{label: "Calendario Editorial", value: "82%"}, {label: "Engagement", value: "6.8%"}, {label: "Crecimiento", value: "4.2%"}]
  },
  { 
    area: "Proyectos", estado: "Óptimo", detalle: "Ejecución dentro de cronograma", color: CHART.emerald, text: "text-emerald-400", bg: "rgba(16,185,129,0.14)",
    kpis: [{label: "Hitos en Fecha", value: "92%"}, {label: "Avance Real", value: "88%"}, {label: "Nuevos Proyectos", value: "2"}]
  },
  { 
    area: "Gestión de Oportunidades", estado: "Crítico", detalle: "Falta formalizar convenios institucionales", color: CHART.red, text: "text-red-400", bg: "rgba(239,68,68,0.14)",
    kpis: [{label: "Nuevas Alianzas", value: "0"}, {label: "Reuniones Efectivas", value: "1"}, {label: "Tasa de Respuesta", value: "20%"}]
  },
  { 
    area: "Reportes", estado: "Óptimo", detalle: "Auditoría de datos operativos al día", color: CHART.muted, text: "text-zinc-400", bg: "rgba(113,113,122,0.14)",
    kpis: [{label: "Entregables Externos", value: "100%"}, {label: "Alertas Activas", value: "0"}, {label: "Puntualidad", value: "95%"}]
  }
];

const IMPACTO_ORG = [
  { label: "Personas impactadas (2026)", value: "6,480", suffix: "pax", Icon: Users },
  { label: "Convenios institucionales activos", value: "12", suffix: "", Icon: Building2 },
  { label: "Horas de voluntariado generadas", value: "1,920", suffix: "hrs", Icon: Timer },
  { label: "Proyectos con impacto social directo", value: "5", suffix: "", Icon: Award },
];

const PROYECTO_PRESTIGIO = {
  nombre: "Congreso Cinergia 2026",
  area: "Eventos",
  fecha: "14 Sep 2026",
  responsable: "Ana Rodríguez",
  descripcion:
    "El evento insignia del año: convoca a más de 15 organizaciones aliadas y proyecta el mayor aforo histórico del capítulo PE.",
  metricas: [
    { label: "Aforo proyectado", value: "1,200 pax" },
    { label: "Sponsors confirmados", value: "8" },
    { label: "Avance de planificación", value: "72%" },
  ],
};

/* --- Analítica de Proyectos --- */
const KPI_PROYECTOS = {
  tasaExito: { value: 87, suffix: "%", delta: "+4pp", trend: "up" },
  activos: { value: 5, suffix: "", delta: "+1", trend: "up" },
  tiempoCierre: { value: 18, suffix: " días", delta: "-3 días", trend: "down" },
};

const DISTRIBUCION_POR_AREA = [
  { name: "Eventos", value: PROYECTOS.filter((p) => p.area === "Eventos").length, color: AREA_COLOR.Eventos },
  { name: "Marketing", value: PROYECTOS.filter((p) => p.area === "Marketing").length, color: AREA_COLOR.Marketing },
  { name: "Proyectos", value: PROYECTOS.filter((p) => p.area === "Proyectos").length, color: AREA_COLOR.Proyectos },
  { name: "Gestión de Oportunidades", value: PROYECTOS.filter((p) => p.area === "Gestión de Oportunidades").length, color: AREA_COLOR["Gestión de Oportunidades"] },
  { name: "Reportes", value: PROYECTOS.filter((p) => p.area === "Reportes").length, color: AREA_COLOR.Reportes },
].filter(d => d.value > 0);

const CARGA_LANZAMIENTOS = [
  { mes: "Mar", proyectos: 2 },
  { mes: "Abr", proyectos: 3 },
  { mes: "May", proyectos: 3 },
  { mes: "Jun", proyectos: 5 },
  { mes: "Jul", proyectos: 6 },
  { mes: "Ago", proyectos: 7 },
  { mes: "Sep", proyectos: 9 },
  { mes: "Oct", proyectos: 8 },
];

/* --- Analítica de Marketing --- */
const KPI_MARKETING = {
  engagement: { value: 6.8, suffix: "%", delta: "+1.2pp", trend: "up" },
  seguidores: { value: 1240, suffix: "", delta: "+180", trend: "up" },
  alcance: { value: 42500, suffix: "", delta: "+9,300", trend: "up" },
};

const ALCANCE_POR_EVENTO = [
  { evento: "Retiro Directiva", alcanceK: 5.2 },
  { evento: "Taller Liderazgo", alcanceK: 8.9 },
  { evento: "Lanz. Marca", alcanceK: 15.4 },
  { evento: "Feria Social", alcanceK: 7.1 },
  { evento: "Summit Norte", alcanceK: 6.3 },
];

const ASISTENCIA_POR_EVENTO = [
  { evento: "Retiro Directiva", asistencia: 60 },
  { evento: "Taller Liderazgo", asistencia: 145 },
  { evento: "Lanz. Marca", asistencia: 210 },
  { evento: "Feria Social", asistencia: 380 },
  { evento: "Summit Norte", asistencia: 0 },
];

const AUDIT_LOG = [
  { hora: "09:42", titulo: "Auth de Supabase Activo", detalle: "Sesión de Directiva PE validada correctamente.", Icon: ShieldCheck, color: "text-emerald-500", dot: "bg-emerald-500" },
  { hora: "09:15", titulo: "Sincronización completada", detalle: "Cronograma PE actualizado.", Icon: RefreshCw, color: "text-blue-500", dot: "bg-blue-600" },
  { hora: "08:50", titulo: "Nuevo proyecto registrado", detalle: "PRJ-015 creado por Ana Rodríguez.", Icon: FolderPlus, color: "text-blue-500", dot: "bg-blue-600" },
  { hora: "07:30", titulo: "Backup automático ejecutado", detalle: "Snapshot diario almacenado en frío.", Icon: Database, color: "text-zinc-500", dot: "bg-zinc-600" },
  { hora: "Ayer · 22:10", titulo: "Permisos actualizados", detalle: "Rol Directiva PE con acceso total.", Icon: Settings2, color: "text-amber-500", dot: "bg-amber-500" },
];

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
  if (estado === "En Ejecución") return { text: "text-blue-400", dot: "bg-blue-500", bg: "rgba(37,99,235,0.14)" };
  if (estado === "Finalizado") return { text: "text-emerald-400", dot: "bg-emerald-500", bg: "rgba(16,185,129,0.14)" };
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
/* Drawer / Slide-over "Ver Acta" (PANEL DIVIDIDO: FICHA Y RESUMEN)   */
/* ------------------------------------------------------------------ */

function ActaDrawer({ proyecto, onClose }) {
  const abierto = !!proyecto;

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
        {/* PANEL IZQUIERDO: Ficha de Datos Densa (Tipo Formulario) */}
        {proyecto && (
          <div className="hidden lg:flex flex-1 flex-col justify-center p-8 pointer-events-none overflow-y-auto">
            <div className="max-w-4xl w-full mx-auto pointer-events-auto my-auto">
              
              <div className="rounded-xl border border-zinc-800 p-8 shadow-2xl bg-zinc-950/80 backdrop-blur-xl flex flex-col gap-6">
                
                {/* Título */}
                <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                  <h2 className="text-2xl font-bold text-zinc-100 uppercase tracking-wide">Ficha Técnica Operativa</h2>
                  <p className="font-mono text-xs text-zinc-500">DOC-REF: {proyecto.id}</p>
                </div>

                {/* Sección 1: Datos Generales */}
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
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-400 min-h-[60px]">
                        [Pendiente de extracción de Word: Párrafo de justificación del acta]
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sección 2: Logística y Tiempos */}
                <div>
                  <div className="bg-emerald-900/20 border border-emerald-500/30 px-3 py-1.5 mb-3 rounded">
                    <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Planificación y Recursos</h3>
                  </div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-4 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Fecha de Ejecución</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">{proyecto.fecha}</div>
                    </div>
                    <div className="col-span-4 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Sede / Locación</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">Centro de Convenciones PE</div>
                    </div>
                    <div className="col-span-4 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Staff Requerido</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">12 Voluntarios</div>
                    </div>
                    <div className="col-span-6 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Líder Responsable</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-200">{proyecto.responsable}</div>
                    </div>
                    <div className="col-span-6 flex flex-col">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">Equipo de Apoyo</label>
                      <div className="border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-400 italic">Extrayendo de tabla de asistentes...</div>
                    </div>
                  </div>
                </div>

                {/* Sección 3: Control de Entregables */}
                <div>
                  <div className="bg-amber-900/20 border border-amber-500/30 px-3 py-1.5 mb-3 rounded">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Control de Entregables (KPIs)</h3>
                  </div>
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-8">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">HITO OPERATIVO</label>
                    </div>
                    <div className="col-span-4">
                      <label className="text-[10px] text-zinc-500 uppercase mb-1">ESTADO DE AVANCE</label>
                    </div>
                    
                    <div className="col-span-8 border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-400">
                      Confirmación de aforo final
                    </div>
                    <div className="col-span-4 border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-400 flex items-center justify-center">
                      PENDIENTE
                    </div>
                    
                    <div className="col-span-8 border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-400">
                      Gestión de permisos internos
                    </div>
                    <div className="col-span-4 border border-zinc-800 bg-zinc-900/50 px-3 py-2 rounded text-sm text-zinc-400 flex items-center justify-center">
                      EN PROCESO
                    </div>
                  </div>
                </div>

                {/* Pie de firma / Validación */}
                <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center gap-3">
                  <div className="flex h-5 w-5 items-center justify-center rounded border border-blue-500 bg-blue-500/20">
                    <CheckCircle2 className="h-3 w-3 text-blue-400" />
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-tight">
                    Este documento será validado y autocompletado automáticamente contra el diccionario maestro de Cinergia una vez que el motor de Python procese el archivo .docx de origen.
                  </p>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* PANEL DERECHO: Resumen Compacto (Sin cuadrícula de datos) */}
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
                  onClick={onClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-100 transition-colors focus-visible:outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="mb-6 flex items-center gap-3">
                  <StatusBadge estado={proyecto.estado || "En Evaluación"} />
                </div>

                <div className="mb-6">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-200">
                    <ClipboardList className="h-4 w-4 text-blue-500" /> Resumen del Acta
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-400">
                    Reunión de seguimiento correspondiente al proyecto <strong className="text-zinc-300">{proyecto.nombre}</strong>. Se
                    revisó el avance de los entregables por área, se validaron los compromisos pendientes y se
                    actualizó el cronograma general. La próxima revisión queda sujeta a la disponibilidad de la
                    Directiva PE.
                  </p>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-zinc-200">Compromisos</h3>
                  <ul className="flex flex-col gap-2.5">
                    {[
                      "Confirmar aforo final con el recinto",
                      "Gestión de permisos internos",
                      "Publicar cronograma detallado al equipo",
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-zinc-400">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="border-t border-zinc-800 px-6 py-4 shrink-0">
                <button
                  onClick={onClose}
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
/* NUEVO: Drawer de Creación e Importación de Proyecto                */
/* ------------------------------------------------------------------ */

function NuevoProyectoDrawer({ abierto, onClose }) {
  return (
    <div className={`fixed inset-0 z-50 ${abierto ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!abierto}>
      <div onClick={onClose} className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${abierto ? "opacity-100" : "opacity-0"}`} />

      <div className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-zinc-800 shadow-2xl transition-transform duration-300 ease-out ${abierto ? "translate-x-0" : "translate-x-full"}`} style={{ backgroundColor: PANEL }} role="dialog" aria-modal="true">
        
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 px-6 py-5 shrink-0">
          <div className="min-w-0 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Plus className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="font-mono text-xs text-zinc-500">Gestor Operativo</p>
              <h2 className="mt-0.5 text-lg font-semibold text-zinc-100">Registrar Proyecto</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
          
          <div>
            <h3 className="mb-2 text-sm font-semibold text-zinc-200">Importación de Acta (Parser)</h3>
            <p className="mb-4 text-xs text-zinc-500">Sube el documento Word (.docx) para que el motor de Python extraiga los datos y autocomplete el formulario.</p>
            
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-zinc-800 border-dashed rounded-xl cursor-pointer hover:bg-zinc-900/50 hover:border-blue-500/50 transition-colors bg-zinc-900/20 group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <UploadCloud className="w-8 h-8 mb-3 text-zinc-500 group-hover:text-blue-500 transition-colors" />
                <p className="mb-1 text-sm text-zinc-400"><span className="font-semibold text-zinc-200">Haz clic para subir</span> o arrastra el archivo</p>
                <p className="text-xs text-zinc-500">Solo archivos .docx soportados</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept=".docx" 
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  // 1. Preparamos el paquete
                  const formData = new FormData();
                  formData.append("file", file);

                  try {
                    // 2. Avisamos al usuario
                    alert("Enviando acta al motor de Ingestión...");
                    
                    // 3. Disparamos la petición al servidor Python local
                    const response = await fetch("http://localhost:8000/api/upload-acta", {
                      method: "POST",
                      body: formData,
                    });

                    if (response.ok) {
                      const result = await response.json();
                      alert("✅ ¡Éxito! " + result.message);
                      // Recargamos la página para que React vuelva a consultar Supabase y muestre el nuevo proyecto
                      window.location.reload(); 
                    } else {
                      const errorData = await response.json();
                      alert("❌ Error del servidor: " + errorData.detail);
                    }
                  } catch (error) {
                    alert("❌ Error crítico de conexión. ¿Está encendido el servidor Python (FastAPI)? Detalle: " + error.message);
                  }
                }} 
              />
            </label>
          </div>

          <div className="h-px w-full bg-zinc-800/60" />

          <div>
            <h3 className="mb-4 text-sm font-semibold text-zinc-200">Datos Manuales</h3>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400">Nombre del Proyecto</label>
                <input type="text" placeholder="Ej. Congreso Cinergia 2026..." className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50" />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-400">Área Responsable</label>
                <select className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50">
                  <option value="">Selecciona un área...</option>
                  {AREAS_DISPONIBLES.filter(a => a !== "Todas").map(area => (
                    <option key={area} value={area}>{area}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400">Responsable</label>
                  <input type="text" placeholder="Nombre completo" className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-zinc-400">Fecha Estimada</label>
                  <input type="date" className="w-full rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50" />
                </div>
              </div>
            </div>
          </div>

        </div>

        <div className="border-t border-zinc-800 px-6 py-4 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-zinc-800 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-900 transition-colors">
            Cancelar
          </button>
          <button className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20 transition-colors">
            Guardar Proyecto
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

  const evolucion = useMemo(() => {
    if (!data) return [];
    const base = data.estado === "Óptimo" ? 80 : data.estado === "Atención" ? 60 : 30;
    return [
      { semana: "Sem 1", valor: Math.max(10, Math.round(base - 10 + Math.random() * 8)) },
      { semana: "Sem 2", valor: Math.max(15, Math.round(base - 5 + Math.random() * 10)) },
      { semana: "Sem 3", valor: Math.max(20, Math.round(base + Math.random() * 8)) },
      { semana: "Sem 4", valor: data.estado === "Óptimo" ? 95 : data.estado === "Atención" ? 75 : 45 },
    ];
  }, [data]);

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
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-zinc-800 p-3">
                        <span className="text-sm text-zinc-400">{kpi.label}</span>
                        <span className="font-mono text-sm font-medium text-zinc-200">{kpi.value}</span>
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
              <p className="text-zinc-400 mb-8 text-lg">Análisis de la tendencia a 4 semanas que justifica la decisión del semáforo.</p>
              
              <div className="h-[450px] w-full rounded-2xl border border-white/10 p-8 shadow-2xl bg-zinc-950/50 backdrop-blur-md">
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
                      name="Nivel de Cumplimiento" 
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

function TopBar({ query, setQuery, placeholder }) {
  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
          <button
            onClick={() => setQuery("")}
            className="shrink-0 font-mono text-xs text-zinc-600 transition-colors hover:text-zinc-300"
          >
            ✕
          </button>
        ) : (
          <kbd className="hidden shrink-0 rounded border border-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-600 sm:inline-block">
            ⌘K
          </kbd>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-4">
        <div className="relative">
          <button 
            onClick={() => setShowNotif(!showNotif)}
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800/60 text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-100"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>

          {showNotif && (
            <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-zinc-800 shadow-2xl z-50 p-4" style={{ backgroundColor: PANEL }}>
              <h3 className="mb-3 text-sm font-semibold text-zinc-200">Alertas Recientes</h3>
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  <p className="text-xs text-zinc-400"><strong className="text-zinc-200">Logística:</strong> Aforo por confirmar para Congreso Cinergia 2026.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                  <p className="text-xs text-zinc-400"><strong className="text-zinc-200">Marketing:</strong> Retraso leve en entregable de campaña publicitaria.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-zinc-800/60" />

        <div className="relative">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-900/50"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-emerald-500">
              <span className="font-mono text-xs font-bold text-white">PE</span>
            </div>
            <div className="hidden text-left sm:block">
              <p className="text-sm font-medium leading-tight text-zinc-200">Directiva PE</p>
              <p className="text-xs leading-tight text-zinc-500">Sesión activa</p>
            </div>
            <ChevronDown className={`hidden h-3.5 w-3.5 text-zinc-600 sm:block transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-zinc-800 shadow-2xl z-50 p-2" style={{ backgroundColor: PANEL }}>
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100">
                <Settings2 className="h-4 w-4" /> Configuración OS
              </button>
              <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-800/50 hover:text-zinc-100">
                <ShieldCheck className="h-4 w-4" /> Accesos de Área
              </button>
            </div>
          )}
        </div>

        <button 
          onClick={() => alert("Cerrando conexión segura con Cinergia OS...")}
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

function VistaPanelMacro({ onVerActa, onAbrirSemaforo }) {
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
          
          <h4 className="text-2xl font-bold text-zinc-100">{PROYECTO_PRESTIGIO.nombre}</h4>
          
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-400 border border-blue-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              {PROYECTO_PRESTIGIO.area}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5 text-zinc-500" />
              <span className="font-mono">{PROYECTO_PRESTIGIO.fecha}</span>
            </span>
            <span className="text-zinc-700">•</span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-zinc-500" />
              {PROYECTO_PRESTIGIO.responsable}
            </span>
          </div>
          
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            {PROYECTO_PRESTIGIO.descripcion}
          </p>
        </div>

        <div className="w-full lg:w-auto flex flex-col gap-4 border-t lg:border-t-0 lg:border-l border-zinc-800 pt-5 lg:pt-0 lg:pl-8">
          {PROYECTO_PRESTIGIO.metricas.map((m) => (
            <div key={m.label} className="flex flex-col">
              <span className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">{m.label}</span>
              <span className="font-mono text-xl font-semibold text-zinc-200">{m.value}</span>
            </div>
          ))}
          
          <button 
            onClick={() => onVerActa({
              ...PROYECTO_PRESTIGIO,
              id: "PRJ-015",
              estado: "En Ejecución"
            })}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            <FileText className="h-3.5 w-3.5" />
            Ver Detalle Operativo
          </button>
        </div>
      </div>

      <h3 className="mb-4 text-sm font-semibold text-zinc-200">Semáforo de Rendimiento</h3>
      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {SEMAFORO.map((s) => (
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

      <div>
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">Impacto Organizacional (2026)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {IMPACTO_ORG.map((m) => (
            <div key={m.label} className="rounded-xl border border-zinc-800 p-4" style={{ backgroundColor: PANEL }}>
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800" style={{ backgroundColor: "rgba(16,185,129,0.08)" }}>
                <m.Icon className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl font-semibold text-zinc-100">{m.value}</span>
                {m.suffix && <span className="font-mono text-xs text-zinc-500">{m.suffix}</span>}
              </div>
              <p className="mt-1 text-xs leading-snug text-zinc-500">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista 2 · Portafolio Operativo ACTUALIZADO PARA RECIBIR BASE DE DATOS */
/* ------------------------------------------------------------------ */

function VistaPortafolio({ query, setQuery, onVerActa, onAgregarProyecto, datosProyectos }) {
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

        <button 
          onClick={onAgregarProyecto}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 shadow-lg shadow-blue-500/20"
        >
          <Plus className="h-4 w-4" />
          Agregar Proyecto
        </button>
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

function VistaCalendario({ onVerActa }) {
  const [cursor, setCursor] = useState({ year: 2026, month: 8 });

  const celdas = useMemo(() => {
    const { year, month } = cursor;
    const primerDia = new Date(year, month, 1);
    const offset = (primerDia.getDay() + 6) % 7;
    const diasEnMes = new Date(year, month + 1, 0).getDate();

    const celdasArr = [];
    for (let i = 0; i < offset; i++) celdasArr.push(null);
    for (let d = 1; d <= diasEnMes; d++) {
      const proyectosDelDia = PROYECTOS_POR_FECHA.filter(
        (p) => p.year === year && p.month === month && p.day === d
      );
      celdasArr.push({ day: d, proyectos: proyectosDelDia });
    }
    while (celdasArr.length % 7 !== 0) celdasArr.push(null);
    return celdasArr;
  }, [cursor]);

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
              onClick={() => setCursor({ year: 2026, month: 8 })}
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

function VistaAnaliticaProyectos() {
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

  const distribucionAnalitica = DISTRIBUCION_POR_AREA.filter((d) => 
    ["Eventos", "Marketing", "Proyectos"].includes(d.name)
  );

  const colorActivo = areaSeleccionada === "Todas" ? CHART.emerald : (AREA_COLOR[areaSeleccionada] || CHART.emerald);

  return (
    <div>
      <SectionHeader
        eyebrow="Módulo / Analítica"
        title="Analítica de Proyectos"
        subtitle="Indicadores de ejecución del núcleo operativo (Eventos, Marketing, Proyectos)."
      />

      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard Icon={CheckCircle2} label="Tasa de Éxito" value={KPI_PROYECTOS.tasaExito.value} suffix={KPI_PROYECTOS.tasaExito.suffix} delta={KPI_PROYECTOS.tasaExito.delta} trend={KPI_PROYECTOS.tasaExito.trend} />
        <KpiCard Icon={Zap} label="Proyectos Activos" value={KPI_PROYECTOS.activos.value} suffix={KPI_PROYECTOS.activos.suffix} delta={KPI_PROYECTOS.activos.delta} trend={KPI_PROYECTOS.activos.trend} />
        <KpiCard Icon={Timer} label="Tiempo de Cierre" value={KPI_PROYECTOS.tiempoCierre.value} suffix={KPI_PROYECTOS.tiempoCierre.suffix} delta={KPI_PROYECTOS.tiempoCierre.delta} trend={KPI_PROYECTOS.tiempoCierre.trend} />
        <KpiCard Icon={Layers} label="Total de Proyectos" value={PROYECTOS.length} suffix="" delta="+8" trend="up" />
      </div>

      <div className="mb-5 rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
        <h3 className="mb-1 text-sm font-semibold text-zinc-200">Carga de Lanzamientos / Flujo</h3>
        <p className="mb-4 text-xs text-zinc-500">Proyectos activos acumulados mes a mes durante 2026</p>
        <div style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={CARGA_LANZAMIENTOS} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
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
          {AUDIT_LOG.map((log, i) => (
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
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Vista 5 · Analítica de Marketing                                   */
/* ------------------------------------------------------------------ */

function VistaAnaliticaMarketing() {
  return (
    <div>
      <SectionHeader
        eyebrow="Módulo / Analítica"
        title="Analítica de Marketing"
        subtitle="Desempeño de la marca Cinergia en redes y comparación entre alcance digital y asistencia real a eventos."
      />

      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard Icon={Zap} label="Engagement Rate" value={KPI_MARKETING.engagement.value} suffix={KPI_MARKETING.engagement.suffix} delta={KPI_MARKETING.engagement.delta} trend={KPI_MARKETING.engagement.trend} />
        <KpiCard Icon={TrendingUp} label="Crecimiento de Seguidores" value={KPI_MARKETING.seguidores.value.toLocaleString("es-PE")} delta={KPI_MARKETING.seguidores.delta} trend={KPI_MARKETING.seguidores.trend} />
        <KpiCard Icon={Users} label="Alcance Mensual" value={KPI_MARKETING.alcance.value.toLocaleString("es-PE")} delta={KPI_MARKETING.alcance.delta} trend={KPI_MARKETING.alcance.trend} />
        <KpiCard Icon={Megaphone} label="Eventos Promocionados" value={ALCANCE_POR_EVENTO.length} suffix="" delta="+1" trend="up" />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 p-5" style={{ backgroundColor: PANEL }}>
          <h3 className="mb-1 text-sm font-semibold text-zinc-200">Alcance Digital por Evento</h3>
          <p className="mb-4 text-xs text-zinc-500">Alcance en redes sociales, en miles de personas</p>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ALCANCE_POR_EVENTO} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
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
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ASISTENCIA_POR_EVENTO} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="evento" stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={56} />
                <YAxis stroke={CHART.grid} tick={{ fill: CHART.text, fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip unit=" pax" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="asistencia" name="Asistencia" fill={CHART.emerald} radius={[6, 6, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            El <span className="text-amber-400">Summit Norte</span> aún no registra asistencia — evento próximo a ejecutarse.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* App PRINCIPAL: EL CEREBRO DE LA OPERACIÓN                          */
/* ------------------------------------------------------------------ */

export default function CinergiaOS() {
  const [vistaActiva, setVistaActiva] = useState("macro");
  const [query, setQuery] = useState("");
  const [actaAbierta, setActaAbierta] = useState(null);
  const [semaforoAbierto, setSemaforoAbierto] = useState(null);
  const [creandoProyecto, setCreandoProyecto] = useState(false);
  
  // ESTADO PARA LA BASE DE DATOS REAL
  const [proyectosDB, setProyectosDB] = useState([]);
  const [cargando, setCargando] = useState(true);

  // FETCH A SUPABASE
  useEffect(() => {
    async function fetchProyectos() {
      try {
        const { data, error } = await supabase
          .from('proyectos')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        if (data) {
          const proyectosFormateados = data.map(p => ({
            id: p.id,
            nombre: p.nombre,
            area: p.area,
            estado: p.estado_actual,
            fecha: "10 Oct 2026", // Sustituir luego por cálculo temporal real
            responsable: p.responsable,
            sede: p.sede,
            staff_requerido: p.staff_requerido
          }));
          setProyectosDB(proyectosFormateados);
        }
      } catch (error) {
        console.error("Error al cargar proyectos:", error.message);
      } finally {
        setCargando(false);
      }
    }

    fetchProyectos();
  }, []);

  const placeholders = {
    macro: "Buscar en el panel macro…",
    portafolio: "Buscar proyectos, actas, responsables…",
    calendario: "Buscar en el cronograma…",
    "analitica-proyectos": "Buscar métricas de proyectos…",
    "analitica-marketing": "Buscar métricas de marketing…",
  };

  // Si la BD está vacía, usamos el cascarón falso para que no se vea feo. 
  // Si tiene datos, usamos la BD real.
  const datosParaMostrar = proyectosDB.length > 0 ? proyectosDB : PROYECTOS;

  return (
    <div 
      className="flex h-screen w-full overflow-hidden bg-zinc-950 text-zinc-200 antialiased relative"
      style={{
        backgroundImage: "radial-gradient(#1c1c1f 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        backgroundPosition: "-10px -10px",
      }}
    >
      <Sidebar vistaActiva={vistaActiva} setVistaActiva={setVistaActiva} />

      <div className="flex flex-1 flex-col overflow-hidden relative z-0">
        <TopBar query={query} setQuery={setQuery} placeholder={placeholders[vistaActiva]} />

        <main className="flex-1 overflow-y-auto px-8 py-8">
          {vistaActiva === "macro" && <VistaPanelMacro onVerActa={setActaAbierta} onAbrirSemaforo={setSemaforoAbierto} />}
          
          {/* AQUÍ INYECTAMOS LOS DATOS AL HIJO */}
          {vistaActiva === "portafolio" && (
            <VistaPortafolio 
              query={query} 
              setQuery={setQuery} 
              onVerActa={setActaAbierta} 
              onAgregarProyecto={() => setCreandoProyecto(true)} 
              datosProyectos={datosParaMostrar} 
            />
          )}
          
          {vistaActiva === "calendario" && <VistaCalendario onVerActa={setActaAbierta} />}
          {vistaActiva === "analitica-proyectos" && <VistaAnaliticaProyectos />}
          {vistaActiva === "analitica-marketing" && <VistaAnaliticaMarketing />}
        </main>
      </div>

      <ActaDrawer proyecto={actaAbierta} onClose={() => setActaAbierta(null)} />
      <SemaforoDrawer data={semaforoAbierto} onClose={() => setSemaforoAbierto(null)} />
      <NuevoProyectoDrawer abierto={creandoProyecto} onClose={() => setCreandoProyecto(false)} />
    </div>
  );
}