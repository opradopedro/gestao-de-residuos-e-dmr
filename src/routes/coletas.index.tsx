import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo } from "@/hooks/use-periodo";
import {
  listColetasByUnidade,
  listAllColetas,
  listUnidades,
  totalPesoColeta,
  findMtrDuplicates,
  ALERTA_PESO_KG,
  deleteColeta,
  type ColetaComItens,
} from "@/lib/data";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ColetaImportWizard } from "@/components/ColetaImportWizard";
import { BulkDeleteDialog } from "@/components/BulkDeleteDialog";
import { AdvancedFilterDialog, SavedFiltersDialog } from "@/components/AdvancedFilterDialog";
import { aplicarFiltro, type FiltroAvancado } from "@/lib/coletas-filtros";
import {
  Plus, AlertTriangle, FileWarning, Scale, ArrowUp, ArrowDown,
  Upload, Trash2, Filter, Bookmark, Eye,
} from "lucide-react";
import { formatDate, formatKgPlain } from "@/lib/format";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/coletas/")({
  head: () => ({ meta: [{ title: "Coletas — DMR" }] }),
  component: ColetasList,
});

type SortKey = "data" | "destinador" | "transportador" | "mtr" | "peso" | "residuo" | "unidade";
type SortDir = "asc" | "desc";

