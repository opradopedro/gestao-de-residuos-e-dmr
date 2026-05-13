import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import {
  listColetasByUnidade, totalPesoColeta, findMtrDuplicates,
  isPendenciaSemMtr, isSemMtrOperacao, isPendenciaSemPeso, isErroPreenchimento,
} from "@/lib/data";
import { listDmrUploads, getDmrLinhas } from "@/lib/dmr";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, ShieldQuestion, ArrowRight, AlertTriangle, FileWarning, Scale, FileSpreadsheet, FileCheck, Info } from "lucide-react";
import { useMemo } from "react";
import { formatTon, formatKg } from "@/lib/format";

export const Route = createFileRoute("/risco")({
  head: () => ({ meta: [{ title: "Riscos & Pendências — DMR" }] }),
  component: RiscoPage,
});

type RiskFilter =
  | "sem_mtr_erro" | "sem_mtr_dmr" | "sem_peso" | "mtr_duplicado"
  | "peso_estimado" | "fora_dmr" | "erro_preenchimento";

function RiscoPage() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const navigate = useNavigate();

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
    const semPesoTodos = noTri.filter(isPendenciaSemPeso);
    const totalKg = noTri.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoSemMtr = semMtrErro.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoSemMtrOp = semMtrOp.reduce((s, c) => s + totalPesoColeta(c), 0);
    const pesoEstimado = estimadoComPeso.reduce((s, c) => s + totalPesoColeta(c), 0);
    const dups = findMtrDuplicates(noTri);
    const dupColetas = noTri.filter((c) => c.mtr && dups.has(c.mtr));
    const dupUnicos = dups.size;
    const errosPreench = noTri.filter(isErroPreenchimento);

    let foraDmr = 0;
    if (upload) {
      const totalDmr = linhasDmr.reduce((s, l) => s + Number(l.peso_kg ?? 0), 0);
      foraDmr = Math.max(0, totalKg - totalDmr);
    }

    const fatoresRisco = semMtrTotal + (semPesoTodos.length > 0 ? 1 : 0) + (dupUnicos > 0 ? 1 : 0) + (errosPreench.length > 0 ? 1 : 0);

    let nivel: "alto" | "medio" | "baixo" = "baixo";
    if (semMtrErro.length > 5 || foraDmr > 1000 || semPesoTodos.length > 0 || errosPreench.length > 5) nivel = "alto";
    else if (semMtrTotal > 0 || dupUnicos > 0 || errosPreench.length > 0 || (totalKg > 0 && pesoEstimado / totalKg > 0.1)) nivel = "medio";

    return {
      nivel, semMtrErro, semMtrOp, semMtrTotal, estimadoComPeso, semPesoTodos,
      pesoSemMtr, pesoSemMtrOp, pesoEstimado, totalKg, foraDmr, dupColetas, dupUnicos,
      totalColetas: noTri.length, temUpload: !!upload, fatoresRisco, errosPreench,
    };
  }, [coletas, periodo, upload, linhasDmr]);

  if (!unidade) return <NoUnidade />;

  const tone = analise.nivel === "alto"
    ? { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", icon: ShieldAlert, label: "Risco alto" }
    : analise.nivel === "medio"
    ? { bg: "bg-warning/15", border: "border-warning/50", text: "text-warning-foreground", icon: ShieldQuestion, label: "Risco médio" }
    : { bg: "bg-success/10", border: "border-success/40", text: "text-success", icon: ShieldCheck, label: "Risco baixo" };
  const Icon = tone.icon;

  const goColetas = (filtro: RiskFilter) => {
    navigate({ to: "/coletas", search: { risco: filtro } as any });
  };

  return (
    <div className="p-6 max-w-6xl space-y-6">
      <PageHeader title="Riscos & Pendências" description={`Avaliação consolidada para ${periodo.label}.`} />

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
                <> · <span className="text-destructive font-medium">{analise.semMtrErro.length} sem MTR (erro)</span> + <span className="text-warning-foreground font-medium">{analise.semMtrOp.length} Incluir na DMR</span></>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-muted/30">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="size-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <div className="font-medium">Entenda os indicadores</div>
            <div><span className="inline-block size-2 rounded-full bg-destructive mr-2" /><strong>Vermelho — Crítico:</strong> coletas sem MTR por erro de preenchimento, DMR incompleta com volume relevante, ou peso ausente. Resolver antes de fechar o trimestre.</div>
            <div><span className="inline-block size-2 rounded-full bg-orange-500 mr-2" /><strong>Laranja — Alto:</strong> erros pontuais (ex: poucas coletas sem MTR, MTRs duplicados, divergências menores com a DMR). Revisar antes do envio.</div>
            <div><span className="inline-block size-2 rounded-full bg-warning mr-2" /><strong>Amarelo — Atenção:</strong> situações intencionais ou informativas (peso estimado, coletas marcadas para inclusão manual na DMR). Não bloqueia, mas vale conferir.</div>
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
          onClick={() => goColetas("sem_mtr_erro")}
          subtitulo="risco — erro de preenchimento"
        />
        <FatorRisco
          ativa={analise.semMtrOp.length > 0}
          nivel="medio"
          icon={FileCheck}
          titulo="Incluir na DMR"
          descricao={analise.semMtrOp.length > 0
            ? `${analise.semMtrOp.length} coleta(s) totalizando ${formatKg(analise.pesoSemMtrOp)} marcadas para inclusão manual na DMR.`
            : "Nenhuma coleta marcada para inclusão manual na DMR."}
          onClick={() => goColetas("sem_mtr_dmr")}
          subtitulo="risco — operação"
        />
        <FatorRisco
          ativa={analise.semPesoTodos.length > 0}
          nivel="alto"
          icon={Scale}
          titulo="Sem peso (peso = 0 ou ausente)"
          descricao={analise.semPesoTodos.length > 0
            ? `${analise.semPesoTodos.length} coleta(s) com peso zerado ou não informado.`
            : "Todas as coletas têm peso informado."}
          onClick={() => goColetas("sem_peso")}
        />
        <FatorRisco
          ativa={analise.errosPreench.length > 0}
          nivel={analise.errosPreench.length > 5 ? "alto" : "medio"}
          icon={AlertTriangle}
          titulo="Erros de preenchimento"
          descricao={analise.errosPreench.length > 0
            ? `${analise.errosPreench.length} coleta(s) com campos essenciais vazios (data, destinador, transportador, resíduo ou tratamento).`
            : "Sem erros de preenchimento."}
          onClick={() => goColetas("erro_preenchimento")}
        />
        <FatorInformativo
          ativa={analise.estimadoComPeso.length > 0}
          icon={Scale}
          titulo="Peso estimado (informado)"
          descricao={analise.estimadoComPeso.length > 0
            ? `${analise.estimadoComPeso.length} coleta(s) com ${formatKg(analise.pesoEstimado)} emitidas com peso estimado.`
            : "Nenhuma coleta com peso estimado."}
          onClick={() => goColetas("peso_estimado")}
        />
        <FatorRisco
          ativa={analise.dupUnicos > 0}
          nivel="medio"
          icon={AlertTriangle}
          titulo="MTR duplicado"
          descricao={analise.dupUnicos > 0
            ? `${analise.dupUnicos} MTR(s) único(s) duplicado(s) em ${analise.dupColetas.length} coleta(s).`
            : "Nenhum MTR duplicado detectado."}
          onClick={() => goColetas("mtr_duplicado")}
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
          onClick={() => navigate({ to: "/dmr" })}
        />
      </div>
    </div>
  );
}

