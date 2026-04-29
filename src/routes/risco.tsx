import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import { listColetasByUnidade, totalPesoColeta, findMtrDuplicates, isPendenciaSemMtr, isSemMtrOperacao, countMtrDuplicatesUnique } from "@/lib/data";
import { listDmrUploads, getDmrLinhas } from "@/lib/dmr";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, ShieldQuestion, ArrowRight, AlertTriangle, FileWarning, Scale, FileSpreadsheet, ClipboardEdit } from "lucide-react";
import { useMemo } from "react";
import { formatTon, formatKg } from "@/lib/format";

export const Route = createFileRoute("/risco")({
  head: () => ({ meta: [{ title: "Risco — DMR" }] }),
  component: RiscoPage,
});

function RiscoPage() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();

  const { data: coletas = [] } = useQuery({
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

  const analise = useMemo(() => {
    const noTri = coletas.filter((c) => c.data >= periodo.start && c.data <= periodo.end);
    const semMtr = noTri.filter(isPendenciaSemMtr); // erro: esquecimento
    const semMtrOperacao = noTri.filter(isSemMtrOperacao); // DMR manual: risco, não pendência
    const estimado = noTri.filter((c) => c.peso_estimado);
    const totalKg = noTri.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoSemMtr = semMtr.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoSemMtrOperacao = semMtrOperacao.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoEstimado = estimado.reduce((s, c) => s + totalPesoColeta(c), 0);
    const dupUnique = countMtrDuplicatesUnique(noTri);
    const dupSet = findMtrDuplicates(noTri);
    const dupColetas = noTri.filter((c) => c.mtr && dupSet.has(c.mtr));

    let foraDmr = 0;
    if (upload) {
      const totalDmr = linhasDmr.reduce((s, l) => s + Number(l.peso_kg ?? 0), 0);
      foraDmr = Math.max(0, totalKg - totalDmr);
    }

    const pctEstimado = totalKg > 0 ? pesoEstimado / totalKg : 0;
    let nivel: "alto" | "medio" | "baixo" = "baixo";
    if (semMtr.length > 5 || foraDmr > 1000) nivel = "alto";
    else if (semMtr.length > 0 || pctEstimado > 0.1 || dupUnique > 0 || semMtrOperacao.length > 0) nivel = "medio";

    return {
      nivel, semMtr, semMtrOperacao, estimado, pesoSemMtr, pesoSemMtrOperacao, pesoEstimado, totalKg,
      foraDmr, dupColetas, dupUnique, totalColetas: noTri.length, temUpload: !!upload,
    };
  }, [coletas, periodo, upload, linhasDmr]);

  if (!unidade) return <NoUnidade />;

  const tone = analise.nivel === "alto"
    ? { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", icon: ShieldAlert, label: "Risco alto" }
    : analise.nivel === "medio"
    ? { bg: "bg-warning/15", border: "border-warning/50", text: "text-warning-foreground", icon: ShieldQuestion, label: "Risco médio" }
    : { bg: "bg-success/10", border: "border-success/40", text: "text-success", icon: ShieldCheck, label: "Risco baixo" };
  const Icon = tone.icon;

  const frases: string[] = [];
  if (analise.semMtr.length > 0) frases.push(`${analise.semMtr.length} coleta(s) sem MTR`);
  if (analise.foraDmr > 0) frases.push(`${formatTon(analise.foraDmr)} fora da DMR`);
  if (analise.estimado.length > 0) frases.push(`${analise.estimado.length} com peso estimado`);
  if (analise.dupColetas.length > 0) frases.push(`${analise.dupColetas.length} MTR(s) duplicado(s)`);
  if (frases.length === 0) frases.push("Nenhum fator de risco identificado");

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <PageHeader title="Dashboard de Risco" description={`Avaliação consolidada para ${periodo.label}.`} />

      <Card className={`${tone.bg} ${tone.border} border-2`}>
        <CardContent className="p-6 flex items-start gap-5">
          <div className={`size-16 rounded-2xl flex items-center justify-center ${tone.text} bg-card shadow-sm`}>
            <Icon className="size-8" />
          </div>
          <div className="flex-1">
            <div className={`text-xs font-semibold uppercase tracking-wider ${tone.text}`}>{tone.label}</div>
            <div className="text-2xl font-semibold mt-1">{frases.join(" · ")}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {analise.totalColetas} coleta(s) registrada(s) totalizando {formatTon(analise.totalKg)} no período.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <FatorRisco
          ativa={analise.semMtr.length > 0}
          nivel={analise.semMtr.length > 5 ? "alto" : analise.semMtr.length > 0 ? "medio" : "baixo"}
          icon={FileWarning}
          titulo="Coletas sem MTR"
          descricao={analise.semMtr.length > 0 ? `${analise.semMtr.length} coleta(s) totalizando ${formatKg(analise.pesoSemMtr)} não terão rastreio oficial.` : "Todas as coletas possuem MTR."}
          link="/pendencias"
        />
        <FatorRisco
          ativa={analise.estimado.length > 0}
          nivel={analise.estimado.length > 0 && analise.totalKg > 0 && analise.pesoEstimado / analise.totalKg > 0.1 ? "medio" : "baixo"}
          icon={Scale}
          titulo="Peso estimado não confirmado"
          descricao={analise.estimado.length > 0 ? `${analise.estimado.length} coleta(s) com ${formatKg(analise.pesoEstimado)} estimados — confirmar antes da DMR.` : "Todos os pesos estão confirmados."}
          link="/pendencias"
        />
        <FatorRisco
          ativa={analise.foraDmr > 0}
          nivel={analise.foraDmr > 1000 ? "alto" : analise.foraDmr > 0 ? "medio" : "baixo"}
          icon={FileSpreadsheet}
          titulo="Volume fora da DMR"
          descricao={!analise.temUpload ? "Nenhuma DMR foi importada para este trimestre ainda." : analise.foraDmr > 0 ? `${formatTon(analise.foraDmr)} no sistema interno não aparecem na DMR oficial.` : "Sistema interno e DMR estão alinhados."}
          link="/dmr"
        />
        <FatorRisco
          ativa={analise.dupColetas.length > 0}
          nivel="medio"
          icon={AlertTriangle}
          titulo="MTRs duplicados"
          descricao={analise.dupColetas.length > 0 ? `${analise.dupColetas.length} coleta(s) compartilham o mesmo número de MTR.` : "Nenhum MTR duplicado detectado."}
          link="/coletas"
        />
      </div>
    </div>
  );
}

function FatorRisco({ ativa, nivel, icon: Icon, titulo, descricao, link }: { ativa: boolean; nivel: "alto" | "medio" | "baixo"; icon: any; titulo: string; descricao: string; link: string }) {
  const tone = !ativa ? "text-success border-success/30 bg-success/5"
    : nivel === "alto" ? "text-destructive border-destructive/30 bg-destructive/5"
    : "text-warning-foreground border-warning/40 bg-warning/10";
  return (
    <Card className={`border ${tone}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <Icon className="size-6 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">{titulo}</div>
          <div className="text-sm text-muted-foreground">{descricao}</div>
        </div>
        {ativa && (
          <Button asChild size="sm" variant="outline">
            <Link to={link as any}>Ver <ArrowRight className="size-3.5 ml-1" /></Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
