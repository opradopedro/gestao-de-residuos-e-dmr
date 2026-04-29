import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import { listColetasByUnidade, totalPesoColeta, isPendenciaSemMtr, isSemMtrOperacao } from "@/lib/data";
import { listDmrUploads, getDmrLinhas } from "@/lib/dmr";
import { formatTon, formatKg } from "@/lib/format";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Scale, ClipboardList, FileSpreadsheet, Plus, ArrowRight, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Dashboard — DMR" }] }),
  component: Dashboard,
});

function Dashboard() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const { data: coletas = [], isLoading } = useQuery({
    queryKey: ["coletas", unidade],
    queryFn: () => listColetasByUnidade(unidade!),
    enabled: !!unidade,
  });
  const { data: uploads = [] } = useQuery({
    queryKey: ["dmr_uploads", unidade],
    queryFn: () => listDmrUploads(unidade!),
    enabled: !!unidade,
  });
  const upload = uploads.find((u) => u.ano === periodo.ano && u.trimestre === periodo.trimestre);
  const { data: linhasDmr = [] } = useQuery({
    queryKey: ["dmr_linhas", upload?.id],
    queryFn: () => getDmrLinhas(upload!.id),
    enabled: !!upload,
  });

  const stats = useMemo(() => {
    const noTri = coletas.filter((c) => c.data >= periodo.start && c.data <= periodo.end);
    const peso = noTri.reduce((s, c) => s + totalPesoColeta(c), 0);
    const semMtr = noTri.filter(isPendenciaSemMtr);
    const semMtrOperacao = noTri.filter(isSemMtrOperacao);
    const estimado = noTri.filter((c) => c.peso_estimado);
    const pesoSemMtr = semMtr.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoEstimado = estimado.reduce((s, c) => s + totalPesoColeta(c), 0);

    let foraDmr: number | null = null;
    if (upload) {
      const totalDmr = linhasDmr.reduce((s, l) => s + Number(l.peso_kg ?? 0), 0);
      foraDmr = Math.max(0, peso - totalDmr);
    }

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
      semMtrOperacao: semMtrOperacao.length,
      estimadoCount: estimado.length,
      pesoEstimado,
      foraDmr,
      residuoData: Array.from(porResiduo.entries()).map(([nome, kg]) => ({ nome, kg })).sort((a, b) => b.kg - a.kg).slice(0, 8),
      destinadorData: Array.from(porDestinador.entries()).map(([nome, kg]) => ({ nome, kg })).sort((a, b) => b.kg - a.kg).slice(0, 8),
    };
  }, [coletas, periodo, upload, linhasDmr]);

  if (!unidade) return <NoUnidade />;

  const nivelRisco = stats.semMtr > 5 || (stats.foraDmr ?? 0) > 1000 ? "alto"
    : stats.semMtr > 0 || stats.estimadoCount > 0 || stats.semMtrOperacao > 0 ? "medio" : "ok";


  return (
    <div className="p-6 max-w-7xl space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Visão geral · ${periodo.label}`}
        actions={<Button asChild><Link to="/coletas/nova"><Plus className="size-4 mr-1" /> Nova coleta</Link></Button>}
      />

      {nivelRisco !== "ok" && (
        <div className={`rounded-lg border p-4 flex items-start gap-3 ${nivelRisco === "alto" ? "bg-destructive/10 border-destructive/40" : "bg-warning/10 border-warning/40"}`}>
          <ShieldAlert className={`size-5 mt-0.5 ${nivelRisco === "alto" ? "text-destructive" : "text-warning-foreground"}`} />
          <div className="flex-1">
            <div className="font-medium">
              {nivelRisco === "alto" ? "Risco alto detectado" : "Atenção"} —
              {stats.semMtr > 0 && ` ${stats.semMtr} sem MTR (erro)`}
              {stats.semMtrOperacao > 0 && ` · ${stats.semMtrOperacao} sem MTR (operação)`}
              {stats.estimadoCount > 0 && ` · ${stats.estimadoCount} estimadas`}
              {stats.foraDmr && stats.foraDmr > 0 ? ` · ${formatTon(stats.foraDmr)} fora da DMR` : ""}
            </div>
            <Link to="/risco" className="text-sm underline">Abrir dashboard de risco</Link>
          </div>
        </div>
      )}
      {nivelRisco === "ok" && stats.totalColetas > 0 && (
        <div className="rounded-lg border border-success/40 bg-success/10 p-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-success" />
          <div className="text-sm">Tudo certo — nenhuma pendência crítica neste trimestre.</div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="Coletas" value={String(stats.totalColetas)} hint={isLoading ? "Carregando..." : `${formatTon(stats.pesoTotal)} no total`} />
        <StatCard icon={AlertTriangle} label="Sem MTR" value={String(stats.semMtr)} hint={formatKg(stats.pesoSemMtr)} tone={stats.semMtr > 0 ? "danger" : "ok"} />
        <StatCard icon={Scale} label="Peso estimado" value={String(stats.estimadoCount)} hint={formatKg(stats.pesoEstimado)} tone={stats.estimadoCount > 0 ? "warn" : "ok"} />
        <StatCard icon={FileSpreadsheet} label="Fora da DMR" value={stats.foraDmr === null ? "—" : formatTon(stats.foraDmr)} hint={stats.foraDmr === null ? "Sem DMR importada" : "Diferença interno vs DMR"} tone={(stats.foraDmr ?? 0) > 0 ? "danger" : "ok"} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickAction to="/coletas/nova" icon={Plus} label="Registrar coleta" tone="primary" />
        <QuickAction to="/pendencias" icon={AlertTriangle} label={`Resolver pendências${stats.semMtr + stats.estimadoCount > 0 ? ` (${stats.semMtr + stats.estimadoCount})` : ""}`} tone="warn" />
        <QuickAction to="/dmr" icon={FileSpreadsheet} label="Conferir DMR" tone="primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Top resíduos (kg)" data={stats.residuoData} color="oklch(0.55 0.18 255)" />
        <ChartCard title="Top destinadores (kg)" data={stats.destinadorData} color="oklch(0.62 0.17 150)" />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint, tone = "neutral" }: { icon: any; label: string; value: string; hint?: string; tone?: "neutral" | "ok" | "warn" | "danger" }) {
  const styles = tone === "danger" ? "border-destructive/40" : tone === "warn" ? "border-warning/40" : tone === "ok" ? "border-success/40" : "";
  const iconStyles = tone === "danger" ? "text-destructive" : tone === "warn" ? "text-warning-foreground" : tone === "ok" ? "text-success" : "text-muted-foreground";
  return (
    <Card className={styles}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`size-4 ${iconStyles}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function QuickAction({ to, icon: Icon, label, tone }: { to: string; icon: any; label: string; tone: "primary" | "warn" }) {
  return (
    <Link to={to as any} className={`group rounded-lg border p-4 flex items-center gap-3 hover:shadow-sm transition-all bg-card ${tone === "warn" ? "border-warning/40" : "border-border"}`}>
      <div className={`size-10 rounded-md flex items-center justify-center ${tone === "warn" ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary"}`}>
        <Icon className="size-5" />
      </div>
      <span className="font-medium flex-1">{label}</span>
      <ArrowRight className="size-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}

function ChartCard({ title, data, color }: { title: string; data: { nome: string; kg: number }[]; color: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center">Sem dados no período.</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.008 250)" />
              <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(1)}t`} />
              <YAxis type="category" dataKey="nome" width={140} />
              <Tooltip formatter={(v: any) => formatKg(Number(v))} />
              <Bar dataKey="kg" fill={color} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
