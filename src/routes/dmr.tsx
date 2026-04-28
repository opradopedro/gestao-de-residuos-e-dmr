import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUnidadeAtiva } from "@/hooks/use-unidade";
import { listColetasByUnidade } from "@/lib/data";
import { listDmrUploads, getDmrLinhas, createDmrUpload, deleteDmrUpload, DmrMapeamento } from "@/lib/dmr";
import { NoUnidade, PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, AlertTriangle } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { quarterOf, currentQuarter } from "@/lib/quarter";
import { formatKg } from "@/lib/format";

export const Route = createFileRoute("/dmr")({
  head: () => ({ meta: [{ title: "DMR — Conferência" }] }),
  component: DmrPage,
});

type Parsed = { headers: string[]; rows: Record<string, any>[]; fileName: string };
const FIELDS: { key: keyof DmrMapeamento; label: string }[] = [
  { key: "residuo", label: "Resíduo" },
  { key: "destinador", label: "Destinador" },
  { key: "peso_kg", label: "Peso (kg)" },
  { key: "mtr", label: "MTR" },
  { key: "data", label: "Data" },
];

function DmrPage() {
  const unidade = useUnidadeAtiva();
  const qc = useQueryClient();
  const cur = currentQuarter();
  const [ano, setAno] = useState(cur.ano);
  const [tri, setTri] = useState<number>(cur.trimestre);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [map, setMap] = useState<DmrMapeamento>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: uploads = [] } = useQuery({ queryKey: ["dmr_uploads", unidade], queryFn: () => listDmrUploads(unidade!), enabled: !!unidade });
  const [selectedUpload, setSelectedUpload] = useState<string | null>(null);

  const mutUpload = useMutation({
    mutationFn: async () => {
      if (!parsed || !unidade) throw new Error("Sem arquivo");
      const linhas = parsed.rows.map((r) => ({
        residuo: map.residuo ? String(r[map.residuo] ?? "") : undefined,
        destinador: map.destinador ? String(r[map.destinador] ?? "") : undefined,
        peso_kg: map.peso_kg ? Number(String(r[map.peso_kg] ?? "0").replace(",", ".")) || 0 : undefined,
        mtr: map.mtr ? String(r[map.mtr] ?? "") : undefined,
        data: map.data ? String(r[map.data] ?? "") : undefined,
      }));
      return createDmrUpload({ unidade_id: unidade, ano, trimestre: tri, arquivo_nome: parsed.fileName, mapeamento: map, linhas });
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
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      setParsed({ headers, rows, fileName: f.name });
      // auto-mapping por nome
      const auto: DmrMapeamento = {};
      for (const h of headers) {
        const l = h.toLowerCase();
        if (!auto.residuo && /res[íi]duo|tipo/.test(l)) auto.residuo = h;
        if (!auto.destinador && /destin/.test(l)) auto.destinador = h;
        if (!auto.peso_kg && /peso|quant|kg/.test(l)) auto.peso_kg = h;
        if (!auto.mtr && /mtr/.test(l)) auto.mtr = h;
        if (!auto.data && /data/.test(l)) auto.data = h;
      }
      setMap(auto);
    };
    reader.readAsArrayBuffer(f);
  }

  if (!unidade) return <NoUnidade />;

  return (
    <div className="p-6 max-w-7xl space-y-6">
      <PageHeader title="DMR — Conferência" description="Compare a DMR oficial com os dados internos." />

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div><Label className="text-xs">Ano</Label><Input value={ano} onChange={(e) => setAno(Number(e.target.value) || cur.ano)} /></div>
            <div>
              <Label className="text-xs">Trimestre</Label>
              <Select value={String(tri)} onValueChange={(v) => setTri(Number(v))}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1º (Jan-Mar)</SelectItem>
                  <SelectItem value="2">2º (Abr-Jun)</SelectItem>
                  <SelectItem value="3">3º (Jul-Set)</SelectItem>
                  <SelectItem value="4">4º (Out-Dez)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Arquivo Excel</Label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} className="block text-sm" />
            </div>
          </div>

          {parsed && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{parsed.rows.length} linhas detectadas em <b>{parsed.fileName}</b>. Mapeie as colunas:</div>
              <div className="grid gap-3 md:grid-cols-5">
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
          <h3 className="font-medium mb-3">Uploads desta unidade</h3>
          {uploads.length === 0 ? <div className="text-sm text-muted-foreground">Nenhum upload ainda.</div> : (
            <div className="space-y-2">
              {uploads.map((u) => (
                <div key={u.id} className="flex items-center justify-between border rounded-md p-3">
                  <div className="text-sm">
                    <div className="font-medium">{u.arquivo_nome}</div>
                    <div className="text-muted-foreground text-xs">{u.ano} · {u.trimestre}º trimestre</div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setSelectedUpload(u.id)}>Conferir</Button>
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

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={"flex h-9 w-32 rounded-md border border-input bg-background px-3 py-1 text-sm " + (props.className ?? "")} />;
}

function ConferenciaPanel({ uploadId, unidadeId }: { uploadId: string; unidadeId: string }) {
  const { data: upload } = useQuery({ queryKey: ["dmr_uploads", unidadeId], queryFn: () => listDmrUploads(unidadeId), select: (l) => l.find((u) => u.id === uploadId) });
  const { data: linhas = [] } = useQuery({ queryKey: ["dmr_linhas", uploadId], queryFn: () => getDmrLinhas(uploadId) });
  const { data: coletas = [] } = useQuery({ queryKey: ["coletas", unidadeId], queryFn: () => listColetasByUnidade(unidadeId) });

  const grupos = useMemo(() => {
    if (!upload) return [];
    // Filtra coletas no trimestre do upload
    const coletasTri = coletas.filter((c) => {
      const q = quarterOf(c.data);
      return q.ano === upload.ano && q.trimestre === upload.trimestre;
    });

    const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
    const interno = new Map<string, number>();
    const internoColetas = new Map<string, typeof coletasTri>();
    for (const c of coletasTri) {
      const dest = norm(c.destinador) || "(sem destinador)";
      for (const it of c.itens ?? []) {
        const k = `${norm(it.tipo_residuo_nome)}||${dest}`;
        interno.set(k, (interno.get(k) ?? 0) + Number(it.peso_kg));
        if (!internoColetas.has(k)) internoColetas.set(k, []);
        internoColetas.get(k)!.push(c);
      }
    }
    const dmr = new Map<string, number>();
    for (const l of linhas) {
      const k = `${norm(l.residuo)}||${norm(l.destinador) || "(sem destinador)"}`;
      dmr.set(k, (dmr.get(k) ?? 0) + Number(l.peso_kg ?? 0));
    }
    const keys = new Set([...interno.keys(), ...dmr.keys()]);
    return Array.from(keys).map((k) => {
      const [residuo, destinador] = k.split("||");
      const internoKg = interno.get(k) ?? 0;
      const dmrKg = dmr.get(k) ?? 0;
      const diff = dmrKg - internoKg;
      const matches = internoColetas.get(k) ?? [];
      const causasSemMtr = matches.filter((c) => !c.mtr);
      const causasEstimado = matches.filter((c) => c.peso_estimado);
      return { key: k, residuo, destinador, internoKg, dmrKg, diff, causasSemMtr, causasEstimado };
    }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  }, [upload, linhas, coletas]);

  if (!upload) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="p-4 border-b border-border">
          <h3 className="font-medium">Conferência: {upload.arquivo_nome}</h3>
          <div className="text-xs text-muted-foreground">{upload.ano} · {upload.trimestre}º trimestre</div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left p-3">Resíduo</th>
              <th className="text-left p-3">Destinador</th>
              <th className="text-right p-3">Interno</th>
              <th className="text-right p-3">DMR</th>
              <th className="text-right p-3">Divergência</th>
              <th className="text-left p-3">Causas sugeridas</th>
            </tr>
          </thead>
          <tbody>
            {grupos.length === 0 ? <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem dados.</td></tr> : grupos.map((g) => {
              const pct = g.internoKg > 0 ? (g.diff / g.internoKg) * 100 : 0;
              const grave = Math.abs(g.diff) > 10; // > 10 kg
              return (
                <tr key={g.key} className="border-t border-border align-top">
                  <td className="p-3">{g.residuo}</td>
                  <td className="p-3">{g.destinador}</td>
                  <td className="p-3 text-right tabular-nums">{formatKg(g.internoKg)}</td>
                  <td className="p-3 text-right tabular-nums">{formatKg(g.dmrKg)}</td>
                  <td className={"p-3 text-right tabular-nums " + (grave ? "text-destructive font-medium" : "")}>
                    {g.diff > 0 ? "+" : ""}{formatKg(g.diff)}
                    {g.internoKg > 0 && <div className="text-xs text-muted-foreground">{pct > 0 ? "+" : ""}{pct.toFixed(1)}%</div>}
                  </td>
                  <td className="p-3 text-xs space-y-1">
                    {g.causasSemMtr.length > 0 && <div className="flex items-center gap-1 text-warning"><AlertTriangle className="size-3" /> {g.causasSemMtr.length} coleta(s) sem MTR</div>}
                    {g.causasEstimado.length > 0 && <div className="flex items-center gap-1 text-warning"><AlertTriangle className="size-3" /> {g.causasEstimado.length} com peso estimado</div>}
                    {g.causasSemMtr.length === 0 && g.causasEstimado.length === 0 && grave && <span className="text-muted-foreground">Verificar manualmente</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
