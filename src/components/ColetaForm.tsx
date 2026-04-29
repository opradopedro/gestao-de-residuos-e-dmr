import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  listTiposResiduo, listTratamentos, listTransportadores, listDestinadores,
  listDestinadorResiduos, addDestinadorResiduo,
  ColetaInput, ALERTA_PESO_KG, type Transportador, type Destinador,
} from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Autocomplete } from "@/components/Autocomplete";
import { QuickEntityDialog } from "@/components/QuickEntityDialog";

type ItemForm = { tipo_residuo_id: string | null; tipo_residuo_nome: string; peso_kg: number | ""; tratamento: string };

type Props = {
  unidadeId: string;
  initial?: Partial<ColetaInput>;
  onSubmit: (input: ColetaInput, opts?: { addAnother?: boolean }) => void;
  submitting?: boolean;
  showAddAnother?: boolean;
};

export function ColetaForm({ unidadeId, initial, onSubmit, submitting, showAddAnother }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const { data: tratamentos = [] } = useQuery({ queryKey: ["tratamentos"], queryFn: listTratamentos });
  const { data: transportadores = [] } = useQuery({ queryKey: ["transportadores"], queryFn: listTransportadores });
  const { data: destinadores = [] } = useQuery({ queryKey: ["destinadores"], queryFn: listDestinadores });

  const [data, setData] = useState(initial?.data ?? today);
  const [transportadorId, setTransportadorId] = useState<string | null>(initial?.transportador_id ?? null);
  const [transportadorNome, setTransportadorNome] = useState(initial?.transportador ?? "");
  const [destinadorId, setDestinadorId] = useState<string | null>(initial?.destinador_id ?? null);
  const [destinadorNome, setDestinadorNome] = useState(initial?.destinador ?? "");
  const [mtr, setMtr] = useState(initial?.mtr ?? "");
  const [pesoEstimado, setPesoEstimado] = useState(initial?.peso_estimado ?? false);
  const [dmrManual, setDmrManual] = useState(initial?.dmr_manual ?? false);
  const [obs, setObs] = useState(initial?.observacoes ?? "");
  const [itens, setItens] = useState<ItemForm[]>(
    initial?.itens?.map((it) => ({ ...it, peso_kg: it.peso_kg })) ?? [
      { tipo_residuo_id: null, tipo_residuo_nome: "", peso_kg: "", tratamento: "" },
    ]
  );

  // Modais de criação rápida
  const [transpDialog, setTranspDialog] = useState<{ open: boolean; defaultName?: string }>({ open: false });
  const [destDialog, setDestDialog] = useState<{ open: boolean; defaultName?: string }>({ open: false });

  // Vínculos do destinador atual
  const { data: vinculosDest = [] } = useQuery({
    queryKey: ["destinador_residuos", destinadorId],
    queryFn: () => listDestinadorResiduos(destinadorId!),
    enabled: !!destinadorId,
  });

  const transpOptions = useMemo(
    () => transportadores.map((t) => ({ value: t.id, label: t.nome, sublabel: t.cnpj, searchTokens: [t.cnpj ?? ""] })),
    [transportadores]
  );
  const destOptions = useMemo(
    () => destinadores.map((d) => ({ value: d.id, label: d.nome, sublabel: d.cnpj, searchTokens: [d.cnpj ?? ""] })),
    [destinadores]
  );
  const tratamentoOptions = useMemo(
    () => tratamentos.map((t) => ({ value: t.nome, label: t.nome, sublabel: t.codigo, searchTokens: [t.codigo ?? ""] })),
    [tratamentos]
  );

  // Filtro de resíduos baseado nos vínculos do destinador (item 9 — "Mostrar todos + aviso")
  const tipoOptions = useMemo(() => {
    return tipos.map((t) => ({
      value: t.nome,
      label: t.nome,
      sublabel: t.codigo || t.tratamento_padrao,
      searchTokens: [t.codigo ?? "", t.tratamento_padrao],
    }));
  }, [tipos]);

  const destSemVinculos = !!destinadorId && vinculosDest.length === 0;
  const validIds = useMemo(() => new Set(vinculosDest.map((v) => v.tipo_residuo_id)), [vinculosDest]);

  const totalPeso = useMemo(() => itens.reduce((s, it) => s + (Number(it.peso_kg) || 0), 0), [itens]);
  const alertaPeso = itens.some((it) => Number(it.peso_kg) > ALERTA_PESO_KG);

  function updateItem(i: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function selecionarTipoPorNome(i: number, nome: string) {
    const t = tipos.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
    let tratamento = itens[i].tratamento;
    // Tratamento sugerido pelo vínculo do destinador, se existir
    if (t && destinadorId) {
      const v = vinculosDest.find((x) => x.tipo_residuo_id === t.id);
      if (v) tratamento = tratamento || v.tratamento;
    }
    updateItem(i, {
      tipo_residuo_id: t?.id ?? null,
      tipo_residuo_nome: nome,
      tratamento: tratamento || (t?.tratamento_padrao ?? ""),
    });
  }
  function addItem() {
    setItens((p) => [...p, { tipo_residuo_id: null, tipo_residuo_nome: "", peso_kg: "", tratamento: "" }]);
  }
  function removeItem(i: number) {
    setItens((p) => p.filter((_, idx) => idx !== i));
  }

  function reset() {
    setData(today);
    setTransportadorId(null); setTransportadorNome("");
    setDestinadorId(null); setDestinadorNome("");
    setMtr(""); setPesoEstimado(false); setDmrManual(false); setObs("");
    setItens([{ tipo_residuo_id: null, tipo_residuo_nome: "", peso_kg: "", tratamento: "" }]);
  }

  function build(): ColetaInput | null {
    // Permite salvar coleta sem peso (vira pendência "Sem peso")
    const itensValidos = itens.filter((it) => it.tipo_residuo_nome && Number(it.peso_kg) > 0);
    for (const [i, it] of itens.entries()) {
      // Se preencheu tipo OU peso, exige consistência
      const temAlgo = !!it.tipo_residuo_nome || (it.peso_kg !== "" && Number(it.peso_kg) > 0);
      if (!temAlgo) continue;
      if (!it.tipo_residuo_nome) { toast.error(`Item ${i + 1}: selecione o tipo de resíduo`); return null; }
      if (Number(it.peso_kg) > 0 && !it.tratamento) { toast.error(`Item ${i + 1}: informe o tratamento`); return null; }
    }
    return {
      unidade_id: unidadeId,
      data,
      transportador: transportadorNome || null,
      destinador: destinadorNome || null,
      transportador_id: transportadorId,
      destinador_id: destinadorId,
      mtr: dmrManual ? null : (mtr || null),
      peso_estimado: pesoEstimado,
      dmr_manual: dmrManual,
      observacoes: obs || null,
      itens: itensValidos.map((it) => ({
        tipo_residuo_id: it.tipo_residuo_id,
        tipo_residuo_nome: it.tipo_residuo_nome,
        peso_kg: Number(it.peso_kg),
        tratamento: it.tratamento,
      })),
    };
  }

  function submit(e: React.FormEvent, addAnother = false) {
    e.preventDefault();
    const built = build();
    if (!built) return;
    onSubmit(built, { addAnother });
    if (addAnother) reset();
  }

  // Auto-cria vínculo destinador↔resíduo silenciosamente quando o usuário escolhe um par novo
  async function ensureVinculo(item: ItemForm) {
    if (!destinadorId || !item.tipo_residuo_id || !item.tratamento) return;
    if (validIds.has(item.tipo_residuo_id)) return;
    try { await addDestinadorResiduo(destinadorId, item.tipo_residuo_id, item.tratamento); } catch {}
  }

  return (
    <form onSubmit={(e) => submit(e, false)} className="space-y-6">
      <Card>
        <CardContent className="p-6 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <div>
            <Label>MTR {dmrManual && <span className="text-xs text-muted-foreground">(N/A — DMR manual)</span>}</Label>
            <Input
              value={dmrManual ? "" : (mtr ?? "")}
              onChange={(e) => setMtr(e.target.value)}
              placeholder={dmrManual ? "Não aplicável" : "Número do MTR"}
              disabled={dmrManual}
            />
          </div>
          <div>
            <Label>Transportador</Label>
            <Autocomplete
              value={transportadorNome}
              onChange={(v, opt) => {
                setTransportadorNome(opt?.label ?? v);
                setTransportadorId(opt?.value ?? null);
              }}
              options={transpOptions}
              placeholder="Buscar transportador..."
              onCreate={(name) => setTranspDialog({ open: true, defaultName: name })}
            />
          </div>
          <div>
            <Label>Destinador</Label>
            <Autocomplete
              value={destinadorNome}
              onChange={(v, opt) => {
                setDestinadorNome(opt?.label ?? v);
                setDestinadorId(opt?.value ?? null);
              }}
              options={destOptions}
              placeholder="Buscar destinador..."
              onCreate={(name) => setDestDialog({ open: true, defaultName: name })}
            />
            {destSemVinculos && (
              <div className="mt-1 text-xs flex items-center gap-1 text-warning-foreground">
                <Info className="size-3" /> Destinador sem resíduos vinculados — todos serão exibidos.
              </div>
            )}
          </div>

          <div className="md:col-span-2 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 rounded-md bg-warning/10 border border-warning/30 p-3">
              <Checkbox id="pe" checked={pesoEstimado} onCheckedChange={(v) => setPesoEstimado(!!v)} />
              <Label htmlFor="pe" className="cursor-pointer flex items-center gap-2 text-sm">
                <AlertTriangle className="size-4 text-warning-foreground" />
                Emitido com peso estimado
              </Label>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-accent/30 border border-border p-3">
              <Checkbox id="dm" checked={dmrManual} onCheckedChange={(v) => setDmrManual(!!v)} />
              <Label htmlFor="dm" className="cursor-pointer text-sm">
                Incluir pesagem manualmente na DMR
                <div className="text-xs text-muted-foreground">Sem MTR (operação) — não é pendência, mas conta como risco.</div>
              </Label>
            </div>
          </div>

          <div className="md:col-span-2">
            <Label>Observações</Label>
            <Textarea value={obs ?? ""} onChange={(e) => setObs(e.target.value)} rows={3} />
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium">Itens da coleta</h3>
          <div className="text-sm text-muted-foreground">Total: <span className="font-medium text-foreground">{totalPeso.toLocaleString("pt-BR")} kg</span></div>
        </div>
        {alertaPeso && (
          <div className="mb-2 text-sm flex items-center gap-2 text-warning-foreground">
            <AlertTriangle className="size-4" /> Algum item tem peso acima de {ALERTA_PESO_KG.toLocaleString("pt-BR")} kg — confira.
          </div>
        )}
        <div className="space-y-3">
          {itens.map((it, i) => {
            const naoVinculado = !!destinadorId && vinculosDest.length > 0 && !!it.tipo_residuo_id && !validIds.has(it.tipo_residuo_id);
            return (
              <Card key={i}>
                <CardContent className="p-4 grid gap-3 md:grid-cols-12">
                  <div className="md:col-span-4">
                    <Label className="text-xs">Tipo de resíduo</Label>
                    <Autocomplete
                      value={it.tipo_residuo_nome}
                      onChange={(v) => selecionarTipoPorNome(i, v)}
                      options={tipoOptions}
                      placeholder="Digite para buscar..."
                    />
                    {naoVinculado && (
                      <div className="mt-1 text-[11px] text-warning-foreground flex items-center gap-1">
                        <Info className="size-3" /> Não consta na lista do destinador
                      </div>
                    )}
                  </div>
                  <div className="md:col-span-3">
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input
                      type="number" step="0.001" min={0}
                      value={it.peso_kg}
                      onChange={(e) => updateItem(i, { peso_kg: e.target.value === "" ? "" : Number(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label className="text-xs">Tratamento</Label>
                    <Autocomplete
                      value={it.tratamento}
                      onChange={(v) => updateItem(i, { tratamento: v })}
                      options={tratamentoOptions}
                      placeholder="Ex.: Reciclagem"
                    />
                  </div>
                  <div className="md:col-span-1 flex items-end justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={itens.length === 1}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Button type="button" variant="outline" className="mt-3" onClick={addItem}><Plus className="size-4 mr-1" /> Adicionar item</Button>
      </div>

      <div className="flex justify-end gap-2">
        {showAddAnother && (
          <Button type="button" variant="outline" disabled={submitting} onClick={(e) => { itens.forEach(ensureVinculo); submit(e as any, true); }}>
            Salvar e adicionar nova coleta
          </Button>
        )}
        <Button type="submit" disabled={submitting} onClick={() => itens.forEach(ensureVinculo)}>
          {submitting ? "Salvando..." : "Salvar coleta"}
        </Button>
      </div>

      <QuickEntityDialog
        kind="transportador"
        open={transpDialog.open}
        defaultName={transpDialog.defaultName}
        onOpenChange={(o) => setTranspDialog((s) => ({ ...s, open: o }))}
        onCreated={(t: Transportador) => { setTransportadorId(t.id); setTransportadorNome(t.nome); }}
      />
      <QuickEntityDialog
        kind="destinador"
        open={destDialog.open}
        defaultName={destDialog.defaultName}
        onOpenChange={(o) => setDestDialog((s) => ({ ...s, open: o }))}
        onCreated={(d: Destinador) => { setDestinadorId(d.id); setDestinadorNome(d.nome); }}
      />
    </form>
  );
}
