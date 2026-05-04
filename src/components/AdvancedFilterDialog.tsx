import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save, BookmarkCheck } from "lucide-react";
import {
  type FiltroAvancado,
  type FiltroRegra,
  type FiltroCampo,
  type FiltroOperador,
  CAMPOS,
  OPERADORES,
  OP_LABEL,
} from "@/lib/coletas-filtros";
import { listFiltrosSalvos, createFiltroSalvo, deleteFiltroSalvo } from "@/lib/filtros-salvos";
import { toast } from "sonner";

function novaRegra(): FiltroRegra {
  return { id: Math.random().toString(36).slice(2, 9), campo: "mtr", operador: "contem", valor: "" };
}

export function AdvancedFilterDialog({
  open,
  onOpenChange,
  filtro,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filtro: FiltroAvancado | null;
  onApply: (f: FiltroAvancado | null) => void;
}) {
  const [draft, setDraft] = useState<FiltroAvancado>(() => filtro ?? { combinador: "AND", regras: [novaRegra()] });
  const [salvarOpen, setSalvarOpen] = useState(false);
  const [nome, setNome] = useState("");

  useEffect(() => {
    if (open) setDraft(filtro ?? { combinador: "AND", regras: [novaRegra()] });
  }, [open, filtro]);

  const qc = useQueryClient();
  const salvarMut = useMutation({
    mutationFn: () => createFiltroSalvo({ nome, regras: draft }),
    onSuccess: () => {
      toast.success("Filtro salvo");
      setSalvarOpen(false);
      setNome("");
      qc.invalidateQueries({ queryKey: ["filtros-salvos"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  function tipoCampo(c: FiltroCampo) {
    return CAMPOS.find((x) => x.v === c)?.tipo ?? "text";
  }

  function updateRegra(id: string, patch: Partial<FiltroRegra>) {
    setDraft((d) => ({
      ...d,
      regras: d.regras.map((r) =>
        r.id === id ? { ...r, ...patch, ...(patch.campo ? { operador: OPERADORES[tipoCampo(patch.campo)][0] } : {}) } : r
      ),
    }));
  }
  function removeRegra(id: string) {
    setDraft((d) => ({ ...d, regras: d.regras.filter((r) => r.id !== id) }));
  }
  function addRegra() {
    setDraft((d) => ({ ...d, regras: [...d.regras, novaRegra()] }));
  }

  function inputTipo(r: FiltroRegra): "text" | "number" | "date" {
    const t = tipoCampo(r.campo);
    if (t === "number") return "number";
    if (t === "date") return "date";
    return "text";
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Filtro avançado</SheetTitle>
            <SheetDescription>Combine regras para refinar a lista de coletas.</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Combinar com</Label>
              <Select value={draft.combinador} onValueChange={(v) => setDraft((d) => ({ ...d, combinador: v as any }))}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">E (todas)</SelectItem>
                  <SelectItem value="OR">OU (qualquer)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {draft.regras.map((r) => {
              const ops = OPERADORES[tipoCampo(r.campo)];
              const sem = r.operador === "vazio" || r.operador === "nao_vazio";
              return (
                <div key={r.id} className="border rounded p-3 space-y-2 bg-muted/30">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={r.campo} onValueChange={(v) => updateRegra(r.id, { campo: v as FiltroCampo })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CAMPOS.map((c) => <SelectItem key={c.v} value={c.v}>{c.l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={r.operador} onValueChange={(v) => updateRegra(r.id, { operador: v as FiltroOperador })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ops.map((o) => <SelectItem key={o} value={o}>{OP_LABEL[o]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  {!sem && r.campo === "status" ? (
                    <Select value={r.valor ?? ""} onValueChange={(v) => updateRegra(r.id, { valor: v })}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ok">OK</SelectItem>
                        <SelectItem value="sem_mtr">Sem MTR</SelectItem>
                        <SelectItem value="dmr_manual">Incluir na DMR</SelectItem>
                        <SelectItem value="peso_estimado">Peso estimado</SelectItem>
                        <SelectItem value="sem_peso">Sem peso</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : !sem && r.operador === "entre" ? (
                    <div className="flex items-center gap-2">
                      <Input type={inputTipo(r)} value={r.valor ?? ""} onChange={(e) => updateRegra(r.id, { valor: e.target.value })} placeholder="De" className="h-8" />
                      <span className="text-xs">a</span>
                      <Input type={inputTipo(r)} value={r.valor2 ?? ""} onChange={(e) => updateRegra(r.id, { valor2: e.target.value })} placeholder="Até" className="h-8" />
                    </div>
                  ) : !sem ? (
                    <Input type={inputTipo(r)} value={r.valor ?? ""} onChange={(e) => updateRegra(r.id, { valor: e.target.value })} placeholder="Valor" className="h-8" />
                  ) : null}
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => removeRegra(r.id)}>
                      <Trash2 className="size-3 mr-1" /> Remover
                    </Button>
                  </div>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addRegra}>
              <Plus className="size-4 mr-1" /> Adicionar regra
            </Button>
          </div>

          <div className="flex items-center justify-between mt-6 pt-4 border-t">
            <Button variant="ghost" size="sm" onClick={() => { onApply(null); onOpenChange(false); }}>
              Limpar filtro
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSalvarOpen(true)}>
                <Save className="size-4 mr-1" /> Salvar filtro
              </Button>
              <Button size="sm" onClick={() => { onApply(draft); onOpenChange(false); }}>
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={salvarOpen} onOpenChange={setSalvarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Salvar filtro</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Sem MTR no 2º trimestre" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSalvarOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvarMut.mutate()} disabled={!nome.trim() || salvarMut.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SavedFiltersDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (f: FiltroAvancado) => void;
}) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["filtros-salvos"], queryFn: () => listFiltrosSalvos("coletas"), enabled: open });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteFiltroSalvo(id),
    onSuccess: () => { toast.success("Filtro removido"); qc.invalidateQueries({ queryKey: ["filtros-salvos"] }); },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><BookmarkCheck className="size-4" /> Filtros salvos</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>
        ) : data.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Nenhum filtro salvo.</div>
        ) : (
          <div className="border rounded divide-y">
            {data.map((f) => (
              <div key={f.id} className="flex items-center gap-2 p-2 text-sm">
                <button className="flex-1 text-left hover:underline" onClick={() => { onPick(f.regras); onOpenChange(false); }}>
                  {f.nome} <span className="text-xs text-muted-foreground">({f.regras.regras.length} regra(s))</span>
                </button>
                <Button size="sm" variant="ghost" onClick={() => delMut.mutate(f.id)}>
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
