import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import {
  listColetasByUnidade,
  totalPesoColeta,
  findMtrDuplicates,
  ALERTA_PESO_KG,
  type ColetaComItens,
} from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";
import { ColetaImportWizard } from "@/components/ColetaImportWizard";
import { BulkDeleteDialog } from "@/components/BulkDeleteDialog";
import { HistoryDialog } from "@/components/HistoryDialog";
import { Plus, AlertTriangle, FileWarning, Scale, ArrowUp, ArrowDown, Upload, Trash2, History } from "lucide-react";
import { formatDate, formatKg } from "@/lib/format";
import { quarterOf } from "@/lib/quarter";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/coletas/")({
  head: () => ({ meta: [{ title: "Coletas — DMR" }] }),
  component: ColetasList,
});

type SortKey = "data" | "destinador" | "transportador" | "mtr" | "peso" | "residuo";
type SortDir = "asc" | "desc";

function ColetasList() {
  const unidade = useUnidadeAtiva();
  
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "sem_mtr" | "estimado" | "alerta" | "manual">("todas");
  const [residuoSel, setResiduoSel] = useState<string[]>([]);
  const [destinadorSel, setDestinadorSel] = useState<string[]>([]);
  const [transportadorSel, setTransportadorSel] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("data");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [importOpen, setImportOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: coletas = [], isLoading } = useQuery({
    queryKey: ["coletas", unidade],
    queryFn: () => listColetasByUnidade(unidade!),
    enabled: !!unidade,
  });

  const dups = useMemo(() => findMtrDuplicates(coletas), [coletas]);

  const opcoes = useMemo(() => {
    const r = new Set<string>(), d = new Set<string>(), t = new Set<string>();
    for (const c of coletas) {
      if (c.destinador) d.add(c.destinador);
      if (c.transportador) t.add(c.transportador);
      for (const it of c.itens ?? []) if (it.tipo_residuo_nome) r.add(it.tipo_residuo_nome);
    }
    return {
      residuos: Array.from(r).sort(),
      destinadores: Array.from(d).sort(),
      transportadores: Array.from(t).sort(),
    };
  }, [coletas]);

  const filtradas = useMemo(() => {
    const arr = coletas.filter((c) => {
      const itemAlerta = (c.itens ?? []).some((it) => Number(it.peso_kg) > ALERTA_PESO_KG);
      if (filtro === "sem_mtr" && (c.mtr || c.dmr_manual)) return false;
      if (filtro === "estimado" && !c.peso_estimado) return false;
      if (filtro === "manual" && !c.dmr_manual) return false;
      if (filtro === "alerta" && !itemAlerta && !(c.mtr && dups.has(c.mtr))) return false;
      if (residuoSel.length > 0 && !(c.itens ?? []).some((it) => residuoSel.includes(it.tipo_residuo_nome))) return false;
      if (destinadorSel.length > 0 && !(c.destinador && destinadorSel.includes(c.destinador))) return false;
      if (transportadorSel.length > 0 && !(c.transportador && transportadorSel.includes(c.transportador))) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const inFields = [c.mtr, c.transportador, c.destinador, c.observacoes].some((v) => v?.toLowerCase().includes(q));
        const inItens = (c.itens ?? []).some((it) => it.tipo_residuo_nome.toLowerCase().includes(q));
        const inData = c.data.includes(q) || formatDate(c.data).toLowerCase().includes(q);
        if (!inFields && !inItens && !inData) return false;
      }
      return true;
    });
    const sorted = [...arr].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const get = (c: ColetaComItens): string | number => {
        switch (sortKey) {
          case "data": return c.data;
          case "destinador": return (c.destinador || "").toLowerCase();
          case "transportador": return (c.transportador || "").toLowerCase();
          case "mtr": return (c.mtr || "").toLowerCase();
          case "peso": return totalPesoColeta(c);
          case "residuo": return (c.itens?.[0]?.tipo_residuo_nome || "").toLowerCase();
        }
      };
      const av = get(a), bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [coletas, filtro, busca, dups, residuoSel, destinadorSel, transportadorSel, sortKey, sortDir]);


  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }



  if (!unidade) return <NoUnidade />;

  const SortHead = ({ k, children, align = "left" }: { k: SortKey; children: React.ReactNode; align?: "left" | "right" }) => (
    <th className={`p-3 font-medium text-${align}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sortKey === k && (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader
        title="Coletas"
        description={`${coletas.length} coletas registradas · ${filtradas.length} visíveis após filtros.`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
              <History className="size-4 mr-1" /> Histórico
            </Button>
            <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="size-4 mr-1" /> Excluir em massa
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="size-4 mr-1" /> Importar planilha
            </Button>
            <Button asChild size="sm"><Link to="/coletas/nova"><Plus className="size-4 mr-1" /> Nova coleta</Link></Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 mb-3">
        <Input placeholder="Buscar por MTR, transportador, destinador, resíduo, data…" value={busca} onChange={(e) => setBusca(e.target.value)} className="max-w-sm" />
        {([
          ["todas", "Todas"],
          ["sem_mtr", "Sem MTR"],
          ["estimado", "Peso estimado"],
          ["manual", "DMR manual"],
          ["alerta", "Alertas"],
        ] as const).map(([k, label]) => (
          <Button key={k} variant={filtro === k ? "default" : "outline"} size="sm" onClick={() => setFiltro(k)}>
            {label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <MultiSelectFilter label="Resíduo" options={opcoes.residuos} value={residuoSel} onChange={setResiduoSel} />
        <MultiSelectFilter label="Destinador" options={opcoes.destinadores} value={destinadorSel} onChange={setDestinadorSel} />
        <MultiSelectFilter label="Transportador" options={opcoes.transportadores} value={transportadorSel} onChange={setTransportadorSel} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <SortHead k="data">Data</SortHead>
                  <th className="text-left p-3 font-medium">Trimestre</th>
                  <SortHead k="residuo">Tipo de resíduo</SortHead>
                  <SortHead k="destinador">Destinador</SortHead>
                  <SortHead k="transportador">Transportador</SortHead>
                  <SortHead k="mtr">MTR</SortHead>
                  <SortHead k="peso" align="right">Peso</SortHead>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Nenhuma coleta encontrada.</td></tr>
                ) : (
                  filtradas.map((c) => {
                    const peso = totalPesoColeta(c);
                    const itemAlerta = (c.itens ?? []).some((it) => Number(it.peso_kg) > ALERTA_PESO_KG);
                    const mtrDup = c.mtr && dups.has(c.mtr);
                    const residuos = (c.itens ?? []).map((it) => it.tipo_residuo_nome);
                    const residuoLabel = residuos.length === 0
                      ? <span className="text-muted-foreground">—</span>
                      : residuos.length === 1 ? residuos[0]
                      : <span>{residuos[0]} <span className="text-muted-foreground text-xs">+{residuos.length - 1}</span></span>;
                    return (
                      <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                        <td className="p-3">{formatDate(c.data)}</td>
                        <td className="p-3 text-muted-foreground">{quarterOf(c.data).label}</td>
                        <td className="p-3">{residuoLabel}</td>
                        <td className="p-3">{c.destinador || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3">{c.transportador || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3 font-mono text-xs">{c.mtr || <span className="text-muted-foreground italic">{c.dmr_manual ? "manual" : "sem MTR"}</span>}</td>
                        <td className="p-3 text-right tabular-nums">{formatKg(peso)}</td>
                        <td className="p-3 space-x-1">
                          {!c.mtr && !c.dmr_manual && <Badge variant="outline" className="border-warning/50 text-warning"><FileWarning className="size-3 mr-1" />Sem MTR</Badge>}
                          {c.dmr_manual && <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">INCLUIR NA DMR</Badge>}
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
      <ColetaImportWizard open={importOpen} onOpenChange={setImportOpen} unidadeAtiva={unidade} />
    </div>
  );
}
