/* Cálculo de lo que muestra la pantalla de Analítica de Marketing.
   Todo sale de las tablas de la base; nada se inventa aquí. */

import { seriesMensuales, aFecha, aISODate, combinarUmbrales, MESES_CORTOS } from "./kpis.js";

const DIA = 24 * 60 * 60 * 1000;

export const KPIS_MARKETING = [
  { id: "mk_piezas", grupo: "entregas" },
  { id: "mk_anticipacion", grupo: "entregas" },
  { id: "mk_calendario", grupo: "entregas" },
  { id: "mk_cobertura", grupo: "entregas" },
  { id: "mk_seguidores", grupo: "audiencia" },
  { id: "mk_engagement", grupo: "audiencia" },
  { id: "mk_menciones", grupo: "audiencia" },
];

export const NOMBRE_NIVEL = { verde: "Bueno", amarillo: "Normal", rojo: "Malo" };
export const FUENTES_DIFUSION = ["WhatsApp", "Instagram", "Visita a aulas", "Amigos", "Otro"];

/* Promedios de cuentas universitarias de Instagram según Meet Your Class */
export const REFERENCIA_FORMATO = { Video: 3.06, Carrusel: 2.41, Imagen: 1.11 };

/* ------------------------------------------------------------------ */
/* Formato                                                            */
/* ------------------------------------------------------------------ */

const conMiles = (t) => t.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export function fmt(n, decimales = 1) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const [entero, fraccion] = Number(n).toFixed(decimales).split(".");
  return conMiles(entero) + (fraccion ? "," + fraccion : "");
}

export const fmt0 = (n) => fmt(n, 0);

export function fechaLarga(valor) {
  const d = aFecha(valor);
  return d ? `${d.getDate()} ${MESES_CORTOS[d.getMonth()].toLowerCase()} ${d.getFullYear()}` : "Sin fecha";
}

const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ------------------------------------------------------------------ */
/* Resumen mensual: Instagram + lo registrado a mano                  */
/* ------------------------------------------------------------------ */

/* Une, mes a mes, lo que carga la sincronización con lo que escribe el equipo.
   - Seguidores: último dato diario del mes; si no hay, el manual.
   - Alcance e interacciones: suma de los días solo si el mes tiene todos sus
     días cargados hasta ayer; si falta alguno, se usa lo manual.
   - Realizadas y planificadas: cuenta de publicaciones del mes; si es cero, lo manual.
   - Menciones en medios: siempre manual; sin registro del mes queda vacío, no cero.
   Los meses sin seguidores se descartan porque no sirven para el semáforo. */
export function combinarMetricasMensuales(manuales, diario, publicaciones, ahora = new Date()) {
  const meses = new Map();
  const fila = (clave) => {
    if (!meses.has(clave)) meses.set(clave, { manual: null, dias: [], realizadas: 0, planificadas: 0 });
    return meses.get(clave);
  };
  const claveDe = (valor) => {
    const d = aFecha(valor);
    return d ? clavesMes(d) : null;
  };

  (manuales || []).forEach((m) => { const c = claveDe(m.periodo); if (c) fila(c).manual = m; });
  (diario || []).forEach((d) => { const c = claveDe(d.fecha); if (c) fila(c).dias.push(d); });
  (publicaciones || []).forEach((p) => {
    if (p.estado === "publicada") { const c = claveDe(p.fecha_publicacion); if (c) fila(c).realizadas += 1; }
    const cp = claveDe(p.fecha_planificada);
    if (cp) fila(cp).planificadas += 1;
  });

  const ayer = aISODate(new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - 1));

  return [...meses.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([clave, { manual, dias, realizadas, planificadas }]) => {
      const [anio, mes] = clave.split("-").map(Number);
      const ultimoDia = aISODate(new Date(anio, mes, 0));
      const hasta = ultimoDia < ayer ? ultimoDia : ayer;
      const porFecha = new Map(dias.map((d) => [String(d.fecha).slice(0, 10), d]));

      const conSeguidores = dias.filter((d) => d.seguidores != null).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
      const seguidores = conSeguidores.length ? conSeguidores[0].seguidores : manual?.seguidores ?? null;

      let completo = hasta >= `${clave}-01`;
      let alcance = 0;
      let interacciones = 0;
      for (let dia = 1; completo && dia <= Number(hasta.slice(8, 10)); dia += 1) {
        const d = porFecha.get(`${clave}-${String(dia).padStart(2, "0")}`);
        if (!d || d.alcance == null) completo = false;
        else { alcance += Number(d.alcance); interacciones += Number(d.interacciones || 0); }
      }

      return {
        periodo: `${clave}-01`,
        seguidores,
        alcance: completo ? alcance : manual?.alcance ?? null,
        interacciones: completo ? interacciones : manual?.interacciones ?? null,
        publicaciones_realizadas: realizadas > 0 ? realizadas : manual?.publicaciones_realizadas ?? null,
        publicaciones_planificadas: planificadas > 0 ? planificadas : manual?.publicaciones_planificadas ?? null,
        menciones_medios: manual ? manual.menciones_medios : null,
        created_at: manual?.created_at ?? null,
      };
    })
    .filter((f) => f.seguidores != null);
}

