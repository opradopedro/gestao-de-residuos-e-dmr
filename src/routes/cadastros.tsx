import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listUnidades, createUnidade, updateUnidade, deleteUnidade, bulkInsertUnidades,
  listTiposResiduo, upsertTipoResiduo, deleteTipoResiduo, bulkInsertTiposResiduo,
  listTratamentos, upsertTratamento, deleteTratamento, bulkInsertTratamentos,
  listTransportadores, createTransportador, updateTransportador, deleteTransportador, bulkInsertTransportadores,
  listDestinadores, createDestinador, updateDestinador, deleteDestinador, bulkInsertDestinadores,
  listDestinadorResiduos, setDestinadorResiduos,
  mergeDestinadores, mergeTransportadores, mergeUnidades, mergeTiposResiduo, mergeTratamentos,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Upload, Pencil, Merge } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { EntityImportDialog } from "@/components/EntityImportDialog";
import { EntityDeleteDialog } from "@/components/EntityDeleteDialog";

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
          <TabsTrigger value="unidades" className="hover:bg-accent/60 transition-colors">Unidades</TabsTrigger>
          <TabsTrigger value="residuos" className="hover:bg-accent/60 transition-colors">Tipos de resíduo</TabsTrigger>
          <TabsTrigger value="tratamentos" className="hover:bg-accent/60 transition-colors">Tratamentos</TabsTrigger>
          <TabsTrigger value="transportadores" className="hover:bg-accent/60 transition-colors">Transportadores</TabsTrigger>
          <TabsTrigger value="destinadores" className="hover:bg-accent/60 transition-colors">Destinadores</TabsTrigger>
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

// ============== Toolbar padronizada ==============
function Toolbar({ onAdd, onMerge, onImport, mergeDisabled }: {
  onAdd: () => void; onMerge: () => void; onImport: () => void; mergeDisabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onImport}><Upload className="size-4 mr-1" /> Importar</Button>
      <Button variant="outline" size="sm" onClick={onMerge} disabled={mergeDisabled}><Merge className="size-4 mr-1" /> Unificar</Button>
      <Button size="sm" onClick={onAdd}><Plus className="size-4 mr-1" /> Adicionar</Button>
    </div>
  );
}

