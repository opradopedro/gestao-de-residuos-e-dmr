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
import { listUnidades, getColeta, deleteColeta, createColeta, type ColetaComItens, type ColetaInput } from "@/lib/data";
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

export function HistoryDialog({
  open,
  onOpenChange,
  unidadeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unidadeId: string | null;
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
        const n = await restoreColetasFromSnapshot(entry.snapshot ?? []);
        await markRevertido(entry.id);
        await logAction({
          unidade_id: entry.unidade_id,
          tipo: "rollback",
          descricao: `Rollback: ${entry.descricao} → ${n} coleta(s) restaurada(s)`,
          quantidade: n,
        });
        return n;
      }
      if (entry.tipo === "importacao") {
        const ids: string[] = entry.snapshot?.idsCriadas ?? [];
        const n = await deleteColetasByIds(ids);
        await markRevertido(entry.id);
        await logAction({
          unidade_id: entry.unidade_id,
          tipo: "rollback",
          descricao: `Rollback: ${entry.descricao} → ${n} coleta(s) removida(s)`,
          quantidade: n,
        });
        return n;
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

  function canRollback(e: AuditEntry) {
    return e.rollback_disponivel && !e.revertido && (e.tipo === "exclusao_em_massa" || e.tipo === "importacao");
  }

  function isSingleColetaEntry(e: AuditEntry): boolean {
    return e.quantidade === 1 && (e.tipo === "coleta_criada" || e.tipo === "coleta_editada" || e.tipo === "coleta_excluida");
  }

  // Agrupa visualmente por unidade quando "todas"
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
              <SelectTrigger className="h-8 w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as unidades</SelectItem>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
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
                            <Badge variant="outline" className="text-[10px]">
                              {TIPO_LABEL[e.tipo] ?? e.tipo}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(e.criado_em).toLocaleString("pt-BR")}
                            </span>
                            {e.revertido && (
                              <Badge variant="secondary" className="text-[10px]">
                                REVERTIDO
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1">{e.descricao}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {e.quantidade} registro(s) afetado(s)
                          </div>
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
                                if (
                                  confirm(
                                    `Desfazer "${e.descricao}"? Esta ação irá restaurar/remover ${e.quantidade} registro(s).`
                                  )
                                ) {
                                  rollbackMut.mutate(e);
                                }
                              }}
                              disabled={rollbackMut.isPending}
                            >
                              <Undo2 className="size-3 mr-1" /> Desfazer
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

      <SingleRecordDialog entry={verEntry} onClose={() => setVerEntry(null)} />
    </>
  );
}

// Modal para "Ver registro" com snapshot vs atual
function SingleRecordDialog({ entry, onClose }: { entry: AuditEntry | null; onClose: () => void }) {
  const qc = useQueryClient();
  const open = !!entry;
  const snap: any = Array.isArray(entry?.snapshot) ? entry?.snapshot?.[0] : entry?.snapshot;
  const coletaId = snap?.id;

  const { data: atual } = useQuery({
    queryKey: ["coleta-atual", coletaId],
    queryFn: () => (coletaId ? getColeta(coletaId) : Promise.resolve(null)),
    enabled: open && !!coletaId,
  });

  const reverterMut = useMutation({
    mutationFn: async () => {
      if (!snap) return;
      // Para coleta editada/criada: reaplicar snapshot.
      // Estratégia simples: se coleta atual existe, deletá-la e recriar do snapshot.
      if (atual) await deleteColeta(atual.id, { skipAudit: true });
      const input: ColetaInput = {
        unidade_id: snap.unidade_id,
        data: snap.data,
        transportador: snap.transportador,
        destinador: snap.destinador,
        transportador_id: snap.transportador_id,
        destinador_id: snap.destinador_id,
        mtr: snap.mtr,
        peso_estimado: !!snap.peso_estimado,
        dmr_manual: !!snap.dmr_manual,
        observacoes: snap.observacoes,
        itens: snap.itens ?? [],
      };
      await createColeta(input, { skipAudit: true });
      await logAction({
        unidade_id: snap.unidade_id,
        tipo: "rollback",
        descricao: `Rollback de coleta única (MTR ${snap.mtr ?? "—"})`,
        quantidade: 1,
      });
    },
    onSuccess: () => {
      toast.success("Coleta revertida ao estado anterior.");
      qc.invalidateQueries({ queryKey: ["coletas"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
      onClose();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[95vw] w-[900px]">
        <DialogHeader>
          <DialogTitle>Comparar registro</DialogTitle>
          <DialogDescription>{entry.descricao}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="border rounded p-3">
            <div className="font-semibold mb-2 text-muted-foreground">Estado anterior (snapshot)</div>
            <pre className="whitespace-pre-wrap break-all">{snap ? JSON.stringify(snap, null, 2) : "—"}</pre>
          </div>
          <div className="border rounded p-3">
            <div className="font-semibold mb-2 text-muted-foreground">Estado atual</div>
            <pre className="whitespace-pre-wrap break-all">
              {atual ? JSON.stringify(atual, null, 2) : "Coleta não existe mais"}
            </pre>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          {atual && (
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = `/coletas/${atual.id}`;
              }}
            >
              Editar atual
            </Button>
          )}
          {snap && (
            <Button onClick={() => reverterMut.mutate()} disabled={reverterMut.isPending}>
              Reverter para anterior
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