/* ------------------------------------------------------------------ */
/* KPIs y series                                                      */
/* ------------------------------------------------------------------ */

function decimalesDe(u) {
  return u.unidad === "%" && u.verde >= 10 ? 0 : u.unidad === "%" ? 1 : 0;
}

function rangoVertical(u, puntos) {
  const valores = puntos.map((p) => p.valor).filter((v) => v != null);
  const maximo = Math.max(u.verde, ...valores);
  const minimo = Math.min(u.amarillo, ...valores);
  if (u.unidad === "%" && u.verde >= 50) {
    return [Math.max(0, Math.floor((minimo - 10) / 10) * 10), 100];
  }
  const techo = Math.max(maximo * 1.25, u.verde * 1.2);
  const paso = techo <= 10 ? 1 : 5;
  return [0, Math.max(paso, Math.ceil(techo / paso) * paso)];
}

function armarKpis(datos, umbralesBD, ahora) {
  const ids = KPIS_MARKETING.map((k) => k.id);
  const series = seriesMensuales(datos, umbralesBD, ids, 6, ahora);
  const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;
  return KPIS_MARKETING.map(({ id, grupo }) => {
    const { umbral, puntos } = series[id];
    const ultimo = [...puntos].reverse().find((p) => p.valor != null) || null;
    return {
      id,
      grupo,
      nombre: umbral.nombre,
      unidad: umbral.unidad,
      verde: umbral.verde,
      amarillo: umbral.amarillo,
      principal: !!umbral.principal,
      decimales: decimalesDe(umbral),
      puntos,
      actual: ultimo ? ultimo.valor : null,
      nivel: ultimo ? ultimo.nivel : null,
      mesDelDato: ultimo && ultimo.periodo !== mesActual ? ultimo.etiqueta : null,
      rango: rangoVertical(umbral, puntos),
    };
  });
}

/* ------------------------------------------------------------------ */
/* Pedidos de Marketing                                               */
/* ------------------------------------------------------------------ */

function estadoPedido(c, ahora) {
  const limite = aFecha(c.fecha_limite);
  const entrega = aFecha(c.fecha_entrega);
  if (entrega) {
    if (!limite) return { clave: "verde", texto: "Entregada" };
    const dias = Math.floor((limite - entrega) / DIA);
    if (entrega <= limite) return { clave: "verde", texto: dias >= 1 ? `A tiempo, ${plural(dias, "día", "días")} antes` : "A tiempo" };
    return { clave: "rojo", texto: `Entregada tarde, ${plural(Math.max(1, Math.ceil((entrega - limite) / DIA)), "día", "días")}` };
  }
  if (!limite) return { clave: "gris", texto: "Sin fecha límite" };
  const restante = (limite - ahora) / DIA;
  if (restante < 0) return { clave: "rojo", texto: `Atrasada, ${plural(Math.max(1, Math.ceil(-restante)), "día", "días")}` };
  if (restante <= 3) {
    const dias = Math.ceil(restante);
    return { clave: "amarillo", texto: dias <= 0 ? "Vence hoy" : `Vence en ${plural(dias, "día", "días")}` };
  }
  return { clave: "gris", texto: "En plazo" };
}

