import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getColeta, updateColeta, deleteColeta, type ColetaInput } from "@/lib/data";
import { formatDate, formatKgPlain } from "@/lib/format";
import { Pencil, Eye, Trash2 } from "lucide-react";
import { ColetaForm } from "@/components/ColetaForm";
import { toast } from "sonner";

export function ColetaViewDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const { data: c, isLoading } = useQuery({
    queryKey: ["coleta", id],
    queryFn: () => getColeta(id!),
    enabled: !!id,
  });

  const mutSave = useMutation({
    mutationFn: (input: ColetaInput) => updateColeta(id!, input),
    onSuccess: () => {
      toast.success("Coleta atualizada");
      qc.invalidateQueries({ queryKey: ["coletas"] });
      qc.invalidateQueries({ queryKey: ["coleta", id] });
      setEditMode(false);
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const mutDel = useMutation({
    mutationFn: () => deleteColeta(id!),
    onSuccess: () => {
      toast.success("Coleta excluída");
      qc.invalidateQueries({ queryKey: ["coletas"] });
      onClose();
    },
  });

  const handleClose = () => { setEditMode(false); onClose(); };

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>{editMode ? "Editar coleta" : "Visualizar coleta"}</span>
            {c && (
              <div className="flex gap-2 mr-8">
                {!editMode ? (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(true)}><Pencil className="size-3.5 mr-1" /> Editar</Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditMode(false)}><Eye className="size-3.5 mr-1" /> Visualizar</Button>
                )}
                <Button size="sm" variant="outline" className="text-destructive border-destructive/40"
                  onClick={() => { if (confirm("Excluir coleta?")) mutDel.mutate(); }}>
                  <Trash2 className="size-3.5 mr-1" /> Excluir
                </Button>
              </div>
            )}
          </DialogTitle>
        </DialogHeader>
        {isLoading || !c ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : editMode ? (
          <ColetaForm
            unidadeId={c.unidade_id}
            initial={{
              unidade_id: c.unidade_id,
              data: c.data,
              transportador: c.transportador,
              destinador: c.destinador,
              transportador_id: c.transportador_id,
              destinador_id: c.destinador_id,
              mtr: c.mtr,
              peso_estimado: c.peso_estimado,
              dmr_manual: c.dmr_manual,
              observacoes: c.observacoes,
              itens: (c.itens ?? []).map((it) => ({
                tipo_residuo_id: it.tipo_residuo_id,
                tipo_residuo_nome: it.tipo_residuo_nome,
                peso_kg: Number(it.peso_kg),
                tratamento: it.tratamento,
              })),
            }}
            onSubmit={(v) => mutSave.mutate(v)}
            submitting={mutSave.isPending}
          />
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" value={formatDate(c.data)} />
              <Field label="MTR" value={c.mtr || "—"} />
              <Field label="Destinador" value={c.destinador || "—"} />
              <Field label="Transportador" value={c.transportador || "—"} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {c.peso_estimado && <Badge variant="outline">Peso estimado</Badge>}
              {c.dmr_manual && <Badge>MTR não emitido (Incluir na DMR)</Badge>}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Itens</div>
              <div className="border rounded divide-y">
                {(c.itens ?? []).map((it) => (
                  <div key={it.id} className="flex justify-between p-2">
                    <span>{it.tipo_residuo_nome} <span className="text-muted-foreground text-xs">· {it.tratamento}</span></span>
                    <span className="tabular-nums">{formatKgPlain(Number(it.peso_kg))}</span>
                  </div>
                ))}
              </div>
            </div>
            {c.observacoes && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Observações</div>
                <div className="text-sm whitespace-pre-wrap">{c.observacoes}</div>
              </div>
            )}
          </div>
        )}
        {!editMode && (
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
