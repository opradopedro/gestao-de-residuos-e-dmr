import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { listColetasByUnidade, totalPesoColeta } from "@/lib/data";
import { currentQuarter, quarterRange, quarterOf } from "@/lib/quarter";
import { formatTon, formatKg } from "@/lib/format";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Scale, ClipboardList, TrendingUp, Plus } from "lucide-react";
import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — DMR" }] }),
  component: Dashboard,
});

function Dashboard() {
  const unidade = useUnidadeAtiva();
  const q = currentQuarter();
  const { start, end } = quarterRange(q.ano, q.trimestre);
  const { data: coletas = [], isLoading } = useQuery({
    queryKey: ["coletas", unidade],
    queryFn: () => listColetasByUnidade(unidade!),
    enabled: !!unidade,
  });

  const stats = useMemo(() => {
    const noTri = coletas.filter((c) => c.data >= start && c.data <= end);
    const peso = noTri.reduce((s, c) => s + totalPesoColeta(c), 0);
    const semMtr = noTri.filter((c) => !c.mtr);
    const estimado = noTri.filter((c) => c.peso_estimado);
    const pesoSemMtr = semMtr.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoEstimado = estimado.reduce((s, c) => s + totalPesoColeta(c), 0);
    const foraSistema = pesoSemMtr;

    const porResiduo = new Map<string, number>();
    const porDestinador = new Map<string, number>();
    for (const c of noTri) {
      for (const it of c.itens ?? []) {
        porResiduo.set(it.tipo_residuo_nome, (porResiduo.get(it.tipo_residuo_nome) ?? 0) + Number(it.peso_kg));
      }
      const d = c.destinador || "(sem destinador)";
      porDestinador.set(d, (porDestinador.get(d) ?? 0) + totalPesoColeta(c));
    }
    return {
      totalColetas: noTri.length,
      pesoTotal: peso,
      semMtr: semMtr.length,
      pesoSemMtr,
      estimadoCount: estimado.length,
      pesoEstimado,
      foraSistema,
      residuoData: Array.from(porResiduo.entries()).map(([nome, kg]) => ({ nome, kg })).sort((a, b) => b.kg - a.kg).slice(0, 8),
      destinadorData: Array.from(porDestinador.entries()).map(([nome, kg]) => ({ nome, kg })).sort((a, b) => b.kg - a.kg).slice(0, 8),
    };
  }, [coletas, start, end]);

  if (!unidade) return <NoUnidade />;

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader
        title="Dashboard"
        description={`Visão geral do trimestre atual (${q.label}).`}
        actions={<Button asChild><Link to="/coletas/nova"><Plus className="size-4 mr-1" /> Nova coleta</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="Coletas no trimestre" value={String(stats.totalColetas)} hint={isLoading ? "Carregando..." : ""} />
        <StatCard icon={Scale} label="Peso total" value={formatTon(stats.pesoTotal)} accent />
        <StatCard icon={AlertTriangle} label="Coletas sem MTR" value={String(stats.semMtr)} hint={formatKg(stats.pesoSemMtr)} warn={stats.semMtr > 0} />
        <StatCard icon={TrendingUp} label="Peso estimado" value={String(stats.estimadoCount)} hint={formatKg(stats.pesoEstimado)} warn={stats.estimadoCount > 0} />
      </div>

      {stats.foraSistema > 0 && (
        <div className="mt-4 rounded-lg border border-warning/40 bg-warning/10 text-warning-foreground p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 mt-0.5" />
          <div>
            <div className="font-medium">{formatTon(stats.foraSistema)} fora do sistema oficial</div>
            <div className="text-sm opacity-80">Coletas sem MTR não são reportadas. <Link to="/pendencias" className="underline">Resolver pendências</Link>.</div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <ChartCard title="Top resíduos (kg)" data={stats.residuoData} />
        <ChartCard title="Top destinadores (kg)" data={stats.destinadorData} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, accent, warn }: { icon: any; label: string; value: string; hint?: string; accent?: boolean; warn?: boolean }) {
  return (
    <Card className={accent ? "border-primary/40" : warn ? "border-warning/40" : ""}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`size-4 ${warn ? "text-warning" : accent ? "text-primary" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, data }: { title: string; data: { nome: string; kg: number }[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Sem dados no trimestre.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.01 155)" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(1)}t`} />
              <YAxis type="category" dataKey="nome" width={140} />
              <Tooltip formatter={(v: any) => formatKg(Number(v))} />
              <Bar dataKey="kg" fill="oklch(0.55 0.14 155)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
