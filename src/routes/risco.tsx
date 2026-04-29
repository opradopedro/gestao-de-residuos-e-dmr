import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import {
  listColetasByUnidade, totalPesoColeta, findMtrDuplicates,
  isPendenciaSemMtr, isSemMtrOperacao, isPendenciaPesoEstimadoSemPeso,
} from "@/lib/data";
import { listDmrUploads, getDmrLinhas } from "@/lib/dmr";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, ShieldQuestion, ArrowRight, AlertTriangle, FileWarning, Scale, FileSpreadsheet, FileCheck } from "lucide-react";
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
    const semMtrErro = noTri.filter(isPendenciaSemMtr);
    const semMtrOp = noTri.filter(isSemMtrOperacao);
    const semMtrTotal = semMtrErro.length + semMtrOp.length;
    const estimadoComPeso = noTri.filter((c) => c.peso_estimado && totalPesoColeta(c) > 0);
    const estimadoSemPeso = noTri.filter(isPendenciaPesoEstimadoSemPeso);
    const totalKg = noTri.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoSemMtr = semMtrErro.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoSemMtrOp = semMtrOp.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoEstimado = estimadoComPeso.reduce((s, c) => s + totalPesoColeta(c), 0);
    const dups = findMtrDuplicates(noTri);
    const dupColetas = noTri.filter((c) => c.mtr && dups.has(c.mtr));
    const dupUnicos = dups.size;

    let foraDmr = 0;
    if (upload) {
      const totalDmr = linhasDmr.reduce((s, l) => s + Number(l.peso_kg ?? 0), 0);
      foraDmr = Math.max(0, totalKg - totalDmr);
    }

    // Total de fatores de risco = total de coletas sem MTR (erro + operação).
    const fatoresRisco = semMtrTotal;

    let nivel: "alto" | "medio" | "baixo" = "baixo";
    if (semMtrErro.length > 5 || foraDmr > 1000 || estimadoSemPeso.length > 0) nivel = "alto";
    else if (semMtrTotal > 0 || dupUnicos > 0 || (totalKg > 0 && pesoEstimado / totalKg > 0.1)) nivel = "medio";

    return {
      nivel, semMtrErro, semMtrOp, semMtrTotal, estimadoComPeso, estimadoSemPeso,
      pesoSemMtr, pesoSemMtrOp, pesoEstimado, totalKg, foraDmr, dupColetas, dupUnicos,
      totalColetas: noTri.length, temUpload: !!upload, fatoresRisco,
    };
  }, [coletas, periodo, upload, linhasDmr]);

  if (!unidade) return <NoUnidade />;

  const tone = analise.nivel === "alto"
    ? { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", icon: ShieldAlert, label: "Risco alto" }
    : analise.nivel === "medio"
    ? { bg: "bg-warning/15", border: "border-warning/50", text: "text-warning-foreground", icon: ShieldQuestion, label: "Risco médio" }
    : { bg: "bg-success/10", border: "border-success/40", text: "text-success", icon: ShieldCheck, label: "Risco baixo" };
  const Icon = tone.icon;

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
            <div className="text-2xl font-semibold mt-1">
              {analise.fatoresRisco} fator{analise.fatoresRisco === 1 ? "" : "es"} de risco identificado{analise.fatoresRisco === 1 ? "" : "s"}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {analise.totalColetas} coleta(s) registrada(s) totalizando {formatTon(analise.totalKg)} no período.
              {analise.semMtrTotal > 0 && (
                <> · <span className="text-destructive font-medium">{analise.semMtrErro.length} sem MTR (erro)</span> + <span className="text-warning-foreground font-medium">{analise.semMtrOp.length} sem MTR (operação manual)</span></>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        <FatorRisco
          ativa={analise.semMtrErro.length > 0}
          nivel={analise.semMtrErro.length > 5 ? "alto" : analise.semMtrErro.length > 0 ? "medio" : "baixo"}
          icon={FileWarning}
          titulo="Sem MTR (erro)"
          descricao={analise.semMtrErro.length > 0
            ? `${analise.semMtrErro.length} coleta(s) totalizando ${formatKg(analise.pesoSemMtr)} sem rastreio oficial.`
            : "Todas as coletas que deveriam ter MTR possuem MTR."}
          link="/pendencias"
        />
        <FatorInformativo
          ativa={analise.semMtrOp.length > 0}
          icon={FileCheck}
          titulo="Sem MTR por operação (DMR manual)"
          descricao={analise.semMtrOp.length > 0
            ? `${analise.semMtrOp.length} coleta(s) marcadas como DMR manual — sem MTR por escolha operacional.`
            : "Nenhuma coleta marcada como DMR manual."}
          link="/coletas"
        />
        <FatorRisco
          ativa={analise.estimadoSemPeso.length > 0}
          nivel="alto"
          icon={Scale}
          titulo="Peso estimado sem peso"
          descricao={analise.estimadoSemPeso.length > 0
            ? `${analise.estimadoSemPeso.length} coleta(s) marcada(s) como estimado mas sem valor de peso.`
            : "Nenhuma coleta estimada sem peso."}
          link="/pendencias"
        />
        <FatorInformativo
          ativa={analise.estimadoComPeso.length > 0}
          icon={Scale}
          titulo="Peso estimado (informado)"
          descricao={analise.estimadoComPeso.length > 0
            ? `${analise.estimadoComPeso.length} coleta(s) com ${formatKg(analise.pesoEstimado)} emitidas com peso estimado.`
            : "Nenhuma coleta com peso estimado."}
          link="/coletas"
        />
        <FatorRisco
          ativa={analise.dupUnicos > 0}
          nivel="medio"
          icon={AlertTriangle}
          titulo="MTR duplicado"
          descricao={analise.dupUnicos > 0
            ? `${analise.dupUnicos} MTR(s) único(s) duplicado(s) em ${analise.dupColetas.length} coleta(s).`
            : "Nenhum MTR duplicado detectado."}
          link="/pendencias"
        />
        <FatorRisco
          ativa={analise.foraDmr > 0}
          nivel={analise.foraDmr > 1000 ? "alto" : analise.foraDmr > 0 ? "medio" : "baixo"}
          icon={FileSpreadsheet}
          titulo="Volume fora da DMR"
          descricao={!analise.temUpload
            ? "Nenhuma DMR foi importada para este trimestre ainda."
            : analise.foraDmr > 0
            ? `${formatTon(analise.foraDmr)} no sistema interno não aparecem na DMR oficial.`
            : "Sistema interno e DMR estão alinhados."}
          link="/dmr"
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

function FatorInformativo({ ativa, icon: Icon, titulo, descricao, link }: { ativa: boolean; icon: any; titulo: string; descricao: string; link: string }) {
  return (
    <Card className="border border-border bg-muted/30">
      <CardContent className="p-4 flex items-center gap-4">
        <Icon className="size-6 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">{titulo} <span className="text-xs text-muted-foreground font-normal">· informativo</span></div>
          <div className="text-sm text-muted-foreground">{descricao}</div>
        </div>
        {ativa && (
          <Button asChild size="sm" variant="ghost">
            <Link to={link as any}>Ver <ArrowRight className="size-3.5 ml-1" /></Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
