import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { listColetasByUnidade, totalPesoColeta } from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatDate, formatKg, formatTon } from "@/lib/format";
import { useMemo } from "react";
import { AlertTriangle, FileWarning, Scale } from "lucide-react";

export const Route = createFileRoute("/pendencias")({
  head: () => ({ meta: [{ title: "Pendências — DMR" }] }),
  component: Pendencias,
});

function Pendencias() {
  const unidade = useUnidadeAtiva();
  const { data: coletas = [] } = useQuery({
    queryKey: ["coletas", unidade],
    queryFn: () => listColetasByUnidade(unidade!),
    enabled: !!unidade,
  });

  const semMtr = useMemo(() => coletas.filter((c) => !c.mtr), [coletas]);
  const estimado = useMemo(() => coletas.filter((c) => c.peso_estimado), [coletas]);
  const pesoSemMtr = semMtr.reduce((s, c) => s + totalPesoColeta(c), 0);
  const pesoEstimado = estimado.reduce((s, c) => s + totalPesoColeta(c), 0);

  if (!unidade) return <NoUnidade />;

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader title="Pendências" description="Coletas que precisam de ajuste antes da DMR." />

      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <Card className="border-warning/40">
          <CardContent className="p-5 flex items-start gap-3">
            <FileWarning className="size-7 text-warning" />
            <div>
              <div className="text-sm text-muted-foreground">Coletas sem MTR</div>
              <div className="text-2xl font-semibold">{semMtr.length}</div>
              <div className="text-sm">{formatTon(pesoSemMtr)} fora do sistema oficial</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/40">
          <CardContent className="p-5 flex items-start gap-3">
            <Scale className="size-7 text-warning" />
            <div>
              <div className="text-sm text-muted-foreground">Coletas com peso estimado</div>
              <div className="text-2xl font-semibold">{estimado.length}</div>
              <div className="text-sm">{formatTon(pesoEstimado)} a confirmar</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="mtr">
        <TabsList>
          <TabsTrigger value="mtr">Sem MTR ({semMtr.length})</TabsTrigger>
          <TabsTrigger value="estimado">Peso estimado ({estimado.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="mtr"><PendenciaTable rows={semMtr} /></TabsContent>
        <TabsContent value="estimado"><PendenciaTable rows={estimado} /></TabsContent>
      </Tabs>
    </div>
  );
}

function PendenciaTable({ rows }: { rows: any[] }) {
  if (rows.length === 0) return (
    <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma pendência 🎉</CardContent></Card>
  );
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Data</th>
              <th className="text-left p-3">Destinador</th>
              <th className="text-left p-3">Resíduos</th>
              <th className="text-right p-3">Peso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="p-3">{formatDate(c.data)}</td>
                <td className="p-3">{c.destinador || "—"}</td>
                <td className="p-3 text-xs">{(c.itens ?? []).map((it: any) => it.tipo_residuo_nome).join(", ")}</td>
                <td className="p-3 text-right tabular-nums">{formatKg(totalPesoColeta(c))}</td>
                <td className="p-3 text-right">
                  <Button asChild size="sm" variant="ghost"><Link to="/coletas/$id" params={{ id: c.id }}>Corrigir</Link></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
