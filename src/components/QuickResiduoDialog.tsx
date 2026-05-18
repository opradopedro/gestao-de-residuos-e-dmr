import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  upsertTipoResiduo, listTratamentos, listDestinadores, addDestinadorResiduo,
  type TipoResiduo,
} from "@/lib/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Autocomplete } from "@/components/Autocomplete";
import { toast } from "sonner";
import { normalizeCodigoIbama, formatCodigoIbama } from "@/lib/ibama";
import { formatCNPJ } from "@/lib/cnpj";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultName?: string;
  defaultDestinadorId?: string | null;
  onCreated: (tipo: TipoResiduo) => void;
};

export function QuickResiduoDialog({ open, onOpenChange, defaultName, defaultDestinadorId, onCreated }: Props) {
  const qc = useQueryClient();
  const { data: tratamentos = [] } = useQuery({ queryKey: ["tratamentos"], queryFn: listTratamentos });
  const { data: destinadores = [] } = useQuery({ queryKey: ["destinadores"], queryFn: listDestinadores });

  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [tratamento, setTratamento] = useState("");
  const [destSelecionados, setDestSelecionados] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(defaultName ?? "");
      setCodigo("");
      setTratamento("");
      setDestSelecionados(new Set(defaultDestinadorId ? [defaultDestinadorId] : []));
    }
  }, [open, defaultName, defaultDestinadorId]);

  const tratOpts = useMemo(
    () => tratamentos.map((t) => ({ value: t.nome, label: t.nome, sublabel: t.codigo, searchTokens: [t.codigo ?? ""] })),
    [tratamentos]
  );

  function toggleDest(id: string) {
    setDestSelecionados((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    if (!tratamento.trim()) { toast.error("Informe o tratamento padrão"); return; }
    setSaving(true);
    try {
      const tipo = await upsertTipoResiduo({
        nome: nome.trim(),
        codigo: normalizeCodigoIbama(codigo) || null,
        tratamento_padrao: tratamento.trim(),
      });
      const ids = Array.from(destSelecionados);
      if (ids.length > 0) {
        await Promise.all(ids.map((did) => addDestinadorResiduo(did, tipo.id, tratamento.trim())));
      }
      qc.invalidateQueries({ queryKey: ["tipos_residuo"] });
      qc.invalidateQueries({ queryKey: ["destinador_residuos"] });
      toast.success("Resíduo cadastrado");
      onCreated(tipo);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Novo resíduo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Código IBAMA</Label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: 01 01 19" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Tratamento padrão</Label>
            <Autocomplete
              value={tratamento}
              onChange={(v) => setTratamento(v)}
              options={tratOpts}
              placeholder="Ex.: Reciclagem"
            />
          </div>
          <div className="border-t pt-3">
            <Label className="text-xs">Vincular a destinadores (opcional)</Label>
            <div className="mt-2 max-h-56 overflow-auto rounded-md border divide-y">
              {destinadores.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground">Nenhum destinador cadastrado.</div>
              ) : destinadores.map((d) => (
                <label key={d.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-accent/50">
                  <Checkbox checked={destSelecionados.has(d.id)} onCheckedChange={() => toggleDest(d.id)} />
                  <span className="text-sm">{d.nome}</span>
                  {d.cnpj && <span className="text-xs text-muted-foreground ml-auto">{d.cnpj}</span>}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || !nome.trim() || !tratamento.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
