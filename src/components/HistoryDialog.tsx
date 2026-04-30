import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Undo2 } from "lucide-react";
import { listAuditLog, markRevertido, restoreColetasFromSnapshot, deleteColetasByIds, type AuditEntry, logAction } from "@/lib/audit";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";

const TIPO_LABEL: Record<string, string> = {
  coleta_criada: "Coleta criada",
  coleta_editada: "Coleta editada",
  coleta_excluida: "Coleta excluída",
  exclusao_em_massa: "Exclusão em massa",
  importacao: "Importação de planilha",
  merge_destinador: "Merge de destinador",
  merge_transportador: "Merge de transportador",
  rollback: "Rollback",
};

export function HistoryDialog({
  open, onOpenChange, unidadeId,
}: { open: boolean; onOpenChange: (v: boolean) => void; unidadeId: string | null }) {
  const qc = useQueryClient();
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["audit_log", unidadeId],
    queryFn: () => listAuditLog(unidadeId, 15),
    enabled: open,
  });

  const rollbackMut = useMutation({
    mutationFn: async (entry: AuditEntry) => {
      if (entry.tipo === "exclusao_em_massa" || entry.tipo === "coleta_excluida") {
        const n = await restoreColetasFromSnapshot(entry.snapshot ?? []);
        await markRevertido(entry.id);
        await logAction({
          unidade_id: entry.unidade_id, tipo: "rollback",
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
          unidade_id: entry.unidade_id, tipo: "rollback",
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="size-5" /> Histórico de alterações</DialogTitle>
          <DialogDescription>Últimas 15 ações. Importações e exclusões em massa podem ser revertidas integralmente.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Carregando…</div>
        ) : entries.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Nenhuma ação registrada ainda.</div>
        ) : (
          <div className="border rounded divide-y">
            {entries.map((e) => (
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
                {canRollback(e) && (
                  <Button size="sm" variant="outline" onClick={() => {
                    if (confirm(`Desfazer "${e.descricao}"? Esta ação irá restaurar/remover ${e.quantidade} registro(s).`)) {
                      rollbackMut.mutate(e);
                    }
                  }} disabled={rollbackMut.isPending}>
                    <Undo2 className="size-3 mr-1" /> Desfazer
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
