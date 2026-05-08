import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listUnidades,
  listColetasByUnidade,
  listTiposResiduo,
  listTratamentos,
  listDestinadores,
  listTransportadores,
  upsertTipoResiduo,
  upsertTratamento,
  createDestinador,
  createTransportador,
  createColeta,
  updateColeta,
  type ColetaInput,
  type ColetaComItens,
} from "@/lib/data";
import { setUnidadeAtiva } from "@/hooks/use-unidade";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, ArrowLeft, ArrowRight, FileSpreadsheet, AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { QuickResiduoDialog } from "@/components/QuickResiduoDialog";
import { QuickEntityDialog } from "@/components/QuickEntityDialog";
import { QuickTratamentoDialog } from "@/components/QuickTratamentoDialog";

const ESTIMADO_RX = /est[ií]m[ao]?d?[ao]?s?/i;
const DMR_MTR_RX = /^\s*d[mr]{2}\s*$|incluir.*dmr/i;

type Step = "file" | "config" | "unidade" | "review" | "conflicts" | "missing" | "final" | "running";

type ColMap = {
  data: string;
  mtr: string;
  residuo: string;
  peso: string;
  tratamento: string;
  destinador: string;
  transportador: string;
  observacoes: string;
};
const EMPTY_MAP: ColMap = { data: "", mtr: "", residuo: "", peso: "", tratamento: "", destinador: "", transportador: "", observacoes: "" };

type ParsedRow = {
  idx: number;
  data: string;
  mtr: string;
  residuo: string;
  peso: number;
  tratamento: string;
  destinador: string;
  transportador: string;
  observacoes: string;
  peso_estimado: boolean;
  dmr_manual: boolean;
};

type ConflictAction = "substituir" | "ignorar";

