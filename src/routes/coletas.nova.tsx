import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ColetaForm } from "@/components/ColetaForm";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createColeta, ColetaInput } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/coletas/nova")({
  head: () => ({ meta: [{ title: "Nova coleta — DMR" }] }),
  component: NovaColeta,
});

function NovaColeta() {
  const unidade = useUnidadeAtiva();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: (input: ColetaInput) => createColeta(input),
    onSuccess: () => {
      toast.success("Coleta criada");
      qc.invalidateQueries({ queryKey: ["coletas"] });
      navigate({ to: "/coletas" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar"),
  });

  if (!unidade) return <NoUnidade />;
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title="Nova coleta" description="Registre uma nova coleta com seus itens." />
      <ColetaForm unidadeId={unidade} onSubmit={(v) => mut.mutate(v)} submitting={mut.isPending} />
    </div>
  );
}
