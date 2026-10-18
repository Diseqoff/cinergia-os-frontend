import { useState } from "react";
import { Megaphone, Plug, Trash2 } from "lucide-react";
import { supabase } from "./supabaseClient";
import { llamarApi, sincronizarInstagram } from "./api";
import { CAMPO_FORM, ETIQUETA_FORM } from "./tokens";
import { ModalRegistro, CampoNumero, CampoFecha, TituloBloque } from "./ui";

const num = (v) => (v === "" || v == null ? null : Number(v));

/* ------------------------------------------------------------------ */
/* Métricas del mes · carga manual                                    */
/* ------------------------------------------------------------------ */

export function MetricasMarketingModal({ abierto, onClose, onGuardado, registros }) {
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
          <p className="text-xs leading-relaxed text-zinc-500">
            Con Instagram conectado, los seguidores, el alcance y las interacciones se toman de los datos diarios. Lo que se escriba aquí se usa solo en los meses que no tengan todos sus días cargados. Las menciones en medios siempre se anotan aquí.
          </p>
        </div>
        <div className="flex flex-col gap-4 border-t border-zinc-800 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <TituloBloque color="emerald">2. Calendario Editorial</TituloBloque>
          <div className="grid grid-cols-2 gap-3">
            <CampoNumero label="Publicaciones planificadas" value={form.publicaciones_planificadas} onChange={set("publicaciones_planificadas")} />
            <CampoNumero label="Publicaciones realizadas" value={form.publicaciones_realizadas} onChange={set("publicaciones_realizadas")} />
          </div>
          <p className="text-xs leading-relaxed text-zinc-500">
            Las publicaciones planificadas y realizadas se cuentan solas desde el registro de publicaciones. Estos campos solo se usan para meses sin registro.
          </p>
          <p className="text-xs leading-relaxed text-zinc-500">
            Las piezas de comunicación con fecha de entrega se registran como compromisos del proyecto correspondiente, con tipo Pieza de comunicación. De ahí se calculan la puntualidad y la anticipación de 72 h.
          </p>
        </div>
      </div>
    </ModalRegistro>
  );
}

/* ------------------------------------------------------------------ */
/* Publicación · alta y edición                                       */
/* ------------------------------------------------------------------ */

const FORMATOS = [
  { valor: "imagen", etiqueta: "Imagen" },
  { valor: "carrusel", etiqueta: "Carrusel" },
  { valor: "reel", etiqueta: "Reel" },
  { valor: "video", etiqueta: "Video" },
];
const CATEGORIAS = [
  { valor: "evento", etiqueta: "Evento" },
  { valor: "convocatoria", etiqueta: "Convocatoria" },
  { valor: "resultado", etiqueta: "Resultados" },
  { valor: "institucional", etiqueta: "Institucional" },
  { valor: "otro", etiqueta: "Otro" },
];

