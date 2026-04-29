import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { upsertTratamento, type Tratamento } from "@/lib/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultName?: string;
  onCreated: (t: Tratamento) => void;
};

export function QuickTratamentoDialog({ open, onOpenChange, defaultName, onCreated }: Props) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setNome(defaultName ?? ""); setCodigo(""); }
  }, [open, defaultName]);

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    try {
      const t = await upsertTratamento({ nome: nome.trim(), codigo: codigo.trim() || null });
      qc.invalidateQueries({ queryKey: ["tratamentos"] });
      toast.success("Tratamento cadastrado");
      onCreated(t);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Novo tratamento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Código (opcional)</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || !nome.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
