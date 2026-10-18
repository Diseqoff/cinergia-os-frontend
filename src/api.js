import { supabase } from "./supabaseClient";

// Motor de ingestión de actas y administración de cuentas (FastAPI).
// VITE_API_URL define el servidor; sin esa variable se usa el de producción.
const API_BASE_URL = import.meta.env.VITE_API_URL || "https://cinergia-os-frontend.onrender.com";

export async function llamarApi(ruta, { method = "GET", body, formData } = {}) {
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
  if (!resp.ok) {
    // FastAPI devuelve texto en los errores propios y una lista en los de validación
    const detalle = Array.isArray(json.detail)
      ? json.detail.map((d) => d?.msg).filter(Boolean).join(". ")
      : typeof json.detail === "string" ? json.detail : "";
    throw new Error(detalle || "El servidor rechazó la solicitud.");
  }
  return json;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function leerEstadoInstagram() {
  const { data } = await supabase
    .from("instagram_conexion")
    .select("conectada, ultima_sincronizacion, ultimo_error, publicaciones_sincronizadas, updated_at")
    .eq("id", 1)
    .maybeSingle();
  return data || null;
}

/* La actualización corre en el servidor en segundo plano. Se pide, y luego se
   consulta el estado de la conexión hasta que el servidor la marque como terminada.
   Devuelve { ok: true, estado } o lanza un Error con el motivo. */
export async function sincronizarInstagram({ cadaMs = 3000, maximoMs = 180000 } = {}) {
  const antes = await leerEstadoInstagram();
  await llamarApi("/api/instagram/sincronizar", { method: "POST" });
  const inicio = Date.now();
  while (Date.now() - inicio < maximoMs) {
    await esperar(cadaMs);
    const ahora = await leerEstadoInstagram();
    if (!ahora || ahora.updated_at === antes?.updated_at) continue;
    if (!ahora.conectada) throw new Error(ahora.ultimo_error || "Instagram dejó de estar conectado.");
    if (ahora.ultima_sincronizacion !== antes?.ultima_sincronizacion) return { ok: true, estado: ahora };
    if (ahora.ultimo_error) throw new Error(ahora.ultimo_error);
  }
  throw new Error("La actualización sigue en curso. Revisa de nuevo en unos minutos.");
}
