import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import {
  listColetasByUnidade, totalPesoColeta, findMtrDuplicates,
  isPendenciaSemMtr, isSemMtrOperacao, isPendenciaSemPeso, isErroPreenchimento,
  listDestinadores, listTiposResiduo,
} from "@/lib/data";
import { listDmrUploads, getDmrLinhas } from "@/lib/dmr";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck, ShieldQuestion, ArrowRight, AlertTriangle, FileWarning, Scale, FileSpreadsheet, FileCheck, Info, Building2, Recycle } from "lucide-react";
import { useMemo } from "react";
import { formatTon, formatKg } from "@/lib/format";

export const Route = createFileRoute("/risco")({
  head: () => ({ meta: [{ title: "Riscos & Pendências — DMR" }] }),
  component: RiscoPage,
});

type Severidade = "vermelho" | "laranja" | "amarelo" | "verde";

type Fator = {
  id: string;
  severidade: Severidade;
  icon: any;
  titulo: string;
  descricao: string;
  count: number;
  onClick?: () => void;
};

const SEV_ORDER: Record<Severidade, number> = { vermelho: 0, laranja: 1, amarelo: 2, verde: 3 };
const SEV_LABEL: Record<Severidade, string> = { vermelho: "crítico", laranja: "alto", amarelo: "atenção", verde: "ok" };