function ColetasList() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const qc = useQueryClient();

  const SS_KEY = "coletas-list-state";
  const initial = (() => {
    try { return JSON.parse(sessionStorage.getItem(SS_KEY) || "{}"); } catch { return {}; }
  })();
  const [busca, setBusca] = useState<string>(initial.busca ?? "");
  const [todasColetas, setTodasColetas] = useState<boolean>(initial.todasColetas ?? false);
  const [filtroAvancado, setFiltroAvancado] = useState<FiltroAvancado | null>(initial.filtroAvancado ?? null);
  const [advOpen, setAdvOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(initial.sortKey ?? "data");
  const [sortDir, setSortDir] = useState<SortDir>(initial.sortDir ?? "desc");
  const [importOpen, setImportOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [viewId, setViewId] = useState<string | null>(null);

  // persist
  useMemo(() => {
    try { sessionStorage.setItem(SS_KEY, JSON.stringify({ busca, todasColetas, filtroAvancado, sortKey, sortDir })); } catch {}
  }, [busca, todasColetas, filtroAvancado, sortKey, sortDir]);

  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const unidadeNomes = useMemo(() => Object.fromEntries(unidades.map((u) => [u.id, u.nome])), [unidades]);

  const { data: coletas = [], isLoading } = useQuery({
    queryKey: todasColetas ? ["coletas", "all"] : ["coletas", unidade],
    queryFn: () => (todasColetas ? listAllColetas() : listColetasByUnidade(unidade!)),
    enabled: todasColetas || !!unidade,
  });

  const dups = useMemo(() => findMtrDuplicates(coletas), [coletas]);

  const delMut = useMutation({
    mutationFn: (id: string) => deleteColeta(id),
    onSuccess: () => {
      toast.success("Coleta removida");
      qc.invalidateQueries({ queryKey: ["coletas"] });
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const filtradas = useMemo(() => {
    let arr = coletas;
    // Filtro de período (sempre aplicado)
    arr = arr.filter((c) => c.data >= periodo.start && c.data <= periodo.end);
    // Busca livre
    if (busca) {
      const q = busca.toLowerCase();
      arr = arr.filter((c) => {
        const inFields = [c.mtr, c.transportador, c.destinador, c.observacoes].some((v) => v?.toLowerCase().includes(q));
        const inItens = (c.itens ?? []).some((it) => it.tipo_residuo_nome.toLowerCase().includes(q));
        const inData = c.data.includes(q) || formatDate(c.data).toLowerCase().includes(q);
        return inFields || inItens || inData;
      });
    }
    // Filtro avançado
    arr = aplicarFiltro(arr, filtroAvancado, unidadeNomes);

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
          case "unidade": return (unidadeNomes[c.unidade_id] || "").toLowerCase();
        }
      };
      const av = get(a), bv = get(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return sorted;
  }, [coletas, busca, filtroAvancado, sortKey, sortDir, unidadeNomes, periodo.start, periodo.end]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("asc"); }
  }

  if (!todasColetas && !unidade) return <NoUnidade />;

  const SortHead = ({ k, children, align = "left" }: { k: SortKey; children: React.ReactNode; align?: "left" | "right" }) => (
    <th className={`p-3 font-medium text-${align}`}>
      <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sortKey === k && (sortDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  const colCount = todasColetas ? 9 : 8;

  return (
    <div className="p-6 max-w-7xl">
      <PageHeader
        title="Coletas"
        description={`${coletas.length} coletas no escopo · ${filtradas.length} visíveis após filtros (período ${periodo.label}).`}
        actions={
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(true)}>
              <Trash2 className="size-4 mr-1" /> Excluir em massa
            </Button>
            <Button variant="outline" size="sm" onClick={async () => {
              const { isImportActive } = await import("@/lib/import-job");
              if (isImportActive()) { toast.error("Já existe uma importação em andamento. Aguarde concluir."); return; }
              if (!unidade) { toast.error("Selecione uma unidade para importar."); return; }
              setImportOpen(true);
            }}>
              <Upload className="size-4 mr-1" /> Importar planilha
            </Button>
            <Button asChild size="sm"><Link to="/coletas/nova"><Plus className="size-4 mr-1" /> Nova coleta</Link></Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Input
          placeholder="Buscar por MTR, transportador, destinador, resíduo, data…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={() => setAdvOpen(true)}>
          <Filter className="size-4 mr-1" /> Filtro avançado
          {filtroAvancado && filtroAvancado.regras.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-[10px]">{filtroAvancado.regras.length}</Badge>
          )}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setSavedOpen(true)}>
          <Bookmark className="size-4 mr-1" /> Filtros salvos
        </Button>
        {filtroAvancado && (
          <Button variant="ghost" size="sm" onClick={() => setFiltroAvancado(null)}>Limpar filtro</Button>
        )}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <Switch id="todas-un" checked={todasColetas} onCheckedChange={setTodasColetas} />
          <label htmlFor="todas-un" className="cursor-pointer">Ver todas as unidades</label>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <SortHead k="data">Data</SortHead>
                  {todasColetas && <SortHead k="unidade">Unidade</SortHead>}
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
                  <tr><td colSpan={colCount} className="p-6 text-center text-muted-foreground">Carregando…</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={colCount} className="p-6 text-center text-muted-foreground">Nenhuma coleta encontrada.</td></tr>
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
                        {todasColetas && <td className="p-3 text-muted-foreground">{unidadeNomes[c.unidade_id] ?? "—"}</td>}
                        <td className="p-3">{residuoLabel}</td>
                        <td className="p-3">{c.destinador || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3">{c.transportador || <span className="text-muted-foreground">—</span>}</td>
                        <td className="p-3 font-mono text-xs">{c.mtr || <span className="text-muted-foreground italic">{c.dmr_manual ? "manual" : "sem MTR"}</span>}</td>
                        <td className="p-3 text-right tabular-nums">{formatKgPlain(peso)}</td>
                        <td className="p-3 space-x-1">
                          {!c.mtr && !c.dmr_manual && <Badge variant="outline" className="border-warning/50 text-warning"><FileWarning className="size-3 mr-1" />Sem MTR</Badge>}
                          {c.dmr_manual && <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/90">INCLUIR NA DMR</Badge>}
                          {c.peso_estimado && <Badge variant="outline" className="border-warning/50 text-warning"><Scale className="size-3 mr-1" />Estimado</Badge>}
                          {itemAlerta && <Badge variant="outline" className="border-destructive/50 text-destructive"><AlertTriangle className="size-3 mr-1" />Peso alto</Badge>}
                          {mtrDup && <Badge variant="outline" className="border-destructive/50 text-destructive">MTR repetido</Badge>}
                          {c.mtr && !c.peso_estimado && !itemAlerta && !mtrDup && <Badge variant="secondary">OK</Badge>}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild size="sm" variant="ghost" title="Visualizar">
                              <Link to="/coletas/$id" params={{ id: c.id }}><Eye className="size-4" /></Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              title="Excluir"
                              onClick={() => {
                                if (confirm(`Excluir esta coleta${c.mtr ? ` (MTR ${c.mtr})` : ""}?`)) {
                                  delMut.mutate(c.id);
                                }
                              }}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          </div>
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

      {unidade && <ColetaImportWizard open={importOpen} onOpenChange={setImportOpen} unidadeAtiva={unidade} />}
      <BulkDeleteDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen} coletas={coletas} unidadeId={unidade} totalGeral={coletas.length} />
      <AdvancedFilterDialog open={advOpen} onOpenChange={setAdvOpen} filtro={filtroAvancado} onApply={setFiltroAvancado} />
      <SavedFiltersDialog open={savedOpen} onOpenChange={setSavedOpen} onPick={setFiltroAvancado} />
    </div>
  );
}
