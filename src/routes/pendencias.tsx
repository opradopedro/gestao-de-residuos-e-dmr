import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import { listColetasByUnidade, totalPesoColeta, updateColetaMtr, confirmarPesoColeta, isPendenciaSemMtr } from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, formatKg, formatTon } from "@/lib/format";
import { useMemo, useState } from "react";
import { FileWarning, Scale, CheckCircle2 } from "lucide-react";
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
  const estimado = useMemo(() => noTri.filter((c) => c.peso_estimado), [noTri]);
  const pesoSemMtr = semMtr.reduce((s, c) => s + totalPesoColeta(c), 0);
  const pesoEstimado = estimado.reduce((s, c) => s + totalPesoColeta(c), 0);

  if (!unidade) return <NoUnidade />;

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader title="Pendências" description={`Coletas que precisam de ajuste antes da DMR · ${periodo.label}`} />

      <div className="grid gap-4 sm:grid-cols-2 mb-6">
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-5 flex items-start gap-3">
            <FileWarning className="size-7 text-destructive" />
            <div>
              <div className="text-sm text-muted-foreground">Coletas sem MTR</div>
              <div className="text-2xl font-semibold">{semMtr.length}</div>
              <div className="text-sm text-destructive">{formatTon(pesoSemMtr)} fora do sistema oficial</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="p-5 flex items-start gap-3">
            <Scale className="size-7 text-warning-foreground" />
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
        <TabsContent value="mtr"><PendenciaTable rows={semMtr} tipo="mtr" /></TabsContent>
        <TabsContent value="estimado"><PendenciaTable rows={estimado} tipo="estimado" /></TabsContent>
      </Tabs>
    </div>
  );
}

function PendenciaTable({ rows, tipo }: { rows: any[]; tipo: "mtr" | "estimado" }) {
  const qc = useQueryClient();
  const [mtrDialog, setMtrDialog] = useState<{ id: string; mtr: string } | null>(null);

  const mutMtr = useMutation({
    mutationFn: ({ id, mtr }: { id: string; mtr: string }) => updateColetaMtr(id, mtr),
    onSuccess: () => { toast.success("MTR adicionado"); qc.invalidateQueries({ queryKey: ["coletas"] }); setMtrDialog(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const mutPeso = useMutation({
    mutationFn: (id: string) => confirmarPesoColeta(id),
    onSuccess: () => { toast.success("Peso confirmado"); qc.invalidateQueries({ queryKey: ["coletas"] }); },
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
                  <td className="p-3 text-right tabular-nums">{formatKg(totalPesoColeta(c))}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    {tipo === "mtr" ? (
                      <Button size="sm" onClick={() => setMtrDialog({ id: c.id, mtr: "" })}>Adicionar MTR</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => mutPeso.mutate(c.id)}>Confirmar peso</Button>
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
