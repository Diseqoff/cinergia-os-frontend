/* ------------------------------------------------------------------ */
/* Motor de KPIs de CINERGIA                                          */
/* Fuente: Sistema de KPIs, Semáforo y Entregables · Área de Reportes */
/*                                                                    */
/* Todos los cálculos parten de datos registrados en Supabase:        */
/* proyectos, compromisos, historial_etapas, cierres_evento y         */
/* metricas_marketing. Los rangos del semáforo se leen de la tabla    */
/* kpi_umbrales; UMBRALES_BASE solo se usa si la tabla está vacía.    */
/* ------------------------------------------------------------------ */

export const ETAPAS = [
  "Planificación Base",
  "Aprobación Directiva",
  "Ejecución Activa",
  "Revisión / QA",
  "Cierre Operativo",
];
export const ETAPA_FINAL = "Finalizado";

export const AREAS = ["Eventos", "Marketing", "Proyectos", "Gestión de Oportunidades", "Reportes"];

export const TIPOS_COMPROMISO = [
  { value: "hito", label: "Hito" },
  { value: "entregable", label: "Entregable" },
  { value: "pieza_comunicacion", label: "Pieza de comunicación" },
  { value: "reporte", label: "Reporte" },
  { value: "insumo_reportes", label: "Insumo para Reportes" },
  { value: "respuesta_aliado", label: "Respuesta a aliado" },
  { value: "compromiso_aliado", label: "Compromiso con aliado" },
];

export const ETIQUETA_FECHA_SOLICITUD = {
  respuesta_aliado: "Solicitud recibida",
  reporte: "Cierre de recopilación",
};

/*
 * sentido "mayor": valor >= verde → verde; valor >= amarillo → amarillo; resto → rojo.
 * sentido "menor": valor <= verde → verde; valor <= amarillo → amarillo; resto → rojo.
 */
export const UMBRALES_BASE = [
  // Eventos
  { kpi: "ev_cronograma", area: "Eventos", nombre: "Cumplimiento de cronograma", unidad: "%", sentido: "mayor", verde: 95, amarillo: 80, principal: true },
  { kpi: "ev_asistencia", area: "Eventos", nombre: "Asistencia vs. aforo estimado", unidad: "%", sentido: "mayor", verde: 80, amarillo: 60 },
  { kpi: "ev_memoria", area: "Eventos", nombre: "Entrega de memoria técnica", unidad: "días hábiles", sentido: "menor", verde: 5, amarillo: 10 },
  { kpi: "ev_satisfaccion", area: "Eventos", nombre: "Satisfacción de participantes", unidad: "/5", sentido: "mayor", verde: 4.2, amarillo: 3.5 },
  { kpi: "ev_aliados", area: "Eventos", nombre: "Aliados o patrocinios por evento", unidad: "", sentido: "mayor", verde: 2, amarillo: 1 },
  { kpi: "ev_incidencias", area: "Eventos", nombre: "Incidencias mayores por evento", unidad: "", sentido: "menor", verde: 0, amarillo: 1 },
  { kpi: "ev_difusion", area: "Eventos", nombre: "Difusión con 72 h de anticipación", unidad: "%", sentido: "mayor", verde: 100, amarillo: 70 },
  // Marketing
  { kpi: "mk_piezas", area: "Marketing", nombre: "Piezas entregadas a tiempo", unidad: "%", sentido: "mayor", verde: 95, amarillo: 80, principal: true },
  { kpi: "mk_calendario", area: "Marketing", nombre: "Cumplimiento del calendario editorial", unidad: "%", sentido: "mayor", verde: 90, amarillo: 70 },
  { kpi: "mk_seguidores", area: "Marketing", nombre: "Crecimiento de seguidores", unidad: "%", sentido: "mayor", verde: 5, amarillo: 2 },
  { kpi: "mk_engagement", area: "Marketing", nombre: "Engagement promedio", unidad: "%", sentido: "mayor", verde: 3, amarillo: 1.5 },
  { kpi: "mk_cobertura", area: "Marketing", nombre: "Eventos con registro audiovisual", unidad: "%", sentido: "mayor", verde: 100, amarillo: 85 },
  { kpi: "mk_menciones", area: "Marketing", nombre: "Menciones en medios externos", unidad: "", sentido: "mayor", verde: 2, amarillo: 1 },
  { kpi: "mk_anticipacion", area: "Marketing", nombre: "Piezas con 72 h de anticipación", unidad: "%", sentido: "mayor", verde: 95, amarillo: 80 },
  // Proyectos
  { kpi: "pr_avance", area: "Proyectos", nombre: "Avance real vs. planificado", unidad: "%", sentido: "mayor", verde: 90, amarillo: 75, principal: true },
  { kpi: "pr_hitos", area: "Proyectos", nombre: "Hitos cumplidos en fecha", unidad: "%", sentido: "mayor", verde: 90, amarillo: 70 },
  { kpi: "pr_cronograma", area: "Proyectos", nombre: "Proyectos con cronograma vigente", unidad: "%", sentido: "mayor", verde: 100, amarillo: 85 },
  { kpi: "pr_externos", area: "Proyectos", nombre: "Entregables externos completados", unidad: "%", sentido: "mayor", verde: 95, amarillo: 75 },
  { kpi: "pr_respuesta", area: "Proyectos", nombre: "Respuesta a solicitudes de aliados", unidad: "h", sentido: "menor", verde: 48, amarillo: 72 },
  { kpi: "pr_nuevos", area: "Proyectos", nombre: "Proyectos nuevos formulados", unidad: "% de la meta", sentido: "mayor", verde: 100, amarillo: 50, meta: 2 },
  // Gestión de Oportunidades · KPIs de Alianzas
  { kpi: "go_compromisos", area: "Gestión de Oportunidades", nombre: "Compromisos bilaterales cumplidos", unidad: "%", sentido: "mayor", verde: 90, amarillo: 70, principal: true },
  { kpi: "go_respuesta", area: "Gestión de Oportunidades", nombre: "Respuesta a aliados", unidad: "h", sentido: "menor", verde: 48, amarillo: 72 },
  { kpi: "go_satisfaccion", area: "Gestión de Oportunidades", nombre: "Satisfacción de aliados", unidad: "/5", sentido: "mayor", verde: 4.2, amarillo: 3.5 },
  { kpi: "go_activados", area: "Gestión de Oportunidades", nombre: "Aliados activados por evento", unidad: "", sentido: "mayor", verde: 2, amarillo: 1 },
  // Reportes
  { kpi: "rp_reportes", area: "Reportes", nombre: "Reportes entregados a tiempo", unidad: "%", sentido: "mayor", verde: 100, amarillo: 85, principal: true },
  { kpi: "rp_insumos", area: "Reportes", nombre: "Áreas con insumos completos y a tiempo", unidad: "%", sentido: "mayor", verde: 90, amarillo: 70 },
  { kpi: "rp_consolidacion", area: "Reportes", nombre: "Tiempo de consolidación", unidad: "días", sentido: "menor", verde: 2, amarillo: 3 },
  { kpi: "rp_calidad", area: "Reportes", nombre: "Correcciones por insumo recibido", unidad: "", sentido: "menor", verde: 0, amarillo: 2 },
  // Transversales
  { kpi: "tr_externos", area: "Transversal", nombre: "Cumplimiento de entregables externos", unidad: "%", sentido: "mayor", verde: 90, amarillo: 70 },
  { kpi: "tr_satisfaccion", area: "Transversal", nombre: "Satisfacción de aliados y clientes", unidad: "/5", sentido: "mayor", verde: 4, amarillo: 3 },
  { kpi: "tr_puntualidad", area: "Transversal", nombre: "Puntualidad interáreas", unidad: "%", sentido: "mayor", verde: 85, amarillo: 65 },
  { kpi: "tr_planes", area: "Transversal", nombre: "Zonas rojas con plan correctivo", unidad: "%", sentido: "mayor", verde: 100, amarillo: 80 },
];