function armarPedidos(datos, ahora) {
  const proyectos = new Map((datos.proyectos || []).map((p) => [p.id, p]));
  const piezas = (datos.compromisos || [])
    .filter((c) => c.tipo === "pieza_comunicacion")
    .map((c) => ({
      id: c.id,
      evento: proyectos.get(c.proyecto_id)?.nombre || "Sin evento",
      pieza: c.descripcion,
      limite: c.fecha_limite,
      entregada: c.fecha_entrega,
      estado: estadoPedido(c, ahora),
    }));
  const porAtender = piezas
    .filter((p) => !p.entregada)
    .sort((a, b) => (aFecha(a.limite) || new Date(8.64e15)) - (aFecha(b.limite) || new Date(8.64e15)));
  const completadas = piezas
    .filter((p) => p.entregada)
    .sort((a, b) => aFecha(b.entregada) - aFecha(a.entregada));
  return { porAtender, completadas };
}

/* ------------------------------------------------------------------ */
/* Redes: calendario y seguidores                                     */
/* ------------------------------------------------------------------ */

function armarCalendario(kpis, filasMarketing) {
  const base = kpis.find((k) => k.id === "mk_calendario").puntos;
  return base.map((p) => {
    const fila = (filasMarketing || []).find((m) => (m.periodo || "").slice(0, 7) === p.periodo);
    return {
      mes: p.etiqueta,
      planificadas: fila?.publicaciones_planificadas ?? null,
      realizadas: fila?.publicaciones_realizadas ?? null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Contenido                                                          */
/* ------------------------------------------------------------------ */

function grupoDeFormato(formato) {
  if (formato === "reel" || formato === "video") return "Video";
  if (formato === "carrusel") return "Carrusel";
  if (formato === "imagen") return "Imagen";
  return null;
}

function clavesMes(fecha) {
  return fecha ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}` : null;
}

function seguidoresDeReferencia(diario, filasMarketing) {
  const conDato = [...(diario || [])].filter((d) => d.seguidores != null).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  if (conDato.length) return Number(conDato[0].seguidores);
  const mensual = [...(filasMarketing || [])].sort((a, b) => (a.periodo < b.periodo ? 1 : -1))[0];
  return mensual ? Number(mensual.seguidores) : null;
}

function armarContenido(publicaciones, diario, filasMarketing, proyectos, ahora) {
  const publicadas = (publicaciones || []).filter((p) => p.estado === "publicada" && aFecha(p.fecha_publicacion));
  const mesActual = clavesMes(ahora);
  const meses = [...new Set(publicadas.map((p) => clavesMes(aFecha(p.fecha_publicacion))))].sort();
  const mes = meses.includes(mesActual) ? mesActual : meses[meses.length - 1] || null;
  const seguidores = seguidoresDeReferencia(diario, filasMarketing);
  const nombresProyecto = new Map((proyectos || []).map((p) => [p.id, p.nombre]));

  const posts = publicadas
    .filter((p) => clavesMes(aFecha(p.fecha_publicacion)) === mes)
    .map((p) => {
      const grupo = grupoDeFormato(p.formato);
      const eng = seguidores && p.interacciones != null ? (Number(p.interacciones) / seguidores) * 100 : null;
      return {
        id: p.id,
        titulo: p.titulo || (grupo ? `${grupo} del ${fechaLarga(p.fecha_publicacion)}` : `Publicación del ${fechaLarga(p.fecha_publicacion)}`),
        formato: grupo,
        alcance: p.alcance,
        envios: p.compartidos,
        interacciones: p.interacciones,
        eng,
        enlace: p.enlace,
        evento: nombresProyecto.get(p.proyecto_id) || null,
        original: p,
      };
    });

  const conEng = posts.filter((p) => p.eng != null);
  const porFormato = ["Video", "Carrusel", "Imagen"]
    .map((f) => {
      const lista = conEng.filter((p) => p.formato === f);
      return { formato: f, publicaciones: lista.length, eng: lista.length ? lista.reduce((a, p) => a + p.eng, 0) / lista.length : null, referencia: REFERENCIA_FORMATO[f] };
    })
    .filter((f) => f.publicaciones > 0);

  const ordenadas = [...porFormato].sort((a, b) => b.eng - a.eng);
  const conAlcance = posts.filter((p) => p.alcance != null);
  return {
    mes,
    etiquetaMes: mes ? mesNombre(mes) : null,
    seguidores,
    posts,
    porFormato,
    resumen: {
      total: posts.length,
      alcanceTotal: conAlcance.length ? conAlcance.reduce((a, p) => a + Number(p.alcance), 0) : null,
      engPromedio: conEng.length ? conEng.reduce((a, p) => a + p.eng, 0) / conEng.length : null,
      mejorFormato: ordenadas[0] || null,
      peorFormato: ordenadas.length > 1 ? ordenadas[ordenadas.length - 1] : null,
    },
  };
}

const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
function mesNombre(clave) {
  return NOMBRES_MES[Number(clave.slice(5, 7)) - 1];
}

/* ------------------------------------------------------------------ */
/* Difusión a asistencia                                              */
/* ------------------------------------------------------------------ */

function armarEventos(cierres, proyectos) {
  const porId = new Map((proyectos || []).map((p) => [p.id, p]));
  return (cierres || [])
    .filter((c) => c.inscritos != null || c.asistentes_reales != null)
    .map((c) => ({
      id: c.proyecto_id,
      nombre: porId.get(c.proyecto_id)?.nombre || c.proyecto_id,
      fecha: aFecha(c.fecha_real_ejecucion),
      inscritos: c.inscritos,
      asistieron: c.asistentes_reales,
      participantes: c.participantes_totales,
      encuesta: c.respuestas_encuesta,
      meta: c.meta_asistencia,
      alcance: c.alcance_digital,
      fuentes: c.fuentes_difusion && typeof c.fuentes_difusion === "object" ? c.fuentes_difusion : {},
    }))
    .sort((a, b) => (a.fecha || 0) - (b.fecha || 0));
}

export function sumarEventos(eventos) {
  const suma = (campo) => {
    const valores = eventos.map((e) => e[campo]).filter((v) => v != null);
    return valores.length ? valores.reduce((a, v) => a + Number(v), 0) : null;
  };
  const fuentes = {};
  eventos.forEach((e) => Object.entries(e.fuentes).forEach(([k, v]) => { fuentes[k] = (fuentes[k] || 0) + Number(v || 0); }));
  return {
    id: "todos",
    nombre: "Todos los eventos del ciclo",
    inscritos: suma("inscritos"),
    asistieron: suma("asistieron"),
    participantes: suma("participantes"),
    encuesta: suma("encuesta"),
    meta: null,
    alcance: suma("alcance"),
    fuentes,
    todos: true,
  };
}

/* ------------------------------------------------------------------ */
/* Alertas                                                            */
/* ------------------------------------------------------------------ */

function armarAlertas({ pedidos, conexion, filasMarketing, proyectos, cierres, ahora }) {
  const alertas = [];
  const atrasadas = pedidos.porAtender.filter((p) => p.estado.clave === "rojo");
  atrasadas.slice(0, 3).forEach((p) => alertas.push({
    nivel: "rojo",
    titulo: `${p.pieza} de ${p.evento} está atrasada.`,
    detalle: `Su fecha límite fue el ${fechaLarga(p.limite)}.`,
  }));
  if (atrasadas.length > 3) alertas.push({ nivel: "rojo", titulo: `${atrasadas.length - 3} piezas más están atrasadas.`, detalle: "Revisa la lista de pedidos por atender." });
  pedidos.porAtender.filter((p) => p.estado.clave === "amarillo").slice(0, 3).forEach((p) => alertas.push({
    nivel: "amarillo",
    titulo: `${p.pieza} de ${p.evento}: ${p.estado.texto.toLowerCase()}.`,
    detalle: `Fecha límite ${fechaLarga(p.limite)}.`,
  }));

  const mesActual = clavesMes(ahora);
  const hayMetricasDelMes = (filasMarketing || []).some((m) => (m.periodo || "").slice(0, 7) === mesActual);
  if (!hayMetricasDelMes) {
    alertas.push({
      nivel: "amarillo",
      titulo: "Sin métricas de este mes.",
      detalle: conexion?.conectada
        ? "La conexión con Instagram aún no entregó datos de este mes."
        : "Faltan seguidores y alcance de este mes para calcular el semáforo.",
    });
  }
  if (conexion?.ultimo_error) {
    alertas.push({ nivel: "rojo", titulo: "La última actualización de Instagram falló.", detalle: conexion.ultimo_error });
  }
  const expira = aFecha(conexion?.token_expira);
  if (conexion?.conectada && expira) {
    const dias = Math.ceil((expira - ahora) / DIA);
    if (dias <= 10) alertas.push({ nivel: dias <= 3 ? "rojo" : "amarillo", titulo: "El acceso a Instagram está por vencer.", detalle: `Quedan ${plural(Math.max(0, dias), "día", "días")} y la renovación automática no se completó. Si vence, un SuperAdmin debe generar un token nuevo.` });
  }

  const cerrados = new Set((cierres || []).map((c) => c.proyecto_id));
  (proyectos || [])
    .filter((p) => p.area === "Eventos" && !cerrados.has(p.id))
    .filter((p) => {
      const f = aFecha(p.fecha_programada) || aFecha(p.fecha);
      return f && f < ahora && ahora - f < 45 * DIA;
    })
    .slice(0, 3)
    .forEach((p) => alertas.push({
      nivel: "amarillo",
      titulo: `${p.nombre} no tiene cierre registrado.`,
      detalle: "Sin el cierre no entra al embudo de difusión a asistencia ni a la cobertura audiovisual.",
    }));

  const orden = { rojo: 0, amarillo: 1 };
  return alertas.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

/* ------------------------------------------------------------------ */
/* Entrada principal                                                  */
/* ------------------------------------------------------------------ */

export function vistaMarketing({ datos: original, ahora = new Date() }) {
  const mensual = combinarMetricasMensuales(original.marketing, original.instagramDiario, original.publicaciones, ahora);
  const datos = { ...original, marketing: mensual };
  const umbralesBD = datos.umbrales || [];
  const kpis = armarKpis(datos, umbralesBD, ahora);
  const pedidos = armarPedidos(datos, ahora);
  const contenido = armarContenido(datos.publicaciones, datos.instagramDiario, datos.marketing, datos.proyectos, ahora);
  const eventos = armarEventos(datos.cierres, datos.proyectos);
  const umbralEng = combinarUmbrales(umbralesBD).get("mk_engagement");
  return {
    kpis,
    principal: kpis.find((k) => k.principal) || kpis[0],
    pedidos,
    calendario: armarCalendario(kpis, datos.marketing),
    seguidores: kpis.find((k) => k.id === "mk_seguidores"),
    contenido: { ...contenido, umbralEng: { verde: umbralEng.verde, amarillo: umbralEng.amarillo } },
    eventos,
    alertas: armarAlertas({
      pedidos, conexion: datos.instagramConexion, filasMarketing: datos.marketing,
      proyectos: datos.proyectos, cierres: datos.cierres, ahora,
    }),
  };
}
