import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteEntidadeComTransferencia } from "@/lib/data";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type Tipo = "unidade" | "residuo" | "tratamento" | "transportador" | "destinador";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning-foreground" /> Excluir "{nome}"
          </DialogTitle>
        </DialogHeader>
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
              Os registros vinculados perderão a referência e aparecerão em Pendências.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" disabled={mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Excluindo…" : "Confirmar exclusão"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
