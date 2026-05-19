import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listDestinadores, createDestinador, type Destinador } from "@/lib/data";
import { renameDmrLinhasDestinador } from "@/lib/dmr";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCNPJ } from "@/lib/cnpj";
import { toast } from "sonner";

type Pendente = { texto: string; ocorrencias: number };

export function DmrResolveDestinadoresDialog({
  open, onOpenChange, uploadId, pendentes,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  uploadId: string;
  pendentes: Pendente[];
}) {
  const qc = useQueryClient();
  const { data: destinadores = [] } = useQuery({ queryKey: ["destinadores"], queryFn: listDestinadores });

  // Congela a lista no momento da abertura para evitar saltos de índice ao resolver itens.
  const [frozen, setFrozen] = useState<Pendente[]>(pendentes);
  const [idx, setIdx] = useState(0);
  const [escolha, setEscolha] = useState<string>("");
  const [criandoNome, setCriandoNome] = useState("");
  const [criando, setCriando] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFrozen(pendentes);
      setIdx(0);
      setEscolha("");
      setCriando(false);
      setCriandoNome("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const atual = frozen[idx];
  const total = frozen.length;
  if (!atual) return null;

  async function aplicar(nomeFinal: string) {
    setBusy(true);
    try {
      await renameDmrLinhasDestinador(uploadId, atual.texto, nomeFinal);
      qc.invalidateQueries({ queryKey: ["dmr_linhas", uploadId] });
      toast.success(`"${atual.texto}" → ${nomeFinal}`);
      avancar();
    } catch (e: any) { toast.error(e.message ?? "Erro"); }
    finally { setBusy(false); }
  }

  async function criarECasar() {
    const nome = criandoNome.trim();
    if (!nome) return;
    setBusy(true);
    try {
      const novo = await createDestinador({ nome });
      qc.invalidateQueries({ queryKey: ["destinadores"] });
      await renameDmrLinhasDestinador(uploadId, atual.texto, novo.nome);
      qc.invalidateQueries({ queryKey: ["dmr_linhas", uploadId] });
      toast.success(`Criado e vinculado: ${novo.nome}`);
      setCriando(false);
      setCriandoNome("");
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Resolver destinador da DMR ({idx + 1}/{total})</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="rounded-md border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Texto original na DMR</div>
            <div className="font-medium">{atual.texto}</div>
            <div className="text-xs text-muted-foreground mt-1">{atual.ocorrencias} linha(s)</div>
          </div>

          {!criando ? (
            <>
              <div>
                <Label className="text-xs">Substituir por destinador cadastrado</Label>
                <Select value={escolha} onValueChange={setEscolha}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {destinadores.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}{d.cnpj ? ` — ${formatCNPJ(d.cnpj)}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  disabled={!escolha || busy}
                  onClick={() => {
                    const d = destinadores.find((x) => x.id === escolha);
                    if (d) aplicar(d.nome);
                  }}
                >Substituir</Button>
                <Button variant="outline" onClick={() => { setCriandoNome(atual.texto); setCriando(true); }}>
                  Criar novo destinador
                </Button>
                <Button variant="ghost" onClick={avancar}>Pular</Button>
              </div>
            </>
          ) : (
            <div className="space-y-2 border rounded p-3">
              <Label className="text-xs">Nome do novo destinador</Label>
              <Input value={criandoNome} onChange={(e) => setCriandoNome(e.target.value)} autoFocus />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => setCriando(false)}>Voltar</Button>
                <Button size="sm" disabled={!criandoNome.trim() || busy} onClick={criarECasar}>
                  Criar e vincular
                </Button>
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
