import { useEffect, useState } from "react";

const KEY = "dmr.unidade_ativa";
const EVENT = "dmr-unidade-change";

export function getUnidadeAtiva(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setUnidadeAtiva(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(KEY, id);
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function useUnidadeAtiva(): string | null {
  const [id, setId] = useState<string | null>(() => getUnidadeAtiva());
  useEffect(() => {
    const handler = () => setId(getUnidadeAtiva());
    window.addEventListener(EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return id;
}
