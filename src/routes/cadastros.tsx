import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listUnidades, createUnidade, updateUnidade, deleteUnidade,
  listTiposResiduo, upsertTipoResiduo, deleteTipoResiduo, bulkInsertTiposResiduo,
  listTratamentos, upsertTratamento, deleteTratamento, bulkInsertTratamentos,
  listTransportadores, createTransportador, updateTransportador, deleteTransportador,
  listDestinadores, createDestinador, updateDestinador, deleteDestinador,
  listDestinadorResiduos, setDestinadorResiduos,
  type TipoResiduo, type Tratamento, type Transportador, type Destinador, type Unidade,
} from "@/lib/data";
import { PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Plus, Upload, Pencil } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { parseCsv } from "@/lib/csv";

export const Route = createFileRoute("/cadastros")({
  head: () => ({ meta: [{ title: "Cadastros — DMR" }] }),
  component: Cadastros,
});

function Cadastros() {
  return (
    <div className="p-6 max-w-5xl">
      <PageHeader title="Cadastros" description="Gerencie unidades, resíduos, tratamentos, transportadores e destinadores." />
      <Tabs defaultValue="unidades">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="residuos">Tipos de resíduo</TabsTrigger>
          <TabsTrigger value="tratamentos">Tratamentos</TabsTrigger>
          <TabsTrigger value="transportadores">Transportadores</TabsTrigger>
          <TabsTrigger value="destinadores">Destinadores</TabsTrigger>
        </TabsList>
        <TabsContent value="unidades"><UnidadesTab /></TabsContent>
        <TabsContent value="residuos"><ResiduosTab /></TabsContent>
        <TabsContent value="tratamentos"><TratamentosTab /></TabsContent>
        <TabsContent value="transportadores"><TransportadoresTab /></TabsContent>
        <TabsContent value="destinadores"><DestinadoresTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ Unidades ============
function UnidadesTab() {
  const qc = useQueryClient();
  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const [nome, setNome] = useState("");
  const [edit, setEdit] = useState<Unidade | null>(null);
  const mutAdd = useMutation({
    mutationFn: () => createUnidade(nome.trim()),
    onSuccess: () => { setNome(""); qc.invalidateQueries({ queryKey: ["unidades"] }); toast.success("Unidade criada"); },
    onError: (e: any) => toast.error(e.message),
  });
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteUnidade(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["unidades"] }); toast.success("Unidade removida"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) mutAdd.mutate(); }}>
          <div className="flex-1">
            <Label className="text-xs">Nova unidade</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Hospital Central" />
          </div>
          <Button type="submit" className="self-end" disabled={!nome.trim() || mutAdd.isPending}><Plus className="size-4 mr-1" />Adicionar</Button>
        </form>
        <div className="divide-y border rounded-md">
          {unidades.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhuma unidade.</div> : unidades.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3">
              <span>{u.nome}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(u)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${u.nome}? Todas as coletas dela serão excluídas.`)) mutDel.mutate(u.id); }}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <UnidadeEditDialog unidade={edit} onClose={() => setEdit(null)} />
      </CardContent>
    </Card>
  );
}

function UnidadeEditDialog({ unidade, onClose }: { unidade: Unidade | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  useEffect(() => { setNome(unidade?.nome ?? ""); }, [unidade]);
  const mut = useMutation({
    mutationFn: () => updateUnidade(unidade!.id, nome.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["unidades"] }); toast.success("Atualizado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={!!unidade} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar unidade</DialogTitle></DialogHeader>
        <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ CSV uploader ============
function CsvUploader({ onParsed, hint }: { onParsed: (rows: Record<string, string>[]) => void; hint: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="rounded-md border bg-muted/30 p-3 flex items-center justify-between gap-3">
      <div className="text-xs text-muted-foreground">{hint}</div>
      <div>
        <input
          ref={ref} type="file" accept=".csv,text/csv" className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            const text = await f.text();
            try {
              const rows = parseCsv(text);
              if (rows.length === 0) return toast.error("CSV vazio");
              onParsed(rows);
            } catch (err: any) { toast.error("Erro lendo CSV: " + err.message); }
            if (ref.current) ref.current.value = "";
          }}
        />
        <Button type="button" variant="outline" onClick={() => ref.current?.click()}>
          <Upload className="size-4 mr-1" /> Importar CSV
        </Button>
      </div>
    </div>
  );
}

// ============ Tipos de resíduo ============
function ResiduosTab() {
  const qc = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [trat, setTrat] = useState("");
  const [edit, setEdit] = useState<TipoResiduo | null>(null);
  const mutAdd = useMutation({
    mutationFn: () => upsertTipoResiduo({ nome: nome.trim(), tratamento_padrao: trat.trim(), codigo: codigo.trim() || null }),
    onSuccess: () => { setNome(""); setCodigo(""); setTrat(""); qc.invalidateQueries({ queryKey: ["tipos_residuo"] }); toast.success("Adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteTipoResiduo(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos_residuo"] }); },
  });
  const mutBulk = useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      bulkInsertTiposResiduo(rows.map((r) => ({
        nome: r.nome ?? r.name ?? "",
        codigo: r.codigo ?? r.code ?? null,
        tratamento_padrao: r.tratamento ?? r.tratamento_padrao ?? r.treatment ?? null,
      }))),
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["tipos_residuo"] }); toast.success(`${n} resíduo(s) importado(s)`); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <form className="grid gap-2 md:grid-cols-4" onSubmit={(e) => { e.preventDefault(); if (nome.trim() && trat.trim()) mutAdd.mutate(); }}>
          <div><Label className="text-xs">Nome do resíduo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">Código (opcional)</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
          <div><Label className="text-xs">Tratamento padrão</Label><Input value={trat} onChange={(e) => setTrat(e.target.value)} /></div>
          <Button type="submit" className="self-end" disabled={!nome.trim() || !trat.trim()}><Plus className="size-4 mr-1" />Adicionar</Button>
        </form>
        <CsvUploader hint="CSV com colunas: nome, codigo (opcional), tratamento (opcional)" onParsed={(rows) => mutBulk.mutate(rows)} />
        <div className="border rounded-md divide-y">
          {tipos.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{t.nome}</span>
                {t.codigo && <span className="text-xs text-muted-foreground ml-2">({t.codigo})</span>}
                <span className="text-muted-foreground text-sm"> → {t.tratamento_padrao}</span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(t)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${t.nome}?`)) mutDel.mutate(t.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <ResiduoEditDialog tipo={edit} onClose={() => setEdit(null)} />
      </CardContent>
    </Card>
  );
}

