import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ColetaForm } from "@/components/ColetaForm";
import { PageHeader } from "@/components/NoUnidade";
import { Button } from "@/components/ui/button";
import { getColeta, updateColeta, deleteColeta, ColetaInput } from "@/lib/data";
import { toast } from "sonner";
import { Trash2, ArrowLeft, Pencil, Eye } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/coletas/$id")({
  head: () => ({ meta: [{ title: "Coleta — DMR" }] }),
  component: EditarColeta,
});

function EditarColeta() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const { data: coleta, isLoading } = useQuery({ queryKey: ["coleta", id], queryFn: () => getColeta(id) });

  const mutSave = useMutation({
    mutationFn: (input: ColetaInput) => updateColeta(id, input),
    onSuccess: () => {
      toast.success("Coleta atualizada");
      qc.invalidateQueries({ queryKey: ["coletas"] });
      qc.invalidateQueries({ queryKey: ["coleta", id] });
      navigate({ to: "/coletas" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const mutDel = useMutation({
    mutationFn: () => deleteColeta(id),
    onSuccess: () => {
      toast.success("Coleta excluída");
      qc.invalidateQueries({ queryKey: ["coletas"] });
      navigate({ to: "/coletas" });
    },
  });

  if (isLoading) return <div className="p-6">Carregando…</div>;
  if (!coleta) return <div className="p-6">Coleta não encontrada.</div>;

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-2">
        <Button variant="ghost" size="sm" onClick={() => history.length > 1 ? history.back() : navigate({ to: "/coletas" })}>
          <ArrowLeft className="size-4 mr-1" /> Voltar
        </Button>
      </div>
      <PageHeader
        title={editMode ? "Editar coleta" : "Visualizar coleta"}
        actions={
          <div className="flex gap-2">
            {!editMode ? (
              <Button variant="outline" onClick={() => setEditMode(true)}><Pencil className="size-4 mr-1" /> Editar</Button>
            ) : (
              <Button variant="outline" onClick={() => setEditMode(false)}><Eye className="size-4 mr-1" /> Visualizar</Button>
            )}
            <Button variant="outline" className="text-destructive border-destructive/40" onClick={() => { if (confirm("Excluir coleta?")) mutDel.mutate(); }}>
              <Trash2 className="size-4 mr-1" /> Excluir
            </Button>
          </div>
        }
      />
      <fieldset disabled={!editMode} className={editMode ? "" : "opacity-95 [&_input]:pointer-events-none [&_button]:pointer-events-none [&_select]:pointer-events-none"}>
        <ColetaForm
          unidadeId={coleta.unidade_id}
          initial={{
            unidade_id: coleta.unidade_id,
            data: coleta.data,
            transportador: coleta.transportador,
            destinador: coleta.destinador,
            transportador_id: (coleta as any).transportador_id ?? null,
            destinador_id: (coleta as any).destinador_id ?? null,
            mtr: coleta.mtr,
            peso_estimado: coleta.peso_estimado,
            dmr_manual: (coleta as any).dmr_manual ?? false,
            observacoes: coleta.observacoes,
            itens: (coleta.itens ?? []).map((it) => ({
              tipo_residuo_id: it.tipo_residuo_id,
              tipo_residuo_nome: it.tipo_residuo_nome,
              peso_kg: Number(it.peso_kg),
              tratamento: it.tratamento,
            })),
          }}
          onSubmit={(v) => mutSave.mutate(v)}
          submitting={mutSave.isPending}
        />
      </fieldset>
    </div>
  );
}
