/**
 * Modelo del "Resumen anual staffing por persona":
 * semanas ISO del año × (persona → proyectos) con el estado de cada semana.
 */
import { addDays, addWeeks, format, getISOWeek, startOfISOWeek } from "date-fns";
import { CARGOS, CARGO_COLORS } from "@/lib/constants";

export interface SemanaAnual {
  numero: number;   // semana ISO
  inicio: string;   // lunes yyyy-MM-dd
  fin: string;      // viernes yyyy-MM-dd
  mes: number;      // 0-11, según el jueves (regla ISO)
}

export type EstadoSemana = "C" | "P"; // Confirmado | Plan

export interface ProyectoFila {
  id: string;
  nombre: string;
  semanas: (EstadoSemana | null)[]; // un valor por semana del año
  cargos: (string | null)[];        // cargo que tenía la persona en esa semana (define el color)
}

/** Paleta del panel Equipo (Inicio): misma que ve el usuario en las burbujas de cargo */
const COLORES_EQUIPO: Record<string, string> = {
  "socio": "#1a1a2e",
  "director de proyectos": "#4a90e2", "director": "#4a90e2",
  "gerente de proyectos": "#7c5cbf", "gerente": "#7c5cbf",
  "asociado": "#e2884a",
  "consultor senior": "#4ab89a", "senior": "#4ab89a", "analista senior": "#a0b84a",
  "consultor de proyectos": "#e24a6a", "consultor proyecto": "#e24a6a", "consultor": "#e24a6a",
  "consultor analista": "#a0b84a",
  "consultor trainee": "#c07c4a", "analista": "#c07c4a", "practicante": "#c07c4a",
};
const COLOR_DEFAULT = "#94a3b8";

/** Busca el color tolerando mayúsculas/espacios; null si el cargo no se reconoce */
export function colorConocido(cargo: string | null): string | null {
  if (!cargo) return null;
  const k = cargo.trim().toLowerCase();
  return COLORES_EQUIPO[k] ?? CARGO_COLORS[cargo.trim()] ?? null;
}

export function colorCargo(cargo: string | null): string {
  return colorConocido(cargo) ?? COLOR_DEFAULT;
}

/** Mezcla un color hex con blanco (para semanas en Plan) */
export function aclarar(hex: string, factor = 0.6): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * factor);
  const [r, g, b] = [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)];
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export interface PersonaFila {
  id: string;
  nombre: string;
  cargo: string;
  proyectos: ProyectoFila[];
  ausencias: (string | null)[]; // por semana: detalle de ausencias (tooltip) o null
}

export interface CargoHistorial {
  persona_id: string;
  cargo: string;
  fecha_inicio: string;
  fecha_fin: string | null;
}

export interface AusenciaAnual {
  persona_id: string;
  tipo: string;
  fecha_inicio: string;
  fecha_fin: string;
}

/** "2026-02-03" → "03/02/2026" */
const fechaCorta = (f: string) => f.split("-").reverse().join("/");

export interface GrupoCargo {
  cargo: string;
  personas: PersonaFila[];
}

export interface AsigAnual {
  persona_id: string;
  engagement_id: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  estado_staffing: "CONFIRMADO" | "PLAN";
  persona: { nombre: string; apellido: string; cargo_actual: string | null } | null;
  engagement: { nombre: string; codigo: string | null; cliente: string | null; is_deleted: boolean } | null;
}

export const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

/** Semanas ISO cuyo jueves cae dentro del año */
export function semanasDelAnio(anio: number): SemanaAnual[] {
  const semanas: SemanaAnual[] = [];
  let lunes = startOfISOWeek(new Date(anio, 0, 4)); // la semana 1 contiene el 4 de enero
  while (addDays(lunes, 3).getFullYear() === anio) {
    const jueves = addDays(lunes, 3);
    semanas.push({
      numero: getISOWeek(lunes),
      inicio: format(lunes, "yyyy-MM-dd"),
      fin: format(addDays(lunes, 4), "yyyy-MM-dd"),
      mes: jueves.getMonth(),
    });
    lunes = addWeeks(lunes, 1);
  }
  return semanas;
}

/** Agrupa las semanas consecutivas por mes (para encabezados combinados) */
export function tramosMeses(semanas: SemanaAnual[]): { mes: number; desde: number; cantidad: number }[] {
  const tramos: { mes: number; desde: number; cantidad: number }[] = [];
  semanas.forEach((s, i) => {
    const ult = tramos[tramos.length - 1];
    if (ult && ult.mes === s.mes) ult.cantidad++;
    else tramos.push({ mes: s.mes, desde: i, cantidad: 1 });
  });
  return tramos;
}

function nombreProyecto(e: NonNullable<AsigAnual["engagement"]>): string {
  return e.codigo ? `${e.codigo} · ${e.nombre}` : e.nombre;
}

