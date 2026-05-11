import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertTipoResiduo, type TipoResiduo } from "@/lib/data";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function TipoResiduoEditDialog({
  open, onOpenChange, tipo, defaultName, defaultCodigo, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo?: TipoResiduo | null;
  defaultName?: string;
  defaultCodigo?: string;
  onSaved?: (t: TipoResiduo) => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!tipo;
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [trat, setTrat] = useState("");

  useEffect(() => {
    if (open) {
      setNome(tipo?.nome ?? defaultName ?? "");
      setCodigo(tipo?.codigo ?? defaultCodigo ?? "");
      setTrat(tipo?.tratamento_padrao ?? "");
    }
  }, [open, tipo, defaultName, defaultCodigo]);

  const mut = useMutation({
    mutationFn: () => upsertTipoResiduo({
      id: tipo?.id, nome: nome.trim(),
      tratamento_padrao: trat.trim() || "Reciclagem",
      codigo: codigo.trim() || null,
    }),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ["tipos_residuo"] });
      qc.invalidateQueries({ queryKey: ["coletas"] });
      toast.success(isEdit ? "Resíduo atualizado" : "Resíduo criado");
      onSaved?.(t);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tipo de resíduo" : "Novo tipo de resíduo"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Nome</Label><Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">Código IBAMA</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: 200138" /></div>
          <div><Label className="text-xs">Tratamento padrão</Label><Input value={trat} onChange={(e) => setTrat(e.target.value)} placeholder="Ex.: Reciclagem" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