function ResiduoEditDialog({ tipo, onClose }: { tipo: TipoResiduo | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [trat, setTrat] = useState("");
  useEffect(() => {
    setNome(tipo?.nome ?? "");
    setCodigo(tipo?.codigo ?? "");
    setTrat(tipo?.tratamento_padrao ?? "");
  }, [tipo]);
  const mut = useMutation({
    mutationFn: () => upsertTipoResiduo({ id: tipo!.id, nome: nome.trim(), tratamento_padrao: trat.trim(), codigo: codigo.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos_residuo"] }); toast.success("Atualizado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={!!tipo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Editar tipo de resíduo</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">Código (IBAMA)</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
          <div><Label className="text-xs">Tratamento padrão</Label><Input value={trat} onChange={(e) => setTrat(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || !trat.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Tratamentos ============
function TratamentosTab() {
  const qc = useQueryClient();
  const { data: tratamentos = [] } = useQuery({ queryKey: ["tratamentos"], queryFn: listTratamentos });
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [edit, setEdit] = useState<Tratamento | null>(null);
  const mutAdd = useMutation({
    mutationFn: () => upsertTratamento({ nome: nome.trim(), codigo: codigo.trim() || null }),
    onSuccess: () => { setNome(""); setCodigo(""); qc.invalidateQueries({ queryKey: ["tratamentos"] }); toast.success("Adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteTratamento(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tratamentos"] }); },
  });
  const mutBulk = useMutation({
    mutationFn: (rows: Record<string, string>[]) =>
      bulkInsertTratamentos(rows.map((r) => ({ nome: r.nome ?? r.name ?? "", codigo: r.codigo ?? r.code ?? null }))),
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["tratamentos"] }); toast.success(`${n} tratamento(s) importado(s)`); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <form className="grid gap-2 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) mutAdd.mutate(); }}>
          <div><Label className="text-xs">Nome do tratamento</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Reciclagem" /></div>
          <div><Label className="text-xs">Código (opcional)</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ex.: REC" /></div>
          <Button type="submit" className="self-end" disabled={!nome.trim()}><Plus className="size-4 mr-1" />Adicionar</Button>
        </form>
        <CsvUploader hint="CSV com colunas: nome, codigo (opcional)" onParsed={(rows) => mutBulk.mutate(rows)} />
        <div className="border rounded-md divide-y">
          {tratamentos.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum tratamento.</div> : tratamentos.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{t.nome}</span>
                {t.codigo && <span className="text-xs text-muted-foreground ml-2">({t.codigo})</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(t)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${t.nome}?`)) mutDel.mutate(t.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <TratamentoEditDialog tratamento={edit} onClose={() => setEdit(null)} />
      </CardContent>
    </Card>
  );
}

function TratamentoEditDialog({ tratamento, onClose }: { tratamento: Tratamento | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  useEffect(() => { setNome(tratamento?.nome ?? ""); setCodigo(tratamento?.codigo ?? ""); }, [tratamento]);
  const mut = useMutation({
    mutationFn: () => upsertTratamento({ id: tratamento!.id, nome: nome.trim(), codigo: codigo.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tratamentos"] }); toast.success("Atualizado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={!!tratamento} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar tratamento</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">Código</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Transportadores ============
function TransportadoresTab() {
  const qc = useQueryClient();
  const { data: lista = [] } = useQuery({ queryKey: ["transportadores"], queryFn: listTransportadores });
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [edit, setEdit] = useState<Transportador | null>(null);
  const mutAdd = useMutation({
    mutationFn: () => createTransportador({ nome: nome.trim(), cnpj: cnpj.trim() || null }),
    onSuccess: () => { setNome(""); setCnpj(""); qc.invalidateQueries({ queryKey: ["transportadores"] }); toast.success("Adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteTransportador(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportadores"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <form className="grid gap-2 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) mutAdd.mutate(); }}>
          <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">CNPJ (opcional)</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
          <Button type="submit" className="self-end" disabled={!nome.trim()}><Plus className="size-4 mr-1" />Adicionar</Button>
        </form>
        <div className="border rounded-md divide-y">
          {lista.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum transportador.</div> : lista.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{t.nome}</span>
                {t.cnpj && <span className="text-xs text-muted-foreground ml-2">{t.cnpj}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(t)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${t.nome}?`)) mutDel.mutate(t.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <TransportadorEditDialog transportador={edit} onClose={() => setEdit(null)} />
      </CardContent>
    </Card>
  );
}

function TransportadorEditDialog({ transportador, onClose }: { transportador: Transportador | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  useEffect(() => { setNome(transportador?.nome ?? ""); setCnpj(transportador?.cnpj ?? ""); }, [transportador]);
  const mut = useMutation({
    mutationFn: () => updateTransportador(transportador!.id, { nome: nome.trim(), cnpj: cnpj.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportadores"] }); toast.success("Atualizado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={!!transportador} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar transportador</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Destinadores ============
function DestinadoresTab() {
  const qc = useQueryClient();
  const { data: lista = [] } = useQuery({ queryKey: ["destinadores"], queryFn: listDestinadores });
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [edit, setEdit] = useState<Destinador | null>(null);
  const mutAdd = useMutation({
    mutationFn: () => createDestinador({ nome: nome.trim(), cnpj: cnpj.trim() || null }),
    onSuccess: () => { setNome(""); setCnpj(""); qc.invalidateQueries({ queryKey: ["destinadores"] }); toast.success("Adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteDestinador(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["destinadores"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <form className="grid gap-2 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); if (nome.trim()) mutAdd.mutate(); }}>
          <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">CNPJ (opcional)</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
          <Button type="submit" className="self-end" disabled={!nome.trim()}><Plus className="size-4 mr-1" />Adicionar</Button>
        </form>
        <div className="border rounded-md divide-y">
          {lista.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum destinador.</div> : lista.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{d.nome}</span>
                {d.cnpj && <span className="text-xs text-muted-foreground ml-2">{d.cnpj}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(d)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${d.nome}?`)) mutDel.mutate(d.id); }}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        <DestinadorEditDialog destinador={edit} onClose={() => setEdit(null)} />
      </CardContent>
    </Card>
  );
}

function DestinadorEditDialog({ destinador, onClose }: { destinador: Destinador | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [vinculos, setVinculos] = useState<Record<string, { selected: boolean; tratamento: string }>>({});

  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const { data: vinculosAtuais = [] } = useQuery({
    queryKey: ["destinador_residuos", destinador?.id],
    queryFn: () => listDestinadorResiduos(destinador!.id),
    enabled: !!destinador,
  });

  useEffect(() => {
    setNome(destinador?.nome ?? "");
    setCnpj(destinador?.cnpj ?? "");
  }, [destinador]);

  useEffect(() => {
    if (!destinador) return;
    const map: Record<string, { selected: boolean; tratamento: string }> = {};
    for (const t of tipos) {
      const ex = vinculosAtuais.find((v) => v.tipo_residuo_id === t.id);
      map[t.id] = { selected: !!ex, tratamento: ex?.tratamento ?? t.tratamento_padrao };
    }
    setVinculos(map);
  }, [destinador, tipos, vinculosAtuais]);

  const mut = useMutation({
    mutationFn: async () => {
      await updateDestinador(destinador!.id, { nome: nome.trim(), cnpj: cnpj.trim() || null });
      const sel = Object.entries(vinculos)
        .filter(([, v]) => v.selected)
        .map(([tipo_residuo_id, v]) => ({ tipo_residuo_id, tratamento: v.tratamento.trim() || "Reciclagem" }));
      await setDestinadorResiduos(destinador!.id, sel);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["destinadores"] });
      qc.invalidateQueries({ queryKey: ["destinador_residuos"] });
      toast.success("Atualizado"); onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={!!destinador} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar destinador</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
        </div>
        <div>
          <Label className="text-xs">Resíduos vinculados e tratamento</Label>
          <div className="border rounded-md max-h-72 overflow-y-auto divide-y mt-1">
            {tipos.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">Cadastre tipos de resíduo primeiro.</div>
            ) : tipos.map((t) => {
              const v = vinculos[t.id] ?? { selected: false, tratamento: t.tratamento_padrao };
              return (
                <div key={t.id} className="flex items-center gap-3 p-2">
                  <Checkbox
                    checked={v.selected}
                    onCheckedChange={(c) => setVinculos((p) => ({ ...p, [t.id]: { ...v, selected: !!c } }))}
                  />
                  <div className="flex-1 min-w-0 text-sm">
                    <div className="truncate font-medium">{t.nome}</div>
                    {t.codigo && <div className="text-xs text-muted-foreground">{t.codigo}</div>}
                  </div>
                  <Input
                    className="h-8 w-40"
                    placeholder="Tratamento"
                    value={v.tratamento}
                    disabled={!v.selected}
                    onChange={(e) => setVinculos((p) => ({ ...p, [t.id]: { ...v, tratamento: e.target.value } }))}
                  />
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
