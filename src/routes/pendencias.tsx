import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import {
  listColetasByUnidade, totalPesoColeta, updateColetaMtr,
  isPendenciaSemMtr, isPendenciaSemPeso, isPendenciaEstimadoSemPeso,
  findMtrDuplicates, countMtrDuplicatesUnique,
} from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatKg, formatTon } from "@/lib/format";
import { useMemo, useState } from "react";
import { FileWarning, Scale, CheckCircle2, PackageX, Copy } from "lucide-react";
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

  const noTri = useMemo(() => coletas.filter((c) => c.data >= periodo.start && c.data <= periodo.end), [coletas, periodo]);
  const semMtr = useMemo(() => noTri.filter(isPendenciaSemMtr), [noTri]);
  const estimadoPend = useMemo(() => noTri.filter(isPendenciaEstimadoSemPeso), [noTri]);
  const semPeso = useMemo(() => noTri.filter(isPendenciaSemPeso), [noTri]);
  const dupSet = useMemo(() => findMtrDuplicates(noTri), [noTri]);
  const dupColetas = useMemo(() => noTri.filter((c) => c.mtr && dupSet.has(c.mtr)), [noTri, dupSet]);
  const dupUnique = countMtrDuplicatesUnique(noTri);

  const pesoSemMtr = semMtr.reduce((s, c) => s + totalPesoColeta(c), 0);

  if (!unidade) return <NoUnidade />;

  const total = semMtr.length + estimadoPend.length + semPeso.length + dupUnique;

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader title="Pendências" description={`Coletas que precisam de ajuste antes da DMR · ${periodo.label} · ${total} item(ns)`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <SummaryCard tone="danger" icon={FileWarning} label="Sem MTR" value={semMtr.length} hint={`${formatTon(pesoSemMtr)} sem rastreio`} />
        <SummaryCard tone="warn" icon={Scale} label="Estimado sem peso" value={estimadoPend.length} hint="Aguardando pesagem" />
        <SummaryCard tone="warn" icon={PackageX} label="Sem peso" value={semPeso.length} hint="Coleta sem itens" />
        <SummaryCard tone="warn" icon={Copy} label="MTR duplicado" value={dupUnique} hint={`${dupColetas.length} coleta(s) afetada(s)`} />
      </div>

      <Tabs defaultValue="mtr">
        <TabsList>
          <TabsTrigger value="mtr">Sem MTR ({semMtr.length})</TabsTrigger>
          <TabsTrigger value="estimado">Estimado sem peso ({estimadoPend.length})</TabsTrigger>
          <TabsTrigger value="sempeso">Sem peso ({semPeso.length})</TabsTrigger>
          <TabsTrigger value="dup">MTR duplicado ({dupUnique})</TabsTrigger>
        </TabsList>
        <TabsContent value="mtr"><PendenciaTable rows={semMtr} tipo="mtr" /></TabsContent>
        <TabsContent value="estimado"><PendenciaTable rows={estimadoPend} tipo="estimado" /></TabsContent>
        <TabsContent value="sempeso"><PendenciaTable rows={semPeso} tipo="sempeso" /></TabsContent>
        <TabsContent value="dup"><PendenciaTable rows={dupColetas} tipo="dup" /></TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({ tone, icon: Icon, label, value, hint }: { tone: "danger" | "warn"; icon: any; label: string; value: number; hint: string }) {
  const styles = tone === "danger" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-warning/50 bg-warning/10 text-warning-foreground";
  return (
    <Card className={styles.split(" ").slice(0, 2).join(" ")}>
      <CardContent className="p-5 flex items-start gap-3">
        <Icon className={`size-7 ${styles.split(" ").slice(2).join(" ")}`} />
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold text-foreground">{value}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function PendenciaTable({ rows, tipo }: { rows: any[]; tipo: "mtr" | "estimado" | "sempeso" | "dup" }) {
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
        Nenhuma pendência nesta categoria.
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
                {tipo === "dup" && <th className="text-left p-3">MTR</th>}
                <th className="text-left p-3">Destinador</th>
                <th className="text-left p-3">Resíduos</th>
                <th className="text-right p-3">Peso</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="p-3 whitespace-nowrap">{formatDate(c.data)}</td>
                  {tipo === "dup" && <td className="p-3 font-mono text-xs">{c.mtr}</td>}
                  <td className="p-3">{c.destinador || "—"}</td>
                  <td className="p-3 text-xs">{(c.itens ?? []).map((it: any) => it.tipo_residuo_nome).join(", ") || "—"}</td>
                  <td className="p-3 text-right tabular-nums">{formatKg(totalPesoColeta(c))}</td>
                  <td className="p-3">
                    {c.peso_estimado && <Badge variant="outline" className="text-warning-foreground border-warning/50 text-[10px]">Emitido com peso estimado</Badge>}
                  </td>
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
        <DialogContent>
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
