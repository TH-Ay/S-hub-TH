/**
 * Genera el Excel "Resumen anual staffing por persona" en el navegador (exceljs).
 */
import type { FilaDetalle, GrupoCargo, SemanaAnual } from "./modelo";
import { MESES, aclarar, colorCargo, fechaDisplay, tramosMeses } from "./modelo";
import { CARGOS } from "@/lib/constants";

/** "#4a90e2" → "FF4A90E2" (formato exceljs) */
const argb = (hex: string) => "FF" + hex.replace("#", "").toUpperCase();
const COLOR_CARGO = "FF1A1A2E"; // fila de capa
const COLOR_PERSONA = "FFF0F2F7";
const COLOR_AUSENCIA = "FF22A45D"; // semana con ausencia

const relleno = (argb: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb } });

export async function exportarResumenAnual(anio: number, semanas: SemanaAnual[], grupos: GrupoCargo[], filaDetalle: FilaDetalle[] = []) {
  const ExcelJS = (await import("exceljs")).default; // carga diferida: solo al descargar
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(`Staffing ${anio}`, { views: [{ state: "frozen", xSplit: 1, ySplit: 3 }] });

  const nSem = semanas.length;
  ws.getColumn(1).width = 42;
  for (let i = 0; i < nSem; i++) ws.getColumn(i + 2).width = 2.6;

  // Fila 1: título
  ws.getCell(1, 1).value = `Resumen anual staffing por persona — ${anio}`;
  ws.getCell(1, 1).font = { bold: true, size: 13 };

  // Fila 2: meses combinados
  ws.getCell(2, 1).value = "Persona / Proyecto";
  ws.getCell(2, 1).font = { bold: true };
  for (const t of tramosMeses(semanas)) {
    const c1 = t.desde + 2;
    ws.mergeCells(2, c1, 2, c1 + t.cantidad - 1);
    const cell = ws.getCell(2, c1);
    cell.value = MESES[t.mes];
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: "center" };
    cell.border = { left: { style: "thin", color: { argb: "FF999999" } } };
  }

  // Fila 3: número de semana (chico)
  semanas.forEach((s, i) => {
    const cell = ws.getCell(3, i + 2);
    cell.value = s.numero;
    cell.font = { size: 6, color: { argb: "FF888888" } };
    cell.alignment = { horizontal: "center" };
  });

  let fila = 4;
  for (const g of grupos) {
    // Fila de capa (cargo)
    const rCargo = ws.getRow(fila++);
    rCargo.getCell(1).value = g.cargo;
    for (let c = 1; c <= nSem + 1; c++) rCargo.getCell(c).fill = relleno(COLOR_CARGO);
    rCargo.getCell(1).font = { bold: true, color: { argb: "FFFFFFFF" } };

    for (const p of g.personas) {
      // Fila de persona
      const rP = ws.getRow(fila++);
      rP.getCell(1).value = p.nombre;
      rP.getCell(1).font = { bold: true };
      for (let c = 1; c <= nSem + 1; c++) rP.getCell(c).fill = relleno(COLOR_PERSONA);

      // Filas de proyectos con semanas pintadas
      for (const pr of p.proyectos) {
        const r = ws.getRow(fila++);
        r.getCell(1).value = pr.nombre;
        r.getCell(1).alignment = { indent: 2 };
        r.getCell(1).font = { size: 9 };
        pr.semanas.forEach((e, i) => {
          if (!e) return;
          const cell = r.getCell(i + 2);
          const aus = p.ausencias[i];
          // Semana con ausencia → verde + nota con tipo y fechas
          const base = colorCargo(pr.cargos[i]);
          cell.fill = relleno(aus ? COLOR_AUSENCIA : argb(e === "C" ? base : aclarar(base)));
          if (aus) cell.note = aus;
        });
      }
    }
  }

  // Leyenda
  fila++;
  ws.getCell(fila++, 1).value = "Color = cargo de la persona en esa semana (tono claro = Plan)";
  for (const cargo of CARGOS) {
    ws.getCell(fila, 1).value = cargo;
    ws.getCell(fila, 2).fill = relleno(argb(colorCargo(cargo)));
    ws.getCell(fila++, 3).fill = relleno(argb(aclarar(colorCargo(cargo))));
  }
  ws.getCell(fila, 1).value = "Ausencia (ver nota de la celda)";
  ws.getCell(fila, 2).fill = relleno(COLOR_AUSENCIA);

  // ── Hoja "Detalle" ──────────────────────────────────────────────────────────
  if (filaDetalle.length > 0) {
    const wd = wb.addWorksheet("Detalle", { views: [{ state: "frozen", xSplit: 0, ySplit: 2 }] });
    wd.getColumn(1).width = 12; // Código
    wd.getColumn(2).width = 46; // Nombre Proyecto
    wd.getColumn(3).width = 28; // Nombre Persona
    wd.getColumn(4).width = 16; // Fecha Inicio
    wd.getColumn(5).width = 16; // Fecha Término

    // Fila 1: título
    wd.getCell(1, 1).value = `Detalle de engagements por persona — ${anio}`;
    wd.getCell(1, 1).font = { bold: true, size: 13 };
    wd.mergeCells(1, 1, 1, 5);

    // Fila 2: encabezados
    const encabezados = ["Código", "Nombre Proyecto", "Nombre Persona", "Fecha Inicio", "Fecha Término"];
    encabezados.forEach((v, i) => {
      const cell = wd.getCell(2, i + 1);
      cell.value = v;
      cell.fill = relleno("FF1A1A2E");
      cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
      cell.alignment = { horizontal: "left" };
    });

    let fd = 3;
    let personaActual = "";
    for (const f of filaDetalle) {
      // Fila agrupadora de persona (cada vez que cambia)
      if (f.nombrePersona !== personaActual) {
        personaActual = f.nombrePersona;
        const rP = wd.getRow(fd++);
        rP.getCell(1).value = `${f.nombrePersona}  —  ${f.cargo}`;
        rP.getCell(1).font = { bold: true, size: 10 };
        for (let c = 1; c <= 5; c++) rP.getCell(c).fill = relleno(COLOR_PERSONA);
        wd.mergeCells(fd - 1, 1, fd - 1, 5);
      }
      const r = wd.getRow(fd++);
      r.getCell(1).value = f.codigoProyecto ?? "";
      r.getCell(1).alignment = { indent: 2 };
      r.getCell(1).font = { size: 9 };
      r.getCell(2).value = f.nombreProyecto;
      r.getCell(2).font = { size: 9 };
      r.getCell(3).value = f.nombrePersona;
      r.getCell(3).font = { size: 9 };
      r.getCell(4).value = fechaDisplay(f.fechaInicio);
      r.getCell(4).font = { size: 9 };
      r.getCell(5).value = fechaDisplay(f.fechaFin);
      r.getCell(5).font = { size: 9 };
      r.border = {
        bottom: { style: "thin", color: { argb: "FFE8E8E8" } },
      };
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `Resumen-Anual-Staffing-${anio}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