export function ColetaImportWizard({
  open,
  onOpenChange,
  unidadeAtiva,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unidadeAtiva: string | null;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>("file");
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [matrix, setMatrix] = useState<any[][]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [startRow, setStartRow] = useState<number>(2);
  const [colMap, setColMap] = useState<ColMap>(EMPTY_MAP);
  const [unidadeSel, setUnidadeSel] = useState<string>("");
  const [conflictActions, setConflictActions] = useState<Record<string, ConflictAction>>({});
  const [missingMap, setMissingMap] = useState<Record<string, string>>({}); // key "tipo:nome" -> id ou "__new__"
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const { data: trats = [] } = useQuery({ queryKey: ["tratamentos"], queryFn: listTratamentos });
  const { data: destinadores = [] } = useQuery({ queryKey: ["destinadores"], queryFn: listDestinadores });
  const { data: transportadores = [] } = useQuery({ queryKey: ["transportadores"], queryFn: listTransportadores });

  useEffect(() => {
    if (open) {
      setStep("file");
      setFile(null); setWorkbook(null); setSheetName(""); setMatrix([]);
      setHasHeader(true); setStartRow(2); setColMap(EMPTY_MAP);
      setUnidadeSel(unidadeAtiva ?? "");
      setConflictActions({}); setMissingMap({}); setProgress({ done: 0, total: 0 });
    }
  }, [open, unidadeAtiva]);

  const { data: coletasUnidade = [] } = useQuery({
    queryKey: ["coletas", unidadeSel],
    queryFn: () => listColetasByUnidade(unidadeSel),
    enabled: !!unidadeSel,
  });

  // Headers from row (startRow-1) when hasHeader, else generic A,B,C
  const headerRow: string[] = useMemo(() => {
    if (matrix.length === 0) return [];
    if (hasHeader) {
      const headerIdx = Math.max(0, startRow - 2);
      const r = matrix[headerIdx] ?? [];
      return r.map((v, i) => String(v ?? "").trim() || `Coluna ${i + 1}`);
    }
    const maxLen = Math.max(...matrix.map((r) => r.length));
    return Array.from({ length: maxLen }, (_, i) => `Coluna ${i + 1}`);
  }, [matrix, hasHeader, startRow]);

  function parseDateCell(v: any): string {
    if (v == null || v === "") return "";
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === "number") {
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    const m = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (m) {
      const [, d, mo, y] = m;
      const yy = y.length === 2 ? "20" + y : y;
      return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return "";
  }

  // Parsed rows (only when in steps after config)
  const parsedRows: ParsedRow[] = useMemo(() => {
    if (matrix.length === 0) return [];
    const startIdx = Math.max(0, startRow - 1);
    const colIdx = (name: string) => headerRow.indexOf(name);
    const out: ParsedRow[] = [];
    for (let i = startIdx; i < matrix.length; i++) {
      const r = matrix[i] ?? [];
      const get = (name: string) => {
        const idx = colIdx(name);
        return idx >= 0 ? r[idx] : "";
      };
      const dataStr = colMap.data ? parseDateCell(get(colMap.data)) : "";
      const mtr = colMap.mtr ? String(get(colMap.mtr) ?? "").trim() : "";
      const residuo = colMap.residuo ? String(get(colMap.residuo) ?? "").trim() : "";
      const pesoRaw = colMap.peso ? String(get(colMap.peso) ?? "0").replace(/\./g, "").replace(",", ".") : "0";
      const peso = Number(pesoRaw) || 0;
      const tratamento = colMap.tratamento ? String(get(colMap.tratamento) ?? "").trim() : "";
      const destinador = colMap.destinador ? String(get(colMap.destinador) ?? "").trim() : "";
      const transportador = colMap.transportador ? String(get(colMap.transportador) ?? "").trim() : "";
      const observacoes = colMap.observacoes ? String(get(colMap.observacoes) ?? "").trim() : "";
      const peso_estimado = ESTIMADO_RX.test(observacoes);
      const dmr_manual = DMR_MTR_RX.test(mtr);
      const mtrFinal = dmr_manual ? "" : mtr;
      // skip empty rows
      if (!residuo && !mtr && peso === 0 && !destinador) continue;
      out.push({ idx: i + 1, data: dataStr, mtr: mtrFinal, residuo, peso, tratamento, destinador, transportador, observacoes, peso_estimado, dmr_manual });
    }
    return out;
  }, [matrix, startRow, headerRow, colMap]);

  // Group: with MTR -> by mtr; dmr_manual or no MTR -> by data+destinador+transportador (still grouped if all three match)
  const grupos = useMemo(() => {
    const map = new Map<string, { key: string; mtr: string; dmr_manual: boolean; rows: ParsedRow[] }>();
    for (const r of parsedRows) {
      const key = r.mtr
        ? `mtr:${r.mtr}`
        : `nm:${r.data}|${r.destinador.toLowerCase()}|${r.transportador.toLowerCase()}`;
      if (!map.has(key)) map.set(key, { key, mtr: r.mtr, dmr_manual: r.dmr_manual, rows: [] });
      const g = map.get(key)!;
      g.rows.push(r);
      if (r.dmr_manual) g.dmr_manual = true;
    }
    return Array.from(map.values());
  }, [parsedRows]);

  const conflitos = useMemo(() => {
    const exMap = new Map<string, ColetaComItens>();
    for (const c of coletasUnidade) if (c.mtr) exMap.set(c.mtr, c);
    return grupos
      .filter((g) => g.mtr && exMap.has(g.mtr))
      .map((g) => ({ grupo: g, existente: exMap.get(g.mtr)! }));
  }, [grupos, coletasUnidade]);

  const missingItems = useMemo(() => {
    const tiposSet = new Set(tipos.map((t) => t.nome.toLowerCase()));
    const tratsSet = new Set(trats.map((t) => t.nome.toLowerCase()));
    const destsSet = new Set(destinadores.map((d) => d.nome.toLowerCase()));
    const transSet = new Set(transportadores.map((t) => t.nome.toLowerCase()));
    const missing = { residuos: new Set<string>(), tratamentos: new Set<string>(), destinadores: new Set<string>(), transportadores: new Set<string>() };
    for (const r of parsedRows) {
      if (r.residuo && !tiposSet.has(r.residuo.toLowerCase())) missing.residuos.add(r.residuo);
      if (r.tratamento && !tratsSet.has(r.tratamento.toLowerCase())) missing.tratamentos.add(r.tratamento);
      if (r.destinador && !destsSet.has(r.destinador.toLowerCase())) missing.destinadores.add(r.destinador);
      if (r.transportador && !transSet.has(r.transportador.toLowerCase())) missing.transportadores.add(r.transportador);
    }
    return {
      residuos: Array.from(missing.residuos),
      tratamentos: Array.from(missing.tratamentos),
      destinadores: Array.from(missing.destinadores),
      transportadores: Array.from(missing.transportadores),
    };
  }, [parsedRows, tipos, trats, destinadores, transportadores]);

  const resumo = useMemo(() => {
    const residuos = new Set<string>(), tratsSet = new Set<string>(), dests = new Set<string>();
    for (const r of parsedRows) {
      if (r.residuo) residuos.add(r.residuo);
      if (r.tratamento) tratsSet.add(r.tratamento);
      if (r.destinador) dests.add(r.destinador);
    }
    return { coletas: grupos.length, residuos: residuos.size, tratamentos: tratsSet.size, destinadores: dests.size };
  }, [parsedRows, grupos]);

  // ===== Handlers =====
  async function handleFile(f: File) {
    setFile(f);
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    setWorkbook(wb);
    const first = wb.SheetNames[0];
    setSheetName(first);
    loadSheet(wb, first);
  }
  function loadSheet(wb: XLSX.WorkBook, name: string) {
    const sheet = wb.Sheets[name];
    const m = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
    setMatrix(m);
    // auto-detect mapping
    const firstRow = (m[0] ?? []).map((v) => String(v ?? "").trim() || "");
    const find = (...patterns: RegExp[]) => firstRow.find((h) => h && patterns.some((p) => p.test(h.toLowerCase()))) ?? "";
    setColMap({
      data: find(/^data|emiss/),
      mtr: find(/^mtr|n.*mtr/),
      residuo: find(/res[íi]duo|tipo/),
      peso: find(/peso|kg/),
      tratamento: find(/tratamento/),
      destinador: find(/destin/),
      transportador: find(/transport/),
      observacoes: find(/obs/),
    });
  }

  function goNext() {
    if (step === "file") {
      if (!file || !workbook || !sheetName) { toast.error("Selecione um arquivo e uma aba"); return; }
      setStep("config");
    } else if (step === "config") {
      if (!colMap.residuo || !colMap.peso) { toast.error("Mapeie ao menos Resíduo e Peso"); return; }
      setStep("unidade");
    } else if (step === "unidade") {
      if (!unidadeSel) { toast.error("Selecione a unidade"); return; }
      if (parsedRows.length === 0) { toast.error("Nenhuma linha válida nos dados"); return; }
      setStep("review");
    } else if (step === "review") {
      if (conflitos.length > 0) {
        const init: Record<string, ConflictAction> = {};
        for (const c of conflitos) if (!conflictActions[c.grupo.key]) init[c.grupo.key] = "manter";
        setConflictActions((prev) => ({ ...init, ...prev }));
        setStep("conflicts");
      } else if (hasMissing()) setStep("missing");
      else setStep("final");
    } else if (step === "conflicts") {
      if (hasMissing()) setStep("missing");
      else setStep("final");
    } else if (step === "missing") {
      setStep("final");
    } else if (step === "final") {
      runImport();
    }
  }
  function goBack() {
    if (step === "config") setStep("file");
    else if (step === "unidade") setStep("config");
    else if (step === "review") setStep("unidade");
    else if (step === "conflicts") setStep("review");
    else if (step === "missing") setStep(conflitos.length > 0 ? "conflicts" : "review");
    else if (step === "final") setStep(hasMissing() ? "missing" : conflitos.length > 0 ? "conflicts" : "review");
  }
  function hasMissing() {
    return missingItems.residuos.length + missingItems.tratamentos.length + missingItems.destinadores.length + missingItems.transportadores.length > 0;
  }

  async function runImport() {
    const { startImportJob, isImportActive } = await import("@/lib/import-job");
    if (isImportActive()) {
      toast.error("Já existe uma importação em andamento. Aguarde concluir.");
      return;
    }
    const res = await startImportJob({
      fileName: file?.name ?? "planilha",
      unidadeId: unidadeSel,
      grupos: grupos.map((g) => ({
        key: g.key,
        mtr: g.mtr,
        rows: g.rows.map((r) => ({
          data: r.data, mtr: r.mtr, residuo: r.residuo, peso: r.peso,
          tratamento: r.tratamento, destinador: r.destinador,
          transportador: r.transportador, observacoes: r.observacoes,
        })),
      })),
      conflictActions,
      coletasExistentes: coletasUnidade,
      missingItems,
      missingMap,
      tipos: tipos as any,
      trats: trats as any,
      destinadores: destinadores as any,
      transportadores: transportadores as any,
    });
    if (!res.ok) {
      toast.error(res.reason ?? "Não foi possível iniciar a importação");
      return;
    }
    toast.success("Importação iniciada em background. Você pode continuar usando o sistema.");
    onOpenChange(false);
  }

  // Final summary numbers
  const finalSummary = useMemo(() => {
    let criadas = 0, atualizadas = 0, ignoradas = 0;
    const exMap = new Map<string, ColetaComItens>();
    for (const c of coletasUnidade) if (c.mtr) exMap.set(c.mtr, c);
    for (const g of grupos) {
      if (g.mtr && exMap.has(g.mtr)) {
        const a = conflictActions[g.key] ?? "manter";
        if (a === "substituir") atualizadas++;
        else ignoradas++;
      } else {
        criadas++;
      }
    }
    return { criadas, atualizadas, ignoradas };
  }, [grupos, coletasUnidade, conflictActions]);

  const stepLabels: Record<Step, string> = {
    file: "1. Arquivo",
    config: "2. Configuração",
    unidade: "3. Unidade",
    review: "4. Revisão",
    conflicts: "5. Conflitos",
    missing: "6. Cadastros faltantes",
    final: "7. Confirmação",
    running: "Importando…",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-[1100px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-5" /> Importar coletas — {stepLabels[step]}
          </DialogTitle>
        </DialogHeader>

        {step === "file" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <Upload className="size-10 mx-auto mb-3 text-muted-foreground" />
              <Button onClick={() => fileRef.current?.click()}><Upload className="size-4 mr-2" />Selecionar planilha</Button>
              {file && <div className="mt-3 text-sm text-muted-foreground">Arquivo: <strong>{file.name}</strong></div>}
            </div>
            {workbook && (
              <div>
                <Label>Aba da planilha</Label>
                <Select value={sheetName} onValueChange={(v) => { setSheetName(v); loadSheet(workbook, v); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {workbook.SheetNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {step === "config" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Linha inicial dos dados</Label>
                <Input type="number" min={1} value={startRow} onChange={(e) => setStartRow(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div className="flex items-end gap-2">
                <Checkbox id="hasHeader" checked={hasHeader} onCheckedChange={(v) => setHasHeader(!!v)} />
                <Label htmlFor="hasHeader" className="cursor-pointer">Arquivo possui cabeçalho</Label>
              </div>
            </div>
            <div className="border rounded p-3 bg-muted/30">
              <div className="text-sm font-medium mb-2">Mapeamento de colunas</div>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["data", "Data"], ["mtr", "MTR"], ["residuo", "Resíduo *"], ["peso", "Peso *"],
                  ["tratamento", "Tratamento"], ["destinador", "Destinador"],
                  ["transportador", "Transportador"], ["observacoes", "Observações"],
                ] as const).map(([k, label]) => (
                  <div key={k}>
                    <Label className="text-xs">{label}</Label>
                    <Select value={colMap[k] || "__none__"} onValueChange={(v) => setColMap((m) => ({ ...m, [k]: v === "__none__" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— (não usar)</SelectItem>
                        {headerRow.map((h, i) => <SelectItem key={i} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              Pré-visualização: {matrix.length} linhas no arquivo. Será considerado a partir da linha {startRow}.
            </div>
          </div>
        )}

        {step === "unidade" && (
          <div className="space-y-4">
            <div className="border rounded p-4 bg-muted/30">
              <div className="text-sm text-muted-foreground">Você está importando dados para a unidade:</div>
              <div className="text-lg font-semibold">
                {unidades.find((u) => u.id === unidadeSel)?.nome ?? <span className="text-destructive">Nenhuma unidade selecionada</span>}
              </div>
            </div>
            <div>
              <Label>Alterar unidade</Label>
              <Select value={unidadeSel} onValueChange={setUnidadeSel}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="link" size="sm" className="px-0 mt-1" onClick={() => unidadeSel && setUnidadeAtiva(unidadeSel)}>
                Definir como unidade ativa
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {parsedRows.length} linha(s) válida(s) detectada(s).
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <SummaryCard label="Coletas" value={resumo.coletas} />
              <SummaryCard label="Resíduos diferentes" value={resumo.residuos} />
              <SummaryCard label="Tratamentos" value={resumo.tratamentos} />
              <SummaryCard label="Destinadores" value={resumo.destinadores} />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Preview de todos os registros ({parsedRows.length})</div>
              <div className="border rounded max-h-[40vh] overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2">#</th>
                      <th className="text-left p-2">Data</th>
                      <th className="text-left p-2">MTR</th>
                      <th className="text-left p-2">Resíduo</th>
                      <th className="text-right p-2">Peso</th>
                      <th className="text-left p-2">Tratamento</th>
                      <th className="text-left p-2">Destinador</th>
                      <th className="text-left p-2">Transportador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((r) => (
                      <tr key={r.idx} className="border-t">
                        <td className="p-2 text-muted-foreground">{r.idx}</td>
                        <td className="p-2">{r.data || <em className="text-muted-foreground">—</em>}</td>
                        <td className="p-2 font-mono">{r.mtr || <em className="text-muted-foreground">—</em>}</td>
                        <td className="p-2">{r.residuo}</td>
                        <td className="p-2 text-right tabular-nums">{r.peso}</td>
                        <td className="p-2">{r.tratamento}</td>
                        <td className="p-2">{r.destinador}</td>
                        <td className="p-2">{r.transportador}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {conflitos.length > 0 && (
              <div className="text-sm text-warning flex items-center gap-1">
                <AlertTriangle className="size-4" /> {conflitos.length} conflito(s) de MTR detectado(s) — você poderá decidir o que fazer no próximo passo.
              </div>
            )}
            {hasMissing() && (
              <div className="text-sm text-warning flex items-center gap-1">
                <AlertTriangle className="size-4" /> Cadastros novos detectados (resíduos/tratamentos/destinadores/transportadores).
              </div>
            )}
          </div>
        )}

        {step === "conflicts" && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                const m: Record<string, ConflictAction> = {};
                conflitos.forEach((c) => m[c.grupo.key] = "substituir");
                setConflictActions((p) => ({ ...p, ...m }));
              }}>Substituir todos</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const m: Record<string, ConflictAction> = {};
                conflitos.forEach((c) => m[c.grupo.key] = "manter");
                setConflictActions((p) => ({ ...p, ...m }));
              }}>Manter todos</Button>
            </div>
            <div className="border rounded max-h-[55vh] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2">MTR</th>
                    <th className="text-left p-2">Existente</th>
                    <th className="text-left p-2">Da planilha</th>
                    <th className="text-left p-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {conflitos.map(({ grupo, existente }) => {
                    const r0 = grupo.rows[0];
                    return (
                      <tr key={grupo.key} className="border-t align-top">
                        <td className="p-2 font-mono">{grupo.mtr}</td>
                        <td className="p-2">
                          <div>{existente.data} · {existente.destinador || "—"}</div>
                          <div className="text-muted-foreground">{(existente.itens ?? []).map((it) => `${it.tipo_residuo_nome} (${it.peso_kg}kg)`).join(", ")}</div>
                        </td>
                        <td className="p-2">
                          <div>{r0.data} · {r0.destinador || "—"}</div>
                          <div className="text-muted-foreground">{grupo.rows.map((r) => `${r.residuo} (${r.peso}kg)`).join(", ")}</div>
                        </td>
                        <td className="p-2">
                          <Select value={conflictActions[grupo.key] ?? "manter"} onValueChange={(v) => setConflictActions((p) => ({ ...p, [grupo.key]: v as ConflictAction }))}>
                            <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manter">Manter existente</SelectItem>
                              <SelectItem value="substituir">Substituir</SelectItem>
                              <SelectItem value="ignorar">Ignorar linha</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {step === "missing" && (
          <div className="space-y-4 max-h-[65vh] overflow-auto">
            <MissingSection title="Resíduos não cadastrados" cat="residuo" items={missingItems.residuos}
              options={tipos.map((t) => ({ id: t.id, nome: t.nome }))} value={missingMap} onChange={setMissingMap} />
            <MissingSection title="Tratamentos não cadastrados" cat="tratamento" items={missingItems.tratamentos}
              options={trats.map((t) => ({ id: t.id, nome: t.nome }))} value={missingMap} onChange={setMissingMap} />
            <MissingSection title="Destinadores não cadastrados" cat="destinador" items={missingItems.destinadores}
              options={destinadores.map((d) => ({ id: d.id, nome: d.nome }))} value={missingMap} onChange={setMissingMap} />
            <MissingSection title="Transportadores não cadastrados" cat="transportador" items={missingItems.transportadores}
              options={transportadores.map((t) => ({ id: t.id, nome: t.nome }))} value={missingMap} onChange={setMissingMap} />
          </div>
        )}

        {step === "final" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <SummaryCard label="Serão criadas" value={finalSummary.criadas} accent="success" />
              <SummaryCard label="Serão atualizadas" value={finalSummary.atualizadas} accent="warning" />
              <SummaryCard label="Serão ignoradas" value={finalSummary.ignoradas} />
            </div>
            <div className="border rounded p-3 bg-muted/30 text-sm space-y-1">
              <div>Unidade: <strong>{unidades.find((u) => u.id === unidadeSel)?.nome}</strong></div>
              <div>Arquivo: <strong>{file?.name}</strong> · Aba: <strong>{sheetName}</strong></div>
              <div>{parsedRows.length} linhas processadas em {grupos.length} coletas.</div>
            </div>
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-4 text-success" /> Tudo pronto. A importação só será executada após você confirmar.
            </div>
          </div>
        )}

        {step === "running" && (
          <div className="space-y-3 py-6 text-center">
            <div className="text-lg font-medium">Importando coletas…</div>
            <div className="text-sm text-muted-foreground">{progress.done} / {progress.total}</div>
            <div className="w-full bg-muted rounded h-2 overflow-hidden">
              <div className="bg-primary h-full transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between">
          <Button variant="ghost" onClick={goBack} disabled={step === "file" || step === "running"}>
            <ArrowLeft className="size-4 mr-1" /> Voltar
          </Button>
          {step !== "running" && (
            <Button onClick={goNext}>
              {step === "final" ? <><CheckCircle2 className="size-4 mr-1" /> Confirmar importação</> : <>Avançar <ArrowRight className="size-4 ml-1" /></>}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number; accent?: "success" | "warning" }) {
  const color = accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-foreground";
  return (
    <div className="border rounded p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function MissingSection({ title, cat, items, options, value, onChange }: {
  title: string;
  cat: "residuo" | "tratamento" | "destinador" | "transportador";
  items: string[];
  options: { id: string; nome: string }[];
  value: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-sm font-medium mb-1">{title} <Badge variant="outline" className="ml-1">{items.length}</Badge></div>
      <div className="border rounded">
        {items.map((nome) => {
          const key = `${cat}:${nome.toLowerCase()}`;
          const v = value[key] ?? "__new__";
          return (
            <div key={key} className="flex items-center gap-2 p-2 border-b last:border-b-0">
              <div className="flex-1 text-sm">{nome}</div>
              <Select value={v} onValueChange={(nv) => onChange({ ...value, [key]: nv })}>
                <SelectTrigger className="h-8 w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__"><span className="inline-flex items-center gap-1"><Plus className="size-3" /> Criar novo "{nome}"</span></SelectItem>
                  {options.map((o) => <SelectItem key={o.id} value={o.id}>Substituir por: {o.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
