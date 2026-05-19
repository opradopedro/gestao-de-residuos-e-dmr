import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteColetas, listUnidades, type ColetaComItens, totalPesoColeta } from "@/lib/data";
import { formatDate, formatKg } from "@/lib/format";
import { AdvancedFilterDialog } from "@/components/AdvancedFilterDialog";
import { aplicarFiltro, type FiltroAvancado, OP_LABEL } from "@/lib/coletas-filtros";

export function BulkDeleteDialog({
  open, onOpenChange, coletas, unidadeId, totalGeral,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coletas: ColetaComItens[];
  unidadeId: string | null;
  totalGeral: number;
}) {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<FiltroAvancado | null>(null);
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [confirma, setConfirma] = useState("");
  const [step, setStep] = useState<"filtro" | "preview" | "confirma">("filtro");

  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const unidadeNomes = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u.nome])), [unidades]);

  const matches = useMemo(() => {
    if (!filtro || filtro.regras.length === 0) return [];
    return aplicarFiltro(coletas, filtro, unidadeNomes);
  }, [coletas, filtro, unidadeNomes]);

  const expected = `EXCLUIR ${matches.length} COLETAS`;
  const pct = totalGeral > 0 ? (matches.length / totalGeral) * 100 : 0;

  const mut = useMutation({
    mutationFn: () => bulkDeleteColetas(matches.map((c) => c.id), unidadeId),
    onSuccess: (n) => {
      toast.success(`${n} coleta(s) excluída(s).`);
      qc.invalidateQueries({ queryKey: ["coletas"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
      reset();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  function reset() {
    setFiltro(null); setConfirma(""); setStep("filtro");
  }

  function resumoRegra(i: number) {
    if (!filtro) return "";
    const r = filtro.regras[i];
    const vazio = r.operador === "vazio" || r.operador === "nao_vazio";
    return `${r.campo} ${OP_LABEL[r.operador]}${vazio ? "" : ` "${r.valor ?? ""}"${r.valor2 ? ` e "${r.valor2}"` : ""}`}`;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
        <DialogContent className="max-w-[90vw] w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" /> Exclusão em massa de coletas
            </DialogTitle>
            <DialogDescription>Filtre, revise e confirme. Esta ação ficará no histórico e poderá ser desfeita.</DialogDescription>
          </DialogHeader>

          {step === "filtro" && (
            <div className="space-y-3">
              <div className="border rounded p-3 bg-muted/30 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Regras de filtro</div>
                  <Button size="sm" variant="outline" onClick={() => setFiltroOpen(true)}>
                    <Filter className="size-3 mr-1" /> {filtro ? "Editar filtro" : "Configurar filtro"}
                  </Button>
                </div>
                {filtro && filtro.regras.length > 0 ? (
                  <ul className="text-xs space-y-1">
                    {filtro.regras.map((r, i) => (
                      <li key={r.id} className="flex items-center gap-1">
                        {i > 0 && <span className="font-semibold text-primary">{filtro.combinador}</span>}
                        <span className="font-mono">{resumoRegra(i)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground">Nenhuma regra definida — clique em "Configurar filtro".</div>
                )}
              </div>
              <div className="text-sm text-muted-foreground">{matches.length} coleta(s) correspondem ao filtro.</div>
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                <Button disabled={matches.length === 0} onClick={() => setStep("preview")}>
                  Ver preview ({matches.length})
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-3">
              <div className="border rounded p-3 bg-warning/10 text-sm flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                <div>
                  Você está prestes a excluir <strong>{matches.length} coleta(s)</strong>, isso significa <strong>{pct.toFixed(1)}%</strong> do total de {totalGeral} coleta(s) registradas.
                </div>
              </div>
              <div className="border rounded max-h-[40vh] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">MTR</th>
                      <th className="text-left p-2">Unidade</th>
                      <th className="text-left p-2">Destinador</th>
                      <th className="text-left p-2">Resíduo</th>
                      <th className="text-right p-2">Peso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-2">{formatDate(c.data)}</td>
                        <td className="p-2 font-mono">{c.mtr || "—"}</td>
                        <td className="p-2">{unidadeNomes[c.unidade_id] ?? "—"}</td>
                        <td className="p-2">{c.destinador || "—"}</td>
                        <td className="p-2">{(c.itens ?? []).map((it) => it.tipo_residuo_nome).join(", ") || "—"}</td>
                        <td className="p-2 text-right tabular-nums">{formatKg(totalPesoColeta(c))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("filtro")}>Voltar</Button>
                <Button variant="destructive" onClick={() => setStep("confirma")}>Prosseguir para confirmação</Button>
              </DialogFooter>
            </div>
          )}

          {step === "confirma" && (
            <div className="space-y-3">
              <div className="border rounded p-3 bg-destructive/10 text-sm">
                <div className="font-semibold text-destructive mb-1">Confirmação dupla obrigatória</div>
                <div>Para excluir <strong>{matches.length}</strong> coleta(s) ({pct.toFixed(1)}% do total), digite exatamente o texto abaixo:</div>
                <div className="font-mono text-base bg-background border rounded px-3 py-2 mt-2 select-all">{expected}</div>
              </div>
              <Input value={confirma} onChange={(e) => setConfirma(e.target.value)} placeholder="Digite o texto exato" autoFocus />
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("preview")}>Voltar</Button>
                <Button variant="destructive" disabled={confirma !== expected || mut.isPending}
                  onClick={() => mut.mutate()}>
                  {mut.isPending ? "Excluindo…" : `Confirmar exclusão de ${matches.length} coleta(s)`}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AdvancedFilterDialog
        open={filtroOpen}
        onOpenChange={setFiltroOpen}
        filtro={filtro}
        onApply={setFiltro}
      />
    </>
  );
}
