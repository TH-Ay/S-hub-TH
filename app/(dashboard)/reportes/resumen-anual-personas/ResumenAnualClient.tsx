"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange, FileSpreadsheet, Loader2 } from "lucide-react";
import { createClient, createAnyClient } from "@/lib/supabase/client";
import { esAdmin } from "@/lib/roles";
import { useTiposAusencia } from "@/lib/hooks/useTiposAusencia";
import { EngagementDetalleModal } from "@/components/personas/EngagementDetalleModal";
import { MESES, aclarar, colorCargo, construirGrupos, construirDetalle, fechaDisplay, semanasDelAnio, tramosMeses, type AsigAnual, type AusenciaAnual, type CargoHistorial } from "./modelo";
import { exportarResumenAnual } from "./exportarExcel";
import { cargarDatosAnuales } from "./datos";

export function ResumenAnualClient() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const [asigs, setAsigs] = useState<AsigAnual[]>([]);
  const [ausencias, setAusencias] = useState<AusenciaAnual[]>([]);
  const [historial, setHistorial] = useState<CargoHistorial[]>([]);
  const [detalle, setDetalle] = useState<{ engagementId: string; personaId: string } | null>(null);
  const [pestana, setPestana] = useState<"resumen" | "detalle">("resumen");
  const { tipos } = useTiposAusencia(); // id → label legible
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [puedeDescargar, setPuedeDescargar] = useState(false);
  const [descargando, setDescargando] = useState(false);

  // Solo admin descarga el Excel (mismo criterio que Resumen de Proyectos)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) return;
      const { data } = await createAnyClient().from("persona").select("rol_sistema").eq("auth_user_id", user.id).single();
      setPuedeDescargar(esAdmin(data?.rol_sistema));
    })();
  }, []);

  const semanas = useMemo(() => semanasDelAnio(anio), [anio]);

  // Carga de datos del año (función compartida con Descargables)
  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError(null);
    cargarDatosAnuales(semanas)
      .then((d) => { if (!cancelado) { setAsigs(d.asigs); setAusencias(d.ausencias); setHistorial(d.historial); } })
      .catch((e) => { if (!cancelado) setError(e instanceof Error ? e.message : "Error al cargar"); })
      .finally(() => { if (!cancelado) setLoading(false); });
    return () => { cancelado = true; };
  }, [semanas]);

  const grupos = useMemo(
    () => construirGrupos(asigs, semanas, ausencias, new Map(tipos.map((t) => [t.id, t.label])), historial),
    [asigs, semanas, ausencias, tipos, historial],
  );
  const tramos = useMemo(() => tramosMeses(semanas), [semanas]);
  const totalPersonas = grupos.reduce((n, g) => n + g.personas.length, 0);
  const filaDetalle = useMemo(() => construirDetalle(asigs, semanas), [asigs, semanas]);

  async function descargar() {
    setDescargando(true);
    try { await exportarResumenAnual(anio, semanas, grupos, filaDetalle); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo generar el Excel"); }
    finally { setDescargando(false); }
  }

  // Color de la barra: verde si hay ausencia; si no, color del cargo (más claro si es Plan)
  const colorCelda = (e: "C" | "P", cargo: string | null, aus: string | null) =>
    aus ? "#22a45d" : e === "C" ? colorCargo(cargo) : aclarar(colorCargo(cargo));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="h-14 bg-white border-b border-[#e8e8e8] flex items-center px-6 gap-3 flex-shrink-0">
        <Link href="/reportes" className="text-[#888] hover:text-[#1a1a2e]"><ArrowLeft className="w-4 h-4" /></Link>
        <CalendarRange className="w-4 h-4 text-[#4a90e2]" />
        <h1 className="text-[16px] font-bold flex-1 text-[#1a1a2e]">Resumen anual staffing por persona</h1>
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="text-[12px] border border-[#e8e8e8] rounded-lg px-2 py-1.5 bg-white"
        >
          {Array.from({ length: 5 }, (_, i) => anioActual - 3 + i).map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        {puedeDescargar && (
          <button
            onClick={descargar}
            disabled={descargando || loading || totalPersonas === 0}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#1a7f4a] hover:bg-[#15693c] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-1.5 transition-colors"
          >
            {descargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            {descargando ? "Generando..." : "Descargar Excel"}
          </button>
        )}
      </header>

      {error && <div className="px-6 py-2 text-[12px] text-red-600 bg-red-50 border-b border-red-100">Error: {error}</div>}

      {/* Pestañas */}
      <div className="flex gap-0 px-6 pt-4 border-b border-[#e8e8e8] flex-shrink-0">
        {(["resumen", "detalle"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPestana(p)}
            className={`px-4 py-2 text-[12px] font-semibold capitalize border-b-2 transition-colors ${
              pestana === p
                ? "border-[#4a90e2] text-[#4a90e2]"
                : "border-transparent text-[#888] hover:text-[#1a1a2e]"
            }`}
          >
            {p === "resumen" ? "Resumen" : "Detalle"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {pestana === "resumen" ? (
          <>
            <div className="flex items-center gap-4 mb-3 text-[11px] text-[#666]">
              <span>{totalPersonas} personas</span>
              <span>Color de la barra = cargo de la persona en esa semana (tono claro = Plan)</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-[#22a45d]" /> Ausencia (pasa el mouse para ver detalle)</span>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-[13px] text-[#888]"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
            ) : totalPersonas === 0 ? (
              <p className="text-[13px] text-[#888]">No hay asignaciones en {anio}.</p>
            ) : (
              <div className="bg-white rounded-xl border border-[#e8e8e8] overflow-auto">
                <table className="border-collapse text-[11px]">
                  <thead className="sticky top-0 z-20 bg-white">
                    <tr>
                      <th rowSpan={2} className="sticky left-0 z-30 bg-white text-left px-3 py-1 min-w-[260px] border-b border-[#e8e8e8]">Persona / Proyecto</th>
                      {tramos.map((t) => (
                        <th key={t.desde} colSpan={t.cantidad} className="font-semibold text-[#1a1a2e] border-l border-[#ddd] px-0.5">{MESES[t.mes]}</th>
                      ))}
                    </tr>
                    <tr>
                      {semanas.map((s, i) => (
                        <th key={s.inicio} title={`${s.inicio} a ${s.fin}`}
                          className={`font-normal text-[8px] text-[#aaa] w-3 border-b border-[#e8e8e8] ${tramos.some((t) => t.desde === i) ? "border-l border-l-[#ddd]" : ""}`}>
                          {s.numero}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g) => (
                      <Fragment key={g.cargo}>
                        {/* Capa (cargo) */}
                        <tr className="bg-[#1a1a2e] text-white">
                          <td className="sticky left-0 z-10 bg-[#1a1a2e] px-3 py-1 font-bold">{g.cargo}</td>
                          <td colSpan={semanas.length} />
                        </tr>
                        {g.personas.map((p) => (
                          <Fragment key={p.id}>
                            <tr className="bg-[#f0f2f7]">
                              <td className="sticky left-0 z-10 bg-[#f0f2f7] px-3 py-1 font-semibold text-[#1a1a2e]">{p.nombre}</td>
                              <td colSpan={semanas.length} />
                            </tr>
                            {p.proyectos.map((pr) => (
                              <tr key={pr.id} className="border-b border-[#f3f3f3]">
                                <td className="sticky left-0 z-10 bg-white pl-7 pr-3 py-0.5 max-w-[260px]">
                                  <button
                                    onClick={() => setDetalle({ engagementId: pr.id, personaId: p.id })}
                                    title={pr.nombre}
                                    className="block w-full text-left truncate text-[#555] hover:text-[#4a90e2] hover:underline"
                                  >
                                    {pr.nombre}
                                  </button>
                                </td>
                                {pr.semanas.map((e, i) => {
                                  const aus = e ? p.ausencias[i] : null;
                                  return (
                                    <td key={i} title={aus ?? undefined}
                                      className={`h-4 w-3 p-0 ${tramos.some((t) => t.desde === i) ? "border-l border-[#eee]" : ""} ${aus ? "cursor-help" : ""}`}>
                                      {e && <div className="h-3" style={{ backgroundColor: colorCelda(e, pr.cargos[i], aus) }} />}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* ── Pestaña Detalle ── */
          <>
            <div className="flex items-center gap-4 mb-3 text-[11px] text-[#666]">
              <span>{filaDetalle.length} engagement{filaDetalle.length !== 1 ? "s" : ""}</span>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 text-[13px] text-[#888]"><Loader2 className="w-4 h-4 animate-spin" /> Cargando...</div>
            ) : filaDetalle.length === 0 ? (
              <p className="text-[13px] text-[#888]">No hay asignaciones en {anio}.</p>
            ) : (
              <div className="bg-white rounded-xl border border-[#e8e8e8] overflow-auto">
                <table className="border-collapse text-[11px] w-full">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-[#e8e8e8]">
                      {["Código", "Nombre Proyecto", "Nombre Persona", "Fecha Inicio", "Fecha Término"].map((h) => (
                        <th key={h} className="text-left px-3 py-2 font-semibold text-[#1a1a2e] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let personaActual = "";
                      return filaDetalle.map((f, idx) => {
                        const nuevaPersona = f.nombrePersona !== personaActual;
                        if (nuevaPersona) personaActual = f.nombrePersona;
                        return (
                          <Fragment key={idx}>
                            {nuevaPersona && (
                              <tr className="bg-[#f0f2f7]">
                                <td colSpan={5} className="px-3 py-1 font-semibold text-[#1a1a2e]">{f.nombrePersona} <span className="font-normal text-[#888]">— {f.cargo}</span></td>
                              </tr>
                            )}
                            <tr className="border-b border-[#f3f3f3] hover:bg-[#fafafa]">
                              <td className="pl-7 pr-3 py-1.5 text-[#888] whitespace-nowrap font-mono">{f.codigoProyecto ?? "—"}</td>
                              <td className="px-3 py-1.5 text-[#333]">{f.nombreProyecto}</td>
                              <td className="px-3 py-1.5 text-[#555]">{f.nombrePersona}</td>
                              <td className="px-3 py-1.5 text-[#555] whitespace-nowrap">{fechaDisplay(f.fechaInicio)}</td>
                              <td className="px-3 py-1.5 text-[#555] whitespace-nowrap">{fechaDisplay(f.fechaFin)}</td>
                            </tr>
                          </Fragment>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Ficha del proyecto (misma que en el perfil de persona) */}
      {detalle && (
        <EngagementDetalleModal
          engagementId={detalle.engagementId}
          personaId={detalle.personaId}
          onClose={() => setDetalle(null)}
        />
      )}
    </div>
  );
}
