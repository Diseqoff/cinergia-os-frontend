import { useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, RefreshCw, Plug, Megaphone } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, ComposedChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine,
} from "recharts";
import { sincronizarInstagram } from "./api";
import { PANEL, CHART } from "./tokens";
import { SectionHeader } from "./ui";
import { aFecha } from "./kpis";
import {
  vistaMarketing, sumarEventos, fmt, fmt0, fechaLarga, NOMBRE_NIVEL, FUENTES_DIFUSION,
} from "./marketingDatos";

const COLOR_NIVEL = { verde: CHART.emerald, amarillo: CHART.amber, rojo: CHART.red };
const TEXTO_NIVEL = { verde: "text-emerald-400", amarillo: "text-amber-400", rojo: "text-red-400" };
const PILDORA = {
  verde: "border-emerald-500/35 bg-emerald-500/10 text-emerald-400",
  amarillo: "border-amber-500/35 bg-amber-500/10 text-amber-400",
  rojo: "border-red-500/35 bg-red-500/10 text-red-400",
  gris: "border-zinc-800 bg-white/[0.02] text-zinc-400",
};
const PUNTO_PILDORA = { verde: "bg-emerald-500", amarillo: "bg-amber-500", rojo: "bg-red-500", gris: "bg-zinc-500" };
const LUZ = {
  verde: "bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.55)]",
  amarillo: "bg-amber-500 shadow-[0_0_14px_rgba(245,158,11,0.55)]",
  rojo: "bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.55)]",
  gris: "bg-zinc-600",
};
const EJE = { fill: CHART.text, fontSize: 12 };
const CUADRICULA = { stroke: CHART.grid, strokeDasharray: "3 3" };

/* ------------------------------------------------------------------ */
/* Piezas pequeñas                                                    */
/* ------------------------------------------------------------------ */

function Tarjeta({ children, className = "", ...resto }) {
  return (
    <div className={`min-w-0 rounded-[14px] border border-zinc-800 p-6 ${className}`} style={{ backgroundColor: PANEL }} {...resto}>
      {children}
    </div>
  );
}

function Seccion({ titulo, descripcion, children }) {
  return (
    <section className="mt-16">
      <div className="mb-5">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-100">{titulo}</h2>
        {descripcion && <p className="mt-1.5 max-w-3xl text-[13px] leading-relaxed text-zinc-500">{descripcion}</p>}
      </div>
      {children}
    </section>
  );
}

function Pildora({ clave, children }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11.5px] ${PILDORA[clave]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${PUNTO_PILDORA[clave]}`} />
      {children}
    </span>
  );
}

function Segmento({ opciones, valor, onCambio }) {
  return (
    <div className="inline-flex gap-0.5 rounded-[9px] border border-zinc-800 p-[3px]">
      {opciones.map((o) => (
        <button
          key={o.valor}
          onClick={() => onCambio(o.valor)}
          className={`rounded-md px-3 py-1.5 text-xs transition-colors ${valor === o.valor ? "bg-[#1f1f23] text-zinc-100" : "text-zinc-400 hover:text-zinc-200"}`}
        >
          {o.etiqueta}
          {o.cuenta != null && <span className="ml-1.5 text-[11px] text-zinc-500">{o.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

function Selector({ valor, onCambio, opciones, ancho = "min-w-[320px]", pequeno = false }) {
  return (
    <div className={`relative inline-block max-w-full ${pequeno ? "" : ancho}`}>
      <select
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className={`w-full cursor-pointer appearance-none border border-zinc-700 text-zinc-100 outline-none focus:ring-2 focus:ring-blue-600/50 ${pequeno ? "rounded-lg py-1.5 pl-2.5 pr-8 text-xs" : "rounded-[10px] py-2.5 pl-3.5 pr-10 text-[13.5px]"}`}
        style={{ backgroundColor: PANEL }}
      >
        {opciones.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
      </select>
      <ChevronDown className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-zinc-400 ${pequeno ? "right-2.5 h-3.5 w-3.5" : "right-3.5 h-4 w-4"}`} />
    </div>
  );
}

function Leyenda({ items }) {
  return (
    <div className="mb-3.5 flex flex-wrap gap-4 text-xs text-zinc-500">
      {items.map(([color, texto]) => (
        <span key={texto} className="flex items-center gap-2">
          <span className="h-[9px] w-[9px] rounded-sm" style={{ backgroundColor: color }} />
          {texto}
        </span>
      ))}
    </div>
  );
}

function Vacio({ children }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-7 text-center text-[12.5px] leading-relaxed text-zinc-500">
      {children}
    </div>
  );
}

function TooltipMk({ active, payload, label, formato }) {
  if (!active || !payload || !payload.length) return null;
  const lineas = formato ? formato(payload, label) : payload.map((p) => `${p.name}: ${p.value}`);
  return (
    <div className="rounded-lg border border-zinc-800 px-3 py-2 text-xs shadow-xl" style={{ backgroundColor: PANEL }}>
      {label != null && label !== "" && <p className="mb-1 font-mono text-zinc-500">{label}</p>}
      {lineas.map((l, i) => <p key={i} className={i === 0 ? "font-medium text-zinc-200" : "text-zinc-400"}>{l}</p>)}
    </div>
  );
}

const textoValor = (k, v) => `${fmt(v, k.decimales)}${k.unidad ? ` ${k.unidad}` : ""}`;

