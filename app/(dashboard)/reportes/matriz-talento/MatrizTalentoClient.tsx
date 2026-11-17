"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Grid2X2, AlertCircle } from "lucide-react";
import { createAnyClient } from "@/lib/supabase/client";

// ── Grupos de filtro ──────────────────────────────────────────────
const GRUPOS = [
  {
    id: "dg",
    sigla: "D/G",
    label: "Directores y Gerentes",
    cargos: [
      "Socio", "Director de Proyectos", "Director",
      "Gerente de Proyectos", "Gerente",
      "Director / Gerente de Proyectos",
    ],
  },
  {
    id: "asr",
    sigla: "A/Sr",
    label: "Consultores Senior y Asociados",
    cargos: ["Asociado", "Consultor Senior", "Asociado / Consultor Senior"],
  },
  {
    id: "c",
    sigla: "C",
    label: "Consultores, Analistas y Trainees",
    cargos: [
      "Consultor de Proyectos", "Consultor Proyecto", "Consultor",
      "Consultor Analista", "Analista Senior",
      "Consultor Trainee", "Analista", "Practicante",
    ],
  },
  {
    id: "todos",
    sigla: "Todos",
    label: "Toda la empresa",
    cargos: null as string[] | null, // null = sin filtro
  },
] as const;

// ── Colores por cargo ─────────────────────────────────────────────
const COLORES_CARGO: Record<string, string> = {
  "Socio":                    "#1a1a2e",
  "Director de Proyectos":    "#4a90e2",
  "Director":                 "#4a90e2",
  "Gerente de Proyectos":     "#7c5cbf",
  "Gerente":                  "#7c5cbf",
  "Asociado":                 "#e2884a",
  "Consultor Senior":         "#4ab89a",
  "Consultor de Proyectos":   "#e24a6a",
  "Consultor Analista":       "#a0b84a",
  "Consultor Trainee":        "#c07c4a",
};
const COLOR_DEFAULT = "#94a3b8";

// ── 9 cuadrantes (fila 0 = alto potencial) ───────────────────────
const BOXES = [
  { title: "Diamante en bruto",          bg: "#8c9e99", text: "#fff" },
  { title: "Talento Emergente",           bg: "#4a7075", text: "#fff" },
  { title: "Futuro Líder",                bg: "#1e5f5a", text: "#fff" },
  { title: "Talento Inconsistente",       bg: "#b8c0bb", text: "#333" },
  { title: "Futuro Prometedor",           bg: "#607d8b", text: "#fff" },
  { title: "Talento en Desarrollo",       bg: "#38a89d", text: "#fff" },
  { title: "Talento en Riesgo",           bg: "#e05555", text: "#fff" },
  { title: "Talento Estancado",           bg: "#8fa0a8", text: "#fff" },
  { title: "Profesional Experimentado",  bg: "#e07b2a", text: "#fff" },
];

// Etiquetas de fila/col para los ejes
const ROW_LABELS = ["Alto", "Medio", "Bajo"];
const COL_LABELS = ["Bajo", "Esperado", "Excelente"];

const B1 = 7 / 3;
const B2 = 11 / 3;

function getBoxIndex(pot: number, des: number): number {
  const row = pot > B2 ? 0 : pot > B1 ? 1 : 2;
  const col = des <= B1 ? 0 : des <= B2 ? 1 : 2;
  return row * 3 + col;
}
function iniciales(n: string, a: string) {
  return `${n[0] ?? ""}${a[0] ?? ""}`.toUpperCase();
}
/** Score 1-5 → 5-95% (padding evita clipping en bordes) */
function toCoords(desempeno: number, potencial: number) {
  const x = 5 + ((desempeno - 1) / 4) * 90;
  const y = 5 + ((potencial  - 1) / 4) * 90;
  return { x, y };
}
/** Radio del badge (w-7 = 28px) + ring-2 (2px) */
const BADGE_R = 16;
/** Distancia mínima entre centros: dos radios + 2px de aire */
const MIN_DIST = BADGE_R * 2 + 2;
/** Espacio reservado arriba de cada celda para su título */
const TITLE_PAD = 22;

/**
 * Calcula la posición en píxeles de cada badge sin que se toquen.
 * 1) Parte de la coordenada real (puntaje).
 * 2) Empuja los círculos que chocan hasta separarlos (varias pasadas).
 * 3) Cada badge queda siempre dentro de su celda del 9-box, para no
 *    mostrar a nadie en una categoría que no es la suya.
 */
