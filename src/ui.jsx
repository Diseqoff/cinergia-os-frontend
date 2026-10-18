import { X, CheckCircle2 } from "lucide-react";
import { PANEL, CAMPO_FORM, ETIQUETA_FORM } from "./tokens";

export function ChartTooltip({ active, payload, label, unit = "" }) {
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

export function SectionHeader({ eyebrow, title, subtitle }) {
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

export function ModalRegistro({ abierto, onClose, eyebrow, titulo, Icono, children, onGuardar, guardando, error, textoGuardar }) {
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

export function CampoNumero({ label, value, onChange, step = "1", min = "0", max }) {
  return (
    <div className="flex flex-col">
      <label className={ETIQUETA_FORM}>{label}</label>
      <input type="number" step={step} min={min} max={max} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={CAMPO_FORM} />
    </div>
  );
}

export function CampoFecha({ label, value, onChange }) {
  return (
    <div className="flex flex-col">
      <label className={ETIQUETA_FORM}>{label}</label>
      <input type="date" value={value || ""} onChange={(e) => onChange(e.target.value)} className={CAMPO_FORM} />
    </div>
  );
}

export function TituloBloque({ color, children }) {
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