function severidadeTone(s: Severidade) {
  switch (s) {
    case "vermelho": return "border-destructive/40 bg-destructive/5 text-destructive";
    case "laranja": return "border-orange-400/50 bg-orange-500/5 text-orange-600 dark:text-orange-400";
    case "amarelo": return "border-warning/40 bg-warning/10 text-warning-foreground";
    case "verde": return "border-success/40 bg-success/5 text-success";
  }
}

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
  const { data: destinadores = [] } = useQuery({ queryKey: ["destinadores"], queryFn: listDestinadores });
  const { data: tiposResiduo = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });

  const upload = uploads.find((u) => u.ano === periodo.ano && u.trimestre === periodo.trimestre);
  const { data: linhasDmr = [] } = useQuery({
    queryKey: ["dmr_linhas", upload?.id],
    queryFn: () => getDmrLinhas(upload!.id),
    enabled: !!upload,
  });

  const fatores = useMemo<Fator[]>(() => {
    if (!unidade) return [];
    const noTri = coletas.filter((c) => c.data >= periodo.start && c.data <= periodo.end);
    const semPeso = noTri.filter(isPendenciaSemPeso);
    const errosPreench = noTri.filter(isErroPreenchimento);
    const semMtrErro = noTri.filter(isPendenciaSemMtr);
    const semMtrOp = noTri.filter(isSemMtrOperacao);
    const dups = findMtrDuplicates(noTri);
    const dupColetas = noTri.filter((c) => c.mtr && dups.has(c.mtr));

    const totalKg = noTri.reduce((s, c) => s + totalPesoColeta(c), 0);
    let foraDmr = 0;
    if (upload) {
      const totalDmrKg = linhasDmr.reduce((s, l) => s + Number(l.peso_kg ?? 0), 0);
      foraDmr = Math.max(0, totalKg - totalDmrKg);
    }

    const destSemCnpj = destinadores.filter((d) => !d.cnpj || !d.cnpj.trim());
    const resSemIbama = tiposResiduo.filter((t) => !t.codigo || !t.codigo.trim());

    const list: Fator[] = [];

    // VERMELHO — Crítico (impacta diretamente DMR)
    list.push(semPeso.length > 0 ? {
      id: "sem_peso", severidade: "vermelho", icon: Scale,
      titulo: "Sem peso",
      descricao: `${semPeso.length} coleta(s) com peso zerado ou não informado — impacta diretamente a DMR.`,
      count: semPeso.length,
      onClick: () => navigate({ to: "/coletas", search: { risco: "sem_peso" } as any }),
    } : {
      id: "sem_peso", severidade: "verde", icon: Scale,
      titulo: "Sem peso", descricao: "Todas as coletas têm peso informado.", count: 0,
    });
    list.push(foraDmr > 0 ? {
      id: "fora_dmr", severidade: "vermelho", icon: FileSpreadsheet,
      titulo: "Volume fora da DMR",
      descricao: `${formatTon(foraDmr)} no sistema interno não aparecem na DMR oficial do trimestre.`,
      count: 1,
      onClick: () => navigate({ to: "/dmr" }),
    } : {
      id: "fora_dmr", severidade: "verde", icon: FileSpreadsheet,
      titulo: "Volume fora da DMR",
      descricao: upload ? "Volume interno bate com a DMR oficial." : "Sem DMR importada para comparar.",
      count: 0,
    });

    // LARANJA — Alto impacto (pode impactar DMR)
    list.push(errosPreench.length > 0 ? {
      id: "erro_preenchimento", severidade: "laranja", icon: AlertTriangle,
      titulo: "Erros de preenchimento",
      descricao: `${errosPreench.length} coleta(s) com campos essenciais vazios (data, destinador, transportador, resíduo ou tratamento).`,
      count: errosPreench.length,
      onClick: () => navigate({ to: "/coletas", search: { risco: "erro_preenchimento" } as any }),
    } : {
      id: "erro_preenchimento", severidade: "verde", icon: AlertTriangle,
      titulo: "Erros de preenchimento", descricao: "Todos os campos essenciais preenchidos.", count: 0,
    });
    list.push(semMtrOp.length > 0 ? {
      id: "incluir_dmr", severidade: "laranja", icon: FileCheck,
      titulo: "Incluir na DMR",
      descricao: `${semMtrOp.length} coleta(s) marcadas para inclusão manual na DMR — confirme antes do envio.`,
      count: semMtrOp.length,
      onClick: () => navigate({ to: "/coletas", search: { risco: "sem_mtr_dmr" } as any }),
    } : {
      id: "incluir_dmr", severidade: "verde", icon: FileCheck,
      titulo: "Incluir na DMR", descricao: "Nenhuma coleta pendente de inclusão manual.", count: 0,
    });
    list.push(resSemIbama.length > 0 ? {
      id: "ibama", severidade: "laranja", icon: Recycle,
      titulo: "Resíduo sem código IBAMA",
      descricao: `${resSemIbama.length} resíduo(s) cadastrado(s) sem código IBAMA — ficarão sem correspondência na DMR.`,
      count: resSemIbama.length,
      onClick: () => navigate({ to: "/cadastros", search: { risco: "ibama" } as any }),
    } : {
      id: "ibama", severidade: "verde", icon: Recycle,
      titulo: "Resíduo sem código IBAMA", descricao: "Todos os resíduos têm código IBAMA.", count: 0,
    });

    // AMARELO — Atenção (não crítico)
    list.push(semMtrErro.length > 0 ? {
      id: "sem_mtr_erro", severidade: "amarelo", icon: FileWarning,
      titulo: "Sem MTR",
      descricao: `${semMtrErro.length} coleta(s) sem MTR informado e não marcadas como "Incluir na DMR".`,
      count: semMtrErro.length,
      onClick: () => navigate({ to: "/coletas", search: { risco: "sem_mtr_erro" } as any }),
    } : {
      id: "sem_mtr_erro", severidade: "verde", icon: FileWarning,
      titulo: "Sem MTR", descricao: "Todas as coletas têm MTR ou estão marcadas para inclusão manual.", count: 0,
    });
    list.push(dups.size > 0 ? {
      id: "mtr_dup", severidade: "amarelo", icon: AlertTriangle,
      titulo: "MTR duplicado",
      descricao: `${dups.size} MTR(s) único(s) duplicado(s) em ${dupColetas.length} coleta(s).`,
      count: dups.size,
      onClick: () => navigate({ to: "/coletas", search: { risco: "mtr_duplicado" } as any }),
    } : {
      id: "mtr_dup", severidade: "verde", icon: AlertTriangle,
      titulo: "MTR duplicado", descricao: "Nenhum MTR duplicado.", count: 0,
    });
    list.push(destSemCnpj.length > 0 ? {
      id: "cnpj", severidade: "amarelo", icon: Building2,
      titulo: "Destinador sem CNPJ",
      descricao: `${destSemCnpj.length} destinador(es) cadastrado(s) sem CNPJ.`,
      count: destSemCnpj.length,
      onClick: () => navigate({ to: "/cadastros", search: { risco: "cnpj" } as any }),
    } : {
      id: "cnpj", severidade: "verde", icon: Building2,
      titulo: "Destinador sem CNPJ", descricao: "Todos os destinadores têm CNPJ.", count: 0,
    });

    list.sort((a, b) => {
      const d = SEV_ORDER[a.severidade] - SEV_ORDER[b.severidade];
      if (d !== 0) return d;
      return a.titulo.localeCompare(b.titulo, "pt-BR");
    });

    return list;
  }, [coletas, periodo, upload, linhasDmr, destinadores, tiposResiduo, unidade, navigate]);

  const fatoresAtivos = useMemo(() => fatores.filter((f) => f.severidade !== "verde"), [fatores]);

  const totalKg = useMemo(
    () => coletas.filter((c) => c.data >= periodo.start && c.data <= periodo.end).reduce((s, c) => s + totalPesoColeta(c), 0),
    [coletas, periodo],
  );
  const totalColetasNoTri = useMemo(
    () => coletas.filter((c) => c.data >= periodo.start && c.data <= periodo.end).length,
    [coletas, periodo],
  );

  const nivelGeral: Severidade | "ok" = fatoresAtivos[0]?.severidade ?? "ok";
  const tone = nivelGeral === "vermelho"
    ? { bg: "bg-destructive/10", border: "border-destructive/40", text: "text-destructive", icon: ShieldAlert, label: "Risco crítico" }
    : nivelGeral === "laranja"
    ? { bg: "bg-orange-500/10", border: "border-orange-400/50", text: "text-orange-600 dark:text-orange-400", icon: ShieldAlert, label: "Alto impacto" }
    : nivelGeral === "amarelo"
    ? { bg: "bg-warning/15", border: "border-warning/50", text: "text-warning-foreground", icon: ShieldQuestion, label: "Atenção" }
    : { bg: "bg-success/10", border: "border-success/40", text: "text-success", icon: ShieldCheck, label: "Sem pendências" };
  const Icon = tone.icon;

  if (!unidade) return <NoUnidade />;

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
              {fatoresAtivos.length} fator{fatoresAtivos.length === 1 ? "" : "es"} de risco identificado{fatoresAtivos.length === 1 ? "" : "s"}
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {totalColetasNoTri} coleta(s) registrada(s) totalizando {formatTon(totalKg)} no período.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-muted/30">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="size-5 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <div className="font-medium">Entenda os indicadores</div>
            <div><span className="inline-block size-2 rounded-full bg-destructive mr-2" /><strong>Vermelho — Crítico:</strong> situações que impactam diretamente a DMR (sem peso, volume fora da DMR).</div>
            <div><span className="inline-block size-2 rounded-full bg-orange-500 mr-2" /><strong>Laranja — Alto impacto:</strong> situações que podem impactar a DMR (erros de preenchimento, "Incluir na DMR", resíduo sem código IBAMA).</div>
            <div><span className="inline-block size-2 rounded-full bg-warning mr-2" /><strong>Amarelo — Atenção:</strong> não crítico (MTR ausente/duplicado, destinador sem CNPJ).</div>
          </div>
        </CardContent>
      </Card>

      {fatores.length === 0 ? (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-6 text-center">
            <ShieldCheck className="size-10 text-success mx-auto mb-2" />
            <div className="font-medium">Nenhum risco ou pendência identificada no período.</div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {fatores.map((f) => {
            const tone = severidadeTone(f.severidade);
            const Ico = f.icon;
            return (
              <Card key={f.id} className={`border ${tone}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <Ico className="size-6 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground">
                      {f.titulo}
                      <span className="text-[10px] uppercase tracking-wider font-semibold ml-2">{SEV_LABEL[f.severidade]}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">{f.descricao}</div>
                  </div>
                  {f.onClick && (
                    <Button size="sm" variant="outline" onClick={f.onClick}>
                      Resolver <ArrowRight className="size-3.5 ml-1" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
