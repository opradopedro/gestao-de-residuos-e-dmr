import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, Undo2, Eye } from "lucide-react";
import {
  listAuditLog,
  markRevertido,
  restoreColetasFromSnapshot,
  deleteColetasByIds,
  type AuditEntry,
  logAction,
} from "@/lib/audit";
import { listUnidades, getColeta, deleteColeta, createColeta, rollbackMerge, type ColetaInput } from "@/lib/data";
import { formatDate, formatKgPlain } from "@/lib/format";
import { toast } from "sonner";

const TIPO_LABEL: Record<string, string> = {
  coleta_criada: "Coleta criada",
  coleta_editada: "Coleta editada",
  coleta_excluida: "Coleta excluída",
  exclusao_em_massa: "Exclusão em massa",
  importacao: "Importação de planilha",
  merge_destinador: "Merge de destinador",
  merge_transportador: "Merge de transportador",
  merge_residuo: "Merge de resíduo",
  merge_tratamento: "Merge de tratamento",
  rollback: "Rollback",
  cadastro_criado: "Cadastro criado",
  cadastro_editado: "Cadastro editado",
  cadastro_excluido: "Cadastro excluído",
  vinculo_criado: "Vínculo criado",
  dmr_upload: "Upload de DMR",
};

function isSingleColetaEntry(e: AuditEntry): boolean {
  return e.quantidade === 1 && (e.tipo === "coleta_criada" || e.tipo === "coleta_editada" || e.tipo === "coleta_excluida");
}

function isMergeEntry(e: AuditEntry) {
  return e.tipo === "merge_destinador" || e.tipo === "merge_transportador" || e.tipo === "merge_unidade" || (e.tipo as any) === "merge_residuo" || (e.tipo as any) === "merge_tratamento";
}
function canRollback(e: AuditEntry) {
  if (e.revertido) return false;
  if (e.rollback_disponivel && (e.tipo === "exclusao_em_massa" || e.tipo === "importacao")) return true;
  if (isSingleColetaEntry(e) && e.snapshot) return true;
  if (isMergeEntry(e) && e.snapshot && e.rollback_disponivel) return true;
  return false;
}

