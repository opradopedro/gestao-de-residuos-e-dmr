import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import { listColetasByUnidade, listUnidades } from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { quarterOf } from "@/lib/quarter";
import { formatKg } from "@/lib/format";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/consolidacao")({
  head: () => ({ meta: [{ title: "Consolidação trimestral — DMR" }] }),
  component: Consolidacao,
});

function Consolidacao() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const { data: coletas = [] } = useQuery({
    queryKey: ["coletas", unidade],
    queryFn: () => listColetasByUnidade(unidade!),
    enabled: !!unidade,
  });
  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const nomeUnidade = unidades.find((u) => u.id === unidade)?.nome ?? "Unidade";

  const noTri = useMemo(() => coletas.filter((c) => quarterOf(c.data).key === periodo.key), [coletas, periodo.key]);

  const pivot = useMemo(() => {
    const map = new Map<string, { residuo: string; destinador: string; kg: number }>();
    for (const c of noTri) {
      const dest = c.destinador || "(sem destinador)";
      for (const it of c.itens ?? []) {
        const k = `${it.tipo_residuo_nome}||${dest}`;
        const cur = map.get(k);
        if (cur) cur.kg += Number(it.peso_kg);
        else map.set(k, { residuo: it.tipo_residuo_nome, destinador: dest, kg: Number(it.peso_kg) });
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
        description={`Agrupamento por tipo de resíduo e destinador · ${periodo.label}`}
        actions={<Button onClick={exportar}><Download className="size-4 mr-1" /> Exportar XLSX</Button>}
      />
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left p-3">Tipo de Resíduo</th>
                <th className="text-left p-3">Destinador</th>
                <th className="text-right p-3">Peso (kg)</th>
              </tr>
            </thead>
            <tbody>
              {pivot.length === 0 ? (
                <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">Sem dados no trimestre selecionado.</td></tr>
              ) : (
                pivot.map((r, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="p-3">{r.residuo}</td>
                    <td className="p-3">{r.destinador}</td>
                    <td className="p-3 text-right tabular-nums">{formatKg(r.kg)}</td>
                  </tr>
                ))
              )}
              {pivot.length > 0 && (
                <tr className="border-t-2 border-border font-semibold">
                  <td colSpan={2} className="p-3">Total</td>
                  <td className="p-3 text-right tabular-nums">{formatKg(total)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
