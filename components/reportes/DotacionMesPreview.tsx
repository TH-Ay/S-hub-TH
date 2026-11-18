/**
 * Portada ilustrativa de "Dotación por Mes (Snapshot)":
 * mini tabla Grupo | Personas | Total (sin consultas a la base).
 */
const GRUPOS: { grupo: string; color: string; personas: number; total: number }[] = [
  { grupo: "Socios", color: "#1a1a2e", personas: 2, total: 2 },
  { grupo: "Directores / Gerentes", color: "#4a90e2", personas: 5, total: 6 },
  { grupo: "Asociados / Senior", color: "#4ab89a", personas: 4, total: 4 },
  { grupo: "Consultores", color: "#e24a6a", personas: 6, total: 9 },
  { grupo: "Analistas / Trainee", color: "#a0b84a", personas: 3, total: 5 },
];

export function DotacionMesPreview() {
  const total = GRUPOS.reduce((n, g) => n + g.total, 0);
  return (
    <div className="w-full h-full p-3 flex flex-col gap-1.5 text-[8px] select-none">
      {/* Mes evaluado */}
      <div className="flex items-center gap-1.5">
        <span className="text-[#888] font-semibold">Mes evaluado</span>
        <span className="px-1.5 py-0.5 rounded bg-white border border-[#e8e8e8] text-[#1a1a2e] font-semibold">Noviembre 2026</span>
      </div>

      {/* Tabla */}
      <div className="rounded-md border border-[#e8e8e8] bg-white overflow-hidden">
        <div className="flex bg-[#f7f8fa] text-[#777] font-bold px-2 py-0.5">
          <span className="w-[90px]">Grupo</span>
          <span className="flex-1">Personas</span>
          <span className="w-6 text-center">Total</span>
        </div>
        {GRUPOS.map((g) => (
          <div key={g.grupo} className="flex items-center px-2 py-[3px] border-t border-[#f0f0f0]">
            <span className="w-[90px] flex items-center gap-1 text-[#1a1a2e] font-semibold truncate">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: g.color }} />
              {g.grupo}
            </span>
            {/* Burbujas de personas (iniciales simuladas) */}
            <span className="flex-1 flex gap-0.5">
              {Array.from({ length: g.personas }, (_, i) => (
                <span key={i} className="w-2.5 h-2.5 rounded-full opacity-80" style={{ backgroundColor: g.color }} />
              ))}
            </span>
            <span className="w-6 text-center font-bold text-[#1a1a2e]">{g.total}</span>
          </div>
        ))}
        <div className="flex px-2 py-0.5 border-t border-[#e8e8e8] bg-[#f7f8fa] font-bold text-[#1a1a2e]">
          <span className="flex-1">Total dotación</span>
          <span className="w-6 text-center">{total}</span>
        </div>
      </div>
    </div>
  );
}