export function HistoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unidadeId?: string | null;
}) {
  const qc = useQueryClient();
  const [filtroUnidade, setFiltroUnidade] = useState<string>("__all__");
  const [verEntry, setVerEntry] = useState<AuditEntry | null>(null);

  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades, enabled: open });
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit_log", filtroUnidade],
    queryFn: () => listAuditLog(filtroUnidade === "__all__" ? null : filtroUnidade, 15),
    enabled: open,
  });

  const rollbackMut = useMutation({
    mutationFn: async (entry: AuditEntry) => {
      if (entry.tipo === "exclusao_em_massa" || entry.tipo === "coleta_excluida") {
        const snap = Array.isArray(entry.snapshot) ? entry.snapshot : [entry.snapshot];
        const n = await restoreColetasFromSnapshot(snap);
        await markRevertido(entry.id);
        await logAction({ unidade_id: entry.unidade_id, tipo: "rollback", descricao: `Rollback: ${entry.descricao}`, quantidade: n });
        return n;
      }
      if (entry.tipo === "importacao") {
        const ids: string[] = entry.snapshot?.idsCriadas ?? [];
        const n = await deleteColetasByIds(ids);
        await markRevertido(entry.id);
        await logAction({ unidade_id: entry.unidade_id, tipo: "rollback", descricao: `Rollback: ${entry.descricao}`, quantidade: n });
        return n;
      }
      if (entry.tipo === "coleta_editada" || entry.tipo === "coleta_criada") {
        const snap: any = Array.isArray(entry.snapshot) ? entry.snapshot[0] : entry.snapshot;
        if (!snap) throw new Error("Snapshot indisponível");
        const atual = await getColeta(snap.id).catch(() => null);
        if (atual) await deleteColeta(atual.id, { skipAudit: true } as any);
        if (entry.tipo === "coleta_editada") {
          const input: ColetaInput = {
            unidade_id: snap.unidade_id, data: snap.data, transportador: snap.transportador,
            destinador: snap.destinador, transportador_id: snap.transportador_id,
            destinador_id: snap.destinador_id, mtr: snap.mtr, peso_estimado: !!snap.peso_estimado,
            dmr_manual: !!snap.dmr_manual, observacoes: snap.observacoes, itens: snap.itens ?? [],
          };
          await createColeta(input, { skipAudit: true } as any);
        }
        await markRevertido(entry.id);
        await logAction({ unidade_id: entry.unidade_id, tipo: "rollback", descricao: `Rollback: ${entry.descricao}`, quantidade: 1 });
        return 1;
      }
      throw new Error("Tipo não suporta rollback");
    },
    onSuccess: (n) => {
      toast.success(`Rollback aplicado: ${n} registro(s) afetado(s).`);
      qc.invalidateQueries({ queryKey: ["coletas"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const grupos =
    filtroUnidade === "__all__"
      ? (() => {
          const m = new Map<string, AuditEntry[]>();
          for (const e of entries) {
            const k = e.unidade_id ?? "__global__";
            if (!m.has(k)) m.set(k, []);
            m.get(k)!.push(e);
          }
          return Array.from(m.entries());
        })()
      : [["__single__", entries] as [string, AuditEntry[]]];

  const nomeUnidade = (id: string) =>
    id === "__global__" ? "Sistema (global)" : unidades.find((u) => u.id === id)?.nome ?? "Unidade removida";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-5" /> Histórico de alterações
            </DialogTitle>
            <DialogDescription>
              Últimas 15 ações por unidade. Importações e exclusões em massa podem ser revertidas integralmente.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-muted-foreground">Unidade:</span>
            <Select value={filtroUnidade} onValueChange={setFiltroUnidade}>
              <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as unidades</SelectItem>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
          ) : entries.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma ação registrada ainda.</div>
          ) : (
            <div className="space-y-4">
              {grupos.map(([k, items]) => (
                <div key={k}>
                  {filtroUnidade === "__all__" && (
                    <div className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                      {nomeUnidade(k)}
                    </div>
                  )}
                  <div className="border rounded divide-y">
                    {items.map((e) => (
                      <div key={e.id} className="flex items-start gap-3 p-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{TIPO_LABEL[e.tipo] ?? e.tipo}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(e.criado_em).toLocaleString("pt-BR")}</span>
                            {e.revertido && <Badge variant="secondary" className="text-[10px]">REVERTIDO</Badge>}
                          </div>
                          <div className="mt-1">{e.descricao}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{e.quantidade} registro(s) afetado(s)</div>
                        </div>
                        <div className="flex gap-1">
                          {isSingleColetaEntry(e) && (
                            <Button size="sm" variant="outline" onClick={() => setVerEntry(e)}>
                              <Eye className="size-3 mr-1" /> Ver
                            </Button>
                          )}
                          {canRollback(e) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (confirm(`Desfazer "${e.descricao}"?`)) rollbackMut.mutate(e);
                              }}
                              disabled={rollbackMut.isPending}
                            >
                              <Undo2 className="size-3 mr-1" /> Reverter
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SingleRecordDialog entry={verEntry} onClose={() => setVerEntry(null)} onRevert={(e) => { rollbackMut.mutate(e); setVerEntry(null); }} reverting={rollbackMut.isPending} />
    </>
  );
}

function ColetaPreview({ data, title }: { data: any; title: string }) {
  if (!data) return (
    <div className="border rounded p-3 text-xs">
      <div className="font-semibold mb-2 text-muted-foreground">{title}</div>
      <div className="text-muted-foreground italic">— sem dados —</div>
    </div>
  );
  const itens: any[] = data.itens ?? [];
  const total = itens.reduce((s, it) => s + Number(it.peso_kg ?? 0), 0);
  return (
    <div className="border rounded p-3 text-xs space-y-1.5">
      <div className="font-semibold text-muted-foreground mb-1">{title}</div>
      <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{data.data ? formatDate(data.data) : "—"}</span></div>
      <div><span className="text-muted-foreground">MTR:</span> <span className="font-mono">{data.mtr || "—"}</span></div>
      <div><span className="text-muted-foreground">Transportador:</span> {data.transportador || "—"}</div>
      <div><span className="text-muted-foreground">Destinador:</span> {data.destinador || "—"}</div>
      <div><span className="text-muted-foreground">Peso estimado:</span> {data.peso_estimado ? "Sim" : "Não"}</div>
      <div><span className="text-muted-foreground">Manual (DMR):</span> {data.dmr_manual ? "Sim" : "Não"}</div>
      {data.observacoes && <div><span className="text-muted-foreground">Obs.:</span> {data.observacoes}</div>}
      <div className="pt-2 border-t mt-2">
        <div className="text-muted-foreground mb-1">Itens ({itens.length}) — total {formatKgPlain(total)}</div>
        {itens.length === 0 ? <div className="italic text-muted-foreground">sem itens</div> :
          <ul className="space-y-1">
            {itens.map((it, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate">{it.tipo_residuo_nome} <span className="text-muted-foreground">· {it.tratamento}</span></span>
                <span className="font-mono">{formatKgPlain(Number(it.peso_kg ?? 0))}</span>
              </li>
            ))}
          </ul>}
      </div>
    </div>
  );
}

function SingleRecordDialog({
  entry, onClose, onRevert, reverting,
}: {
  entry: AuditEntry | null; onClose: () => void; onRevert: (e: AuditEntry) => void; reverting: boolean;
}) {
  const open = !!entry;
  const [showRaw, setShowRaw] = useState(false);
  const snap: any = Array.isArray(entry?.snapshot) ? entry?.snapshot?.[0] : entry?.snapshot;
  const coletaId = snap?.id;

  const { data: atual } = useQuery({
    queryKey: ["coleta-atual", coletaId],
    queryFn: () => (coletaId ? getColeta(coletaId) : Promise.resolve(null)),
    enabled: open && !!coletaId,
  });

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{entry.descricao}</DialogTitle>
          <DialogDescription>
            {new Date(entry.criado_em).toLocaleString("pt-BR")}
          </DialogDescription>
        </DialogHeader>
        {!showRaw ? (
          <div className="grid md:grid-cols-2 gap-3">
            <ColetaPreview data={snap} title="Estado anterior (snapshot)" />
            <ColetaPreview data={atual} title="Estado atual" />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div className="border rounded p-3">
              <div className="font-semibold mb-2 text-muted-foreground">Snapshot (JSON)</div>
              <pre className="whitespace-pre-wrap break-all">{snap ? JSON.stringify(snap, null, 2) : "—"}</pre>
            </div>
            <div className="border rounded p-3">
              <div className="font-semibold mb-2 text-muted-foreground">Atual (JSON)</div>
              <pre className="whitespace-pre-wrap break-all">{atual ? JSON.stringify(atual, null, 2) : "Coleta não existe mais"}</pre>
            </div>
          </div>
        )}
        <div className="flex justify-between gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => setShowRaw((s) => !s)}>
            {showRaw ? "Ver formato visual" : "Ver snapshot (JSON)"}
          </Button>
          <div className="flex gap-2">
            {atual && (
              <Button variant="outline" onClick={() => { window.location.href = `/coletas/${atual.id}`; }}>
                Editar atual
              </Button>
            )}
            {snap && !entry.revertido && (
              <Button onClick={() => onRevert(entry)} disabled={reverting}>
                <Undo2 className="size-3 mr-1" /> Reverter para anterior
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