/* ------------------------------------------------------------------ */
/* Fechas                                                             */
/* ------------------------------------------------------------------ */

const DIA = 24 * 60 * 60 * 1000;
export const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function aFecha(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor;
  if (typeof valor === "string") {
    const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
    if (soloFecha) return new Date(+soloFecha[1], +soloFecha[2] - 1, +soloFecha[3]);
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(valor.trim());
    if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1]);
    const corta = /^(\d{1,2})\s+([A-Za-zÁÉÍÓÚáéíóú]{3})\w*\s+(\d{4})$/.exec(valor.trim());
    if (corta) {
      const mes = MESES_CORTOS.findIndex((m) => m.toLowerCase() === corta[2].slice(0, 3).toLowerCase());
      if (mes >= 0) return new Date(+corta[3], mes, +corta[1]);
    }
  }
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fechaDeProyecto(p) {
  return aFecha(p?.fecha_programada) || aFecha(p?.fecha);
}

export function formatoFechaCorta(valor) {
  const d = aFecha(valor);
  if (!d) return "Sin fecha";
  return `${String(d.getDate()).padStart(2, "0")} ${MESES_CORTOS[d.getMonth()]} ${d.getFullYear()}`;
}

export function aISODate(d) {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function finDelDia(d) {
  const r = new Date(d);
  r.setHours(23, 59, 59, 999);
  return r;
}

function enRango(d, desde, hasta) {
  return !!d && d >= desde && d <= hasta;
}

function diasHabiles(inicio, fin) {
  if (!inicio || !fin || fin <= inicio) return 0;
  let dias = 0;
  const cursor = new Date(inicio);
  cursor.setHours(0, 0, 0, 0);
  const limite = new Date(fin);
  limite.setHours(0, 0, 0, 0);
  while (cursor < limite) {
    cursor.setDate(cursor.getDate() + 1);
    const dia = cursor.getDay();
    if (dia !== 0 && dia !== 6) dias += 1;
  }
  return dias;
}

/* ------------------------------------------------------------------ */
/* Utilidades numéricas y semáforo                                    */
/* ------------------------------------------------------------------ */

function pct(parte, total) {
  return total > 0 ? (parte / total) * 100 : null;
}

function promedio(valores) {
  const v = valores.filter((x) => typeof x === "number" && !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function redondear(valor) {
  if (valor == null) return null;
  const abs = Math.abs(valor);
  return abs < 10 && !Number.isInteger(valor) ? Math.round(valor * 10) / 10 : Math.round(valor);
}

export function evaluar(valor, umbral) {
  if (valor == null || !umbral) return null;
  if (umbral.sentido === "menor") {
    if (valor <= umbral.verde) return "verde";
    if (valor <= umbral.amarillo) return "amarillo";
    return "rojo";
  }
  if (valor >= umbral.verde) return "verde";
  if (valor >= umbral.amarillo) return "amarillo";
  return "rojo";
}

export const ESTADO_SEMAFORO = {
  verde: { estado: "Óptimo", color: "#10b981", text: "text-emerald-400", bg: "rgba(16,185,129,0.14)" },
  amarillo: { estado: "Atención", color: "#f59e0b", text: "text-amber-400", bg: "rgba(245,158,11,0.14)" },
  rojo: { estado: "Crítico", color: "#ef4444", text: "text-red-400", bg: "rgba(239,68,68,0.14)" },
  sinDatos: { estado: "Sin datos", color: "#71717a", text: "text-zinc-400", bg: "rgba(113,113,122,0.14)" },
};

export function formatearValor(valor, unidad) {
  if (valor == null || Number.isNaN(valor)) return "Sin datos";
  const r = redondear(valor);
  switch (unidad) {
    case "%": return `${r}%`;
    case "/5": return `${Number(valor).toFixed(1)}/5`;
    case "días hábiles": return `${r} días háb.`;
    case "días": return `${r} días`;
    case "h": return `${r} h`;
    case "% de la meta": return `${r}% de la meta`;
    default: return `${r}`;
  }
}

export function formatearMeta(umbral) {
  if (!umbral) return "";
  const signo = umbral.sentido === "menor" ? "≤" : "≥";
  return `${signo} ${formatearValor(umbral.verde, umbral.unidad)}`;
}

export function combinarUmbrales(filasBD) {
  const mapa = new Map(UMBRALES_BASE.map((u) => [u.kpi, { ...u }]));
  (filasBD || []).forEach((f) => {
    const base = mapa.get(f.kpi) || {};
    mapa.set(f.kpi, {
      ...base,
      ...f,
      verde: f.verde != null ? Number(f.verde) : base.verde,
      amarillo: f.amarillo != null ? Number(f.amarillo) : base.amarillo,
      meta: f.meta != null ? Number(f.meta) : base.meta,
    });
  });
  return mapa;
}

/* ------------------------------------------------------------------ */
/* Cálculos base sobre compromisos                                    */
/* ------------------------------------------------------------------ */

function entregadoATiempo(c) {
  const fe = aFecha(c.fecha_entrega);
  const fl = aFecha(c.fecha_limite);
  return !!fe && !!fl && fe <= fl;
}

function puntualidad(lista, desde, hasta, corte) {
  const vencidos = lista.filter((c) => {
    const fl = aFecha(c.fecha_limite);
    return fl && enRango(fl, desde, hasta) && fl <= corte;
  });
  if (!vencidos.length) return null;
  return pct(vencidos.filter(entregadoATiempo).length, vencidos.length);
}

function completados(lista, desde, hasta, corte) {
  const vencidos = lista.filter((c) => {
    const fl = aFecha(c.fecha_limite);
    return fl && enRango(fl, desde, hasta) && fl <= corte;
  });
  if (!vencidos.length) return null;
  return pct(vencidos.filter((c) => c.fecha_entrega).length, vencidos.length);
}

function horasDeRespuesta(lista, desde, hasta, corte, umbralVerde) {
  const valores = [];
  lista.forEach((c) => {
    const fs = aFecha(c.fecha_solicitud) || aFecha(c.created_at);
    if (!fs || !enRango(fs, desde, hasta)) return;
    const fe = aFecha(c.fecha_entrega);
    if (fe) {
      valores.push((fe - fs) / 36e5);
    } else {
      const transcurridas = (corte - fs) / 36e5;
      if (transcurridas > umbralVerde) valores.push(transcurridas);
    }
  });
  return promedio(valores);
}

/* ------------------------------------------------------------------ */
/* Cálculo de cada KPI                                                */
/* ------------------------------------------------------------------ */

function construirContexto(datos) {
  const proyectos = datos.proyectos || [];
  const porId = new Map(proyectos.map((p) => [p.id, p]));
  const compromisos = (datos.compromisos || []).map((c) => ({
    ...c,
    area: c.area || porId.get(c.proyecto_id)?.area || null,
  }));
  const cierres = (datos.cierres || []).map((c) => ({ ...c, proyecto: porId.get(c.proyecto_id) || null }));
  const marketing = [...(datos.marketing || [])].sort((a, b) => (aFecha(a.periodo) || 0) - (aFecha(b.periodo) || 0));
  return { proyectos, porId, compromisos, cierres, marketing, historial: datos.historial || [] };
}

function fechaDeCierre(c) {
  return aFecha(c.fecha_real_ejecucion) || fechaDeProyecto(c.proyecto);
}

function marketingDelPeriodo(ctx, hasta) {
  const filas = ctx.marketing.filter((m) => aFecha(m.periodo) && aFecha(m.periodo) <= hasta);
  const actual = filas[filas.length - 1] || null;
  const anterior = filas[filas.length - 2] || null;
  if (actual && hasta - aFecha(actual.periodo) > 62 * DIA) return { actual: null, anterior: null };
  return { actual, anterior };
}

const CALCULOS = {
  ev_cronograma(ctx, desde, hasta, corte) {
    const eventos = ctx.proyectos.filter((p) => {
      const f = fechaDeProyecto(p);
      return p.area === "Eventos" && f && enRango(f, desde, hasta) && f <= corte;
    });
    if (!eventos.length) return null;
    const enFecha = eventos.filter((p) => {
      const cierre = ctx.cierres.find((c) => c.proyecto_id === p.id);
      const real = cierre && aFecha(cierre.fecha_real_ejecucion);
      return real && real <= finDelDia(fechaDeProyecto(p));
    });
    return pct(enFecha.length, eventos.length);
  },
  ev_asistencia(ctx, desde, hasta) {
    let reales = 0;
    let aforo = 0;
    ctx.cierres.forEach((c) => {
      if (c.proyecto?.area !== "Eventos" || !enRango(fechaDeCierre(c), desde, hasta)) return;
      if (c.asistentes_reales == null || !c.proyecto.aforo_estimado) return;
      reales += Number(c.asistentes_reales);
      aforo += Number(c.proyecto.aforo_estimado);
    });
    return pct(reales, aforo);
  },
  ev_memoria(ctx, desde, hasta, corte, u) {
    const valores = [];
    ctx.cierres.forEach((c) => {
      const fr = fechaDeCierre(c);
      if (c.proyecto?.area !== "Eventos" || !enRango(fr, desde, hasta)) return;
      const fm = aFecha(c.fecha_entrega_memoria);
      if (fm) valores.push(diasHabiles(fr, fm));
      else {
        const transcurridos = diasHabiles(fr, corte);
        if (transcurridos >= u.verde) valores.push(transcurridos);
      }
    });
    return promedio(valores);
  },
  ev_satisfaccion(ctx, desde, hasta) {
    return promedio(ctx.cierres
      .filter((c) => c.proyecto?.area === "Eventos" && enRango(fechaDeCierre(c), desde, hasta) && c.satisfaccion_participantes != null)
      .map((c) => Number(c.satisfaccion_participantes)));
  },
  ev_aliados(ctx, desde, hasta) {
    return promedio(ctx.cierres
      .filter((c) => c.proyecto?.area === "Eventos" && enRango(fechaDeCierre(c), desde, hasta))
      .map((c) => Number(c.aliados_confirmados ?? 0)));
  },
  ev_incidencias(ctx, desde, hasta) {
    return promedio(ctx.cierres
      .filter((c) => c.proyecto?.area === "Eventos" && enRango(fechaDeCierre(c), desde, hasta))
      .map((c) => Number(c.incidencias_mayores ?? 0)));
  },
  ev_difusion(ctx, desde, hasta) {
    const con = ctx.cierres.filter((c) => c.proyecto?.area === "Eventos" && enRango(fechaDeCierre(c), desde, hasta));
    if (!con.length) return null;
    const cumplen = con.filter((c) => {
      const inicio = aFecha(c.inicio_difusion);
      const evento = fechaDeProyecto(c.proyecto) || fechaDeCierre(c);
      return inicio && evento && evento - inicio >= 3 * DIA;
    });
    return pct(cumplen.length, con.length);
  },

  mk_piezas(ctx, desde, hasta, corte) {
    return puntualidad(ctx.compromisos.filter((c) => c.tipo === "pieza_comunicacion"), desde, hasta, corte);
  },
  mk_calendario(ctx, desde, hasta) {
    const { actual } = marketingDelPeriodo(ctx, hasta);
    if (!actual || !actual.publicaciones_planificadas) return null;
    return pct(Number(actual.publicaciones_realizadas || 0), Number(actual.publicaciones_planificadas));
  },
  mk_seguidores(ctx, desde, hasta) {
    const { actual, anterior } = marketingDelPeriodo(ctx, hasta);
    if (!actual || !anterior || !anterior.seguidores) return null;
    return pct(Number(actual.seguidores) - Number(anterior.seguidores), Number(anterior.seguidores));
  },
  mk_engagement(ctx, desde, hasta) {
    const { actual } = marketingDelPeriodo(ctx, hasta);
    if (!actual || !actual.alcance) return null;
    return pct(Number(actual.interacciones || 0), Number(actual.alcance));
  },
  mk_cobertura(ctx, desde, hasta) {
    const con = ctx.cierres.filter((c) => enRango(fechaDeCierre(c), desde, hasta));
    if (!con.length) return null;
    return pct(con.filter((c) => c.registro_audiovisual).length, con.length);
  },
  mk_menciones(ctx, desde, hasta) {
    const { actual } = marketingDelPeriodo(ctx, hasta);
    return actual ? Number(actual.menciones_medios || 0) : null;
  },
  mk_anticipacion(ctx, desde, hasta) {
    const piezas = ctx.compromisos.filter((c) => {
      const fe = aFecha(c.fecha_entrega);
      return c.tipo === "pieza_comunicacion" && fe && aFecha(c.fecha_limite) && enRango(fe, desde, hasta);
    });
    if (!piezas.length) return null;
    return pct(piezas.filter((c) => aFecha(c.fecha_limite) - aFecha(c.fecha_entrega) >= 3 * DIA).length, piezas.length);
  },

  pr_avance(ctx, desde, hasta, corte) {
    const ratios = [];
    ctx.proyectos
      .filter((p) => p.area === "Proyectos" && p.estado_actual !== ETAPA_FINAL)
      .forEach((p) => {
        const hitos = ctx.compromisos.filter((c) => c.proyecto_id === p.id && aFecha(c.fecha_limite));
        const planificado = hitos.filter((c) => aFecha(c.fecha_limite) <= corte).length;
        if (!planificado) return;
        const real = hitos.filter((c) => aFecha(c.fecha_entrega) && aFecha(c.fecha_entrega) <= corte).length;
        ratios.push(Math.min(100, (real / planificado) * 100));
      });
    return promedio(ratios);
  },
  pr_hitos(ctx, desde, hasta, corte) {
    return puntualidad(ctx.compromisos.filter((c) => c.tipo === "hito" && c.area === "Proyectos"), desde, hasta, corte);
  },
  pr_cronograma(ctx, desde, hasta, corte) {
    const activos = ctx.proyectos.filter((p) => p.area === "Proyectos" && p.estado_actual !== ETAPA_FINAL);
    if (!activos.length) return null;
    const vigentes = activos.filter((p) => {
      const propios = ctx.compromisos.filter((c) => c.proyecto_id === p.id && aFecha(c.fecha_limite));
      if (!propios.length) return false;
      return !propios.some((c) => !c.fecha_entrega && aFecha(c.fecha_limite) < corte);
    });
    return pct(vigentes.length, activos.length);
  },
  pr_externos(ctx, desde, hasta, corte) {
    return completados(ctx.compromisos.filter((c) => c.externo && c.area === "Proyectos"), desde, hasta, corte);
  },
  pr_respuesta(ctx, desde, hasta, corte, u) {
    return horasDeRespuesta(ctx.compromisos.filter((c) => c.tipo === "respuesta_aliado" && c.area === "Proyectos"), desde, hasta, corte, u.verde);
  },
  pr_nuevos(ctx, desde, hasta, corte, u) {
    const meta = u.meta || 0;
    if (!meta) return null;
    const nuevos = ctx.proyectos.filter((p) => p.area === "Proyectos" && enRango(aFecha(p.created_at), desde, hasta)).length;
    return pct(nuevos, meta);
  },

  go_compromisos(ctx, desde, hasta, corte) {
    return puntualidad(ctx.compromisos.filter((c) => c.tipo === "compromiso_aliado"), desde, hasta, corte);
  },
  go_respuesta(ctx, desde, hasta, corte, u) {
    return horasDeRespuesta(ctx.compromisos.filter((c) => c.tipo === "respuesta_aliado"), desde, hasta, corte, u.verde);
  },
  go_satisfaccion(ctx, desde, hasta) {
    return promedio(ctx.cierres
      .filter((c) => enRango(fechaDeCierre(c), desde, hasta) && c.satisfaccion_aliados != null)
      .map((c) => Number(c.satisfaccion_aliados)));
  },
  go_activados(ctx, desde, hasta) {
    return promedio(ctx.cierres
      .filter((c) => enRango(fechaDeCierre(c), desde, hasta))
      .map((c) => Number(c.aliados_confirmados ?? 0)));
  },

  rp_reportes(ctx, desde, hasta, corte) {
    return puntualidad(ctx.compromisos.filter((c) => c.tipo === "reporte"), desde, hasta, corte);
  },
  rp_insumos(ctx, desde, hasta, corte) {
    const insumos = ctx.compromisos.filter((c) => {
      const fl = aFecha(c.fecha_limite);
      return c.tipo === "insumo_reportes" && fl && enRango(fl, desde, hasta) && fl <= corte;
    });
    if (!insumos.length) return null;
    const porArea = new Map();
    insumos.forEach((c) => {
      const clave = c.area || "Sin área";
      porArea.set(clave, (porArea.get(clave) ?? true) && entregadoATiempo(c));
    });
    return pct([...porArea.values()].filter(Boolean).length, porArea.size);
  },
  rp_consolidacion(ctx, desde, hasta) {
    return promedio(ctx.compromisos
      .filter((c) => c.tipo === "reporte" && enRango(aFecha(c.fecha_entrega), desde, hasta) && aFecha(c.fecha_solicitud))
      .map((c) => (aFecha(c.fecha_entrega) - aFecha(c.fecha_solicitud)) / DIA));
  },
  rp_calidad(ctx, desde, hasta) {
    return promedio(ctx.compromisos
      .filter((c) => c.tipo === "insumo_reportes" && enRango(aFecha(c.fecha_entrega), desde, hasta))
      .map((c) => Number(c.correcciones || 0)));
  },

  tr_externos(ctx, desde, hasta, corte) {
    return puntualidad(ctx.compromisos.filter((c) => c.externo), desde, hasta, corte);
  },
  tr_satisfaccion(ctx, desde, hasta) {
    return CALCULOS.go_satisfaccion(ctx, desde, hasta);
  },
  tr_puntualidad(ctx, desde, hasta, corte) {
    return puntualidad(ctx.compromisos, desde, hasta, corte);
  },
  tr_planes() {
    return null;
  },
};

function calcularKpi(ctx, umbral, desde, hasta, corte) {
  const fn = CALCULOS[umbral.kpi];
  if (!fn) return null;
  const valor = fn(ctx, desde, hasta, corte, umbral);
  return valor == null || Number.isNaN(valor) ? null : valor;
}

/* ------------------------------------------------------------------ */
/* Tablero completo                                                   */
/* ------------------------------------------------------------------ */

function ventana(ahora, dias, desplazamiento = 0) {
  const hasta = new Date(ahora.getTime() - desplazamiento * DIA);
  const desde = new Date(hasta.getTime() - dias * DIA);
  return { desde, hasta };
}

function resultadoKpi(ctx, u, desde, hasta, corte) {
  const valor = calcularKpi(ctx, u, desde, hasta, corte);
  const nivel = evaluar(valor, u);
  const vista = ESTADO_SEMAFORO[nivel || "sinDatos"];
  return {
    kpi: u.kpi,
    label: u.nombre,
    unidad: u.unidad,
    principal: !!u.principal,
    valorNumerico: valor,
    value: formatearValor(valor, u.unidad),
    meta: formatearMeta(u),
    nivel,
    text: vista.text,
    color: vista.color,
  };
}

const ORDEN_NIVEL = { rojo: 0, amarillo: 1, verde: 2 };

function semaforoDeArea(ctx, umbrales, area, ahora) {
  const propios = [...umbrales.values()].filter((u) => u.area === area);
  const { desde, hasta } = ventana(ahora, 30);
  const kpis = propios.map((u) => resultadoKpi(ctx, u, desde, hasta, ahora));

  const principal = kpis.find((k) => k.principal) || kpis[0];
  const conDatos = kpis.filter((k) => k.nivel);
  const referencia = principal?.nivel ? principal : conDatos.sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel])[0];
  const vista = ESTADO_SEMAFORO[referencia?.nivel || "sinDatos"];

  const rojos = kpis.filter((k) => k.nivel === "rojo").length;
  const amarillos = kpis.filter((k) => k.nivel === "amarillo").length;
  let detalle;
  if (!referencia) {
    detalle = "Sin registros en los últimos 30 días para calcular sus KPIs.";
  } else {
    const partes = [`${referencia.label}: ${referencia.value}`];
    if (rojos) partes.push(`${rojos} KPI en rojo`);
    if (amarillos) partes.push(`${amarillos} en amarillo`);
    detalle = partes.join(" · ");
  }

  const umbralPrincipal = propios.find((u) => u.kpi === principal?.kpi);
  const evolucion = [3, 2, 1, 0].map((semanasAtras, i) => {
    const v = ventana(ahora, 7, semanasAtras * 7);
    const valor = umbralPrincipal ? calcularKpi(ctx, umbralPrincipal, v.desde, v.hasta, v.hasta) : null;
    return { semana: `Sem ${i + 1}`, valor: valor == null ? null : redondear(Math.min(100, valor)) };
  });

  return {
    area,
    estado: vista.estado,
    nivel: referencia?.nivel || null,
    detalle,
    color: vista.color,
    text: vista.text,
    bg: vista.bg,
    kpis,
    kpiPrincipal: principal?.label || "Nivel de Cumplimiento",
    evolucion,
  };
}

function proyectosActivosAl(proyectos, historial, fecha) {
  return proyectos.filter((p) => {
    const creado = aFecha(p.created_at);
    if (!creado || creado > fecha) return false;
    const final = historial
      .filter((h) => h.proyecto_id === p.id && h.etapa === ETAPA_FINAL)
      .map((h) => aFecha(h.fecha_inicio))
      .filter(Boolean)[0];
    const finalizado = final || (p.estado_actual === ETAPA_FINAL ? aFecha(p.updated_at) : null);
    return !finalizado || finalizado > fecha;
  }).length;
}

function delta(actual, anterior, sufijo = "") {
  if (actual == null || anterior == null) return { delta: "—", trend: "flat" };
  const d = redondear(actual - anterior);
  if (d === 0) return { delta: `0${sufijo}`, trend: "flat" };
  return { delta: `${d > 0 ? "+" : ""}${d}${sufijo}`, trend: d > 0 ? "up" : "down" };
}

function nombreCorto(nombre, max = 18) {
  if (!nombre) return "Sin nombre";
  return nombre.length > max ? `${nombre.slice(0, max - 1)}…` : nombre;
}

function horaAuditoria(fecha, ahora) {
  const d = aFecha(fecha);
  if (!d) return "";
  const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  if (d >= hoy) return hh;
  if (d >= new Date(hoy.getTime() - DIA)) return `Ayer · ${hh}`;
  return `${formatoFechaCorta(d)} · ${hh}`;
}

export function calcularTablero(datos, filasUmbrales, ahora = new Date()) {
  const ctx = construirContexto(datos);
  const umbrales = combinarUmbrales(filasUmbrales);
  const u30 = ventana(ahora, 30);
  const u30Previo = ventana(ahora, 30, 30);
  const inicioAnio = new Date(ahora.getFullYear(), 0, 1);

  /* Semáforo por área */
  const semaforo = AREAS.map((area) => semaforoDeArea(ctx, umbrales, area, ahora));

  /* KPIs transversales */
  const transversales = [...umbrales.values()]
    .filter((u) => u.area === "Transversal")
    .map((u) => resultadoKpi(ctx, u, u30.desde, u30.hasta, ahora));

  /* Impacto organizacional del año */
  const cierresAnio = ctx.cierres.filter((c) => enRango(fechaDeCierre(c), inicioAnio, ahora));
  const sumar = (campo) => cierresAnio.reduce((acc, c) => acc + Number(c[campo] || 0), 0);
  const impacto = [
    { clave: "personas", label: `Personas impactadas ${ahora.getFullYear()}`, valor: cierresAnio.length ? sumar("asistentes_reales") : null, suffix: "pax" },
    { clave: "convenios", label: "Convenios institucionales activos", valor: null, suffix: "" },
    { clave: "voluntariado", label: "Horas de voluntariado generadas", valor: cierresAnio.length ? sumar("horas_voluntariado") : null, suffix: "hrs" },
    { clave: "social", label: "Proyectos con impacto social directo", valor: cierresAnio.length ? cierresAnio.filter((c) => c.impacto_social).length : null, suffix: "" },
  ];

  /* Proyecto de prestigio del mes */
  const mes = ahora.getMonth();
  const anio = ahora.getFullYear();
  const delMes = ctx.proyectos.filter((p) => {
    const f = fechaDeProyecto(p);
    return f && f.getMonth() === mes && f.getFullYear() === anio;
  });
  const proximos = ctx.proyectos
    .filter((p) => fechaDeProyecto(p) && fechaDeProyecto(p) >= ahora)
    .sort((a, b) => fechaDeProyecto(a) - fechaDeProyecto(b));
  const candidatos = delMes.length ? delMes : proximos.slice(0, 1);
  const prestigioBase = [...candidatos].sort((a, b) => (Number(b.aforo_estimado) || 0) - (Number(a.aforo_estimado) || 0))[0] || null;
  let prestigio = null;
  if (prestigioBase) {
    const propios = ctx.compromisos.filter((c) => c.proyecto_id === prestigioBase.id);
    const entregados = propios.filter((c) => c.fecha_entrega).length;
    prestigio = {
      proyecto: prestigioBase,
      metricas: [
        { label: "Aforo proyectado", value: prestigioBase.aforo_estimado ? `${Number(prestigioBase.aforo_estimado).toLocaleString("es-PE")} pax` : "Sin dato" },
        { label: "Compromisos entregados", value: propios.length ? `${entregados} de ${propios.length}` : "Sin registrar" },
        { label: "Avance de planificación", value: propios.length ? `${Math.round((entregados / propios.length) * 100)}%` : "Sin registrar" },
      ],
    };
  }

  /* Analítica de proyectos */
  const hitosActual = puntualidad(ctx.compromisos.filter((c) => c.tipo === "hito"), u30.desde, u30.hasta, ahora);
  const hitosPrevio = puntualidad(ctx.compromisos.filter((c) => c.tipo === "hito"), u30Previo.desde, u30Previo.hasta, u30Previo.hasta);
  const activosHoy = ctx.proyectos.filter((p) => p.estado_actual !== ETAPA_FINAL).length;
  const activosAntes = proyectosActivosAl(ctx.proyectos, ctx.historial, u30.desde);

  const duraciones = (desde, hasta) => ctx.proyectos
    .map((p) => {
      const fin = ctx.historial
        .filter((h) => h.proyecto_id === p.id && h.etapa === ETAPA_FINAL)
        .map((h) => aFecha(h.fecha_inicio))
        .filter(Boolean)[0];
      const inicio = aFecha(p.created_at);
      return fin && inicio && enRango(fin, desde, hasta) ? (fin - inicio) / DIA : null;
    })
    .filter((v) => v != null);
  const cierreActual = promedio(duraciones(new Date(ahora.getTime() - 90 * DIA), ahora));
  const cierrePrevio = promedio(duraciones(new Date(ahora.getTime() - 180 * DIA), new Date(ahora.getTime() - 90 * DIA)));
  const nuevos30 = ctx.proyectos.filter((p) => enRango(aFecha(p.created_at), u30.desde, u30.hasta)).length;

  const kpiProyectos = {
    hitos: { value: hitosActual == null ? "—" : redondear(hitosActual), suffix: hitosActual == null ? "" : "%", ...delta(hitosActual, hitosPrevio, "pp") },
    activos: { value: activosHoy, suffix: "", ...delta(activosHoy, activosAntes) },
    tiempoCierre: { value: cierreActual == null ? "—" : redondear(cierreActual), suffix: cierreActual == null ? "" : " días", ...delta(cierreActual, cierrePrevio, " días") },
    total: { value: ctx.proyectos.length, suffix: "", delta: nuevos30 ? `+${nuevos30}` : "0", trend: nuevos30 ? "up" : "flat" },
  };

  const cargaLanzamientos = [];
  for (let m = 0; m <= mes; m += 1) {
    const finMes = new Date(anio, m + 1, 0, 23, 59, 59);
    cargaLanzamientos.push({ mes: MESES_CORTOS[m], proyectos: proyectosActivosAl(ctx.proyectos, ctx.historial, finMes < ahora ? finMes : ahora) });
  }

  const distribucion = AREAS.map((area) => ({ name: area, value: ctx.proyectos.filter((p) => p.area === area).length }));

  /* Registro de auditoría */
  const eventos = [];
  ctx.proyectos.forEach((p) => {
    if (p.created_at) eventos.push({ fecha: aFecha(p.created_at), tipo: "proyecto", titulo: "Nuevo proyecto registrado", detalle: `${p.id} · ${p.nombre} · ${p.area}` });
  });
  ctx.historial.forEach((h) => {
    const p = ctx.porId.get(h.proyecto_id);
    if (h.fecha_inicio) eventos.push({ fecha: aFecha(h.fecha_inicio), tipo: "etapa", titulo: `Etapa: ${h.etapa}`, detalle: p ? `${p.id} · ${p.nombre}` : h.proyecto_id });
  });
  ctx.compromisos.forEach((c) => {
    if (c.fecha_entrega) {
      const p = ctx.porId.get(c.proyecto_id);
      eventos.push({ fecha: aFecha(c.fecha_entrega), tipo: "compromiso", titulo: entregadoATiempo(c) || !c.fecha_limite ? "Compromiso entregado" : "Compromiso entregado fuera de plazo", detalle: `${c.descripcion}${p ? ` · ${p.nombre}` : ""}` });
    }
  });
  ctx.cierres.forEach((c) => {
    if (c.created_at) eventos.push({ fecha: aFecha(c.created_at), tipo: "cierre", titulo: "Cierre registrado", detalle: c.proyecto ? `${c.proyecto.id} · ${c.proyecto.nombre}` : c.proyecto_id });
  });
  ctx.marketing.forEach((m) => {
    if (m.created_at) eventos.push({ fecha: aFecha(m.created_at), tipo: "marketing", titulo: "Métricas de Marketing registradas", detalle: `Periodo ${formatoFechaCorta(m.periodo).slice(3)}` });
  });
  const auditoria = eventos
    .filter((e) => e.fecha)
    .sort((a, b) => b.fecha - a.fecha)
    .slice(0, 6)
    .map((e) => ({ ...e, hora: horaAuditoria(e.fecha, ahora) }));

  /* Analítica de marketing */
  const { actual: mkActual, anterior: mkAnterior } = marketingDelPeriodo(ctx, ahora);
  const engagement = mkActual && mkActual.alcance ? pct(Number(mkActual.interacciones || 0), Number(mkActual.alcance)) : null;
  const engagementPrevio = mkAnterior && mkAnterior.alcance ? pct(Number(mkAnterior.interacciones || 0), Number(mkAnterior.alcance)) : null;
  const crecimiento = mkActual && mkAnterior && mkAnterior.seguidores
    ? pct(Number(mkActual.seguidores) - Number(mkAnterior.seguidores), Number(mkAnterior.seguidores))
    : null;
  const nuevosSeguidores = mkActual && mkAnterior ? Number(mkActual.seguidores) - Number(mkAnterior.seguidores) : null;

  const cierresConFecha = [...ctx.cierres]
    .filter((c) => fechaDeCierre(c))
    .sort((a, b) => fechaDeCierre(a) - fechaDeCierre(b));
  const conAlcance = cierresConFecha.filter((c) => c.alcance_digital != null).slice(-8);
  const conAsistencia = cierresConFecha.filter((c) => c.asistentes_reales != null).slice(-8);
  const promocionadosAnio = cierresAnio.filter((c) => Number(c.alcance_digital) > 0).length;
  const promocionados30 = ctx.cierres.filter((c) => Number(c.alcance_digital) > 0 && enRango(fechaDeCierre(c), u30.desde, u30.hasta)).length;

  const pendienteDeCierre = ctx.proyectos
    .filter((p) => p.area === "Eventos" && fechaDeProyecto(p) && !ctx.cierres.some((c) => c.proyecto_id === p.id))
    .sort((a, b) => Math.abs(fechaDeProyecto(a) - ahora) - Math.abs(fechaDeProyecto(b) - ahora))[0] || null;

  const marketingVista = {
    engagement: { value: engagement == null ? "—" : redondear(engagement), suffix: engagement == null ? "" : "%", ...delta(engagement, engagementPrevio, "pp") },
    seguidores: {
      value: crecimiento == null ? "—" : redondear(crecimiento),
      suffix: crecimiento == null ? "" : "%",
      delta: nuevosSeguidores == null ? "—" : `${nuevosSeguidores >= 0 ? "+" : ""}${nuevosSeguidores.toLocaleString("es-PE")}`,
      trend: nuevosSeguidores == null ? "flat" : nuevosSeguidores > 0 ? "up" : nuevosSeguidores < 0 ? "down" : "flat",
    },
    alcance: {
      value: mkActual?.alcance != null ? Number(mkActual.alcance).toLocaleString("es-PE") : "—",
      ...(mkActual?.alcance != null && mkAnterior?.alcance != null
        ? { delta: `${Number(mkActual.alcance) - Number(mkAnterior.alcance) >= 0 ? "+" : ""}${(Number(mkActual.alcance) - Number(mkAnterior.alcance)).toLocaleString("es-PE")}`, trend: Number(mkActual.alcance) >= Number(mkAnterior.alcance) ? "up" : "down" }
        : { delta: "—", trend: "flat" }),
    },
    promocionados: { value: promocionadosAnio, delta: promocionados30 ? `+${promocionados30}` : "0", trend: promocionados30 ? "up" : "flat" },
    alcancePorEvento: conAlcance.map((c) => ({ evento: nombreCorto(c.proyecto?.nombre), alcanceK: Math.round((Number(c.alcance_digital) / 1000) * 10) / 10 })),
    asistenciaPorEvento: conAsistencia.map((c) => ({ evento: nombreCorto(c.proyecto?.nombre), asistencia: Number(c.asistentes_reales) })),
    pendienteDeCierre,
  };

  /* Alertas para la campana */
  const alertas = [];
  semaforo.forEach((s) => {
    s.kpis.filter((k) => k.nivel === "rojo" || k.nivel === "amarillo").forEach((k) => {
      alertas.push({
        id: `${s.area}-${k.kpi}`,
        nivel: k.nivel,
        titulo: `${s.area} · ${k.label}`,
        detalle: `Valor actual ${k.value} · Meta ${k.meta}${k.nivel === "rojo" ? " · Requiere plan correctivo" : ""}`,
      });
    });
  });
  const vencidosPorArea = new Map();
  ctx.compromisos.forEach((c) => {
    const fl = aFecha(c.fecha_limite);
    if (fl && fl < ahora && !c.fecha_entrega) vencidosPorArea.set(c.area || "Sin área", (vencidosPorArea.get(c.area || "Sin área") || 0) + 1);
  });
  vencidosPorArea.forEach((n, area) => {
    alertas.push({ id: `vencidos-${area}`, nivel: "rojo", titulo: `${area} · Compromisos vencidos`, detalle: `${n} compromiso${n === 1 ? "" : "s"} con fecha límite vencida sin entregar.` });
  });
  alertas.sort((a, b) => ORDEN_NIVEL[a.nivel] - ORDEN_NIVEL[b.nivel]);

  return {
    semaforo,
    transversales,
    impacto,
    prestigio,
    kpiProyectos,
    cargaLanzamientos,
    distribucion,
    auditoria,
    marketing: marketingVista,
    alertas,
  };
}

/* ------------------------------------------------------------------ */
/* Utilidades para la ficha de proyecto                               */
/* ------------------------------------------------------------------ */

export function estadoCompromiso(c, ahora = new Date()) {
  const fl = aFecha(c.fecha_limite);
  const fe = aFecha(c.fecha_entrega);
  if (fe) {
    if (!fl || fe <= fl) return { etiqueta: "Entregado a tiempo", clase: "text-emerald-400" };
    return { etiqueta: "Entregado fuera de plazo", clase: "text-amber-400" };
  }
  if (fl && fl < ahora) return { etiqueta: "Vencido", clase: "text-red-400" };
  if (!fl) return { etiqueta: "Sin fecha límite", clase: "text-zinc-500" };
  return { etiqueta: "Pendiente", clase: "text-zinc-400" };
}

export function siguienteEtapa(etapaActual) {
  const i = ETAPAS.indexOf(etapaActual);
  if (etapaActual === ETAPA_FINAL) return null;
  if (i === -1) return ETAPAS[0];
  return i === ETAPAS.length - 1 ? ETAPA_FINAL : ETAPAS[i + 1];
}

export function diasEnEtapa(historial, proyectoId, ahora = new Date()) {
  const abierta = (historial || [])
    .filter((h) => h.proyecto_id === proyectoId && !h.fecha_fin)
    .map((h) => aFecha(h.fecha_inicio))
    .filter(Boolean)
    .sort((a, b) => b - a)[0];
  return abierta ? Math.max(0, Math.floor((ahora - abierta) / DIA)) : null;
}