function severidadeTone(severidade: "vermelho" | "laranja" | "amarelo" | "ok") {
  switch (severidade) {
    case "vermelho": return "text-destructive border-destructive/40 bg-destructive/5";
    case "laranja": return "text-orange-600 border-orange-400/40 bg-orange-500/5 dark:text-orange-400";
    case "amarelo": return "text-warning-foreground border-warning/40 bg-warning/10";
    case "ok": return "text-success border-success/30 bg-success/5";
  }
}

function FatorRisco({ ativa, nivel, icon: Icon, titulo, descricao, onClick, subtitulo }: { ativa: boolean; nivel: "alto" | "medio" | "baixo"; icon: any; titulo: string; descricao: string; onClick: () => void; subtitulo?: string }) {
  const sev: "vermelho" | "laranja" | "amarelo" | "ok" = !ativa ? "ok"
    : nivel === "alto" ? "vermelho"
    : nivel === "medio" ? "laranja"
    : "amarelo";
  const tone = severidadeTone(sev);
  return (
    <Card className={`border ${tone}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <Icon className="size-6 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">
            {titulo}
            {subtitulo && <span className="text-xs text-muted-foreground font-normal ml-2">· {subtitulo}</span>}
            {ativa && <span className="text-[10px] uppercase tracking-wider font-semibold ml-2">{sev === "vermelho" ? "crítico" : sev === "laranja" ? "alto" : "atenção"}</span>}
          </div>
          <div className="text-sm text-muted-foreground">{descricao}</div>
        </div>
        {ativa && (
          <Button size="sm" variant="outline" onClick={onClick}>
            Ver coletas <ArrowRight className="size-3.5 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function FatorInformativo({ ativa, icon: Icon, titulo, descricao, onClick }: { ativa: boolean; icon: any; titulo: string; descricao: string; onClick: () => void }) {
  return (
    <Card className="border border-border bg-muted/30">
      <CardContent className="p-4 flex items-center gap-4">
        <Icon className="size-6 shrink-0 text-muted-foreground" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-foreground">{titulo} <span className="text-xs text-muted-foreground font-normal">· informativo</span></div>
          <div className="text-sm text-muted-foreground">{descricao}</div>
        </div>
        {ativa && (
          <Button size="sm" variant="ghost" onClick={onClick}>
            Ver coletas <ArrowRight className="size-3.5 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