function calcularPosiciones(
  lista: { id: string; talento_desempeno: number | null; talento_potencial: number | null }[],
  w: number,
  h: number,
) {
  const cw = w / 3, ch = h / 3;
  const nodos = [...lista].sort((a, b) => a.id.localeCompare(b.id)).map((p, i) => {
    const des = p.talento_desempeno!, pot = p.talento_potencial!;
    const idx = getBoxIndex(pot, des);
    const col = idx % 3, row = Math.floor(idx / 3);
    // Límites de la celda (centro del badge)
    const minX = col * cw + BADGE_R + 2, maxX = (col + 1) * cw - BADGE_R - 2;
    const minY = row * ch + TITLE_PAD + BADGE_R, maxY = (row + 1) * ch - BADGE_R - 2;
    const { x, y } = toCoords(des, pot);
    // Semilla mínima (ángulo áureo) para que puntos idénticos puedan separarse
    const ang = i * 2.39996;
    return {
      id: p.id, minX, maxX, minY, maxY,
      x: (x / 100) * w + Math.cos(ang) * 0.5,
      y: h - (y / 100) * h + Math.sin(ang) * 0.5,
    };
  });
  const clamp = (n: typeof nodos[number]) => {
    n.x = Math.min(Math.max(n.x, n.minX), Math.max(n.minX, n.maxX));
    n.y = Math.min(Math.max(n.y, n.minY), Math.max(n.minY, n.maxY));
  };
  nodos.forEach(clamp);
  for (let iter = 0; iter < 120; iter++) {
    let movido = false;
    for (let i = 0; i < nodos.length; i++) {
      for (let j = i + 1; j < nodos.length; j++) {
        const a = nodos[i], b = nodos[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= MIN_DIST) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        // Cada uno se aleja la mitad de lo que falta
        const push = (MIN_DIST - d) / 2 / d;
        a.x -= dx * push; a.y -= dy * push;
        b.x += dx * push; b.y += dy * push;
        clamp(a); clamp(b);
        movido = true;
      }
    }
    if (!movido) break;
  }
  return new Map(nodos.map(n => [n.id, { left: n.x, top: n.y }]));
}

interface Persona {
  id: string;
  nombre: string;
  apellido: string;
  cargo_actual: string | null;
  talento_potencial: number | null;
  talento_desempeno: number | null;
}

