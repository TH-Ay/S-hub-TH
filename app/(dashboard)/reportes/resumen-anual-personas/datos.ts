/**
 * Carga de datos del "Resumen anual staffing por persona".
 * Compartida por la vista del reporte y por Descargables.
 */
import { createAnyClient } from "@/lib/supabase/client";
import type { AsigAnual, AusenciaAnual, CargoHistorial, SemanaAnual } from "./modelo";
import { construirGrupos, semanasDelAnio } from "./modelo";
import { exportarResumenAnual } from "./exportarExcel";

const PAGINA = 1000; // límite de filas por consulta de Supabase

export interface DatosAnuales {
  asigs: AsigAnual[];
  ausencias: AusenciaAnual[];
  historial: CargoHistorial[];
}

/** Trae asignaciones (sin canceladas), ausencias e historial de cargos que tocan el rango */
export async function cargarDatosAnuales(semanas: SemanaAnual[]): Promise<DatosAnuales> {
  const desde = semanas[0].inicio;
  const hasta = semanas[semanas.length - 1].fin;
  const sb = createAnyClient();

  const asigs: AsigAnual[] = [];
  for (let i = 0; ; i += PAGINA) {
    const { data, error } = await sb
      .from("asignacion")
      .select("persona_id, engagement_id, fecha_inicio, fecha_fin, estado_staffing, persona:persona_id(nombre, apellido, cargo_actual), engagement:engagement_id(nombre, codigo, cliente, is_deleted)")
      .neq("estado", "cancelada")
      .lte("fecha_inicio", hasta)
      .or(`fecha_fin.gte.${desde},fecha_fin.is.null`)
      .order("id")
      .range(i, i + PAGINA - 1);
    if (error) throw new Error(error.message);
    asigs.push(...((data ?? []) as AsigAnual[]));
    if (!data || data.length < PAGINA) break;
  }

  const ausencias: AusenciaAnual[] = [];
  for (let i = 0; ; i += PAGINA) {
    const { data, error } = await sb
      .from("ausencia")
      .select("persona_id, tipo, fecha_inicio, fecha_fin")
      .lte("fecha_inicio", hasta)
      .gte("fecha_fin", desde)
      .order("id")
      .range(i, i + PAGINA - 1);
    if (error) throw new Error(error.message);
    ausencias.push(...((data ?? []) as AusenciaAnual[]));
    if (!data || data.length < PAGINA) break;
  }

  // Historial que edita la ficha de persona; sin el hito de salida
  const { data: hist, error: histErr } = await sb
    .from("historial_cargos")
    .select("persona_id, cargo, fecha_inicio, fecha_fin")
    .neq("cargo", "Ex-Houser")
    .lte("fecha_inicio", hasta)
    .or(`fecha_fin.gte.${desde},fecha_fin.is.null`)
    .limit(5000);
  if (histErr) throw new Error(histErr.message);

  return { asigs, ausencias, historial: (hist ?? []) as CargoHistorial[] };
}

/** Descarga directa del Excel de un año (usado en Descargables) */
export async function descargarResumenAnual(anio: number) {
  const semanas = semanasDelAnio(anio);
  const sb = createAnyClient();
  const [{ asigs, ausencias, historial }, { data: tipos }] = await Promise.all([
    cargarDatosAnuales(semanas),
    sb.from("tipo_ausencia").select("id, label"),
  ]);
  const labels = new Map(((tipos ?? []) as { id: string; label: string }[]).map((t) => [t.id, t.label]));
  const grupos = construirGrupos(asigs, semanas, ausencias, labels, historial);
  await exportarResumenAnual(anio, semanas, grupos);
}
