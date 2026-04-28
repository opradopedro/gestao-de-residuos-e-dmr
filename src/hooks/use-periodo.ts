import { useEffect, useState } from "react";
import { currentQuarter, quarterRange } from "@/lib/quarter";

const KEY = "dmr.periodo";
const EVENT = "dmr-periodo-change";

export type Periodo = { ano: number; trimestre: 1 | 2 | 3 | 4 };

function readPeriodo(): Periodo {
  if (typeof window === "undefined") {
    const c = currentQuarter();
    return { ano: c.ano, trimestre: c.trimestre };
  }
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p.ano === "number" && p.trimestre >= 1 && p.trimestre <= 4) return p;
    } catch {}
  }
  const c = currentQuarter();
  return { ano: c.ano, trimestre: c.trimestre };
}

export function setPeriodoAtivo(p: Periodo) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
  window.dispatchEvent(new Event(EVENT));
}

export function usePeriodoAtivo() {
  const [p, setP] = useState<Periodo>(() => readPeriodo());
  useEffect(() => {
    const h = () => setP(readPeriodo());
    window.addEventListener(EVENT, h);
    window.addEventListener("storage", h);
    return () => {
      window.removeEventListener(EVENT, h);
      window.removeEventListener("storage", h);
    };
  }, []);
  const range = quarterRange(p.ano, p.trimestre);
  const labels = ["Jan-Mar", "Abr-Jun", "Jul-Set", "Out-Dez"];
  return {
    ...p,
    label: `${labels[p.trimestre - 1]} ${p.ano}`,
    start: range.start,
    end: range.end,
    key: `${p.ano}-T${p.trimestre}`,
  };
}