/* ------------------------------------------------------------------ */
/* Cabecera y estado de la conexión                                   */
/* ------------------------------------------------------------------ */

function haceCuanto(valor) {
  const d = aFecha(valor);
  if (!d) return "todavía ninguna";
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  return `hace ${dias} ${dias === 1 ? "día" : "días"}`;
}

function BarraAcciones({ conexion, puedeEditar, esSuperadmin, onActualizar, actualizando, mensaje, onPublicacion, onMetricas, onInstagram }) {
  const conectada = !!conexion?.conectada;
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800/50 pb-5">
      <div className="flex items-center gap-2.5 text-xs text-zinc-400">
        <span className={`h-2 w-2 rounded-full ${conectada ? "bg-emerald-500" : "bg-zinc-600"}`} />
        {conectada
          ? <span>Instagram conectado como <span className="text-zinc-200">@{conexion.usuario}</span>. Actualizado {haceCuanto(conexion.ultima_sincronizacion)}.</span>
          : <span>Instagram sin conectar. Los datos de redes se cargan a mano.</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {esSuperadmin && (
          <button onClick={onInstagram} className="flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
            <Plug className="h-4 w-4" /> {conectada ? "Conexión" : "Conectar Instagram"}
          </button>
        )}
        {puedeEditar && conectada && (
          <button onClick={onActualizar} disabled={actualizando} className="flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${actualizando ? "animate-spin" : ""}`} /> {actualizando ? "Actualizando…" : "Actualizar ahora"}
          </button>
        )}
        {puedeEditar && (
          <button onClick={onMetricas} className="flex items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-100">
            <Megaphone className="h-4 w-4" /> Métricas del mes
          </button>
        )}
        {puedeEditar && (
          <button onClick={() => onPublicacion(null)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-500/20 transition-colors hover:bg-blue-500">
            <Plus className="h-4 w-4" /> Registrar publicación
          </button>
        )}
      </div>
      {mensaje && (
        <p className={`w-full text-xs ${mensaje.tipo === "error" ? "text-red-400" : "text-emerald-400"}`}>{mensaje.texto}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1 · Semáforo                                                       */
/* ------------------------------------------------------------------ */

function TarjetaKpi({ k, seleccionado, onElegir }) {
  const nivel = k.nivel || "gris";
  return (
    <button
      onClick={() => onElegir(k.id)}
      className={`relative min-w-0 rounded-[14px] border p-5 text-left transition-all hover:-translate-y-px hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${seleccionado ? "border-blue-600/80 shadow-[0_0_0_1px_rgba(37,99,235,0.35),0_10px_30px_rgba(37,99,235,0.12)]" : "border-zinc-800"}`}
      style={{ backgroundColor: PANEL }}
    >
      <p className="min-h-8 pr-6 text-[11px] font-medium uppercase leading-snug tracking-wide text-zinc-500">
        {k.nombre}
        {k.principal && <span className="ml-1.5 rounded-full border border-blue-400/40 px-1.5 py-px align-[1px] text-[9px] tracking-widest text-blue-400">PRINCIPAL</span>}
      </p>
      <span className={`absolute right-5 top-5 h-3 w-3 rounded-full ${LUZ[nivel]}`} />
      <p className="mt-3 font-mono text-[30px] font-semibold tabular-nums text-zinc-100">
        {k.actual == null ? <span className="text-xl text-zinc-500">Sin datos</span> : (
          <>{fmt(k.actual, k.decimales)}<span className="ml-0.5 text-[15px] font-medium text-zinc-400">{k.unidad}</span></>
        )}
      </p>
      <div className="mt-3 flex justify-between gap-2 text-[11.5px] text-zinc-500">
        <span>Verde desde {fmt(k.verde, k.decimales)} {k.unidad}{k.mesDelDato ? `. Dato de ${k.mesDelDato}` : ""}</span>
        <span className={`font-semibold ${k.nivel ? TEXTO_NIVEL[k.nivel] : "text-zinc-500"}`}>{k.nivel ? NOMBRE_NIVEL[k.nivel] : ""}</span>
      </div>
    </button>
  );
}

function Semaforo({ vista, kpiSel, onElegir }) {
  const p = vista.principal;
  const nivel = p.nivel || "gris";
  return (
    <>
      <Tarjeta className="flex flex-wrap items-center gap-6 !px-7 !py-6">
        <span className={`h-16 w-16 shrink-0 rounded-full ${LUZ[nivel]}`} />
        <div className="min-w-0 flex-1 basis-80">
          <p className="mb-1 text-[11px] uppercase tracking-widest text-zinc-500">Estado general del área</p>
          <p className={`text-[22px] font-semibold ${p.nivel ? TEXTO_NIVEL[p.nivel] : "text-zinc-400"}`}>{p.nivel ? NOMBRE_NIVEL[p.nivel] : "Sin datos"}</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">
            {p.actual == null
              ? `El color del área lo marca el KPI principal, ${p.nombre.toLowerCase()}. Todavía no hay registros para calcularlo.`
              : `El color del área lo marca el KPI principal, ${p.nombre.toLowerCase()}, que va en ${fmt(p.actual, p.decimales)} ${p.unidad} contra una meta de ${fmt(p.verde, p.decimales)} ${p.unidad}.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-zinc-400">
          {[["rojo", "Malo"], ["amarillo", "Normal"], ["verde", "Bueno"]].map(([c, t]) => (
            <span key={c} className="flex items-center gap-2"><i className="h-[9px] w-[9px] rounded-full" style={{ backgroundColor: COLOR_NIVEL[c] }} />{t}</span>
          ))}
        </div>
      </Tarjeta>

      <Grupo titulo="Entregas y cobertura">
        <div className="grid grid-cols-1 gap-[18px] min-[520px]:grid-cols-2 lg:grid-cols-4">
          {vista.kpis.filter((k) => k.grupo === "entregas").map((k) => <TarjetaKpi key={k.id} k={k} seleccionado={k.id === kpiSel} onElegir={onElegir} />)}
        </div>
      </Grupo>
      <Grupo titulo="Audiencia">
        <div className="grid grid-cols-1 gap-[18px] lg:grid-cols-3">
          {vista.kpis.filter((k) => k.grupo === "audiencia").map((k) => <TarjetaKpi key={k.id} k={k} seleccionado={k.id === kpiSel} onElegir={onElegir} />)}
        </div>
      </Grupo>
    </>
  );
}

function Grupo({ titulo, children }) {
  return (
    <div className="mt-8">
      <h4 className="mb-3.5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {titulo}
        <span className="h-px flex-1 bg-zinc-800/50" />
      </h4>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2 · Evolución del KPI                                              */
/* ------------------------------------------------------------------ */

function PuntoSemaforo({ cx, cy, payload }) {
  if (payload?.valor == null || cx == null || cy == null) return <g />;
  return <circle cx={cx} cy={cy} r={7} fill={COLOR_NIVEL[payload.nivel] || CHART.muted} stroke={PANEL} strokeWidth={3} />;
}

function EvolucionKpi({ kpis, kpiSel, onElegir, anclaRef }) {
  const k = kpis.find((x) => x.id === kpiSel);
  const [min, max] = k.rango;
  const etiquetaZona = (texto, color) => ({ value: texto, position: "insideTopRight", fill: color, fontSize: 11 });
  const hayDatos = k.puntos.some((p) => p.valor != null);
  return (
    <Tarjeta>
      <div ref={anclaRef} className="mb-5 flex flex-wrap gap-2">
        {kpis.map((x) => (
          <button
            key={x.id}
            onClick={() => onElegir(x.id, false)}
            className={`rounded-full border px-3.5 py-1.5 text-xs transition-all ${x.id === kpiSel ? "border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-600/25" : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"}`}
          >
            {x.nombre}
          </button>
        ))}
      </div>
      <div className="mb-1.5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">{k.nombre}</h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500">
            Evolución mensual. Verde desde {fmt(k.verde, k.decimales)} {k.unidad}, amarillo desde {fmt(k.amarillo, k.decimales)} {k.unidad}.
          </p>
        </div>
        {k.nivel
          ? <Pildora clave={k.nivel}>{NOMBRE_NIVEL[k.nivel]}{k.mesDelDato ? ` en ${k.mesDelDato}` : " este mes"}, {textoValor(k, k.actual)}</Pildora>
          : <Pildora clave="gris">Sin datos</Pildora>}
      </div>
      <div className="relative mt-3" style={{ height: 400 }}>
        {!hayDatos && <Vacio>Todavía no hay registros para calcular este KPI.</Vacio>}
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={k.puntos} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
            <ReferenceArea y1={min} y2={k.amarillo} fill={CHART.red} fillOpacity={0.09} stroke="none" ifOverflow="hidden" label={etiquetaZona("Malo", "rgba(239,68,68,0.75)")} />
            <ReferenceArea y1={k.amarillo} y2={k.verde} fill={CHART.amber} fillOpacity={0.09} stroke="none" ifOverflow="hidden" label={etiquetaZona("Normal", "rgba(245,158,11,0.75)")} />
            <ReferenceArea y1={k.verde} y2={max} fill={CHART.emerald} fillOpacity={0.09} stroke="none" ifOverflow="hidden" label={etiquetaZona("Bueno", "rgba(16,185,129,0.75)")} />
            <CartesianGrid {...CUADRICULA} vertical={false} />
            <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} />
            <YAxis domain={[min, max]} tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => `${v}${k.unidad ? ` ${k.unidad}` : ""}`} width={k.unidad ? 56 : 40} />
            <Tooltip
              cursor={{ stroke: CHART.grid }}
              content={<TooltipMk formato={(pl) => {
                const d = pl[0].payload;
                return d.valor == null ? ["Sin datos"] : [textoValor(k, d.valor), `${NOMBRE_NIVEL[d.nivel]}, meta verde ${textoValor(k, k.verde)}`];
              }} />}
            />
            <Line type="monotone" dataKey="valor" stroke="#e4e4e7" strokeWidth={2} dot={<PuntoSemaforo />} activeDot={<PuntoSemaforo />} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* 3 · Pedidos                                                        */
/* ------------------------------------------------------------------ */

function Pedidos({ pedidos }) {
  const [tab, setTab] = useState("atender");
  const lista = tab === "atender" ? pedidos.porAtender : pedidos.completadas;
  return (
    <Tarjeta>
      <div className="mb-3.5">
        <Segmento
          valor={tab}
          onCambio={setTab}
          opciones={[
            { valor: "atender", etiqueta: "Por atender", cuenta: pedidos.porAtender.length },
            { valor: "listas", etiqueta: "Completadas", cuenta: pedidos.completadas.length },
          ]}
        />
      </div>
      <div className="max-h-[300px] overflow-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              {["Evento", "Pieza pedida por el acta", "Fecha límite", "Entregada", "Estado"].map((t) => (
                <th key={t} className="sticky top-0 z-[1] border-b border-zinc-800 px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-widest text-zinc-500" style={{ backgroundColor: PANEL }}>{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/50 last:border-0">
                <td className="px-3 py-3.5 text-zinc-200">{p.evento}</td>
                <td className="px-3 py-3.5 text-zinc-400">{p.pieza}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-zinc-400">{fechaLarga(p.limite)}</td>
                <td className="whitespace-nowrap px-3 py-3.5 text-zinc-400">{p.entregada ? fechaLarga(p.entregada) : "Pendiente"}</td>
                <td className="px-3 py-3.5"><Pildora clave={p.estado.clave}>{p.estado.texto}</Pildora></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.length === 0 && (
          <p className="px-3 py-8 text-center text-[12.5px] text-zinc-500">
            {tab === "atender" ? "No hay piezas pendientes." : "Todavía no hay piezas entregadas."}
          </p>
        )}
      </div>
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* 4 · Rendimiento en redes                                           */
/* ------------------------------------------------------------------ */

function Redes({ vista }) {
  const seg = vista.seguidores;
  const valores = seg.puntos.map((p) => p.valor).filter((v) => v != null);
  const techo = Math.max(seg.verde * 1.2, ...valores.map((v) => v * 1.2));
  const hayCalendario = vista.calendario.some((c) => c.planificadas != null || c.realizadas != null);
  return (
    <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
      <Tarjeta>
        <h3 className="mb-1 text-[15px] font-semibold text-zinc-200">Calendario editorial</h3>
        <p className="mb-4 text-[12.5px] leading-relaxed text-zinc-500">Publicaciones planificadas contra publicaciones realizadas por mes.</p>
        <Leyenda items={[[CHART.blueSoft, "Planificadas"], [CHART.emerald, "Realizadas"]]} />
        <div className="relative" style={{ height: 300 }}>
          {!hayCalendario && <Vacio>Todavía no hay publicaciones planificadas ni realizadas en estos meses.</Vacio>}
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={vista.calendario} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid {...CUADRICULA} vertical={false} />
              <XAxis dataKey="mes" tick={EJE} tickLine={false} axisLine={false} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<TooltipMk formato={(pl) => pl.map((p) => `${p.name}: ${p.value ?? 0}`)} />} />
              <Bar dataKey="planificadas" name="Planificadas" fill={CHART.blueSoft} radius={[6, 6, 0, 0]} barSize={16} />
              <Bar dataKey="realizadas" name="Realizadas" fill={CHART.emerald} radius={[6, 6, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h3 className="mb-1 text-[15px] font-semibold text-zinc-200">Crecimiento de seguidores</h3>
        <p className="mb-4 text-[12.5px] leading-relaxed text-zinc-500">Crecimiento mensual en porcentaje. Las líneas punteadas son las metas del semáforo.</p>
        <Leyenda items={[[CHART.emerald, "Meta verde"], [CHART.amber, "Meta amarilla"]]} />
        <div className="relative" style={{ height: 300 }}>
          {valores.length === 0 && <Vacio>Se calcula con los seguidores de dos meses seguidos.</Vacio>}
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={seg.puntos} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid {...CUADRICULA} vertical={false} />
              <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} />
              <YAxis domain={[0, Math.ceil(techo)]} tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} tickFormatter={(v) => `${v} %`} />
              {valores.length > 0 && <ReferenceLine y={seg.verde} stroke={CHART.emerald} strokeDasharray="5 5" strokeWidth={1.5} ifOverflow="extendDomain" />}
              {valores.length > 0 && <ReferenceLine y={seg.amarillo} stroke={CHART.amber} strokeDasharray="5 5" strokeWidth={1.5} ifOverflow="extendDomain" />}
              <Tooltip cursor={{ stroke: CHART.grid }} content={<TooltipMk formato={(pl) => [pl[0].value == null ? "Sin datos" : `${fmt(pl[0].value)} %`]} />} />
              <Line type="monotone" dataKey="valor" name="Crecimiento" stroke={CHART.blue} strokeWidth={2} dot={{ r: 4, fill: CHART.blue, stroke: CHART.blue }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5 · Qué contenido funciona                                         */
/* ------------------------------------------------------------------ */

function nivelEng(eng, u) {
  return eng >= u.verde ? "verde" : eng >= u.amarillo ? "amarillo" : "rojo";
}

function Contenido({ contenido, puedeEditar, onEditar }) {
  const [modo, setModo] = useState("post");
  const [tab, setTab] = useState("mejores");
  const [cantidad, setCantidad] = useState("5");
  const u = contenido.umbralEng;
  const { posts, porFormato, resumen, etiquetaMes } = contenido;
  const conEng = posts.filter((p) => p.eng != null);
  const sinMetricas = posts.length - conEng.length;

  const ordenadasGrafica = useMemo(() => [...conEng].sort((a, b) => b.eng - a.eng), [conEng]);
  const ordenTabla = useMemo(
    () => [...conEng].sort((a, b) => (tab === "mejores" ? b.eng - a.eng : a.eng - b.eng)).slice(0, Number(cantidad)),
    [conEng, tab, cantidad],
  );
  const maxEje = Math.max(4, Math.ceil(Math.max(0, ...conEng.map((p) => p.eng)) + 0.5));
  const marcasEje = Array.from({ length: maxEje + 1 }, (_, i) => i);
  const altoGrafica = Math.max(340, ordenadasGrafica.length * 34 + 50);

  const tarjetas = [
    ["Publicaciones del mes", posts.length ? resumen.total : "Sin datos", etiquetaMes ? `registradas en ${etiquetaMes}` : "no hay publicaciones registradas"],
    ["Alcance total", resumen.alcanceTotal != null ? fmt0(resumen.alcanceTotal) : "Sin datos", "personas, suma de publicaciones"],
    ["Engagement promedio", resumen.engPromedio != null ? `${fmt(resumen.engPromedio)} %` : "Sin datos", "interacciones sobre seguidores"],
    [
      "Mejor formato",
      resumen.mejorFormato ? resumen.mejorFormato.formato : "Sin datos",
      resumen.mejorFormato && resumen.peorFormato
        ? `${fmt(resumen.mejorFormato.eng)} % contra ${fmt(resumen.peorFormato.eng)} % de ${resumen.peorFormato.formato.toLowerCase()}`
        : resumen.mejorFormato ? `${fmt(resumen.mejorFormato.eng)} % de engagement` : "se calcula con las cifras de cada publicación",
    ],
  ];

  return (
    <>
      <div className="mb-[22px] grid grid-cols-2 gap-[18px] lg:grid-cols-4">
        {tarjetas.map(([t, v, s]) => (
          <Tarjeta key={t} className="!px-5 !py-[18px]">
            <p className="text-[11px] uppercase tracking-wide text-zinc-500">{t}</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums text-zinc-100">{v}</p>
            <p className="mt-1 text-xs text-zinc-500">{s}</p>
          </Tarjeta>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
        <Tarjeta className="flex flex-col">
          <div className="mb-1 flex flex-wrap items-start justify-between gap-3.5">
            <div>
              <h3 className="text-[15px] font-semibold text-zinc-200">{modo === "post" ? "Engagement de cada publicación" : "Engagement por formato"}</h3>
              <p className="mb-4 mt-1 max-w-md text-[12.5px] leading-relaxed text-zinc-500">
                {modo === "post"
                  ? `Cada barra es una publicación${etiquetaMes ? ` de ${etiquetaMes}` : ""}. Las líneas punteadas son las metas del semáforo: verde en ${fmt(u.verde)} %, amarillo en ${fmt(u.amarillo)} %.`
                  : "Promedio de cada formato frente al promedio de cuentas universitarias de Instagram según Meet Your Class. Sirve para decidir qué formato producir más."}
              </p>
            </div>
            <Segmento valor={modo} onCambio={setModo} opciones={[{ valor: "post", etiqueta: "Por publicación" }, { valor: "fmt", etiqueta: "Por formato" }]} />
          </div>
          <div className={`relative min-h-[340px] flex-1 ${modo === "post" ? "max-h-[470px] overflow-y-auto" : ""}`}>
            {conEng.length === 0 && <Vacio>Todavía no hay publicaciones con cifras de interacción para comparar.</Vacio>}
            {conEng.length === 0 ? null : modo === "post" ? (
              <div style={{ height: altoGrafica }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordenadasGrafica} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid {...CUADRICULA} horizontal={false} />
                  <XAxis type="number" domain={[0, maxEje]} ticks={marcasEje} tick={EJE} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} %`} />
                  <YAxis type="category" dataKey="titulo" width={175} tick={{ ...EJE, fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(t) => (t.length > 28 ? `${t.slice(0, 27)}…` : t)} interval={0} />
                  <ReferenceLine x={u.verde} stroke={CHART.emerald} strokeDasharray="5 5" strokeWidth={1.5} />
                  <ReferenceLine x={u.amarillo} stroke={CHART.amber} strokeDasharray="5 5" strokeWidth={1.5} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    content={<TooltipMk formato={(pl) => {
                      const d = pl[0].payload;
                      return [`${fmt(d.eng)} % de engagement`, `${d.formato || "Formato sin indicar"}, alcance ${d.alcance != null ? fmt0(d.alcance) : "sin dato"}`];
                    }} />}
                  />
                  <Bar dataKey="eng" radius={[0, 5, 5, 0]} maxBarSize={24} isAnimationActive={false}>
                    {ordenadasGrafica.map((p) => <Cell key={p.id} fill={COLOR_NIVEL[nivelEng(p.eng, u)]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={porFormato.map((f) => ({ ...f, etiqueta: `${f.formato}, ${f.publicaciones} publ.` }))} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid {...CUADRICULA} vertical={false} />
                  <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} />
                  <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={(v) => `${v} %`} />
                  <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<TooltipMk formato={(pl) => pl.map((p) => `${p.name}: ${fmt(p.value)} %`)} />} />
                  <Bar dataKey="eng" name="Cinergia" fill={CHART.blue} radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={false} />
                  <Bar dataKey="referencia" name="Promedio universitario" fill="#52525b" radius={[6, 6, 0, 0]} maxBarSize={34} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {modo === "fmt" && conEng.length > 0 && <Leyenda items={[[CHART.blue, "Cinergia"], ["#52525b", "Promedio universitario"]]} />}
        </Tarjeta>

        <Tarjeta>
          <h3 className="text-[15px] font-semibold text-zinc-200">Publicaciones del mes</h3>
          <p className="mb-4 mt-1 text-[12.5px] leading-relaxed text-zinc-500">
            {tab === "mejores"
              ? "De mayor a menor engagement. Los envíos son la señal que Instagram dice pesar más para llegar a gente nueva."
              : "De menor a mayor engagement. Sirven para detectar qué no repetir."}
          </p>
          <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
            <Segmento valor={tab} onCambio={setTab} opciones={[{ valor: "mejores", etiqueta: "Mejores" }, { valor: "peores", etiqueta: "Menos rindieron" }]} />
            <Selector pequeno valor={cantidad} onCambio={setCantidad} opciones={[{ valor: "5", etiqueta: "Mostrar 5" }, { valor: "10", etiqueta: "Mostrar 10" }, { valor: "9999", etiqueta: "Mostrar todas" }]} />
          </div>
          <div className="max-h-[300px] overflow-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  {["Publicación", "Formato", "Alcance", "Envíos", "Eng."].map((t) => (
                    <th key={t} className="sticky top-0 z-[1] border-b border-zinc-800 px-3 py-2.5 text-left text-[10.5px] font-medium uppercase tracking-widest text-zinc-500" style={{ backgroundColor: PANEL }}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ordenTabla.map((p) => (
                  <tr
                    key={p.id}
                    onClick={puedeEditar ? () => onEditar(p.original) : undefined}
                    className={`border-b border-zinc-800/50 last:border-0 ${puedeEditar ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}
                  >
                    <td className="px-3 py-3.5 text-zinc-200">
                      {p.titulo}
                      {p.evento && <span className="mt-0.5 block text-[10.5px] text-zinc-500">{p.evento}</span>}
                    </td>
                    <td className="px-3 py-3.5 text-zinc-400">{p.formato || "—"}</td>
                    <td className="px-3 py-3.5 font-mono text-zinc-400">{p.alcance != null ? fmt0(p.alcance) : "—"}</td>
                    <td className="px-3 py-3.5 font-mono text-zinc-400">{p.envios != null ? p.envios : "—"}</td>
                    <td className={`px-3 py-3.5 font-mono ${TEXTO_NIVEL[nivelEng(p.eng, u)]}`}>{fmt(p.eng)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ordenTabla.length === 0 && <p className="px-3 py-8 text-center text-[12.5px] text-zinc-500">No hay publicaciones con cifras para mostrar.</p>}
          </div>
          {sinMetricas > 0 && (
            <p className="mt-3 text-xs text-zinc-500">
              {sinMetricas === 1 ? "Una publicación todavía no tiene cifras" : `${sinMetricas} publicaciones todavía no tienen cifras`} y no entra al ranking.
            </p>
          )}
          {puedeEditar && posts.length > 0 && <p className="mt-1 text-xs text-zinc-600">Toca una fila para indicar a qué evento pertenece.</p>}
        </Tarjeta>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 6 · De la difusión a la asistencia                                 */
/* ------------------------------------------------------------------ */

const PALETA_FUENTES = ["#2563eb", "#60a5fa", "#10b981", "#f59e0b", "#52525b"];

function Embudo({ eventos }) {
  const [elegido, setElegido] = useState(null);
  const porDefecto = eventos.length ? eventos[eventos.length - 1].id : "todos";
  const seleccion = elegido && (elegido === "todos" || eventos.some((e) => e.id === elegido)) ? elegido : porDefecto;
  const e = seleccion === "todos" ? sumarEventos(eventos) : eventos.find((x) => x.id === seleccion);
  const grafica = eventos.slice(-8);

  if (!eventos.length) {
    return (
      <Tarjeta>
        <p className="py-10 text-center text-[13px] leading-relaxed text-zinc-500">
          Aún no hay eventos con inscritos y asistentes registrados. Se cargan en el cierre de cada evento.
        </p>
      </Tarjeta>
    );
  }

  const base = e.inscritos ?? Math.max(e.asistieron || 0, e.participantes || 0, e.encuesta || 0);
  const pct = (v) => (base > 0 && v != null ? (v / base) * 100 : null);
  const filas = [
    ["Inscritos", e.inscritos, e.inscritos != null ? 100 : null, CHART.blue, null],
    ["Inscritos que asistieron", e.asistieron, pct(e.asistieron), CHART.blue, null],
    ["Participantes totales", e.participantes, pct(e.participantes), CHART.blueSoft, null],
    ["Respondieron la encuesta", e.encuesta, pct(e.encuesta), CHART.emerald, e.participantes ? (e.encuesta / e.participantes) * 100 : null],
  ].filter((f) => f[1] != null);

  const fuentes = [...FUENTES_DIFUSION, ...Object.keys(e.fuentes).filter((k) => !FUENTES_DIFUSION.includes(k))]
    .map((nombre) => ({ nombre, valor: Number(e.fuentes[nombre] || 0) }))
    .filter((f) => f.valor > 0);
  const hayFuentes = fuentes.length > 0;
  const metaCumplida = e.meta != null && e.asistieron != null && e.asistieron >= e.meta;

  return (
    <>
      <div className="mb-[22px] flex flex-wrap items-center gap-3.5">
        <label className="text-xs uppercase tracking-wider text-zinc-500">Evento</label>
        <Selector
          valor={seleccion}
          onCambio={setElegido}
          opciones={[{ valor: "todos", etiqueta: "Todos los eventos del ciclo" }, ...[...eventos].reverse().map((x) => ({ valor: x.id, etiqueta: x.nombre }))]}
        />
      </div>

      <div className="grid grid-cols-1 gap-[22px] lg:grid-cols-2">
        <Tarjeta>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-[15px] font-semibold text-zinc-200">Embudo de {e.nombre}</h3>
            {e.meta != null && !e.todos && e.asistieron != null && (
              <Pildora clave={metaCumplida ? "verde" : "rojo"}>{metaCumplida ? "Meta cumplida" : "Meta no alcanzada"}, {e.asistieron} de {e.meta}</Pildora>
            )}
          </div>
          <p className="mb-[18px] mt-1 text-[12.5px] text-zinc-500">De los inscritos a quienes opinaron.</p>
          <div className="mb-[22px] grid grid-cols-3 gap-3">
            {[
              ["Alcance campaña", e.alcance != null ? fmt0(e.alcance) : "Sin dato"],
              ["Asistencia", e.inscritos > 0 && e.asistieron != null ? `${fmt((e.asistieron / e.inscritos) * 100)} %` : "Sin dato"],
              ["Meta de asistentes", e.todos ? "Varias" : e.meta != null ? e.meta : "Sin dato"],
            ].map(([t, v]) => (
              <div key={t} className="min-w-0 rounded-[10px] border border-zinc-800 px-3.5 py-3">
                <p className="text-[10.5px] uppercase tracking-wide text-zinc-500">{t}</p>
                <p className="mt-1.5 font-mono text-[19px] font-semibold tabular-nums text-zinc-100">{v}</p>
              </div>
            ))}
          </div>
          {filas.map(([nombre, valor, porcentaje, color, sobreParticipantes]) => (
            <div key={nombre} className="my-3.5 grid grid-cols-[130px_minmax(0,1fr)_62px] items-center gap-3.5 text-[12.5px] text-zinc-400 sm:grid-cols-[175px_minmax(0,1fr)_62px]">
              <span>
                {nombre}
                {sobreParticipantes != null && <span className="mt-0.5 block text-[10.5px] text-zinc-500">sobre participantes totales</span>}
              </span>
              <div>
                <div
                  className="flex h-[30px] min-w-[34px] items-center rounded-[7px] pl-3 text-[12.5px] font-semibold text-white transition-[width] duration-500"
                  style={{ width: `${Math.min(100, Math.max(porcentaje ?? 6, 6))}%`, backgroundColor: color }}
                >
                  {fmt0(valor)}
                </div>
              </div>
              <span className="font-mono">{fmt(sobreParticipantes ?? porcentaje)} %</span>
            </div>
          ))}
        </Tarjeta>

        <Tarjeta>
          <h3 className="text-[15px] font-semibold text-zinc-200">¿Cómo se enteraron los inscritos?</h3>
          <p className="mb-[18px] mt-1 text-[12.5px] text-zinc-500">
            {hayFuentes ? "Cada porción es la parte de inscritos que llegó por ese medio." : "Muestra por qué medio llegaron los inscritos."}
          </p>
          <div className="relative" style={{ height: 300 }}>
            {!hayFuentes && <Vacio>Este evento no registró cómo se enteraron los inscritos.<br />Se completa en el formulario de cierre del evento.</Vacio>}
            <div className="flex h-full items-center">
              <div className="h-full min-w-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={hayFuentes ? fuentes : [{ nombre: "Sin dato", valor: 1 }]} dataKey="valor" nameKey="nombre" innerRadius="62%" outerRadius="92%" stroke={PANEL} strokeWidth={3} isAnimationActive={false}>
                      {(hayFuentes ? fuentes : [{}]).map((f, i) => <Cell key={i} fill={hayFuentes ? PALETA_FUENTES[FUENTES_DIFUSION.indexOf(f.nombre) >= 0 ? FUENTES_DIFUSION.indexOf(f.nombre) : 4] : "#1c1c20"} />)}
                    </Pie>
                    {hayFuentes && <Tooltip content={<TooltipMk formato={(pl) => [`${pl[0].name}: ${pl[0].value} inscritos`]} />} />}
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {hayFuentes && (
                <ul className="shrink-0 space-y-3 pr-2 text-xs text-zinc-400">
                  {fuentes.map((f) => (
                    <li key={f.nombre} className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PALETA_FUENTES[FUENTES_DIFUSION.indexOf(f.nombre) >= 0 ? FUENTES_DIFUSION.indexOf(f.nombre) : 4] }} />
                      {f.nombre}
                      <span className="font-mono text-zinc-500">{f.valor}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Tarjeta>
      </div>

      <Tarjeta className="mt-[22px]">
        <h3 className="mb-1 text-[15px] font-semibold text-zinc-200">Comparación entre eventos</h3>
        <p className="mb-4 text-[12.5px] leading-relaxed text-zinc-500">
          Inscritos y asistentes de cada evento. Toca una barra para ver ese evento arriba. Los puntos amarillos son la meta de asistencia que fijó el acta.
        </p>
        <Leyenda items={[[CHART.blue, "Inscritos"], [CHART.emerald, "Asistieron"], [CHART.amber, "Meta del acta"]]} />
        <div style={{ height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={grafica} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid {...CUADRICULA} vertical={false} />
              <XAxis dataKey="nombre" tick={{ ...EJE, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} tickFormatter={(t) => (t.length > 22 ? `${t.slice(0, 21)}…` : t)} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }} content={<TooltipMk formato={(pl) => pl.filter((p) => p.value != null).map((p) => `${p.name}: ${p.value}`)} />} />
              <Bar dataKey="inscritos" name="Inscritos" fill={CHART.blue} radius={[6, 6, 0, 0]} barSize={22} cursor="pointer" onClick={(d) => setElegido(d?.id ?? d?.payload?.id)} isAnimationActive={false} />
              <Bar dataKey="asistieron" name="Asistieron" fill={CHART.emerald} radius={[6, 6, 0, 0]} barSize={22} cursor="pointer" onClick={(d) => setElegido(d?.id ?? d?.payload?.id)} isAnimationActive={false} />
              <Line dataKey="meta" name="Meta del acta" stroke="none" isAnimationActive={false}
                dot={({ cx, cy, payload, key }) => (payload?.meta == null || cx == null
                  ? <g key={key} />
                  : <rect key={key} x={cx - 5} y={cy - 5} width={10} height={10} transform={`rotate(45 ${cx} ${cy})`} fill={CHART.amber} stroke={PANEL} strokeWidth={2} />)}
                activeDot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Tarjeta>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 7 · Alertas                                                        */
/* ------------------------------------------------------------------ */

function Alertas({ alertas }) {
  return (
    <Tarjeta>
      {alertas.length === 0 && <p className="text-[13px] text-zinc-500">Sin alertas por ahora. Todo lo pedido está al día.</p>}
      {alertas.map((a, i) => (
        <div key={i} className="flex gap-3.5 border-b border-zinc-800/50 py-[15px] text-[13px] leading-relaxed text-zinc-400 first:pt-0 last:border-0 last:pb-0">
          <span
            className="mt-[7px] h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: COLOR_NIVEL[a.nivel], boxShadow: `0 0 8px ${COLOR_NIVEL[a.nivel]}99` }}
          />
          <div><b className="font-semibold text-zinc-200">{a.titulo}</b> {a.detalle}</div>
        </div>
      ))}
    </Tarjeta>
  );
}

/* ------------------------------------------------------------------ */
/* Vista completa                                                     */
/* ------------------------------------------------------------------ */

export function VistaAnaliticaMarketing({ datos, puedeEditar, esSuperadmin, onRecargar, onPublicacion, onMetricas, onInstagram }) {
  const vista = useMemo(() => vistaMarketing({ datos }), [datos]);
  const [kpiSel, setKpiSel] = useState(vista.principal.id);
  const [actualizando, setActualizando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const ancla = useRef(null);

  const elegirKpi = (id, bajar = true) => {
    setKpiSel(id);
    if (bajar) ancla.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const actualizar = async () => {
    setMensaje(null);
    setActualizando(true);
    try {
      const r = await sincronizarInstagram();
      await onRecargar?.();
      setMensaje({ tipo: "ok", texto: `Instagram actualizado. ${r.estado.publicaciones_sincronizadas ?? 0} publicaciones revisadas.` });
    } catch (e) {
      await onRecargar?.();
      setMensaje({ tipo: "error", texto: e.message });
    } finally {
      setActualizando(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1160px] pb-24">
      <SectionHeader
        eyebrow="Módulo / Analítica"
        title="Analítica de Marketing"
        subtitle="Desempeño de la marca Cinergia en redes, cumplimiento de lo que piden los eventos y conversión de la difusión en asistencia real."
      />

      <BarraAcciones
        conexion={datos.instagramConexion}
        puedeEditar={puedeEditar}
        esSuperadmin={esSuperadmin}
        onActualizar={actualizar}
        actualizando={actualizando}
        mensaje={mensaje}
        onPublicacion={onPublicacion}
        onMetricas={onMetricas}
        onInstagram={onInstagram}
      />

      <Seccion titulo="Semáforo de Marketing" descripcion="Los 7 KPIs que designó la presidencia. Toca cualquiera para verlo en la gráfica de abajo.">
        <Semaforo vista={vista} kpiSel={kpiSel} onElegir={elegirKpi} />
      </Seccion>

      <Seccion titulo="Evolución del KPI" descripcion="Las franjas de color son las del semáforo de ese KPI. Cada punto toma el color de la franja en la que cayó ese mes.">
        <EvolucionKpi kpis={vista.kpis} kpiSel={kpiSel} onElegir={elegirKpi} anclaRef={ancla} />
      </Seccion>

      <Seccion titulo="Pedidos de Marketing que salen de las actas" descripcion="Cada acta de evento trae un Plan de Difusión con piezas antes, durante y después. Aquí se siguen como entregables con fecha límite.">
        <Pedidos pedidos={vista.pedidos} />
      </Seccion>

      <Seccion titulo="Rendimiento en redes" descripcion="Datos que vienen de Instagram, actualizados una vez al día.">
        <Redes vista={vista} />
      </Seccion>

      <Seccion titulo="Qué contenido funciona" descripcion="Cada publicación que se registra entra aquí. Sirve para ver qué publicaciones rindieron y qué formato conviene producir más. No cambia el semáforo.">
        <Contenido contenido={vista.contenido} puedeEditar={puedeEditar} onEditar={onPublicacion} />
      </Seccion>

      <Seccion titulo="De la difusión a la asistencia" descripcion="Aquí Marketing y Eventos se encuentran: cuánta gente que se enteró termina sentada en el evento. Elige un evento y todo se actualiza.">
        <Embudo eventos={vista.eventos} />
      </Seccion>

      <Seccion titulo="Alertas de Marketing" descripcion="La página avisa sin que nadie pregunte. Sale de las fechas de las actas y de lo que falta cargar.">
        <Alertas alertas={vista.alertas} />
      </Seccion>
    </div>
  );
}
