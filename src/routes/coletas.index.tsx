import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { listColetasByUnidade, totalPesoColeta, findMtrDuplicates, ALERTA_PESO_KG } from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, AlertTriangle, FileWarning, Scale } from "lucide-react";
import { formatDate, formatKg } from "@/lib/format";
import { quarterOf } from "@/lib/quarter";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/coletas/")({
  head: () => ({ meta: [{ title: "Coletas — DMR" }] }),
  component: ColetasList,
});

function ColetasList() {
  const unidade = useUnidadeAtiva();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "sem_mtr" | "estimado" | "alerta">("todas");
  const { data: coletas = [], isLoading } = useQuery({
    queryKey: ["coletas", unidade],
    queryFn: () => listColetasByUnidade(unidade!),
    enabled: !!unidade,
  });

  const dups = useMemo(() => findMtrDuplicates(coletas), [coletas]);

  const filtradas = useMemo(() => {
    return coletas.filter((c) => {
      const peso = totalPesoColeta(c);
      const itemAlerta = (c.itens ?? []).some((it) => Number(it.peso_kg) > ALERTA_PESO_KG);
      if (filtro === "sem_mtr" && c.mtr) return false;
      if (filtro === "estimado" && !c.peso_estimado) return false;
      if (filtro === "alerta" && !itemAlerta && !(c.mtr && dups.has(c.mtr))) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const inFields = [c.mtr, c.transportador, c.destinador, c.observacoes].some((v) => v?.toLowerCase().includes(q));
        const inItens = (c.itens ?? []).some((it) => it.tipo_residuo_nome.toLowerCase().includes(q));
        if (!inFields && !inItens) return false;
      }
      return true;
    });
  }, [coletas, filtro, busca, dups]);

  if (!unidade) return <NoUnidade />;

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader
        title="Coletas"
        description={`${coletas.length} coletas registradas nesta unidade.`}
        actions={<Button asChild><Link to="/coletas/nova"><Plus className="size-4 mr-1" /> Nova coleta</Link></Button>}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Input placeholder="Buscar por MTR, transportador, destinador, resíduo…" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
        {([
          ["todas", "Todas"],
          ["sem_mtr", "Sem MTR"],
          ["estimado", "Peso estimado"],
          ["alerta", "Alertas"],
        ] as const).map(([k, label]) => (
          <Button key={k} variant={filtro === k ? "default" : "outline"} size="sm" onClick={() => setFiltro(k)}>
            {label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-3 font-medium">Data</th>
                  <th className="text-left p-3 font-medium">Trimestre</th>
                  <th className="text-left p-3 font-medium">Destinador</th>
                  <th className="text-left p-3 font-medium">MTR</th>
                  <th className="text-right p-3 font-medium">Peso</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Nenhuma coleta encontrada.</td></tr>
                ) : (
                  filtradas.map((c) => {
                    const peso = totalPesoColeta(c);
                    const itemAlerta = (c.itens ?? []).some((it) => Number(it.peso_kg) > ALERTA_PESO_KG);
                    const mtrDup = c.mtr && dups.has(c.mtr);
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3">{formatDate(c.data)}</td>
                        <td className="p-3 text-muted-foreground">{quarterOf(c.data).label}</td>
                        <td className="p-3">{c.destinador || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3 font-mono text-xs">{c.mtr || <span className="text-muted-foreground italic">sem MTR</span>}</td>
                        <td className="p-3 text-right tabular-nums">{formatKg(peso)}</td>
                        <td className="p-3 space-x-1">
                          {!c.mtr && <Badge variant="outline" className="border-warning/50 text-warning"><FileWarning className="size-3 mr-1" />Sem MTR</Badge>}
                          {c.peso_estimado && <Badge variant="outline" className="border-warning/50 text-warning"><Scale className="size-3 mr-1" />Estimado</Badge>}
                          {itemAlerta && <Badge variant="outline" className="border-destructive/50 text-destructive"><AlertTriangle className="size-3 mr-1" />Peso alto</Badge>}
                          {mtrDup && <Badge variant="outline" className="border-destructive/50 text-destructive">MTR repetido</Badge>}
                          {c.mtr && !c.peso_estimado && !itemAlerta && !mtrDup && <Badge variant="secondary">OK</Badge>}
                        </td>
                        <td className="p-3 text-right">
                          <Button asChild size="sm" variant="ghost"><Link to="/coletas/$id" params={{ id: c.id }}>Editar</Link></Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
