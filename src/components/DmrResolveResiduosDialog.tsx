import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listTiposResiduo, type TipoResiduo } from "@/lib/data";
import { renameDmrLinhasResiduo } from "@/lib/dmr";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TipoResiduoEditDialog } from "./TipoResiduoEditDialog";
import { toast } from "sonner";

type Pendente = { texto: string; ocorrencias: number };

export function DmrResolveResiduosDialog({
  open, onOpenChange, uploadId, pendentes, titulo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  uploadId: string;
  pendentes: Pendente[];
  titulo?: string;
}) {
  const qc = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  // Freeze pendentes list on open so resolving an item doesn't shift indexes (skip 2 by 2 bug).
  const [frozen, setFrozen] = useState<Pendente[]>(pendentes);
  const [idx, setIdx] = useState(0);
  const [escolha, setEscolha] = useState<string>("");
  const [criar, setCriar] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFrozen(pendentes);
      setIdx(0);
      setEscolha("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const atual = frozen[idx];
  const total = frozen.length;

  // sugestão por código IBAMA presente no início do texto (ex.: "200138 - madeira…")
  const codigoSugerido = useMemo(() => {
    if (!atual) return "";
    const m = /^([0-9]{4,8})/.exec(atual.texto.trim());
    return m ? m[1] : "";
  }, [atual]);

  if (!atual) return null;

  async function aplicarExistente(tipo: TipoResiduo) {
    setBusy(true);
    try {
      await renameDmrLinhasResiduo(uploadId, atual.texto, tipo.nome);
      qc.invalidateQueries({ queryKey: ["dmr_linhas", uploadId] });
      toast.success(`"${atual.texto}" → ${tipo.nome}`);
      avancar();
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
    finally { setBusy(false); }
  }

  function avancar() {
    setEscolha("");
    if (idx + 1 >= total) onOpenChange(false);
    else setIdx(idx + 1);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Resolver resíduo da DMR ({idx + 1}/{total})</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground">Texto original na DMR</div>
              <div className="font-medium">{atual.texto}</div>
              <div className="text-xs text-muted-foreground mt-1">{atual.ocorrencias} linha(s)</div>
            </div>
            <div>
              <Label className="text-xs">Substituir por resíduo cadastrado</Label>
              <Select value={escolha} onValueChange={setEscolha}>
                <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                <SelectContent>
                  {tipos.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}{t.codigo ? ` (${t.codigo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                disabled={!escolha || busy}
                onClick={() => {
                  const t = tipos.find((x) => x.id === escolha);
                  if (t) aplicarExistente(t);
                }}
              >Substituir</Button>
              <Button variant="outline" onClick={() => setCriar(true)}>Criar novo resíduo</Button>
              <Button variant="ghost" onClick={avancar}>Pular</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TipoResiduoEditDialog
        open={criar}
        onOpenChange={setCriar}
        defaultName={atual.texto.replace(/^[0-9]{4,8}\s*[-–]?\s*/, "")}
        defaultCodigo={codigoSugerido}
        onSaved={(t) => aplicarExistente(t)}
      />
    </>
  );
}
