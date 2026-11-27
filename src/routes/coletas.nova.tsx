import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ColetaForm } from "@/components/ColetaForm";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createColeta, ColetaInput } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/coletas/nova")({
  head: () => ({ meta: [
    { title: "Nova coleta — DMR" },
    { name: "description", content: "Registro de uma nova coleta de resíduos para conferência da DMR." },
    { property: "og:title", content: "Nova coleta — DMR" },
    { property: "og:description", content: "Registro de uma nova coleta de resíduos para conferência da DMR." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: NovaColeta,
});

function NovaColeta() {
  const unidade = useUnidadeAtiva();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const mut = useMutation({
    mutationFn: ({ input }: { input: ColetaInput; addAnother: boolean }) => createColeta(input),
    onSuccess: (_id, vars) => {
      toast.success("Coleta criada");
      qc.invalidateQueries({ queryKey: ["coletas"] });
      if (!vars.addAnother) navigate({ to: "/coletas" });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao criar"),
  });

  if (!unidade) return <NoUnidade />;
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader title="Nova coleta" description="Registre uma nova coleta com seus itens." />
      <ColetaForm
        unidadeId={unidade}
        showAddAnother
        onSubmit={(input, opts) => mut.mutate({ input, addAnother: !!opts?.addAnother })}
        submitting={mut.isPending}
      />
    </div>
  );
}