function fechaLocalDe(valor) {
  if (!valor) return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formularioPublicacion(pub) {
  return {
    estado: pub?.estado || "publicada",
    titulo: pub?.titulo || "",
    formato: pub?.formato || "",
    categoria: pub?.categoria || "",
    proyecto_id: pub?.proyecto_id || "",
    enlace: pub?.enlace || "",
    fecha_publicacion: fechaLocalDe(pub?.fecha_publicacion) || (pub ? "" : fechaLocalDe(new Date())),
    fecha_planificada: pub?.fecha_planificada || "",
    alcance: pub?.alcance ?? "",
    me_gusta: pub?.me_gusta ?? "",
    comentarios: pub?.comentarios ?? "",
    compartidos: pub?.compartidos ?? "",
    guardados: pub?.guardados ?? "",
  };
}

export function PublicacionModal({ abierto, publicacion, proyectos, instagramConectada = false, onClose, onGuardado }) {
  const editando = !!publicacion;
  const deInstagram = publicacion?.origen === "instagram" || !!publicacion?.ig_media_id;
  const [form, setForm] = useState(() => formularioPublicacion(publicacion));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [confirmaBorrar, setConfirmaBorrar] = useState(false);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const planificada = form.estado === "planificada";
  const eventos = proyectos.filter((p) => p.area === "Eventos");

  const guardar = async () => {
    setError("");
    const enlace = form.enlace.trim();
    if (enlace && !/^https?:\/\/(www\.)?instagram\.com\//i.test(enlace)) {
      setError("El enlace debe ser de una publicación de instagram.com.");
      return;
    }
    if (planificada && !form.fecha_planificada) {
      setError("Indica la fecha planificada.");
      return;
    }
    if (!planificada && !form.fecha_publicacion) {
      setError("Indica la fecha de publicación.");
      return;
    }
    if (!planificada && !form.titulo.trim() && !enlace && !deInstagram) {
      setError("Escribe un título o pega el enlace de la publicación.");
      return;
    }
    if (!planificada && !deInstagram && !enlace && instagramConectada) {
      setError("Con Instagram conectado las publicaciones llegan solas. Pega el enlace para unirla con la de Instagram, o regístrala como planificada.");
      return;
    }

    const fila = {
      estado: form.estado,
      titulo: form.titulo.trim() || null,
      formato: form.formato || null,
      categoria: form.categoria || null,
      proyecto_id: form.proyecto_id || null,
      fecha_planificada: form.fecha_planificada || null,
      fecha_publicacion: planificada ? null : `${form.fecha_publicacion}T12:00:00-05:00`,
    };
    if (!deInstagram) {
      fila.enlace = enlace || null;
      fila.codigo = null;
      const metricas = {
        alcance: num(form.alcance), me_gusta: num(form.me_gusta), comentarios: num(form.comentarios),
        compartidos: num(form.compartidos), guardados: num(form.guardados),
      };
      Object.assign(fila, metricas);
      const conDato = ["me_gusta", "comentarios", "compartidos", "guardados"].some((k) => metricas[k] != null);
      fila.interacciones = conDato
        ? ["me_gusta", "comentarios", "compartidos", "guardados"].reduce((a, k) => a + (metricas[k] || 0), 0)
        : null;
    } else {
      // Las cifras de Instagram se actualizan solas; aquí no se tocan
      delete fila.fecha_publicacion;
      fila.estado = "publicada";
    }

    setGuardando(true);
    try {
      if (editando) {
        // Solo guarda si nadie la cambió mientras estaba abierta, por ejemplo la actualización de Instagram
        const { data: filas, error: e } = await supabase
          .from("publicaciones").update(fila).eq("id", publicacion.id).eq("updated_at", publicacion.updated_at).select("id");
        if (e) throw e;
        if (!filas?.length) {
          setError("La publicación cambió mientras la editabas. Cierra esta ventana y ábrela de nuevo.");
          return;
        }
      } else {
        const { error: e } = await supabase.from("publicaciones").insert({ ...fila, origen: "manual" });
        if (e) throw e;
      }
      await onGuardado?.();
      onClose();
    } catch (e) {
      setError(/duplicate|unique/i.test(e.message || "")
        ? "Ya existe una publicación con ese enlace."
        : "No se pudo guardar la publicación: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    setGuardando(true);
    try {
      const { error: e } = await supabase.from("publicaciones").delete().eq("id", publicacion.id);
      if (e) throw e;
      await onGuardado?.();
      onClose();
    } catch (e) {
      setError("No se pudo eliminar la publicación: " + e.message);
      setConfirmaBorrar(false);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalRegistro
      abierto={abierto}
      onClose={onClose}
      eyebrow="Área de Marketing"
      titulo={editando ? "Editar publicación" : "Registrar publicación"}
      Icono={Megaphone}
      onGuardar={guardar}
      guardando={guardando}
      error={error}
      textoGuardar={editando ? "Guardar cambios" : "Registrar publicación"}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <TituloBloque color="blue">1. La publicación</TituloBloque>
          {!deInstagram && (
            <div className="flex flex-col">
              <label className={ETIQUETA_FORM}>Estado</label>
              <select value={form.estado} onChange={(e) => set("estado")(e.target.value)} className={`${CAMPO_FORM} appearance-none`}>
                <option value="publicada">Publicada</option>
                <option value="planificada">Planificada en el calendario</option>
              </select>
            </div>
          )}
          <div className="flex flex-col">
            <label className={ETIQUETA_FORM}>Título o tema</label>
            <input value={form.titulo} onChange={(e) => set("titulo")(e.target.value)} maxLength={120} className={CAMPO_FORM} />
          </div>
          {!deInstagram && (
            <div className="flex flex-col">
              <label className={ETIQUETA_FORM}>Enlace de la publicación en Instagram</label>
              <input value={form.enlace} onChange={(e) => set("enlace")(e.target.value)} placeholder="https://www.instagram.com/p/…" className={CAMPO_FORM} />
              <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                Con el enlace, las cifras se completan solas en la siguiente actualización de Instagram.
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <label className={ETIQUETA_FORM}>Formato</label>
              <select value={form.formato} onChange={(e) => set("formato")(e.target.value)} className={`${CAMPO_FORM} appearance-none`} disabled={deInstagram && !!publicacion?.formato}>
                <option value="">Sin indicar</option>
                {FORMATOS.map((f) => <option key={f.valor} value={f.valor}>{f.etiqueta}</option>)}
              </select>
            </div>
            <div className="flex flex-col">
              <label className={ETIQUETA_FORM}>Categoría</label>
              <select value={form.categoria} onChange={(e) => set("categoria")(e.target.value)} className={`${CAMPO_FORM} appearance-none`}>
                <option value="">Sin indicar</option>
                {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col">
            <label className={ETIQUETA_FORM}>Evento relacionado</label>
            <select value={form.proyecto_id} onChange={(e) => set("proyecto_id")(e.target.value)} className={`${CAMPO_FORM} appearance-none`}>
              <option value="">Ninguno</option>
              {eventos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-zinc-800 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <TituloBloque color="emerald">{planificada ? "2. Fecha en el calendario" : "2. Fecha y resultados"}</TituloBloque>
          {planificada ? (
            <CampoFecha label="Fecha planificada" value={form.fecha_planificada} onChange={set("fecha_planificada")} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {!deInstagram && <CampoFecha label="Fecha de publicación" value={form.fecha_publicacion} onChange={set("fecha_publicacion")} />}
              <CampoFecha label="Fecha planificada, si la tenía" value={form.fecha_planificada} onChange={set("fecha_planificada")} />
            </div>
          )}
          {!planificada && !deInstagram && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <CampoNumero label="Alcance" value={form.alcance} onChange={set("alcance")} />
                <CampoNumero label="Me gusta" value={form.me_gusta} onChange={set("me_gusta")} />
                <CampoNumero label="Comentarios" value={form.comentarios} onChange={set("comentarios")} />
                <CampoNumero label="Envíos" value={form.compartidos} onChange={set("compartidos")} />
                <CampoNumero label="Guardados" value={form.guardados} onChange={set("guardados")} />
              </div>
              <p className="text-xs leading-relaxed text-zinc-500">
                Las cifras son opcionales. Si la cuenta está conectada y pegaste el enlace, Instagram las reemplaza con las reales.
              </p>
            </>
          )}
          {deInstagram && (
            <p className="text-xs leading-relaxed text-zinc-500">
              Esta publicación llegó desde Instagram. Alcance, interacciones y fecha se actualizan solos. Aquí solo se indica a qué evento y categoría pertenece.
            </p>
          )}
          {editando && !deInstagram && (
            <div className="mt-2 border-t border-zinc-800 pt-4">
              {confirmaBorrar ? (
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-400">Se eliminará esta publicación.</span>
                  <button onClick={eliminar} disabled={guardando} className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-500 disabled:opacity-60">Eliminar</button>
                  <button onClick={() => setConfirmaBorrar(false)} className="text-zinc-400 hover:text-zinc-200">Cancelar</button>
                </div>
              ) : (
                <button onClick={() => setConfirmaBorrar(true)} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-red-400">
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar publicación
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </ModalRegistro>
  );
}

/* ------------------------------------------------------------------ */
/* Conexión con Instagram · solo SuperAdmin                           */
/* ------------------------------------------------------------------ */

export function InstagramModal({ abierto, conexion, onClose, onCambio }) {
  const [token, setToken] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const conectada = !!conexion?.conectada;

  const conectar = async () => {
    setError("");
    setAviso("");
    if (!token.trim()) {
      setError("Pega el token de acceso que generó Meta.");
      return;
    }
    setProcesando(true);
    try {
      const r = await llamarApi("/api/instagram/token", { method: "POST", body: { access_token: token.trim() } });
      setToken("");
      setAviso(`Cuenta conectada: @${r.data.usuario}. Cargando publicaciones…`);
      try {
        await sincronizarInstagram();
        setAviso(`Cuenta conectada: @${r.data.usuario}. Las publicaciones y métricas ya están cargadas.`);
      } catch (e) {
        setAviso(`Cuenta conectada: @${r.data.usuario}. La primera carga no terminó: ${e.message}`);
      }
      await onCambio?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  };

  const desconectar = async () => {
    setError("");
    setAviso("");
    setProcesando(true);
    try {
      await llamarApi("/api/instagram/token", { method: "DELETE" });
      setAviso("Conexión eliminada. Las publicaciones ya cargadas se conservan.");
      await onCambio?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <ModalRegistro
      abierto={abierto}
      onClose={onClose}
      eyebrow="Área de Marketing"
      titulo="Conexión con Instagram"
      Icono={Plug}
      onGuardar={conectar}
      guardando={procesando}
      error={error}
      textoGuardar={conectada ? "Reemplazar token" : "Conectar cuenta"}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <TituloBloque color="blue">1. Estado</TituloBloque>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 text-xs leading-relaxed text-zinc-400">
            {conectada ? (
              <>
                <p className="text-sm font-medium text-zinc-200">Conectada como @{conexion.usuario}</p>
                <p className="mt-1">Última actualización: {conexion.ultima_sincronizacion ? new Date(conexion.ultima_sincronizacion).toLocaleString("es-PE") : "todavía ninguna"}</p>
                <p>Publicaciones sincronizadas: {conexion.publicaciones_sincronizadas ?? 0}</p>
                {conexion.token_expira && <p>El acceso vence el {new Date(conexion.token_expira).toLocaleDateString("es-PE")} y se renueva solo.</p>}
                {conexion.ultimo_error && <p className="mt-2 text-red-400">Último error: {conexion.ultimo_error}</p>}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-zinc-200">Sin conexión</p>
                {conexion?.ultimo_error && <p className="mt-1 text-red-400">Último error: {conexion.ultimo_error}</p>}
                <p className="mt-1">Con la cuenta conectada, las publicaciones, el alcance, las interacciones y los seguidores se cargan solos una vez al día.</p>
              </>
            )}
          </div>
          {conectada && (
            <button onClick={desconectar} disabled={procesando} className="self-start text-xs text-zinc-500 hover:text-red-400 disabled:opacity-60">
              Eliminar la conexión
            </button>
          )}
          {aviso && <div className="rounded-lg border border-emerald-900/30 bg-emerald-500/10 p-3 text-xs text-emerald-400">{aviso}</div>}
        </div>

        <div className="flex flex-col gap-4 border-t border-zinc-800 pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
          <TituloBloque color="emerald">2. Token de acceso</TituloBloque>
          <div className="flex flex-col">
            <label className={ETIQUETA_FORM}>Token generado en el panel de Meta</label>
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} className={CAMPO_FORM} />
          </div>
          <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-zinc-500">
            <li>Entra a developers.facebook.com con la cuenta que administra el Instagram de Cinergia.</li>
            <li>Abre la aplicación de tipo Business y ve a Instagram, Configuración de la API con inicio de sesión de Instagram.</li>
            <li>Agrega la cuenta de Cinergia y pulsa Generar token.</li>
            <li>Copia el token y pégalo aquí. No lo compartas por otros medios.</li>
          </ol>
        </div>
      </div>
    </ModalRegistro>
  );
}