/** Construye los grupos ordenados por jerarquía de cargo (Socio → Desarrollo) */
export function construirGrupos(
  asigs: AsigAnual[],
  semanas: SemanaAnual[],
  ausencias: AusenciaAnual[] = [],
  labelsTipo: Map<string, string> = new Map(),
  historial: CargoHistorial[] = [],
): GrupoCargo[] {
  const histPorPersona = new Map<string, CargoHistorial[]>();
  for (const h of historial) histPorPersona.set(h.persona_id, [...(histPorPersona.get(h.persona_id) ?? []), h]);

  // Ausencias por persona → texto por semana ("Vacaciones: 03/02/2026 al 07/02/2026")
  const ausPorPersona = new Map<string, string[][]>();
  for (const a of ausencias) {
    let sem = ausPorPersona.get(a.persona_id);
    if (!sem) { sem = semanas.map(() => []); ausPorPersona.set(a.persona_id, sem); }
    const texto = `${labelsTipo.get(a.tipo) ?? a.tipo}: ${fechaCorta(a.fecha_inicio)} al ${fechaCorta(a.fecha_fin)}`;
    semanas.forEach((s, i) => {
      if (a.fecha_inicio <= s.fin && a.fecha_fin >= s.inicio && !sem![i].includes(texto)) sem![i].push(texto);
    });
  }

  const personas = new Map<string, PersonaFila & { proyMap: Map<string, ProyectoFila> }>();

  for (const a of asigs) {
    if (!a.persona || !a.engagement || a.engagement.is_deleted) continue;
    const fin = a.fecha_fin ?? "9999-12-31"; // abierta → sigue vigente
    const estado: EstadoSemana = a.estado_staffing === "CONFIRMADO" ? "C" : "P";

    let p = personas.get(a.persona_id);
    if (!p) {
      p = {
        id: a.persona_id,
        nombre: `${a.persona.nombre} ${a.persona.apellido}`.trim(),
        cargo: a.persona.cargo_actual ?? "Sin cargo",
        proyectos: [],
        ausencias: [], // se completa al final
        proyMap: new Map(),
      };
      personas.set(a.persona_id, p);
    }

    let proy = p.proyMap.get(a.engagement_id);
    if (!proy) {
      proy = { id: a.engagement_id, nombre: nombreProyecto(a.engagement), semanas: semanas.map(() => null), cargos: semanas.map(() => null) };
      p.proyMap.set(a.engagement_id, proy);
    }

    semanas.forEach((s, i) => {
      if (a.fecha_inicio <= s.fin && fin >= s.inicio) {
        // Confirmado tiene prioridad sobre Plan si ambos caen en la misma semana
        if (proy!.semanas[i] !== "C") proy!.semanas[i] = estado;
      }
    });
  }

  // Normaliza: proyectos ordenados por primera semana activa; descarta los sin semanas en el año
  const lista: PersonaFila[] = [];
  for (const p of personas.values()) {
    const proyectos = [...p.proyMap.values()]
      .filter((pr) => pr.semanas.some(Boolean))
      .sort((x, y) => x.semanas.findIndex(Boolean) - y.semanas.findIndex(Boolean) || x.nombre.localeCompare(y.nombre));
    // Cargo real de la persona en cada semana (historial); sin historial → cargo actual
    const hist = (histPorPersona.get(p.id) ?? []).sort((x, y) => x.fecha_inicio.localeCompare(y.fecha_inicio));
    const cargoSem = semanas.map((s) => {
      // El último cargo iniciado hasta el viernes y vigente desde el lunes
      const vig = hist.filter((h) => h.fecha_inicio <= s.fin && (h.fecha_fin ?? "9999-12-31") >= s.inicio);
      let h = vig.length > 0 ? vig[vig.length - 1].cargo : null;
      // Cargos combinados ("Asociado / Consultor Senior"): si el actual es uno de ellos, se usa ese
      if (h?.includes("/")) {
        const partes = h.split("/").map((x) => x.trim().toLowerCase());
        const actual = p.cargo.trim().toLowerCase();
        h = partes.some((x) => actual === x || actual.startsWith(x)) ? p.cargo : h.split("/")[0].trim();
      }
      // Si el historial trae un nombre de cargo no reconocido, se usa el cargo actual
      return h && colorConocido(h) ? h : p.cargo;
    });
    for (const pr of proyectos) pr.cargos = pr.semanas.map((e, i) => (e ? cargoSem[i] : null));

    const aus = ausPorPersona.get(p.id);
    const ausenciasSem = semanas.map((_, i) => (aus && aus[i].length > 0 ? aus[i].join("\n") : null));
    if (proyectos.length > 0) lista.push({ id: p.id, nombre: p.nombre, cargo: p.cargo, proyectos, ausencias: ausenciasSem });
  }

  // Orden de capas: CARGOS; cargos desconocidos al final
  const orden = [...CARGOS] as string[];
  const rango = (c: string) => (orden.indexOf(c) === -1 ? orden.length : orden.indexOf(c));
  const cargos = [...new Set(lista.map((p) => p.cargo))].sort((a, b) => rango(a) - rango(b) || a.localeCompare(b));

  return cargos.map((cargo) => ({
    cargo,
    personas: lista.filter((p) => p.cargo === cargo).sort((a, b) => a.nombre.localeCompare(b.nombre)),
  }));
}
