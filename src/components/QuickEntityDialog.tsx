import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createTransportador, createDestinador, listTiposResiduo, listTratamentos,
  listDestinadorResiduos, setDestinadorResiduos, type Transportador, type Destinador,
} from "@/lib/data";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Autocomplete } from "@/components/Autocomplete";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { formatCNPJ, isValidCNPJ, normalizeCNPJ } from "@/lib/cnpj";

type Vinculo = { tipo_residuo_id: string; tipo_residuo_nome: string; tratamento: string };

type Props =
  | {
      kind: "transportador";
      open: boolean;
      onOpenChange: (o: boolean) => void;
      defaultName?: string;
      onCreated: (t: Transportador) => void;
    }
  | {
      kind: "destinador";
      open: boolean;
      onOpenChange: (o: boolean) => void;
      defaultName?: string;
      destinadorId?: string; // edit mode
      onCreated: (d: Destinador) => void;
    };

export function QuickEntityDialog(props: Props) {
  const { kind, open, onOpenChange, defaultName } = props;
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [saving, setSaving] = useState(false);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);

  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo, enabled: kind === "destinador" });
  const { data: tratamentos = [] } = useQuery({ queryKey: ["tratamentos"], queryFn: listTratamentos, enabled: kind === "destinador" });
  const editingId = kind === "destinador" ? (props as any).destinadorId : undefined;
  const { data: vinculosExistentes = [] } = useQuery({
    queryKey: ["destinador_residuos", editingId],
    queryFn: () => listDestinadorResiduos(editingId!),
    enabled: kind === "destinador" && !!editingId,
  });

  useEffect(() => {
    if (open) {
      setNome(defaultName ?? "");
      setCnpj("");
      setVinculos([]);
    }
  }, [open, defaultName]);

  useEffect(() => {
    if (kind === "destinador" && vinculosExistentes.length > 0 && tipos.length > 0) {
      setVinculos(
        vinculosExistentes.map((v) => {
          const t = tipos.find((x) => x.id === v.tipo_residuo_id);
          return { tipo_residuo_id: v.tipo_residuo_id, tipo_residuo_nome: t?.nome ?? "(?)", tratamento: v.tratamento };
        })
      );
    }
  }, [vinculosExistentes, tipos, kind]);

  const tipoOpts = useMemo(
    () => tipos.map((t) => ({ value: t.id, label: t.nome, sublabel: t.codigo, searchTokens: [t.codigo ?? ""] })),
    [tipos]
  );
  const tratOpts = useMemo(
    () => tratamentos.map((t) => ({ value: t.nome, label: t.nome, sublabel: t.codigo, searchTokens: [t.codigo ?? ""] })),
    [tratamentos]
  );

  function addVinculo() {
    setVinculos((p) => [...p, { tipo_residuo_id: "", tipo_residuo_nome: "", tratamento: "" }]);
  }

  const cnpjNorm = normalizeCNPJ(cnpj);
  const cnpjInvalido = cnpjNorm.length > 0 && !isValidCNPJ(cnpjNorm);

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    if (cnpjInvalido) { toast.error("CNPJ inválido"); return; }
    setSaving(true);
    try {
      if (kind === "transportador") {
        const t = await createTransportador({ nome: nome.trim(), cnpj: cnpjNorm || null });
        qc.invalidateQueries({ queryKey: ["transportadores"] });
        toast.success("Transportador cadastrado");
        props.onCreated(t);
      } else {
        const d = await createDestinador({ nome: nome.trim(), cnpj: cnpjNorm || null });
        const validos = vinculos.filter((v) => v.tipo_residuo_id && v.tratamento.trim());
        if (validos.length > 0) {
          await setDestinadorResiduos(d.id, validos.map((v) => ({ tipo_residuo_id: v.tipo_residuo_id, tratamento: v.tratamento })));
        }
        qc.invalidateQueries({ queryKey: ["destinadores"] });
        qc.invalidateQueries({ queryKey: ["destinador_residuos"] });
        toast.success("Destinador cadastrado");
        (props as any).onCreated(d);
      }
      onOpenChange(false);
    } catch (e: any) {
      if (e?.code === "DUP_CNPJ" && e?.existing) {
        toast.error(e.message, {
          action: { label: "Ver existente", onClick: () => {
            (props as any).onCreated(e.existing);
            onOpenChange(false);
          }},
        });
      } else {
        toast.error(e.message ?? "Erro ao salvar");
      }
    } finally {
      setSaving(false);
    }
  }

  const title = kind === "transportador" ? "Novo transportador" : "Novo destinador";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">CNPJ</Label>
            <Input
              value={cnpj.length === 14 && /^\d+$/.test(cnpj) ? formatCNPJ(cnpj) : cnpj}
              onChange={(e) => setCnpj(normalizeCNPJ(e.target.value))}
              placeholder="00.000.000/0000-00"
              maxLength={18}
            />
            {cnpjInvalido && <div className="text-xs text-destructive mt-1">CNPJ inválido (verifique os dígitos)</div>}
          </div>

          {kind === "destinador" && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Resíduos aceitos</Label>
                <Button type="button" size="sm" variant="ghost" onClick={addVinculo}><Plus className="size-3.5 mr-1" /> Adicionar</Button>
              </div>
              <div className="space-y-2 max-h-60 overflow-auto">
                {vinculos.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Nenhum resíduo vinculado. Você poderá adicionar depois.</div>
                ) : vinculos.map((v, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <Autocomplete
                        value={v.tipo_residuo_nome}
                        onChange={(val, opt) => setVinculos((p) => p.map((x, idx) => idx === i ? {
                          ...x,
                          tipo_residuo_nome: opt?.label ?? val,
                          tipo_residuo_id: opt?.value ?? "",
                          tratamento: x.tratamento || (tipos.find((t) => t.id === opt?.value)?.tratamento_padrao ?? ""),
                        } : x))}
                        options={tipoOpts}
                        placeholder="Resíduo"
                      />
                    </div>
                    <div className="col-span-6">
                      <Autocomplete
                        value={v.tratamento}
                        onChange={(val) => setVinculos((p) => p.map((x, idx) => idx === i ? { ...x, tratamento: val } : x))}
                        options={tratOpts}
                        placeholder="Tratamento"
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setVinculos((p) => p.filter((_, idx) => idx !== i))}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving || !nome.trim() || cnpjInvalido}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
