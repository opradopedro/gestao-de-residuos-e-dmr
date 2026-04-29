import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import {
  listColetasByUnidade, totalPesoColeta, updateColetaMtr,
  isPendenciaSemMtr, isPendenciaSemPeso, findMtrDuplicates,
} from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatKg, formatTon } from "@/lib/format";
import { useMemo, useState } from "react";
import { FileWarning, CheckCircle2, ScaleIcon, Copy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/pendencias")({
  head: () => ({ meta: [{ title: "Pendências — DMR" }] }),
  component: Pendencias,
});

function Pendencias() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const { data: coletas = [] } = useQuery({
    queryKey: ["coletas", unidade],
    queryFn: () => listColetasByUnidade(unidade!),
    enabled: !!unidade,
  });

  const { semMtr, semPeso, dupColetas, dupUnicos, pesoSemMtr } = useMemo(() => {
    const noTri = coletas.filter((c) => c.data >= periodo.start && c.data <= periodo.end);
    const dups = findMtrDuplicates(noTri);
    const semMtr = noTri.filter(isPendenciaSemMtr);
    return {
      semMtr,
      semPeso: noTri.filter(isPendenciaSemPeso),
      dupColetas: noTri.filter((c) => c.mtr && dups.has(c.mtr)),
      dupUnicos: dups.size,
      pesoSemMtr: semMtr.reduce((s, c) => s + totalPesoColeta(c), 0),
    };
  }, [coletas, periodo]);

  if (!unidade) return <NoUnidade />;

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader title="Pendências" description={`Coletas que precisam de ajuste antes da DMR · ${periodo.label}`} />

      <div className="grid gap-3 sm:grid-cols-3 mb-6">
        <SummaryCard tone="destructive" icon={FileWarning} label="Sem MTR (erro)" count={semMtr.length} extra={formatTon(pesoSemMtr) + " sem rastreio"} />
        <SummaryCard tone="warning" icon={ScaleIcon} label="Sem peso" count={semPeso.length} extra="Peso não informado" />
        <SummaryCard tone="destructive" icon={Copy} label="MTR duplicado" count={dupUnicos} extra={`${dupColetas.length} coletas envolvidas`} />
      </div>

      <Tabs defaultValue="mtr">
        <TabsList>
          <TabsTrigger value="mtr">Sem MTR ({semMtr.length})</TabsTrigger>
          <TabsTrigger value="sem_peso">Sem peso ({semPeso.length})</TabsTrigger>
          <TabsTrigger value="dup">MTR duplicado ({dupUnicos})</TabsTrigger>
        </TabsList>
        <TabsContent value="mtr"><PendenciaTable rows={semMtr} tipo="mtr" /></TabsContent>
        <TabsContent value="sem_peso"><PendenciaTable rows={semPeso} tipo="sem_peso" /></TabsContent>
        <TabsContent value="dup"><PendenciaTable rows={dupColetas} tipo="dup" /></TabsContent>
      </Tabs>
    </div>
  );
}

function PendenciaTable({ rows, tipo }: { rows: any[]; tipo: "mtr" | "sem_peso" | "est_sem_peso" | "dup" }) {
  const qc = useQueryClient();
  const [mtrDialog, setMtrDialog] = useState<{ id: string; mtr: string } | null>(null);

  const mutMtr = useMutation({
    mutationFn: ({ id, mtr }: { id: string; mtr: string }) => updateColetaMtr(id, mtr),
    onSuccess: () => { toast.success("MTR adicionado"); qc.invalidateQueries({ queryKey: ["coletas"] }); setMtrDialog(null); },
    onError: (e: any) => toast.error(e.message),
  });

  if (rows.length === 0) return (
    <Card>
      <CardContent className="p-8 text-center text-muted-foreground flex flex-col items-center gap-2">
        <CheckCircle2 className="size-8 text-success" />
        Nenhuma pendência neste período.
      </CardContent>
    </Card>
  );
  return (
    <>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Data</th>
                <th className="text-left p-3">Destinador</th>
                <th className="text-left p-3">Resíduos</th>
                {tipo === "dup" && <th className="text-left p-3">MTR</th>}
                <th className="text-right p-3">Peso</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">{formatDate(c.data)}</td>
                  <td className="p-3">{c.destinador || "—"}</td>
                  <td className="p-3 text-xs">{(c.itens ?? []).map((it: any) => it.tipo_residuo_nome).join(", ") || "—"}</td>
                  {tipo === "dup" && <td className="p-3 font-mono text-xs">{c.mtr}</td>}
                  <td className="p-3 text-right tabular-nums">{formatKg(totalPesoColeta(c))}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {tipo === "mtr" && (
                      <Button size="sm" onClick={() => setMtrDialog({ id: c.id, mtr: "" })}>Adicionar MTR</Button>
                    )}
                    <Button asChild size="sm" variant="ghost"><Link to="/coletas/$id" params={{ id: c.id }}>Editar</Link></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!mtrDialog} onOpenChange={(o) => !o && setMtrDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar MTR</DialogTitle></DialogHeader>
          <Input
            autoFocus
            placeholder="Número do MTR"
            value={mtrDialog?.mtr ?? ""}
            onChange={(e) => setMtrDialog((s) => s ? { ...s, mtr: e.target.value } : s)}
            onKeyDown={(e) => e.key === "Enter" && mtrDialog?.mtr && mutMtr.mutate(mtrDialog)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMtrDialog(null)}>Cancelar</Button>
            <Button disabled={!mtrDialog?.mtr || mutMtr.isPending} onClick={() => mtrDialog && mutMtr.mutate(mtrDialog)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
