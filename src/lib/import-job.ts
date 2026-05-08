// Background import job runner.
// - Survives route changes / component unmounts (singleton in module scope).
// - Persists status to localStorage so UI shows progress after page reload.
// - Detects stale jobs (no heartbeat) and marks them as "Erro".
// - Prevents simultaneous imports.
//
// NOTE: A true "continue após refresh" requires server-side job execution.
// In-browser jobs are killed when the tab closes; on reload we surface
// the last known state (running -> erro se sem heartbeat) para o usuário decidir.

import {
  upsertTipoResiduo,
  upsertTratamento,
  createDestinador,
  createTransportador,
  createColeta,
  updateColeta,
  type ColetaInput,
  type ColetaComItens,
} from "@/lib/data";
import { logAction } from "@/lib/audit";

export type ImportStatus = "running" | "done" | "error";

export type ImportJobState = {
  id: string;
  status: ImportStatus;
  fileName: string;
  unidadeId: string;
  startedAt: number;
  updatedAt: number;
  done: number;
  total: number;
  criadas: number;
  atualizadas: number;
  ignoradas: number;
  errorMsg?: string;
};

const LS_KEY = "import-job-state-v1";
const HEARTBEAT_STALE_MS = 30_000;

type Listener = (s: ImportJobState | null) => void;
const listeners = new Set<Listener>();

let current: ImportJobState | null = null;
let running = false; // in-memory flag for THIS tab

// ---- persistence ----
function persist(s: ImportJobState | null) {
  try {
    if (s) localStorage.setItem(LS_KEY, JSON.stringify(s));
    else localStorage.removeItem(LS_KEY);
  } catch {}
}
function loadPersisted(): ImportJobState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ImportJobState;
  } catch {
    return null;
  }
}

function emit() {
  for (const l of listeners) l(current);
}
function update(patch: Partial<ImportJobState>) {
  if (!current) return;
  current = { ...current, ...patch, updatedAt: Date.now() };
  persist(current);
  emit();
}

// On module load: recover persisted state.
if (typeof window !== "undefined") {
  const p = loadPersisted();
  if (p) {
    if (p.status === "running" && Date.now() - p.updatedAt > HEARTBEAT_STALE_MS) {
      // Outra aba/sessão crashou → marca erro
      current = { ...p, status: "error", errorMsg: "Importação interrompida (página recarregada)." };
      persist(current);
    } else {
      current = p;
    }
  }
  // listen storage events from other tabs
  window.addEventListener("storage", (e) => {
    if (e.key !== LS_KEY) return;
    current = loadPersisted();
    emit();
  });
}

// ---- public API ----
export function getImportJob(): ImportJobState | null {
  return current;
}
export function isImportActive(): boolean {
  if (!current) return false;
  if (current.status !== "running") return false;
  // considera ativo apenas se houver heartbeat recente OU é desta aba
  if (running) return true;
  return Date.now() - current.updatedAt <= HEARTBEAT_STALE_MS;
}
export function subscribeImportJob(l: Listener): () => void {
  listeners.add(l);
  l(current);
  return () => {
    listeners.delete(l);
  };
}
export function clearImportJob() {
  if (running) return; // não limpa se está rodando nesta aba
  current = null;
  persist(null);
  emit();
}

// ---- job runner ----
export type ImportJobInput = {
  fileName: string;
  unidadeId: string;
  grupos: Array<{
    key: string;
    mtr: string;
    dmr_manual?: boolean;
    rows: Array<{
      data: string;
      mtr: string;
      residuo: string;
      peso: number;
      tratamento: string;
      destinador: string;
      transportador: string;
      observacoes: string;
      peso_estimado?: boolean;
      dmr_manual?: boolean;
    }>;
  }>;
  conflictActions: Record<string, "manter" | "substituir" | "ignorar">;
  coletasExistentes: ColetaComItens[];
  // missing/criação
  missingItems: { residuos: string[]; tratamentos: string[]; destinadores: string[]; transportadores: string[] };
  missingMap: Record<string, string>; // "cat:nome" -> id ou "__new__"
  tipos: Array<{ id: string; nome: string; tratamento_padrao?: string }>;
  trats: Array<{ id: string; nome: string }>;
  destinadores: Array<{ id: string; nome: string }>;
  transportadores: Array<{ id: string; nome: string }>;
};

