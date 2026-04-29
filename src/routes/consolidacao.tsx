import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import { listColetasByUnidade, listUnidades, totalPesoColeta, type ColetaComItens } from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Download, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { quarterOf } from "@/lib/quarter";
import { formatKg, formatDate } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/consolidacao")({
  head: () => ({ meta: [{ title: "Consolidação trimestral — DMR" }] }),
  component: Consolidacao,
});

type Linha = { residuo: string; destinador: string; kg: number; coletas: ColetaComItens[] };

function Consolidacao() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const [detail, setDetail] = useState<Linha | null>(null);
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
    return Array.from(map.values()).sort((a, b) => b.kg - a.kg);
  }, [noTri]);

  const total = pivot.reduce((s, r) => s + r.kg, 0);

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

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader
        title="Consolidação trimestral"
        description={`Agrupamento por tipo de resíduo e destinador · ${periodo.label} · clique em uma linha para investigar a origem`}
        actions={<Button onClick={exportar}><Download className="size-4 mr-1" /> Exportar XLSX</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Tipo de Resíduo</th>
                <th className="text-left p-3">Destinador</th>
                <th className="text-right p-3">Coletas</th>
                <th className="text-right p-3">Peso (kg)</th>
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
        <SheetContent className="sm:max-w-xl overflow-y-auto">
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
                <div className="font-medium">Coletas de origem ({detail.coletas.length})</div>
                <div className="space-y-2">
                  {detail.coletas.map((c) => {
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
                            <Button asChild size="sm" variant="ghost"><Link to="/coletas/$id" params={{ id: c.id }}>Abrir</Link></Button>
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
    </div>
  );
}