// ============ Unidades ============
function UnidadesTab() {
  const qc = useQueryClient();
  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const [edit, setEdit] = useState<Unidade | null>(null);
  const [add, setAdd] = useState(false);
  const [merge, setMerge] = useState(false);
  const [imp, setImp] = useState(false);
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteUnidade(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["unidades"] }); toast.success("Unidade removida"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Toolbar onAdd={() => setAdd(true)} onMerge={() => setMerge(true)} onImport={() => setImp(true)} mergeDisabled={unidades.length < 2} />
        <div className="divide-y border rounded-md">
          {unidades.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhuma unidade.</div> : unidades.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3">
              <span>{u.nome}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(u)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${u.nome}?`)) mutDel.mutate(u.id); }}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {add && <UnidadeAddDialog onClose={() => setAdd(false)} />}
        <UnidadeEditDialog unidade={edit} onClose={() => setEdit(null)} />
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="unidade" itens={unidades.map((u) => ({ id: u.id, nome: u.nome }))} />
        <EntityImportDialog
          open={imp} onOpenChange={setImp} title="Unidades"
          fields={[{ key: "nome", label: "Nome", required: true }]}
          onImport={async (rows) => { await bulkInsertUnidades(rows.map((r) => ({ nome: r.nome }))); qc.invalidateQueries({ queryKey: ["unidades"] }); }}
        />
      </CardContent>
    </Card>
  );
}

function UnidadeAddDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const mut = useMutation({
    mutationFn: () => createUnidade(nome.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["unidades"] }); toast.success("Unidade criada"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Nova unidade</DialogTitle></DialogHeader>
        <div><Label className="text-xs">Nome</Label><Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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

// ============ Tipos de resíduo ============
function ResiduosTab() {
  const qc = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const [edit, setEdit] = useState<TipoResiduo | null>(null);
  const [add, setAdd] = useState(false);
  const [merge, setMerge] = useState(false);
  const [imp, setImp] = useState(false);
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteTipoResiduo(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos_residuo"] }); },
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Toolbar onAdd={() => setAdd(true)} onMerge={() => setMerge(true)} onImport={() => setImp(true)} mergeDisabled={tipos.length < 2} />
        <div className="border rounded-md divide-y">
          {tipos.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum resíduo.</div> : tipos.map((t) => (
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
        {add && <ResiduoEditDialog tipo={null} onClose={() => setAdd(false)} />}
        {edit && <ResiduoEditDialog tipo={edit} onClose={() => setEdit(null)} />}
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="residuo" itens={tipos.map((t) => ({ id: t.id, nome: t.nome }))} />
        <EntityImportDialog
          open={imp} onOpenChange={setImp} title="Tipos de resíduo"
          fields={[
            { key: "nome", label: "Nome", required: true },
            { key: "codigo", label: "Código (IBAMA)" },
            { key: "tratamento_padrao", label: "Tratamento padrão" },
          ]}
          onImport={async (rows) => {
            await bulkInsertTiposResiduo(rows.map((r) => ({ nome: r.nome, codigo: r.codigo || null, tratamento_padrao: r.tratamento_padrao || null })));
            qc.invalidateQueries({ queryKey: ["tipos_residuo"] });
          }}
        />
      </CardContent>
    </Card>
  );
}

function ResiduoEditDialog({ tipo, onClose }: { tipo: TipoResiduo | null; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!tipo;
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [trat, setTrat] = useState("");
  useEffect(() => {
    setNome(tipo?.nome ?? "");
    setCodigo(tipo?.codigo ?? "");
    setTrat(tipo?.tratamento_padrao ?? "");
  }, [tipo]);
  const mut = useMutation({
    mutationFn: () => upsertTipoResiduo({ id: tipo?.id, nome: nome.trim(), tratamento_padrao: trat.trim() || "Reciclagem", codigo: codigo.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos_residuo"] }); toast.success(isEdit ? "Atualizado" : "Criado"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{isEdit ? "Editar tipo de resíduo" : "Novo tipo de resíduo"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">Código (IBAMA)</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
          <div><Label className="text-xs">Tratamento padrão</Label><Input value={trat} onChange={(e) => setTrat(e.target.value)} placeholder="Ex.: Reciclagem" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ Tratamentos ============
function TratamentosTab() {
  const qc = useQueryClient();
  const { data: tratamentos = [] } = useQuery({ queryKey: ["tratamentos"], queryFn: listTratamentos });
  const [edit, setEdit] = useState<Tratamento | null>(null);
  const [add, setAdd] = useState(false);
  const [merge, setMerge] = useState(false);
  const [imp, setImp] = useState(false);
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteTratamento(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tratamentos"] }); },
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Toolbar onAdd={() => setAdd(true)} onMerge={() => setMerge(true)} onImport={() => setImp(true)} mergeDisabled={tratamentos.length < 2} />
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
        {add && <TratamentoEditDialog tratamento={null} onClose={() => setAdd(false)} />}
        {edit && <TratamentoEditDialog tratamento={edit} onClose={() => setEdit(null)} />}
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="tratamento" itens={tratamentos.map((t) => ({ id: t.id, nome: t.nome }))} />
        <EntityImportDialog
          open={imp} onOpenChange={setImp} title="Tratamentos"
          fields={[{ key: "nome", label: "Nome", required: true }, { key: "codigo", label: "Código" }]}
          onImport={async (rows) => { await bulkInsertTratamentos(rows.map((r) => ({ nome: r.nome, codigo: r.codigo || null }))); qc.invalidateQueries({ queryKey: ["tratamentos"] }); }}
        />
      </CardContent>
    </Card>
  );
}

function TratamentoEditDialog({ tratamento, onClose }: { tratamento: Tratamento | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(tratamento?.nome ?? "");
  const [codigo, setCodigo] = useState(tratamento?.codigo ?? "");
  const mut = useMutation({
    mutationFn: () => upsertTratamento({ id: tratamento?.id, nome: nome.trim(), codigo: codigo.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tratamentos"] }); toast.success("Salvo"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{tratamento ? "Editar tratamento" : "Novo tratamento"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Nome</Label><Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></div>
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
  const [edit, setEdit] = useState<Transportador | null>(null);
  const [add, setAdd] = useState(false);
  const [merge, setMerge] = useState(false);
  const [imp, setImp] = useState(false);
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteTransportador(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportadores"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Toolbar onAdd={() => setAdd(true)} onMerge={() => setMerge(true)} onImport={() => setImp(true)} mergeDisabled={lista.length < 2} />
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
        {add && <TransportadorDialog mode="create" onClose={() => setAdd(false)} />}
        {edit && <TransportadorDialog mode="edit" transportador={edit} onClose={() => setEdit(null)} />}
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="transportador" itens={lista.map((t) => ({ id: t.id, nome: t.nome }))} />
        <EntityImportDialog
          open={imp} onOpenChange={setImp} title="Transportadores"
          fields={[{ key: "nome", label: "Nome", required: true }, { key: "cnpj", label: "CNPJ" }]}
          onImport={async (rows) => { await bulkInsertTransportadores(rows.map((r) => ({ nome: r.nome, cnpj: r.cnpj || null }))); qc.invalidateQueries({ queryKey: ["transportadores"] }); }}
        />
      </CardContent>
    </Card>
  );
}

function TransportadorDialog({ mode, transportador, onClose }: { mode: "create" | "edit"; transportador?: Transportador; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(transportador?.nome ?? "");
  const [cnpj, setCnpj] = useState(transportador?.cnpj ?? "");
  const mut = useMutation({
    mutationFn: () => mode === "create"
      ? createTransportador({ nome: nome.trim(), cnpj: cnpj.trim() || null })
      : updateTransportador(transportador!.id, { nome: nome.trim(), cnpj: cnpj.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportadores"] }); toast.success("Salvo"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{mode === "create" ? "Novo transportador" : "Editar transportador"}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Nome</Label><Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></div>
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
  const [add, setAdd] = useState(false);
  const [edit, setEdit] = useState<Destinador | null>(null);
  const [merge, setMerge] = useState(false);
  const [imp, setImp] = useState(false);
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteDestinador(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["destinadores"] }); toast.success("Removido"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Toolbar onAdd={() => setAdd(true)} onMerge={() => setMerge(true)} onImport={() => setImp(true)} mergeDisabled={lista.length < 2} />
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
        {add && <DestinadorFullDialog mode="create" onClose={() => setAdd(false)} />}
        {edit && <DestinadorFullDialog mode="edit" destinador={edit} onClose={() => setEdit(null)} />}
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="destinador" itens={lista.map((d) => ({ id: d.id, nome: d.nome }))} />
        <EntityImportDialog
          open={imp} onOpenChange={setImp} title="Destinadores"
          fields={[{ key: "nome", label: "Nome", required: true }, { key: "cnpj", label: "CNPJ" }]}
          onImport={async (rows) => { await bulkInsertDestinadores(rows.map((r) => ({ nome: r.nome, cnpj: r.cnpj || null }))); qc.invalidateQueries({ queryKey: ["destinadores"] }); }}
        />
      </CardContent>
    </Card>
  );
}

// ============ Merge dialog (genérico) ============
function MergeDialog({ open, onOpenChange, tipo, itens }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  tipo: "destinador" | "transportador" | "unidade" | "residuo" | "tratamento";
  itens: { id: string; nome: string }[];
}) {
  const qc = useQueryClient();
  const [manterId, setManterId] = useState("");
  const [removerId, setRemoverId] = useState("");
  useEffect(() => { if (!open) { setManterId(""); setRemoverId(""); } }, [open]);
  const mut = useMutation<any, Error, void>({
    mutationFn: async () => {
      if (tipo === "destinador") return mergeDestinadores(manterId, removerId);
      if (tipo === "transportador") return mergeTransportadores(manterId, removerId);
      if (tipo === "unidade") return mergeUnidades(manterId, removerId);
      if (tipo === "residuo") return mergeTiposResiduo(manterId, removerId);
      return mergeTratamentos(manterId, removerId);
    },
    onSuccess: () => {
      toast.success("Unificação concluída (pode ser revertida em Histórico)");
      qc.invalidateQueries();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
  const valid = manterId && removerId && manterId !== removerId;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Merge className="size-5" /> Unificar duplicados</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Selecione o registro <strong>correto</strong> (mantido) e o <strong>duplicado</strong> (removido). Tudo será transferido sem duplicar. Esta ação pode ser revertida no Histórico.
          </div>
          <div>
            <Label className="text-xs">Manter</Label>
            <Select value={manterId} onValueChange={setManterId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{itens.map((i) => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Remover</Label>
            <Select value={removerId} onValueChange={setRemoverId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>{itens.filter((i) => i.id !== manterId).map((i) => <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid || mut.isPending} onClick={() => mut.mutate()}>{mut.isPending ? "Unificando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DestinadorFullDialog({ mode, destinador, onClose }: { mode: "create" | "edit"; destinador?: Destinador; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(destinador?.nome ?? "");
  const [cnpj, setCnpj] = useState(destinador?.cnpj ?? "");
  const [busca, setBusca] = useState("");
  const [vinculos, setVinculos] = useState<Record<string, { selected: boolean; tratamento: string }>>({});
  const [quickResiduo, setQuickResiduo] = useState<string | null>(null);
  const [ready, setReady] = useState(mode === "create");

  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const { data: vinculosAtuais = [], isLoading: loadingVinc } = useQuery({
    queryKey: ["destinador_residuos", destinador?.id ?? "novo"],
    queryFn: () => listDestinadorResiduos(destinador!.id),
    enabled: mode === "edit" && !!destinador,
  });

  useEffect(() => {
    if (mode === "create") {
      const map: Record<string, { selected: boolean; tratamento: string }> = {};
      for (const t of tipos) map[t.id] = { selected: false, tratamento: t.tratamento_padrao };
      setVinculos(map);
      setReady(true);
      return;
    }
    if (mode === "edit" && tipos.length > 0 && !loadingVinc) {
      const map: Record<string, { selected: boolean; tratamento: string }> = {};
      for (const t of tipos) {
        const ex = vinculosAtuais.find((v) => v.tipo_residuo_id === t.id);
        map[t.id] = { selected: !!ex, tratamento: ex?.tratamento ?? t.tratamento_padrao };
      }
      setVinculos(map);
      setReady(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tipos.length, loadingVinc, vinculosAtuais.length]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return tipos;
    return tipos.filter((t) => t.nome.toLowerCase().includes(q) || (t.codigo ?? "").toLowerCase().includes(q));
  }, [tipos, busca]);

  const matchExato = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? tipos.some((t) => t.nome.toLowerCase() === q) : true;
  }, [tipos, busca]);

  const mut = useMutation({
    mutationFn: async () => {
      let id = destinador?.id;
      if (mode === "create") {
        const d = await createDestinador({ nome: nome.trim(), cnpj: cnpj.trim() || null });
        id = d.id;
      } else {
        await updateDestinador(destinador!.id, { nome: nome.trim(), cnpj: cnpj.trim() || null });
      }
      const sel = Object.entries(vinculos)
        .filter(([, v]) => v.selected)
        .map(([tipo_residuo_id, v]) => ({ tipo_residuo_id, tratamento: v.tratamento.trim() || "Reciclagem" }));
      await setDestinadorResiduos(id!, sel);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["destinadores"] });
      qc.invalidateQueries({ queryKey: ["destinador_residuos"] });
      toast.success(mode === "create" ? "Destinador criado" : "Atualizado");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const totalSelecionados = Object.values(vinculos).filter((v) => v.selected).length;

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{mode === "create" ? "Novo destinador" : "Editar destinador"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label className="text-xs">CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-xs">Resíduos aceitos por este destinador</Label>
              <span className="text-xs text-muted-foreground">{totalSelecionados} selecionado(s)</span>
            </div>
            <Input placeholder="Buscar resíduo..." value={busca} onChange={(e) => setBusca(e.target.value)} className="mb-2" />
            <div className="border rounded-md max-h-72 overflow-y-auto divide-y">
              {!ready ? (
                <div className="p-3 text-sm text-muted-foreground">Carregando...</div>
              ) : tipos.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">Cadastre tipos de resíduo primeiro.</div>
              ) : (
                <>
                  {filtrados.map((t) => {
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
                  {busca.trim() && !matchExato && (
                    <button type="button" onClick={() => setQuickResiduo(busca.trim())} className="w-full text-left p-2 text-sm text-primary hover:bg-accent/50">
                      <Plus className="size-3.5 inline mr-1" />Adicionar "{busca.trim()}"
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={!nome.trim() || mut.isPending || !ready} onClick={() => mut.mutate()}>
              {mut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {quickResiduo !== null && (
        <QuickResiduoInlineDialog
          defaultName={quickResiduo}
          onClose={() => setQuickResiduo(null)}
          onCreated={(t) => {
            setVinculos((p) => ({ ...p, [t.id]: { selected: true, tratamento: t.tratamento_padrao } }));
            setBusca("");
            setQuickResiduo(null);
            qc.invalidateQueries({ queryKey: ["tipos_residuo"] });
          }}
        />
      )}
    </>
  );
}

function QuickResiduoInlineDialog({ defaultName, onClose, onCreated }: { defaultName: string; onClose: () => void; onCreated: (t: TipoResiduo) => void }) {
  const [nome, setNome] = useState(defaultName);
  const [codigo, setCodigo] = useState("");
  const [trat, setTrat] = useState("Reciclagem");
  const [saving, setSaving] = useState(false);
  async function salvar() {
    if (!nome.trim() || !trat.trim()) { toast.error("Preencha nome e tratamento"); return; }
    setSaving(true);
    try {
      const t = await upsertTipoResiduo({ nome: nome.trim(), tratamento_padrao: trat.trim(), codigo: codigo.trim() || null });
      onCreated(t);
    } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Novo resíduo</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><Label className="text-xs">Nome</Label><Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">Código IBAMA (opcional)</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
          <div><Label className="text-xs">Tratamento padrão</Label><Input value={trat} onChange={(e) => setTrat(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