export async function startImportJob(input: ImportJobInput): Promise<{ ok: boolean; reason?: string }> {
  if (isImportActive()) return { ok: false, reason: "Já existe uma importação em andamento." };

  const id = `imp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  current = {
    id,
    status: "running",
    fileName: input.fileName,
    unidadeId: input.unidadeId,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    done: 0,
    total: input.grupos.length,
    criadas: 0,
    atualizadas: 0,
    ignoradas: 0,
  };
  running = true;
  persist(current);
  emit();

  // executa em background — não await
  void runJob(input).catch((err) => {
    update({ status: "error", errorMsg: err?.message ?? String(err) });
    running = false;
  });

  return { ok: true };
}

async function runJob(input: ImportJobInput) {
  const tipoMap = new Map(input.tipos.map((t) => [t.nome.toLowerCase(), t]));
  const tratMap = new Map(input.trats.map((t) => [t.nome.toLowerCase(), t]));
  const destMap = new Map(input.destinadores.map((d) => [d.nome.toLowerCase(), d]));
  const transMap = new Map(input.transportadores.map((t) => [t.nome.toLowerCase(), t]));

  const resolveOrCreate = async (cat: "residuo" | "tratamento" | "destinador" | "transportador", nome: string): Promise<string> => {
    const key = `${cat}:${nome.toLowerCase()}`;
    const sub = input.missingMap[key];
    if (sub && sub !== "__new__") return sub;
    if (cat === "residuo") {
      const novo = await upsertTipoResiduo({ nome, tratamento_padrao: "Reciclagem" });
      tipoMap.set(novo.nome.toLowerCase(), novo as any);
      return novo.id;
    } else if (cat === "tratamento") {
      const novo = await upsertTratamento({ nome });
      tratMap.set(novo.nome.toLowerCase(), novo as any);
      return novo.id;
    } else if (cat === "destinador") {
      const novo = await createDestinador({ nome });
      destMap.set(novo.nome.toLowerCase(), novo as any);
      return novo.id;
    } else {
      const novo = await createTransportador({ nome });
      transMap.set(novo.nome.toLowerCase(), novo as any);
      return novo.id;
    }
  };

  for (const nome of input.missingItems.residuos) {
    const k = `residuo:${nome.toLowerCase()}`;
    if (!input.missingMap[k] || input.missingMap[k] === "__new__") await resolveOrCreate("residuo", nome);
  }
  for (const nome of input.missingItems.tratamentos) {
    const k = `tratamento:${nome.toLowerCase()}`;
    if (!input.missingMap[k] || input.missingMap[k] === "__new__") await resolveOrCreate("tratamento", nome);
  }
  for (const nome of input.missingItems.destinadores) {
    const k = `destinador:${nome.toLowerCase()}`;
    if (!input.missingMap[k] || input.missingMap[k] === "__new__") await resolveOrCreate("destinador", nome);
  }
  for (const nome of input.missingItems.transportadores) {
    const k = `transportador:${nome.toLowerCase()}`;
    if (!input.missingMap[k] || input.missingMap[k] === "__new__") await resolveOrCreate("transportador", nome);
  }

  const finalName = (cat: "residuo" | "tratamento" | "destinador" | "transportador", nome: string): string => {
    const k = `${cat}:${nome.toLowerCase()}`;
    const sub = input.missingMap[k];
    if (!sub || sub === "__new__") return nome;
    const list = cat === "residuo" ? Array.from(tipoMap.values())
      : cat === "tratamento" ? Array.from(tratMap.values())
      : cat === "destinador" ? Array.from(destMap.values())
      : Array.from(transMap.values());
    const found = (list as any[]).find((x) => x.id === sub);
    return found ? found.nome : nome;
  };

  const exMap = new Map<string, ColetaComItens>();
  for (const c of input.coletasExistentes) if (c.mtr) exMap.set(c.mtr, c);

  let criadas = 0, atualizadas = 0, ignoradas = 0;
  const idsCriadas: string[] = [];

  for (let i = 0; i < input.grupos.length; i++) {
    const g = input.grupos[i];
    const action = (g.mtr && exMap.has(g.mtr)) ? (input.conflictActions[g.key] ?? "manter") : "substituir";
    if (g.mtr && exMap.has(g.mtr) && (action === "ignorar" || action === "manter")) {
      ignoradas++;
      update({ done: i + 1, ignoradas });
      continue;
    }
    const first = g.rows[0];
    const dest = first.destinador ? finalName("destinador", first.destinador) : "";
    const trans = first.transportador ? finalName("transportador", first.transportador) : "";
    const destObj = dest ? destMap.get(dest.toLowerCase()) : null;
    const transObj = trans ? transMap.get(trans.toLowerCase()) : null;
    const itens = g.rows.map((r) => {
      const residuoNome = r.residuo ? finalName("residuo", r.residuo) : "";
      const tratNome = r.tratamento ? finalName("tratamento", r.tratamento) : (tipoMap.get(residuoNome.toLowerCase())?.tratamento_padrao || "Reciclagem");
      const tipo = tipoMap.get(residuoNome.toLowerCase());
      return {
        tipo_residuo_id: tipo?.id ?? null,
        tipo_residuo_nome: residuoNome,
        peso_kg: r.peso,
        tratamento: tratNome,
      };
    }).filter((it) => it.tipo_residuo_nome);

    if (itens.length === 0) {
      ignoradas++;
      update({ done: i + 1, ignoradas });
      continue;
    }

    const coletaInput: ColetaInput = {
      unidade_id: input.unidadeId,
      data: first.data || new Date().toISOString().slice(0, 10),
      transportador: trans || null,
      destinador: dest || null,
      transportador_id: transObj?.id ?? null,
      destinador_id: destObj?.id ?? null,
      mtr: g.mtr || null,
      peso_estimado: false,
      dmr_manual: false,
      observacoes: g.rows.map((r) => r.observacoes).filter(Boolean).join(" | ") || null,
      itens,
    };

    if (action === "substituir" && g.mtr && exMap.has(g.mtr)) {
      await updateColeta(exMap.get(g.mtr)!.id, coletaInput, { skipAudit: true });
      atualizadas++;
    } else {
      const novoId = await createColeta(coletaInput, { skipAudit: true });
      idsCriadas.push(novoId);
      criadas++;
    }
    update({ done: i + 1, criadas, atualizadas, ignoradas });
  }

  // Registra UM evento único de importação
  await logAction({
    unidade_id: input.unidadeId,
    tipo: "importacao",
    descricao: `Importação de planilha "${input.fileName}": ${criadas} criadas, ${atualizadas} atualizadas, ${ignoradas} ignoradas`,
    quantidade: criadas + atualizadas,
    snapshot: { idsCriadas, arquivo: input.fileName },
    rollback_disponivel: idsCriadas.length > 0,
  });

  update({ status: "done", criadas, atualizadas, ignoradas, done: input.grupos.length });
  running = false;
}
