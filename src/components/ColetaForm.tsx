import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listTiposResiduo, listTratamentos, listTransportadores, listDestinadores,
  listDestinadorResiduos, addDestinadorResiduo,
  ColetaInput, ALERTA_PESO_KG, type Transportador, type Destinador, type TipoResiduo, type Tratamento,
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
import { QuickResiduoDialog } from "@/components/QuickResiduoDialog";
import { QuickTratamentoDialog } from "@/components/QuickTratamentoDialog";

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
  const qc = useQueryClient();
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
  const [residuoDialog, setResiduoDialog] = useState<{ open: boolean; defaultName?: string; lineIndex?: number }>({ open: false });
  const [tratDialog, setTratDialog] = useState<{ open: boolean; defaultName?: string; lineIndex?: number }>({ open: false });

  // Vínculos do destinador atual
  const { data: vinculosDest = [], isLoading: vinculosLoading } = useQuery({
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

  const validIds = useMemo(() => new Set(vinculosDest.map((v) => v.tipo_residuo_id)), [vinculosDest]);
  const destSemVinculos = !!destinadorId && !vinculosLoading && vinculosDest.length === 0;

  // Filtra resíduos de acordo com vínculos do destinador
  const tipoOptions = useMemo(() => {
    const base = (destinadorId && vinculosDest.length > 0)
      ? tipos.filter((t) => validIds.has(t.id))
      : tipos;
    return base.map((t) => ({
      value: t.nome,
      label: t.nome,
      sublabel: t.codigo || t.tratamento_padrao,
      searchTokens: [t.codigo ?? "", t.tratamento_padrao],
    }));
  }, [tipos, destinadorId, vinculosDest, validIds]);

  const totalPeso = useMemo(() => itens.reduce((s, it) => s + (Number(it.peso_kg) || 0), 0), [itens]);
  const alertaPeso = itens.some((it) => Number(it.peso_kg) > ALERTA_PESO_KG);

  // Itens não vinculados ao destinador atual
  const itensNaoVinculados = useMemo(() => {
    if (!destinadorId || vinculosDest.length === 0) return [];
    return itens.filter((it) => it.tipo_residuo_id && !validIds.has(it.tipo_residuo_id));
  }, [itens, destinadorId, vinculosDest, validIds]);

  function updateItem(i: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function selecionarTipo(i: number, value: string, optionPicked: boolean) {
    const t = tipos.find((x) => x.nome.toLowerCase() === value.toLowerCase());
    if (optionPicked && t) {
      // Sobrescreve tratamento: vínculo do destinador > tratamento padrão do tipo
      const v = destinadorId ? vinculosDest.find((x) => x.tipo_residuo_id === t.id) : undefined;
      const novoTrat = v?.tratamento || t.tratamento_padrao || "";
      updateItem(i, { tipo_residuo_id: t.id, tipo_residuo_nome: t.nome, tratamento: novoTrat });
    } else {
      // Apenas digitando — mantém tratamento atual
      updateItem(i, { tipo_residuo_id: t?.id ?? null, tipo_residuo_nome: value });
    }
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
    if (itens.length === 0) { toast.error("Adicione ao menos um item"); return null; }
    for (const [i, it] of itens.entries()) {
      if (!it.tipo_residuo_nome) { toast.error(`Item ${i + 1}: selecione o tipo de resíduo`); return null; }
      // Peso pode ficar vazio (será 0 → entra em pendência "Sem peso"), mas se preenchido deve ser positivo
      if (it.peso_kg !== "" && Number(it.peso_kg) < 0) { toast.error(`Item ${i + 1}: peso inválido`); return null; }
      if (!it.tratamento) { toast.error(`Item ${i + 1}: informe o tratamento`); return null; }
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
      itens: itens.map((it) => ({
        tipo_residuo_id: it.tipo_residuo_id,
        tipo_residuo_nome: it.tipo_residuo_nome,
        peso_kg: it.peso_kg === "" ? 0 : Number(it.peso_kg),
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

  async function adicionarVinculosFaltantes() {
    if (!destinadorId) return;
    const alvo = itensNaoVinculados.filter((it) => it.tipo_residuo_id && it.tratamento);
    if (alvo.length === 0) { toast.error("Itens sem tratamento informado"); return; }
    try {
      await Promise.all(alvo.map((it) => addDestinadorResiduo(destinadorId, it.tipo_residuo_id!, it.tratamento)));
      qc.invalidateQueries({ queryKey: ["destinador_residuos", destinadorId] });
      toast.success(`${alvo.length} vínculo(s) adicionado(s)`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao adicionar vínculo");
    }
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
              strictOnBlur
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

      {itensNaoVinculados.length > 0 && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 flex items-start gap-3">
          <AlertTriangle className="size-4 text-warning-foreground mt-0.5 shrink-0" />
          <div className="flex-1 text-sm">
            <div className="font-medium">Destinador {destinadorNome} não está vinculado a:</div>
            <div className="text-muted-foreground">
              {itensNaoVinculados.map((it) => it.tipo_residuo_nome).join(", ")}
            </div>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={adicionarVinculosFaltantes}>
            Adicionar vínculo
          </Button>
        </div>
      )}

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
        {totalPeso === 0 && (
          <div className="mb-2 text-sm flex items-center gap-2 text-warning-foreground">
            <Info className="size-4" /> Peso não informado — a coleta entrará em pendências como {pesoEstimado ? '"Peso estimado sem peso"' : '"Sem peso"'}.
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
                      onChange={(v, opt) => selecionarTipo(i, opt?.label ?? v, !!opt)}
                      options={tipoOptions}
                      placeholder="Digite para buscar..."
                      onCreate={(name) => setResiduoDialog({ open: true, defaultName: name, lineIndex: i })}
                      createLabel={(v) => `Adicionar resíduo "${v}"`}
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
                      placeholder="0"
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Label className="text-xs">Tratamento</Label>
                    <Autocomplete
                      value={it.tratamento}
                      onChange={(v) => updateItem(i, { tratamento: v })}
                      options={tratamentoOptions}
                      placeholder="Ex.: Reciclagem"
                      onCreate={(name) => setTratDialog({ open: true, defaultName: name, lineIndex: i })}
                      createLabel={(v) => `Adicionar tratamento "${v}"`}
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
          <Button type="button" variant="outline" disabled={submitting} onClick={(e) => submit(e as any, true)}>
            Salvar e adicionar nova coleta
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
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
      <QuickResiduoDialog
        open={residuoDialog.open}
        defaultName={residuoDialog.defaultName}
        defaultDestinadorId={destinadorId}
        onOpenChange={(o) => setResiduoDialog((s) => ({ ...s, open: o }))}
        onCreated={(tipo: TipoResiduo) => {
          const idx = residuoDialog.lineIndex;
          if (idx === undefined) return;
          updateItem(idx, {
            tipo_residuo_id: tipo.id,
            tipo_residuo_nome: tipo.nome,
            tratamento: tipo.tratamento_padrao || "",
          });
        }}
      />
      <QuickTratamentoDialog
        open={tratDialog.open}
        defaultName={tratDialog.defaultName}
        onOpenChange={(o) => setTratDialog((s) => ({ ...s, open: o }))}
        onCreated={(t: Tratamento) => {
          const idx = tratDialog.lineIndex;
          if (idx === undefined) return;
          updateItem(idx, { tratamento: t.nome });
        }}
      />
    </form>
  );
}