export function MatrizTalentoClient() {
  const [personas,     setPersonas]     = useState<Persona[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [grupoActivo,  setGrupoActivo]  = useState("dg");
  const [error,        setError]        = useState<string | null>(null);
  // Tamaño real de la grilla, para separar los badges en píxeles
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setGridSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading]);

  useEffect(() => {
    createAnyClient()
      .from("persona")
      .select("id, nombre, apellido, cargo_actual, talento_potencial, talento_desempeno")
      .eq("activo", true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data, error: err }: { data: any; error: any }) => {
        // Antes un error mostraba la matriz vacía sin ningún mensaje
        if (err) setError(`No se pudo cargar la matriz: ${err.message}`);
        setPersonas((data ?? []) as Persona[]);
        setLoading(false);
      });
  }, []);

  const grupo = GRUPOS.find(g => g.id === grupoActivo)!;

  // Personas del grupo activo
  const personasGrupo = grupo.cargos === null
    ? personas
    : personas.filter(p => (grupo.cargos as string[]).includes(p.cargo_actual ?? ""));

  // Separa: con vs sin coordenadas de talento
  const conDatos   = personasGrupo.filter(p => p.talento_potencial != null && p.talento_desempeno != null);
  const sinDatos   = personasGrupo.filter(p => p.talento_potencial == null || p.talento_desempeno == null);


  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f8f9fb]">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="h-14 bg-white border-b border-[#e8e8e8] flex items-center px-6 gap-3 flex-shrink-0">
        <Link
          href="/reportes"
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-7 h-7 rounded-lg bg-[#f3f0ff] flex items-center justify-center flex-shrink-0">
          <Grid2X2 className="w-3.5 h-3.5 text-[#7c5cbf]" />
        </div>
        <h1 className="text-[15px] font-bold text-[#1a1a2e] flex-1">Matriz de Talento</h1>
        <span className="text-[11px] text-slate-400 font-medium">
          {loading ? "—" : `${conDatos.length} evaluados · ${sinDatos.length} pendientes`}
        </span>
      </header>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>}

        {/* ── Barra de filtros ─────────────────────────────── */}
        <div className="flex items-stretch gap-1 bg-slate-100 rounded-xl p-1 w-fit self-start">
          {GRUPOS.map(g => (
            <button
              key={g.id}
              onClick={() => setGrupoActivo(g.id)}
              title={g.label}
              className={`flex flex-col items-center px-5 py-2 rounded-lg transition-all ${
                grupoActivo === g.id
                  ? "bg-[#1a1a2e] text-white shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-800"
              }`}
            >
              <span className="text-[14px] font-black leading-none">{g.sigla}</span>
              <span className={`text-[9px] font-medium mt-1 leading-tight text-center max-w-[72px] ${
                grupoActivo === g.id ? "text-white/60" : "text-slate-400"
              }`}>
                {g.label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Cuerpo: Matriz + Sidebar ──────────────────────── */}
        <div className="flex gap-5 flex-1 min-h-0">

          {/* Matriz 9-box */}
          <div className="flex flex-col gap-2 flex-1 min-w-0">

            {/* Fila: eje Y + grid */}
            <div className="flex gap-2 flex-1 min-h-0">

              {/* Eje Y — Potencial */}
              <div className="flex flex-col items-center justify-between py-1 flex-shrink-0" style={{ width: 18 }}>
                {ROW_LABELS.map(l => (
                  <span key={l} className="text-[8px] font-bold text-slate-400 uppercase" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", letterSpacing: 1 }}>
                    {l}
                  </span>
                ))}
              </div>

              {/* Grid 3×3 — scatter plot (dos capas) */}
              <div className="flex-1 relative rounded-2xl overflow-hidden shadow-md bg-slate-300">

                {/* Capa 1: celdas coloreadas con títulos */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-px">
                  {BOXES.map((box, idx) => (
                    <div key={idx} className="p-2.5" style={{ background: box.bg }}>
                      <p className="text-[9px] font-bold leading-tight" style={{ color: box.text, opacity: 0.8 }}>
                        {box.title}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Capa 2: badges posicionados por coordenadas reales */}
                <div ref={gridRef} className="absolute inset-0">
                  {gridSize.w > 0 && (() => { const pos = calcularPosiciones(conDatos, gridSize.w, gridSize.h); return conDatos.map(p => {
                    const { left, top } = pos.get(p.id)!;
                    return (
                      <div
                        key={p.id}
                        title={`${p.nombre} ${p.apellido} · D:${p.talento_desempeno} P:${p.talento_potencial} · ${p.cargo_actual ?? "Sin cargo"}`}
                        className="absolute w-7 h-7 rounded-full flex items-center justify-center shadow-lg ring-2 ring-white/30 cursor-default transition-transform hover:scale-110 z-10"
                        style={{
                          left:      `${left}px`,
                          top:       `${top}px`,
                          transform: "translate(-50%, -50%)",
                          background: COLORES_CARGO[p.cargo_actual ?? ""] ?? COLOR_DEFAULT,
                        }}
                      >
                        <span className="text-[10px] font-bold text-white leading-none select-none">
                          {iniciales(p.nombre, p.apellido)}
                        </span>
                      </div>
                    );
                  }); })()}
                </div>
              </div>
            </div>

            {/* Eje X — Desempeño */}
            <div className="flex justify-between pl-[26px] pr-1">
              {COL_LABELS.map(l => (
                <span key={l} className="text-[8px] font-bold text-slate-400 uppercase tracking-wide flex-1 text-center">{l}</span>
              ))}
            </div>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest text-center">
              Desempeño →
            </p>
          </div>

          {/* ── Panel "Sin posición asignada" ────────────────── */}
          <div
            className={`w-56 flex-shrink-0 flex flex-col rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden transition-opacity ${
              sinDatos.length === 0 ? "opacity-40" : ""
            }`}
          >
            {/* Header del panel */}
            <div className="px-4 pt-4 pb-2 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sin asignar</p>
              </div>
              <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">
                {sinDatos.length === 0
                  ? "Todos evaluados en este grupo"
                  : `${sinDatos.length} ${sinDatos.length === 1 ? "persona pendiente" : "personas pendientes"} de evaluación`}
              </p>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {sinDatos.length === 0 ? (
                <p className="text-[10px] text-slate-300 text-center py-4 italic">—</p>
              ) : (
                sinDatos.map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    {/* Badge neutro */}
                    <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-slate-300">
                      <span className="text-[10px] font-bold text-white leading-none select-none">
                        {iniciales(p.nombre, p.apellido)}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-slate-600 truncate">
                        {p.nombre} {p.apellido}
                      </p>
                      <p className="text-[9px] text-slate-400 truncate">
                        {p.cargo_actual ?? "Sin cargo"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
