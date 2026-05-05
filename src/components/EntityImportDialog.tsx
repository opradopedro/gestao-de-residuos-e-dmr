import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { parseCsv } from "@/lib/csv";

type Field = { key: string; label: string; required?: boolean };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  fields: Field[]; // colunas esperadas
  onImport: (rows: Record<string, string>[]) => Promise<void> | void;
};

export function EntityImportDialog({ open, onOpenChange, title, fields, onImport }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"file" | "map">("file");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [hasHeader, setHasHeader] = useState(true);
  const [startRow, setStartRow] = useState(2);
  const [sheetName, setSheetName] = useState<string>("");
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [csvText, setCsvText] = useState<string>("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function reset() {
    setStep("file"); setRawRows([]); setHeaders([]); setSheetName(""); setSheetNames([]);
    setFileBuffer(null); setCsvText(""); setMapping({}); setStartRow(2); setHasHeader(true);
  }

  async function handleFile(f: File) {
    const ext = f.name.toLowerCase();
    if (ext.endsWith(".csv")) {
      const text = await f.text();
      setCsvText(text);
      const rows = parseCsv(text);
      const cols = Object.keys(rows[0] ?? {});
      setHeaders(cols);
      setRawRows(rows.map((r) => cols.map((c) => r[c] ?? "")));
      setStep("map");
    } else {
      const buf = await f.arrayBuffer();
      setFileBuffer(buf);
      const wb = XLSX.read(buf, { type: "array" });
      setSheetNames(wb.SheetNames);
      setSheetName(wb.SheetNames[0]);
      readSheet(wb, wb.SheetNames[0], 2, true);
      setStep("map");
    }
  }

  function readSheet(wb: XLSX.WorkBook, name: string, start: number, header: boolean) {
    const ws = wb.Sheets[name];
    const arr = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: "" });
    const sliced = arr.slice(start - 1) as string[][];
    if (header && sliced.length > 0) {
      setHeaders(sliced[0].map((h) => String(h ?? "").trim()));
      setRawRows(sliced.slice(1));
    } else {
      const ncols = Math.max(0, ...sliced.map((r) => r.length));
      setHeaders(Array.from({ length: ncols }, (_, i) => `Coluna ${i + 1}`));
      setRawRows(sliced);
    }
  }

  function reReadSheet(name: string, start: number, header: boolean) {
    if (!fileBuffer) return;
    const wb = XLSX.read(fileBuffer, { type: "array" });
    readSheet(wb, name, start, header);
  }

  async function executar() {
    setBusy(true);
    try {
      const rows = rawRows
        .filter((r) => r.some((v) => String(v).trim() !== ""))
        .map((r) => {
          const o: Record<string, string> = {};
          for (const f of fields) {
            const col = mapping[f.key];
            if (!col) continue;
            const idx = headers.indexOf(col);
            o[f.key] = idx >= 0 ? String(r[idx] ?? "").trim() : "";
          }
          return o;
        });
      await onImport(rows);
      toast.success(`${rows.length} registro(s) importado(s)`);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  const requiredOk = fields.filter((f) => f.required).every((f) => !!mapping[f.key]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="size-5" /> Importar — {title}</DialogTitle>
          <DialogDescription>Importe a partir de uma planilha CSV ou Excel.</DialogDescription>
        </DialogHeader>

        {step === "file" && (
          <div className="space-y-3">
            <input
              ref={ref} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) await handleFile(f); if (ref.current) ref.current.value = ""; }}
            />
            <div className="flex flex-col items-center gap-2 p-8 border-2 border-dashed rounded-md">
              <FileSpreadsheet className="size-10 text-muted-foreground" />
              <Button onClick={() => ref.current?.click()}><Upload className="size-4 mr-1" /> Selecionar arquivo</Button>
              <div className="text-xs text-muted-foreground">CSV, XLSX ou XLS</div>
            </div>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-3">
            {sheetNames.length > 0 && (
              <div className="grid grid-cols-3 gap-2 items-end">
                <div>
                  <Label className="text-xs">Aba</Label>
                  <Select value={sheetName} onValueChange={(v) => { setSheetName(v); reReadSheet(v, startRow, hasHeader); }}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{sheetNames.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Linha inicial</Label>
                  <Input type="number" min={1} value={startRow} className="h-8"
                    onChange={(e) => { const v = Math.max(1, parseInt(e.target.value || "1")); setStartRow(v); reReadSheet(sheetName, v, hasHeader); }} />
                </div>
                <label className="flex items-center gap-2 text-xs h-8">
                  <input type="checkbox" checked={hasHeader} onChange={(e) => { setHasHeader(e.target.checked); reReadSheet(sheetName, startRow, e.target.checked); }} />
                  Possui cabeçalho
                </label>
              </div>
            )}

            <div className="border rounded-md p-3 space-y-2 bg-muted/30">
              <div className="text-xs font-semibold text-muted-foreground">Mapeamento de colunas</div>
              {fields.map((f) => (
                <div key={f.key} className="grid grid-cols-2 gap-2 items-center">
                  <Label className="text-xs">{f.label}{f.required && <span className="text-destructive ml-1">*</span>}</Label>
                  <Select value={mapping[f.key] ?? ""} onValueChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="— ignorar —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— ignorar —</SelectItem>
                      {headers.map((h, i) => <SelectItem key={`${h}-${i}`} value={h || `Coluna ${i + 1}`}>{h || `Coluna ${i + 1}`}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground">
              {rawRows.filter((r) => r.some((v) => String(v).trim() !== "")).length} linha(s) detectada(s).
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {step === "map" && (
            <Button disabled={!requiredOk || busy} onClick={executar}>
              {busy ? "Importando…" : "Importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
