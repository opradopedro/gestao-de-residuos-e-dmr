import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo, setPeriodoAtivo } from "@/hooks/use-periodo";
import { listColetasByUnidade, totalPesoColeta } from "@/lib/data";
import { listDmrUploads, getDmrLinhas, createDmrUpload, deleteDmrUpload, DmrMapeamento } from "@/lib/dmr";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Upload, Trash2, AlertTriangle, FileSpreadsheet, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { quarterOf } from "@/lib/quarter";
import { formatKg, formatDate } from "@/lib/format";

export const Route = createFileRoute("/dmr")({
  head: () => ({ meta: [{ title: "DMR — Conferência" }] }),
  component: DmrPage,
});

type Parsed = { headers: string[]; rows: Record<string, any>[]; fileName: string };
const FIELDS: { key: keyof DmrMapeamento; label: string }[] = [
  { key: "residuo", label: "Resíduo" },
  { key: "destinador", label: "Destinador" },
  { key: "peso_kg", label: "Peso (toneladas)" },
];

function DmrPage() {
  const unidade = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [linhaInicial, setLinhaInicial] = useState(1);
  const [map, setMap] = useState<DmrMapeamento>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: uploads = [] } = useQuery({ queryKey: ["dmr_uploads", unidade], queryFn: () => listDmrUploads(unidade!), enabled: !!unidade });
  const [selectedUpload, setSelectedUpload] = useState<string | null>(null);

  const mutUpload = useMutation({
    mutationFn: async () => {
      if (!parsed || !unidade) throw new Error("Sem arquivo");
      const linhas = parsed.rows.map((r) => {
        const tonRaw = map.peso_kg ? String(r[map.peso_kg] ?? "0").replace(/\./g, "").replace(",", ".") : "0";
        const ton = Number(tonRaw) || 0;
        return {
          residuo: map.residuo ? String(r[map.residuo] ?? "") : undefined,
          destinador: map.destinador ? String(r[map.destinador] ?? "") : undefined,
          // Valor é interpretado como TONELADAS — convertido para kg internamente.
          peso_kg: ton * 1000,
        };
      });
      return createDmrUpload({ unidade_id: unidade, ano: periodo.ano, trimestre: periodo.trimestre, arquivo_nome: parsed.fileName, mapeamento: map, linhas });
    },
    onSuccess: (id) => {
      toast.success("DMR importada");
      setParsed(null); setMap({}); if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["dmr_uploads"] });
      setSelectedUpload(id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function handleFile(f: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // Lê sem cabeçalho — usuário escolhe linha inicial.
      const matrix = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" }) as any[][];
      const rows = matrix.map((arr) => {
        const obj: Record<string, any> = {};
        arr.forEach((v, i) => { obj[`Coluna ${i + 1}`] = v; });
        return obj;
      });
      setAllRows(rows);
      setLinhaInicial(1);
      applyLinhaInicial(rows, 1, f.name);
    };
    reader.readAsArrayBuffer(f);
  }

  function applyLinhaInicial(rows: Record<string, any>[], inicial: number, fileName: string) {
    if (rows.length === 0) { setParsed({ headers: [], rows: [], fileName }); return; }
    const headerIdx = Math.max(0, inicial - 1);
    const headerRow = rows[headerIdx] ?? {};
    const headers = Object.values(headerRow).map((v, i) => {
      const s = String(v ?? "").trim();
      return s || `Coluna ${i + 1}`;
    });
    const dataRows = rows.slice(headerIdx + 1).map((r) => {
      const obj: Record<string, any> = {};
      Object.values(r).forEach((v, i) => { obj[headers[i] ?? `Coluna ${i + 1}`] = v; });
      return obj;
    });
    setParsed({ headers, rows: dataRows, fileName });
    const auto: DmrMapeamento = {};
    for (const h of headers) {
      const l = h.toLowerCase();
      if (!auto.residuo && /res[íi]duo|tipo/.test(l)) auto.residuo = h;
      if (!auto.destinador && /destin/.test(l)) auto.destinador = h;
      if (!auto.peso_kg && /peso|quant|ton|kg/.test(l)) auto.peso_kg = h;
    }
    setMap(auto);
  }

  if (!unidade) return <NoUnidade />;

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <PageHeader title="DMR — Conferência" description={`Compare a DMR oficial com os dados internos · ${periodo.label}`} />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label className="text-xs">Trimestre alvo</Label>
              <div className="flex gap-2 mt-1">
                <Select value={String(periodo.trimestre)} onValueChange={(v) => setPeriodoAtivo({ ano: periodo.ano, trimestre: Number(v) as 1 | 2 | 3 | 4 })}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1º (Jan-Mar)</SelectItem>
                    <SelectItem value="2">2º (Abr-Jun)</SelectItem>
                    <SelectItem value="3">3º (Jul-Set)</SelectItem>
                    <SelectItem value="4">4º (Out-Dez)</SelectItem>
                  </SelectContent>
                </Select>
                <Input className="w-24" type="number" value={periodo.ano} onChange={(e) => setPeriodoAtivo({ ano: Number(e.target.value) || periodo.ano, trimestre: periodo.trimestre })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Arquivo Excel da DMR</Label>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div className="mt-1">
                <Button type="button" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4 mr-1" /> Selecionar arquivo
                </Button>
                {parsed && <span className="ml-2 text-xs text-muted-foreground">{parsed.fileName}</span>}
              </div>
            </div>
          </div>

          {parsed && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <Label className="text-xs">Linha do cabeçalho</Label>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, allRows.length)}
                    value={linhaInicial}
                    onChange={(e) => {
                      const n = Math.max(1, Number(e.target.value) || 1);
                      setLinhaInicial(n);
                      if (parsed) applyLinhaInicial(allRows, n, parsed.fileName);
                    }}
                    className="w-28 mt-1"
                  />
                </div>
                <div className="text-sm text-muted-foreground pb-2">
                  {parsed.rows.length} linhas de dados após o cabeçalho · <b>{parsed.fileName}</b>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Confirme o mapeamento das colunas:</div>
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                ⚠ Os pesos da DMR são interpretados em <b>toneladas</b>. Ex: o valor <code>10</code> será tratado como 10 toneladas (10.000 kg).
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <Label className="text-xs">{f.label}</Label>
                    <Select value={map[f.key] ?? "__none__"} onValueChange={(v) => setMap((m) => ({ ...m, [f.key]: v === "__none__" ? undefined : v }))}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— ignorar —</SelectItem>
                        {parsed.headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <Button onClick={() => mutUpload.mutate()} disabled={!map.residuo || !map.peso_kg || mutUpload.isPending}>
                <Upload className="size-4 mr-1" /> Importar e conferir
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h3 className="font-medium mb-3 flex items-center gap-2"><FileSpreadsheet className="size-4" /> Uploads desta unidade</h3>
          {uploads.length === 0 ? <div className="text-sm text-muted-foreground">Nenhum upload ainda.</div> : (
            <div className="space-y-2">
              {uploads.map((u) => (
                <div key={u.id} className={`flex items-center justify-between border rounded-md p-3 ${selectedUpload === u.id ? "border-primary bg-primary/5" : ""}`}>
                  <div className="text-sm">
                    <div className="font-medium">{u.arquivo_nome}</div>
                    <div className="text-muted-foreground text-xs">{u.ano} · {u.trimestre}º trimestre</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant={selectedUpload === u.id ? "default" : "outline"} onClick={() => setSelectedUpload(u.id)}>Conferir</Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Excluir upload?")) deleteDmrUpload(u.id).then(() => qc.invalidateQueries({ queryKey: ["dmr_uploads"] })); }}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedUpload && <ConferenciaPanel uploadId={selectedUpload} unidadeId={unidade} />}
    </div>
  );
}

type Grupo = {
  key: string;
  residuo: string;
  destinador: string;
  internoKg: number;
  dmrKg: number;
  diff: number;
  matches: any[];
  causasSemMtr: any[];
  causasEstimado: any[];
  dmrLinhas: any[];
};

function ConferenciaPanel({ uploadId, unidadeId }: { uploadId: string; unidadeId: string }) {
  const { data: upload } = useQuery({ queryKey: ["dmr_uploads", unidadeId], queryFn: () => listDmrUploads(unidadeId), select: (l) => l.find((u) => u.id === uploadId) });
  const { data: linhas = [] } = useQuery({ queryKey: ["dmr_linhas", uploadId], queryFn: () => getDmrLinhas(uploadId) });
  const { data: coletas = [] } = useQuery({ queryKey: ["coletas", unidadeId], queryFn: () => listColetasByUnidade(unidadeId) });
  const [detail, setDetail] = useState<Grupo | null>(null);

  const grupos: Grupo[] = useMemo(() => {
    if (!upload) return [];
    const coletasTri = coletas.filter((c) => {
      const q = quarterOf(c.data);
      return q.ano === upload.ano && q.trimestre === upload.trimestre;
    });

    const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
    const interno = new Map<string, number>();
    const internoColetas = new Map<string, any[]>();
    for (const c of coletasTri) {
      const dest = norm(c.destinador) || "(sem destinador)";
      for (const it of c.itens ?? []) {
        const k = `${norm(it.tipo_residuo_nome)}||${dest}`;
        interno.set(k, (interno.get(k) ?? 0) + Number(it.peso_kg));
        if (!internoColetas.has(k)) internoColetas.set(k, []);
        if (!internoColetas.get(k)!.includes(c)) internoColetas.get(k)!.push(c);
      }
    }
    const dmr = new Map<string, number>();
    const dmrLinhasMap = new Map<string, any[]>();
    for (const l of linhas) {
      const k = `${norm(l.residuo)}||${norm(l.destinador) || "(sem destinador)"}`;
      dmr.set(k, (dmr.get(k) ?? 0) + Number(l.peso_kg ?? 0));
      if (!dmrLinhasMap.has(k)) dmrLinhasMap.set(k, []);
      dmrLinhasMap.get(k)!.push(l);
    }
    const keys = new Set([...interno.keys(), ...dmr.keys()]);
    return Array.from(keys).map((k) => {
      const [residuo, destinador] = k.split("||");
      const internoKg = interno.get(k) ?? 0;
      const dmrKg = dmr.get(k) ?? 0;
      const diff = dmrKg - internoKg;
      const matches = internoColetas.get(k) ?? [];
      return {
        key: k, residuo, destinador, internoKg, dmrKg, diff, matches,
        causasSemMtr: matches.filter((c) => !c.mtr),
        causasEstimado: matches.filter((c) => c.peso_estimado),
        dmrLinhas: dmrLinhasMap.get(k) ?? [],
      };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [upload, linhas, coletas]);

  if (!upload) return null;

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium">Conferência: {upload.arquivo_nome}</h3>
            <div className="text-xs text-muted-foreground">{upload.ano} · {upload.trimestre}º trimestre — clique numa linha para investigar</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Resíduo</th>
                  <th className="text-left p-3">Destinador</th>
                  <th className="text-right p-3">Interno</th>
                  <th className="text-right p-3">DMR</th>
                  <th className="text-right p-3">Divergência</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {grupos.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr> : grupos.map((g) => {
                  const pct = g.internoKg > 0 ? (g.diff / g.internoKg) * 100 : (g.dmrKg > 0 ? 100 : 0);
                  const abs = Math.abs(g.diff);
                  const grave = abs > 50 || Math.abs(pct) > 10;
                  const leve = !grave && abs > 1;
                  const status = grave ? { label: "Grave", cls: "bg-destructive/15 text-destructive border-destructive/30" }
                    : leve ? { label: "Leve", cls: "bg-warning/15 text-warning-foreground border-warning/40" }
                    : { label: "OK", cls: "bg-success/15 text-success border-success/30" };
                  return (
                    <tr key={g.key} className="border-t border-border align-top hover:bg-muted/30 cursor-pointer" onClick={() => setDetail(g)}>
                      <td className="p-3"><span className={`text-[10px] font-semibold uppercase rounded-full px-2 py-1 border ${status.cls}`}>{status.label}</span></td>
                      <td className="p-3">{g.residuo}</td>
                      <td className="p-3">{g.destinador}</td>
                      <td className="p-3 text-right tabular-nums">{formatKg(g.internoKg)}</td>
                      <td className="p-3 text-right tabular-nums">{formatKg(g.dmrKg)}</td>
                      <td className={"p-3 text-right tabular-nums " + (grave ? "text-destructive font-medium" : leve ? "text-warning-foreground" : "")}>
                        {g.diff > 0 ? "+" : ""}{formatKg(g.diff)}
                        {(g.internoKg > 0 || g.dmrKg > 0) && <div className="text-xs text-muted-foreground">{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</div>}
                      </td>
                      <td className="p-3 text-muted-foreground"><ChevronRight className="size-4" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle>{detail.residuo} · {detail.destinador}</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Interno</div>
                    <div className="font-semibold">{formatKg(detail.internoKg)}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">DMR</div>
                    <div className="font-semibold">{formatKg(detail.dmrKg)}</div>
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">Diferença</div>
                    <div className={`font-semibold ${Math.abs(detail.diff) > 50 ? "text-destructive" : ""}`}>{detail.diff > 0 ? "+" : ""}{formatKg(detail.diff)}</div>
                  </div>
                </div>

                {(detail.causasSemMtr.length > 0 || detail.causasEstimado.length > 0) && (
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                    <div className="font-medium flex items-center gap-2"><AlertTriangle className="size-4 text-warning-foreground" /> Causas sugeridas</div>
                    <ul className="mt-1 text-sm list-disc pl-5">
                      {detail.causasSemMtr.length > 0 && <li>{detail.causasSemMtr.length} coleta(s) sem MTR — provavelmente não foram à DMR.</li>}
                      {detail.causasEstimado.length > 0 && <li>{detail.causasEstimado.length} coleta(s) com peso estimado.</li>}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="font-medium mb-2">Coletas internas ({detail.matches.length})</div>
                  {detail.matches.length === 0 ? <div className="text-muted-foreground text-xs">Nada no sistema interno.</div> : (
                    <div className="space-y-2">
                      {detail.matches.map((c) => (
                        <div key={c.id} className="border rounded-md p-2 flex items-center justify-between">
                          <div>
                            <div className="text-xs">{formatDate(c.data)} · MTR {c.mtr || <span className="text-destructive">—</span>}</div>
                            <div className="text-xs text-muted-foreground">{formatKg(totalPesoColeta(c))} {c.peso_estimado && <span className="text-warning-foreground">(estimado)</span>}</div>
                          </div>
                          <Button asChild size="sm" variant="ghost"><Link to="/coletas/$id" params={{ id: c.id }}>Editar</Link></Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="font-medium mb-2">Linhas da DMR ({detail.dmrLinhas.length})</div>
                  {detail.dmrLinhas.length === 0 ? <div className="text-muted-foreground text-xs">Sem linhas correspondentes na DMR.</div> : (
                    <div className="space-y-1 text-xs">
                      {detail.dmrLinhas.slice(0, 20).map((l, i) => (
                        <div key={i} className="border rounded-md p-2 flex justify-between">
                          <span>{l.residuo || "—"} · {l.destinador || "—"}</span>
                          <span className="tabular-nums">{formatKg(Number(l.peso_kg ?? 0))}</span>
                        </div>
                      ))}
                      {detail.dmrLinhas.length > 20 && <div className="text-muted-foreground">+ {detail.dmrLinhas.length - 20} mais...</div>}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
