import { CHART } from "./tokens";
import { ETAPAS, ETAPA_FINAL, MESES_CORTOS, aFecha, fechaDeProyecto, formatoFechaCorta } from "./kpis";

/* Analítica macro por área: suma todas las actas cargadas de cada área. */

export const AREAS_ANALITICA = ["Eventos", "Proyectos", "Gestión de Oportunidades"];

const DIA = 24 * 60 * 60 * 1000;
const MAXIMO_MESES = 14;

export const COLOR_ETAPA = {
  "Planificación Base": CHART.muted,
  "Aprobación Directiva": CHART.blueSoft,
  "Ejecución Activa": CHART.blue,
  "Revisión / QA": CHART.amber,
  "Cierre Operativo": "#34d399",
  Finalizado: CHART.emerald,
};

function inicioDelDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function etiquetaMes(d) {
  return `${MESES_CORTOS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
}

function meses(desde, hasta) {
  const lista = [];
  let m = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), 1);
  while (m <= fin) {
    lista.push(m);
    m = new Date(m.getFullYear(), m.getMonth() + 1, 1);
  }
  return lista.slice(-MAXIMO_MESES);
}

function finDeMes(m) {
  return new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);
}

function plural(n, singular, varios) {
  return `${n} ${n === 1 ? singular : varios}`;
}

function unir(partes) {
  if (partes.length <= 1) return partes[0] || "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function porEtapa(proyectos) {
  return [...ETAPAS, ETAPA_FINAL]
    .map((etapa) => ({ name: etapa, value: proyectos.filter((p) => p.estado_actual === etapa).length, color: COLOR_ETAPA[etapa] }))
    .filter((e) => e.value > 0);
}

function nombreAliado(p) {
  return (p.nombre || "").replace(/^(Convenio|Carta de alianza|Propuesta de alianza) con /i, "");
}

function eventos(proyectos, compromisos, cierres, ahora) {
  const n = proyectos.length;
  const finalizados = proyectos.filter((p) => p.estado_actual === ETAPA_FINAL).length;
  const conAforo = proyectos.filter((p) => Number(p.aforo_estimado) > 0);
  const aforo = conAforo.reduce((acc, p) => acc + Number(p.aforo_estimado), 0);
  const ids = new Set(proyectos.map((p) => p.id));
  const conCierre = new Set(cierres.filter((c) => ids.has(c.proyecto_id)).map((c) => c.proyecto_id));
  const pendientes = proyectos.filter((p) => !conCierre.has(p.id) && fechaDeProyecto(p) && fechaDeProyecto(p) <= ahora).length;
  const metas = proyectos.reduce((acc, p) => acc + (Array.isArray(p.metas) ? p.metas.length : 0), 0);

  const fechas = proyectos.map(fechaDeProyecto).filter(Boolean);
  let serie = [];
  if (fechas.length) {
    const primera = new Date(Math.min(...fechas));
    const ultima = new Date(Math.max(ahora, ...fechas));
    serie = meses(primera, ultima).map((m) => ({
      mes: etiquetaMes(m),
      valor: fechas.filter((f) => f.getFullYear() === m.getFullYear() && f.getMonth() === m.getMonth()).length,
    }));
  }

  return {
    tarjetas: [
      { clave: "registrados", label: "Eventos registrados", value: n, detalle: n ? `${finalizados} finalizados, ${n - finalizados} en curso` : "Sin actas cargadas" },
      { clave: "aforo", label: "Aforo estimado total", value: conAforo.length ? aforo.toLocaleString("es-PE") : "—", suffix: conAforo.length ? "personas" : "", detalle: `${conAforo.length} de ${n} actas declaran aforo` },
      { clave: "cierres", label: "Cierres registrados", value: conCierre.size, suffix: `de ${n}`, detalle: pendientes ? `${plural(pendientes, "evento pasado", "eventos pasados")} sin cierre` : "Sin cierres pendientes" },
      { clave: "metas", label: "Metas declaradas", value: metas, detalle: `En las actas de ${plural(n, "evento", "eventos")}` },
    ],
    serie: { titulo: "Eventos por mes", subtitulo: "Cantidad de eventos según la fecha de cada acta", unidad: " eventos", datos: serie },
    dona: { titulo: "Eventos por etapa", subtitulo: `Etapa actual de ${plural(n, "evento", "eventos")}`, centro: n, centroEtiqueta: "eventos", datos: porEtapa(proyectos) },
  };
}

function proyectosArea(proyectos, compromisos, semaforo) {
  const n = proyectos.length;
  const ids = new Set(proyectos.map((p) => p.id));
  const hitos = compromisos.filter((c) => ids.has(c.proyecto_id) && c.tipo === "hito");
  const cumplido = (c) => c.completado || c.fecha_entrega;
  const cumplidos = hitos.filter(cumplido);
  const pendientesConFecha = hitos.filter((c) => !cumplido(c) && c.fecha_limite).length;
  const sinFecha = hitos.filter((c) => !cumplido(c) && !c.fecha_limite).length;
  const avance = semaforo?.kpis?.find((k) => k.kpi === "pr_avance");
  const avanceValor = avance?.valorNumerico == null ? null : Math.round(avance.valorNumerico);

  const porDia = new Map();
  cumplidos
    .map((c) => aFecha(c.fecha_entrega))
    .filter(Boolean)
    .sort((a, b) => a - b)
    .forEach((d) => {
      const clave = inicioDelDia(d).getTime();
      porDia.set(clave, (porDia.get(clave) || 0) + 1);
    });
  let acumulado = 0;
  const serie = [...porDia.entries()].map(([clave, cantidad]) => {
    const d = new Date(clave);
    acumulado += cantidad;
    return { mes: `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`, valor: acumulado };
  });

  return {
    tarjetas: [
      { clave: "registrados", label: "Proyectos registrados", value: n, detalle: n ? unir(porEtapa(proyectos).map((e) => `${e.value} en ${e.name}`)) : "Sin actas cargadas" },
      { clave: "fases", label: "Fases cumplidas", value: cumplidos.length, suffix: `de ${hitos.length}`, detalle: "Entre todos los proyectos" },
      { clave: "avance", label: "Avance real vs. planificado", value: avanceValor == null ? "—" : avanceValor, suffix: avanceValor == null ? "" : "%", detalle: avanceValor == null ? "Sin fases con fecha vencida" : "Fases con fecha hasta hoy" },
      { clave: "sinFecha", label: "Fases sin fecha", value: sinFecha, detalle: sinFecha ? "Las actas no las fechan todavía" : "Todas las fases tienen fecha" },
    ],
    serie: { titulo: "Fases cumplidas acumuladas", subtitulo: "Suma de las fases de todos los proyectos, por fecha de cumplimiento", unidad: " fases", datos: serie },
    dona: {
      titulo: "Estado de las fases",
      subtitulo: `Las ${hitos.length} fases de ${plural(n, "proyecto", "proyectos")}`,
      centro: hitos.length,
      centroEtiqueta: "fases",
      datos: [
        { name: "Cumplidas", value: cumplidos.length, color: CHART.emerald },
        { name: "Pendiente con fecha", value: pendientesConFecha, color: CHART.amber },
        { name: "Sin fecha", value: sinFecha, color: CHART.muted },
      ].filter((d) => d.value > 0),
    },
  };
}

function alianzas(proyectos, compromisos, ahora) {
  const n = proyectos.length;
  const hoy = inicioDelDia(ahora);
  const tipos = [
    ["convenio", "convenio", "convenios"],
    ["carta", "carta", "cartas"],
    ["propuesta", "propuesta", "propuestas"],
  ]
    .map(([tipo, uno, varios]) => ({ n: proyectos.filter((p) => p.tipo_acta === tipo).length, uno, varios }))
    .filter((t) => t.n > 0)
    .map((t) => plural(t.n, t.uno, t.varios));

  const firmados = proyectos.filter((p) => p.tipo_acta !== "propuesta");
  const vencido = (p) => p.vigente_hasta && aFecha(p.vigente_hasta) < hoy;
  const vencidos = firmados.filter(vencido);
  const vigentes = firmados.filter((p) => !vencido(p) && p.estado_actual !== ETAPA_FINAL);
  const proximo = vigentes
    .filter((p) => aFecha(p.vigente_hasta))
    .sort((a, b) => aFecha(a.vigente_hasta) - aFecha(b.vigente_hasta))[0];

  const ids = new Set(proyectos.map((p) => p.id));
  const propios = compromisos.filter((c) => ids.has(c.proyecto_id) && c.tipo === "compromiso_aliado");
  const deCinergia = propios.filter((c) => c.responsable === "Cinergia").length;
  const deAliados = propios.length - deCinergia;

  const fechas = firmados.map(fechaDeProyecto).filter(Boolean);
  const serie = fechas.length
    ? meses(new Date(Math.min(...fechas)), ahora).map((m) => ({ mes: etiquetaMes(m), valor: fechas.filter((f) => f <= finDeMes(m)).length }))
    : [];

  return {
    tarjetas: [
      { clave: "registrados", label: "Documentos registrados", value: n, detalle: n ? unir(tipos) : "Sin documentos cargados" },
      { clave: "vigentes", label: "Alianzas vigentes", value: vigentes.length, detalle: vencidos.length ? `${plural(vencidos.length, "vencida", "vencidas")}: ${vencidos.map(nombreAliado).join(", ")}` : "Ninguna vencida" },
      { clave: "compromisos", label: "Compromisos registrados", value: propios.length, detalle: `${deCinergia} de Cinergia y ${deAliados} de los aliados` },
      proximo
        ? { clave: "vencimiento", label: "Próximo vencimiento", value: Math.round((aFecha(proximo.vigente_hasta) - hoy) / DIA), suffix: "días", detalle: `${nombreAliado(proximo)}, ${formatoFechaCorta(proximo.vigente_hasta)}` }
        : { clave: "vencimiento", label: "Próximo vencimiento", value: "—", detalle: "Sin vencimientos registrados" },
    ],
    serie: { titulo: "Alianzas firmadas, acumulado", subtitulo: "Documentos con fecha de firma. Las propuestas no se cuentan", unidad: " documentos", datos: serie },
    dona: {
      titulo: "Compromisos por parte",
      subtitulo: `Reparto de los ${propios.length} compromisos registrados`,
      centro: propios.length,
      centroEtiqueta: "compromisos",
      datos: [
        { name: "Cinergia", value: deCinergia, color: CHART.blue },
        { name: "Aliados", value: deAliados, color: CHART.emerald },
      ].filter((d) => d.value > 0),
    },
  };
}

export function analizarArea(area, datos, semaforo, ahora = new Date()) {
  const proyectos = (datos.proyectos || []).filter((p) => p.area === area);
  const compromisos = datos.compromisos || [];
  let resultado;
  if (area === "Eventos") resultado = eventos(proyectos, compromisos, datos.cierres || [], ahora);
  else if (area === "Proyectos") resultado = proyectosArea(proyectos, compromisos, semaforo);
  else resultado = alianzas(proyectos, compromisos, ahora);
  const actas = [...proyectos].sort((a, b) => (fechaDeProyecto(b) || 0) - (fechaDeProyecto(a) || 0));
  return { ...resultado, actas, semaforo };
}
