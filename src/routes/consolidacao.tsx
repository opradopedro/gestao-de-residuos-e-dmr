import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import { listColetasByUnidade, listUnidades, totalPesoColeta, getColeta, updateColeta, type ColetaComItens, type ColetaInput } from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, ChevronRight, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { quarterOf } from "@/lib/quarter";
import { formatKg, formatDate } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { ColetaForm } from "@/components/ColetaForm";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/consolidacao")({
  head: () => ({ meta: [{ title: "Consolidação trimestral — DMR" }] }),
  component: Consolidacao,
});

type Linha = { residuo: string; destinador: string; kg: number; coletas: ColetaComItens[] };
type SortKey = "residuo" | "destinador" | "kg";
type SortDir = "asc" | "desc";

function Consolidacao() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const [detail, setDetail] = useState<Linha | null>(null);
  const [editColetaId, setEditColetaId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("kg");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [drillSortDir, setDrillSortDir] = useState<SortDir>("desc"); // data
  const { data: coletas = [] } = useQuery({
    queryKey: ["coletas", unidade],
    queryFn: () => listColetasByUnidade(unidade!),
    enabled: !!unidade,
  });
  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const nomeUnidade = unidades.find((u) => u.id === unidade)?.nome ?? "Unidade";

  const noTri = useMemo(() => coletas.filter((c) => quarterOf(c.data).key === periodo.key), [coletas, periodo.key]);

  const pivot: Linha[] = useMemo(() => {
    const map = new Map<string, Linha>();
    for (const c of noTri) {
      const dest = c.destinador || "(sem destinador)";
      for (const it of c.itens ?? []) {
        const k = `${it.tipo_residuo_nome}||${dest}`;
        let cur = map.get(k);
        if (!cur) {
          cur = { residuo: it.tipo_residuo_nome, destinador: dest, kg: 0, coletas: [] };
          map.set(k, cur);
        }
        cur.kg += Number(it.peso_kg);
        if (!cur.coletas.includes(c)) cur.coletas.push(c);
      }
    }
    const arr = Array.from(map.values());
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      const av = sortKey === "kg" ? a.kg : a[sortKey].toLowerCase();
      const bv = sortKey === "kg" ? b.kg : b[sortKey].toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return arr;
  }, [noTri, sortKey, sortDir]);

  const total = pivot.reduce((s, r) => s + r.kg, 0);

  const drillColetas = useMemo(() => {
    if (!detail) return [];
    const dir = drillSortDir === "asc" ? 1 : -1;
    return [...detail.coletas].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0) * dir);
  }, [detail, drillSortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "kg" ? "desc" : "asc"); }
  }

  function exportar() {
    if (pivot.length === 0) return toast.error("Sem dados para exportar");
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(
      pivot.map((r) => ({ "Tipo de Resíduo": r.residuo, "Destinador": r.destinador, "Peso (kg)": Number(r.kg.toFixed(3)) }))
    );
    XLSX.utils.book_append_sheet(wb, sheet, "Consolidado");
    const detalhe = XLSX.utils.json_to_sheet(
      noTri.flatMap((c) =>
        (c.itens ?? []).map((it) => ({
          Data: c.data,
          MTR: c.mtr ?? "",
          Transportador: c.transportador ?? "",
          Destinador: c.destinador ?? "",
          "Peso Estimado": c.peso_estimado ? "Sim" : "Não",
          "DMR Manual": c.dmr_manual ? "Sim" : "Não",
          "Tipo Resíduo": it.tipo_residuo_nome,
          Tratamento: it.tratamento,
          "Peso (kg)": Number(it.peso_kg),
          Observações: c.observacoes ?? "",
        }))
      )
    );
    XLSX.utils.book_append_sheet(wb, detalhe, "Detalhe");
    XLSX.writeFile(wb, `DMR_${nomeUnidade}_${periodo.label.replace(/\s+/g, "_")}.xlsx`);
    toast.success("Planilha gerada");
  }

  if (!unidade) return <NoUnidade />;

  const SortHead = ({ k, children, align = "left" }: { k: SortKey; children: React.ReactNode; align?: "left" | "right" }) => {
    const Icon = sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <th className={`p-3 text-${align}`}>
        <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
          {children}
          <Icon className={`size-3 ${sortKey === k ? "" : "opacity-40"}`} />
        </button>
      </th>
    );
  };

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader
        title="Consolidação trimestral"
        description={`Agrupamento por tipo de resíduo e destinador · ${periodo.label} · clique numa linha para investigar`}
        actions={<Button onClick={exportar}><Download className="size-4 mr-1" /> Exportar XLSX</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <SortHead k="residuo">Tipo de Resíduo</SortHead>
                <SortHead k="destinador">Destinador</SortHead>
                <th className="text-right p-3">Coletas</th>
                <SortHead k="kg" align="right">Peso (kg)</SortHead>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pivot.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">Sem dados no trimestre selecionado.</td></tr>
              ) : (
                pivot.map((r, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setDetail(r)}>
                    <td className="p-3">{r.residuo}</td>
                    <td className="p-3">{r.destinador}</td>
                    <td className="p-3 text-right tabular-nums text-muted-foreground">{r.coletas.length}</td>
                    <td className="p-3 text-right tabular-nums">{formatKg(r.kg)}</td>
                    <td className="p-3 text-muted-foreground"><ChevronRight className="size-4" /></td>
                  </tr>
                ))
              )}
              {pivot.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <td colSpan={3} className="p-3">Total</td>
                  <td className="p-3 text-right tabular-nums">{formatKg(total)}</td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.residuo} · {detail.destinador}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-md border p-3 flex items-center justify-between">
                  <span className="text-muted-foreground">Total agrupado</span>
                  <span className="font-semibold tabular-nums">{formatKg(detail.kg)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="font-medium">Coletas de origem ({detail.coletas.length})</div>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => setDrillSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  >
                    Data {drillSortDir === "desc" ? <ArrowDown className="size-3 ml-1" /> : <ArrowUp className="size-3 ml-1" />}
                  </Button>
                </div>
                <div className="space-y-2">
                  {drillColetas.map((c) => {
                    const itensAqui = (c.itens ?? []).filter((it) => it.tipo_residuo_nome === detail.residuo);
                    const subtotal = itensAqui.reduce((s, it) => s + Number(it.peso_kg), 0);
                    return (
                      <div key={c.id} className="border rounded-md p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-muted-foreground">{formatDate(c.data)} · MTR {c.mtr || (c.dmr_manual ? "manual" : "—")}</div>
                            <div className="text-sm">Transportador: {c.transportador || "—"}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold tabular-nums">{formatKg(subtotal)}</div>
                            <Button size="sm" variant="ghost" onClick={() => setEditColetaId(c.id)}>Abrir</Button>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Total da coleta: {formatKg(totalPesoColeta(c))}
                          {c.peso_estimado && " · estimado"}
                          {c.dmr_manual && " · DMR manual"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ColetaModal id={editColetaId} onClose={() => setEditColetaId(null)} />
    </div>
  );
}

function ColetaModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: coleta, isLoading } = useQuery({
    queryKey: ["coleta", id],
    queryFn: () => getColeta(id!),
    enabled: !!id,
  });
  const mut = useMutation({
    mutationFn: (input: ColetaInput) => updateColeta(id!, input),
    onSuccess: () => {
      toast.success("Coleta atualizada");
      qc.invalidateQueries({ queryKey: ["coletas"] });
      qc.invalidateQueries({ queryKey: ["coleta", id] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar coleta</DialogTitle></DialogHeader>
        {isLoading && <div className="p-4 text-muted-foreground">Carregando…</div>}
        {coleta && (
          <ColetaForm
            unidadeId={coleta.unidade_id}
            initial={{
              unidade_id: coleta.unidade_id,
              data: coleta.data,
              transportador: coleta.transportador,
              destinador: coleta.destinador,
              transportador_id: (coleta as any).transportador_id ?? null,
              destinador_id: (coleta as any).destinador_id ?? null,
              mtr: coleta.mtr,
              peso_estimado: coleta.peso_estimado,
              dmr_manual: (coleta as any).dmr_manual ?? false,
              observacoes: coleta.observacoes,
              itens: (coleta.itens ?? []).map((it) => ({
                tipo_residuo_id: it.tipo_residuo_id,
                tipo_residuo_nome: it.tipo_residuo_nome,
                peso_kg: Number(it.peso_kg),
                tratamento: it.tratamento,
              })),
            }}
            onSubmit={(v) => mut.mutate(v)}
            submitting={mut.isPending}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
