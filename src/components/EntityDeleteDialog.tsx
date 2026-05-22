import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteEntidadeComTransferencia } from "@/lib/data";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Tipo = "unidade" | "residuo" | "tratamento" | "transportador" | "destinador";

async function countAfetados(tipo: Tipo, id: string): Promise<number> {
  if (tipo === "residuo") {
    const { count } = await supabase.from("coleta_itens").select("id", { count: "exact", head: true }).eq("tipo_residuo_id", id);
    return count ?? 0;
  }
  if (tipo === "transportador") {
    const { count } = await supabase.from("coletas").select("id", { count: "exact", head: true }).eq("transportador_id", id);
    return count ?? 0;
  }
  if (tipo === "destinador") {
    const { count } = await supabase.from("coletas").select("id", { count: "exact", head: true }).eq("destinador_id", id);
    return count ?? 0;
  }
  if (tipo === "unidade") {
    const { count } = await supabase.from("coletas").select("id", { count: "exact", head: true }).eq("unidade_id", id);
    return count ?? 0;
  }
  return 0;
}

export function EntityDeleteDialog({
  open, onOpenChange, tipo, id, nome, alternativos,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: Tipo;
  id: string;
  nome: string;
  alternativos: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const [transferTo, setTransferTo] = useState<string>("__none__");
  const [confirmStep, setConfirmStep] = useState(false);

  useEffect(() => {
    if (!open) { setTransferTo("__none__"); setConfirmStep(false); }
  }, [open]);

  const { data: afetados = 0 } = useQuery({
    queryKey: ["entity-afetados", tipo, id],
    queryFn: () => countAfetados(tipo, id),
    enabled: open,
  });

  const mut = useMutation({
    mutationFn: () => deleteEntidadeComTransferencia(tipo, id, transferTo === "__none__" ? null : transferTo),
    onSuccess: ({ afetados }) => {
      qc.invalidateQueries();
      const msg = transferTo === "__none__"
        ? (afetados > 0 ? `Removido. ${afetados} registro(s) ficaram pendentes.` : "Removido")
        : `Transferido para outro ${tipo}. ${afetados} registro(s) atualizados.`;
      toast.success(msg);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  const opts = alternativos.filter((a) => a.id !== id);
  const isUnidadeBlocked = false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning-foreground" /> Excluir "{nome}"
          </DialogTitle>
        </DialogHeader>
        {!confirmStep ? (
          <>
            <div className="space-y-3 text-sm">
              <p>Antes de excluir, você pode transferir os dados associados para outro {tipo}.</p>
              <div>
                <Label className="text-xs">Transferir para</Label>
                <Select value={transferTo} onValueChange={setTransferTo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Não transferir (dados ficam pendentes)</SelectItem>
                    {opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {transferTo === "__none__" && (
                <div className="text-xs text-warning-foreground border border-warning/40 bg-warning/10 rounded p-2">
                  {afetados > 0
                    ? <><strong>{afetados}</strong> registro(s) vinculado(s) perderão a referência e aparecerão em Pendências.</>
                    : "Nenhum registro vinculado — exclusão segura."}
                  {isUnidadeBlocked && <div className="mt-1 font-semibold">Para excluir uma unidade com coletas, é necessário transferi-las.</div>}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                disabled={isUnidadeBlocked}
                onClick={() => {
                  if (transferTo === "__none__" && afetados > 0) setConfirmStep(true);
                  else mut.mutate();
                }}
              >
                {transferTo === "__none__" && afetados > 0 ? "Continuar" : "Confirmar exclusão"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 text-sm">
              <div className="border border-destructive/40 bg-destructive/10 rounded p-3">
                <div className="font-semibold text-destructive mb-1">Tem certeza?</div>
                Você está prestes a excluir <strong>"{nome}"</strong>. Isso desvinculará <strong>{afetados}</strong> registro(s),
                que ficarão visíveis em <strong>Riscos & Pendências</strong>.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmStep(false)}>Voltar</Button>
              <Button variant="destructive" disabled={mut.isPending} onClick={() => mut.mutate()}>
                {mut.isPending ? "Excluindo…" : `Sim, excluir e desvincular ${afetados}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
