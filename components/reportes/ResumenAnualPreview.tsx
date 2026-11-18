/**
 * Portada ilustrativa del "Resumen anual staffing por persona":
 * mini Gantt anual (sin consultas a la base, carga instantánea).
 */
const MESES = ["E", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const N = 48; // semanas visibles en la miniatura

// Tramos de ejemplo: [desde, hasta, color]; verde = semana con ausencia
type Tramo = [number, number, string];
const FILAS: { nombre: string; tramos: Tramo[] }[] = [
  { nombre: "Proyecto A", tramos: [[1, 14, "#e24a6a"], [14, 16, "#22a45d"], [16, 22, "#e24a6a"]] },
  { nombre: "Proyecto B", tramos: [[10, 20, "#e24a6a"], [20, 30, "#4ab89a"]] },
  { nombre: "Proyecto C", tramos: [[26, 33, "#4ab89a"], [33, 35, "#22a45d"], [35, 42, "#4ab89a"]] },
  { nombre: "Proyecto D", tramos: [[38, 47, "#b6e3d6"]] },
];

export function ResumenAnualPreview() {
  return (
    <div className="w-full h-full p-3 flex flex-col gap-1 text-[8px] select-none">
      {/* Meses */}
      <div className="flex pl-[70px]">
        {MESES.map((m, i) => (
          <div key={i} className="flex-1 text-center text-[#aaa] font-semibold border-l border-[#eee]">{m}</div>
        ))}
      </div>

      {/* Capa (cargo) y persona */}
      <div className="bg-[#1a1a2e] text-white font-bold rounded-sm px-1.5 py-0.5">Consultor Senior</div>
      <div className="bg-[#f0f2f7] text-[#1a1a2e] font-semibold rounded-sm px-1.5 py-0.5">Persona</div>

      {/* Proyectos con barras por semana */}
      {FILAS.map((f) => (
        <div key={f.nombre} className="flex items-center">
          <span className="w-[70px] pl-2 text-[#777] truncate">{f.nombre}</span>
          <div className="relative flex-1 h-2.5">
            {f.tramos.map(([d, h, c], i) => (
              <div
                key={i}
                className="absolute top-0 h-full"
                style={{ left: `${(d / N) * 100}%`, width: `${((h - d) / N) * 100}%`, backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Segunda persona (atenuada para sugerir continuidad) */}
      <div className="bg-[#f0f2f7] text-[#1a1a2e] font-semibold rounded-sm px-1.5 py-0.5 opacity-60">Persona</div>
      <div className="flex items-center opacity-60">
        <span className="w-[70px] pl-2 text-[#777]">Proyecto E</span>
        <div className="relative flex-1 h-2.5">
          <div className="absolute top-0 h-full bg-[#a0b84a]" style={{ left: "4%", width: "40%" }} />
          <div className="absolute top-0 h-full bg-[#e24a6a]" style={{ left: "44%", width: "30%" }} />
        </div>
      </div>
    </div>
  );
}
