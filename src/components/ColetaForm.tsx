import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listTiposResiduo, listTratamentos, ColetaInput, ALERTA_PESO_KG } from "@/lib/data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Autocomplete } from "@/components/Autocomplete";

type ItemForm = { tipo_residuo_id: string | null; tipo_residuo_nome: string; peso_kg: number | ""; tratamento: string };

type Props = {
  unidadeId: string;
  initial?: Partial<ColetaInput>;
  onSubmit: (input: ColetaInput) => void;
  submitting?: boolean;
};

export function ColetaForm({ unidadeId, initial, onSubmit, submitting }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const { data: tratamentos = [] } = useQuery({ queryKey: ["tratamentos"], queryFn: listTratamentos });

  const tipoOptions = useMemo(() => tipos.map((t) => ({
    value: t.nome,
    label: t.nome,
    sublabel: t.codigo || t.tratamento_padrao,
    searchTokens: [t.codigo ?? "", t.tratamento_padrao],
  })), [tipos]);
  const tratamentoOptions = useMemo(() => tratamentos.map((t) => ({
    value: t.nome,
    label: t.nome,
    sublabel: t.codigo,
    searchTokens: [t.codigo ?? ""],
  })), [tratamentos]);

  const [data, setData] = useState(initial?.data ?? today);
  const [transportador, setTransportador] = useState(initial?.transportador ?? "");
  const [destinador, setDestinador] = useState(initial?.destinador ?? "");
  const [mtr, setMtr] = useState(initial?.mtr ?? "");
  const [pesoEstimado, setPesoEstimado] = useState(initial?.peso_estimado ?? false);
  const [obs, setObs] = useState(initial?.observacoes ?? "");
  const [itens, setItens] = useState<ItemForm[]>(
    initial?.itens?.map((it) => ({ ...it, peso_kg: it.peso_kg })) ?? [{ tipo_residuo_id: null, tipo_residuo_nome: "", peso_kg: "", tratamento: "" }]
  );

  const totalPeso = useMemo(() => itens.reduce((s, it) => s + (Number(it.peso_kg) || 0), 0), [itens]);
  const alertaPeso = itens.some((it) => Number(it.peso_kg) > ALERTA_PESO_KG);

  function updateItem(i: number, patch: Partial<ItemForm>) {
    setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function selecionarTipo(i: number, tipoId: string) {
    const t = tipos.find((x) => x.id === tipoId);
    if (!t) return;
    updateItem(i, { tipo_residuo_id: t.id, tipo_residuo_nome: t.nome, tratamento: itens[i].tratamento || t.tratamento_padrao });
  }
  function selecionarTipoPorNome(i: number, nome: string) {
    const t = tipos.find((x) => x.nome.toLowerCase() === nome.toLowerCase());
    updateItem(i, {
      tipo_residuo_id: t?.id ?? null,
      tipo_residuo_nome: nome,
      tratamento: itens[i].tratamento || (t?.tratamento_padrao ?? ""),
    });
  }
  function addItem() {
    setItens((p) => [...p, { tipo_residuo_id: null, tipo_residuo_nome: "", peso_kg: "", tratamento: "" }]);
  }
  function removeItem(i: number) {
    setItens((p) => p.filter((_, idx) => idx !== i));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (itens.length === 0) return toast.error("Adicione ao menos um item");
    for (const [i, it] of itens.entries()) {
      if (!it.tipo_residuo_nome) return toast.error(`Item ${i + 1}: selecione o tipo de resíduo`);
      if (!it.peso_kg || Number(it.peso_kg) <= 0) return toast.error(`Item ${i + 1}: informe o peso`);
      if (!it.tratamento) return toast.error(`Item ${i + 1}: informe o tratamento`);
    }
    onSubmit({
      unidade_id: unidadeId,
      data,
      transportador: transportador || null,
      destinador: destinador || null,
      mtr: mtr || null,
      peso_estimado: pesoEstimado,
      observacoes: obs || null,
      itens: itens.map((it) => ({
        tipo_residuo_id: it.tipo_residuo_id,
        tipo_residuo_nome: it.tipo_residuo_nome,
        peso_kg: Number(it.peso_kg),
        tratamento: it.tratamento,
      })),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardContent className="p-6 grid gap-4 md:grid-cols-2">
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
          </div>
          <div>
            <Label>MTR (opcional)</Label>
            <Input value={mtr ?? ""} onChange={(e) => setMtr(e.target.value)} placeholder="Número do MTR" />
          </div>
          <div>
            <Label>Transportador</Label>
            <Input value={transportador ?? ""} onChange={(e) => setTransportador(e.target.value)} />
          </div>
          <div>
            <Label>Destinador</Label>
            <Input value={destinador ?? ""} onChange={(e) => setDestinador(e.target.value)} />
          </div>
          <div className="md:col-span-2 flex items-center gap-2 rounded-md bg-warning/10 border border-warning/30 p-3">
            <Checkbox id="pe" checked={pesoEstimado} onCheckedChange={(v) => setPesoEstimado(!!v)} />
            <Label htmlFor="pe" className="cursor-pointer flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning-foreground" />
              Peso estimado (revisar antes de reportar na DMR)
            </Label>
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
          <div className="mb-2 text-sm flex items-center gap-2 text-warning">
            <AlertTriangle className="size-4" /> Algum item tem peso acima de {ALERTA_PESO_KG.toLocaleString("pt-BR")} kg — confira.
          </div>
        )}
        <div className="space-y-3">
          {itens.map((it, i) => (
            <Card key={i}>
              <CardContent className="p-4 grid gap-3 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Label className="text-xs">Tipo de resíduo</Label>
                  <Select value={it.tipo_residuo_id ?? undefined} onValueChange={(v) => selecionarTipo(i, v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
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
                  <Input value={it.tratamento} onChange={(e) => updateItem(i, { tratamento: e.target.value })} placeholder="Ex.: Reciclagem" />
                </div>
                <div className="md:col-span-1 flex items-end justify-end">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={itens.length === 1}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button type="button" variant="outline" className="mt-3" onClick={addItem}><Plus className="size-4 mr-1" /> Adicionar item</Button>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar coleta"}</Button>
      </div>
    </form>
  );
}
