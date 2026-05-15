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
  checkMergeConflicts,
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
import { formatCNPJ, isValidCNPJ, normalizeCNPJ } from "@/lib/cnpj";
import { formatCodigoIbama } from "@/lib/ibama";

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
  const [del, setDel] = useState<Unidade | null>(null);
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
                <Button variant="ghost" size="icon" onClick={() => setDel(u)}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        {add && <UnidadeAddDialog onClose={() => setAdd(false)} />}
        <UnidadeEditDialog unidade={edit} onClose={() => setEdit(null)} />
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="unidade" itens={unidades.map((u) => ({ id: u.id, nome: u.nome }))} />
        {del && <EntityDeleteDialog open onOpenChange={(o) => !o && setDel(null)} tipo="unidade" id={del.id} nome={del.nome} alternativos={unidades.map((u) => ({ id: u.id, nome: u.nome }))} />}
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
  const [del, setDel] = useState<TipoResiduo | null>(null);
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
                <Button variant="ghost" size="icon" onClick={() => setDel(t)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        {add && <ResiduoEditDialog tipo={null} onClose={() => setAdd(false)} />}
        {edit && <ResiduoEditDialog tipo={edit} onClose={() => setEdit(null)} todos={tipos} />}
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="residuo" itens={tipos.map((t) => ({ id: t.id, nome: t.nome }))} />
        {del && <EntityDeleteDialog open onOpenChange={(o) => !o && setDel(null)} tipo="residuo" id={del.id} nome={del.nome} alternativos={tipos.map((t) => ({ id: t.id, nome: t.nome }))} />}
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

function ResiduoEditDialog({ tipo, onClose, todos = [] }: { tipo: TipoResiduo | null; onClose: () => void; todos?: TipoResiduo[] }) {
  const qc = useQueryClient();
  const isEdit = !!tipo;
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [trat, setTrat] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
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
    <>
      <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{isEdit ? "Editar tipo de resíduo" : "Novo tipo de resíduo"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label className="text-xs">Código (IBAMA)</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
            <div><Label className="text-xs">Tratamento padrão</Label><Input value={trat} onChange={(e) => setTrat(e.target.value)} placeholder="Ex.: Reciclagem" /></div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {isEdit && todos.length > 1 && (
              <Button variant="outline" type="button" onClick={() => setMergeOpen(true)}><Merge className="size-4 mr-1" /> Unificar com…</Button>
            )}
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isEdit && <MergeDialog open={mergeOpen} onOpenChange={setMergeOpen} tipo="residuo" itens={todos.map((t) => ({ id: t.id, nome: t.nome }))} preselectRemoverId={tipo!.id} />}
    </>
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
  const [del, setDel] = useState<Tratamento | null>(null);
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
                <Button variant="ghost" size="icon" onClick={() => setDel(t)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        {add && <TratamentoEditDialog tratamento={null} onClose={() => setAdd(false)} />}
        {edit && <TratamentoEditDialog tratamento={edit} onClose={() => setEdit(null)} todos={tratamentos} />}
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="tratamento" itens={tratamentos.map((t) => ({ id: t.id, nome: t.nome }))} />
        {del && <EntityDeleteDialog open onOpenChange={(o) => !o && setDel(null)} tipo="tratamento" id={del.id} nome={del.nome} alternativos={tratamentos.map((t) => ({ id: t.id, nome: t.nome }))} />}
        <EntityImportDialog
          open={imp} onOpenChange={setImp} title="Tratamentos"
          fields={[{ key: "nome", label: "Nome", required: true }, { key: "codigo", label: "Código" }]}
          onImport={async (rows) => { await bulkInsertTratamentos(rows.map((r) => ({ nome: r.nome, codigo: r.codigo || null }))); qc.invalidateQueries({ queryKey: ["tratamentos"] }); }}
        />
      </CardContent>
    </Card>
  );
}

function TratamentoEditDialog({ tratamento, onClose, todos = [] }: { tratamento: Tratamento | null; onClose: () => void; todos?: Tratamento[] }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(tratamento?.nome ?? "");
  const [codigo, setCodigo] = useState(tratamento?.codigo ?? "");
  const [mergeOpen, setMergeOpen] = useState(false);
  const isEdit = !!tratamento;
  const mut = useMutation({
    mutationFn: () => upsertTratamento({ id: tratamento?.id, nome: nome.trim(), codigo: codigo.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tratamentos"] }); toast.success("Salvo"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{isEdit ? "Editar tratamento" : "Novo tratamento"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Nome</Label><Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label className="text-xs">Código</Label><Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {isEdit && todos.length > 1 && (
              <Button variant="outline" type="button" onClick={() => setMergeOpen(true)}><Merge className="size-4 mr-1" /> Unificar com…</Button>
            )}
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isEdit && <MergeDialog open={mergeOpen} onOpenChange={setMergeOpen} tipo="tratamento" itens={todos.map((t) => ({ id: t.id, nome: t.nome }))} preselectRemoverId={tratamento!.id} />}
    </>
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
  const [del, setDel] = useState<Transportador | null>(null);
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Toolbar onAdd={() => setAdd(true)} onMerge={() => setMerge(true)} onImport={() => setImp(true)} mergeDisabled={lista.length < 2} />
        <div className="border rounded-md divide-y">
          {lista.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum transportador.</div> : lista.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{t.nome}</span>
                {t.cnpj && <span className="text-xs text-muted-foreground ml-2">{formatCNPJ(t.cnpj)}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(t)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDel(t)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        {add && <TransportadorDialog mode="create" onClose={() => setAdd(false)} />}
        {edit && <TransportadorDialog mode="edit" transportador={edit} onClose={() => setEdit(null)} todos={lista} />}
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="transportador" itens={lista.map((t) => ({ id: t.id, nome: t.nome }))} />
        {del && <EntityDeleteDialog open onOpenChange={(o) => !o && setDel(null)} tipo="transportador" id={del.id} nome={del.nome} alternativos={lista.map((t) => ({ id: t.id, nome: t.nome }))} />}
        <EntityImportDialog
          open={imp} onOpenChange={setImp} title="Transportadores"
          fields={[{ key: "nome", label: "Nome", required: true }, { key: "cnpj", label: "CNPJ" }]}
          onImport={async (rows) => { await bulkInsertTransportadores(rows.map((r) => ({ nome: r.nome, cnpj: r.cnpj || null }))); qc.invalidateQueries({ queryKey: ["transportadores"] }); }}
        />
      </CardContent>
    </Card>
  );
}

function TransportadorDialog({ mode, transportador, onClose, todos = [] }: { mode: "create" | "edit"; transportador?: Transportador; onClose: () => void; todos?: Transportador[] }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(transportador?.nome ?? "");
  const [cnpj, setCnpj] = useState(transportador?.cnpj ?? "");
  const [mergeOpen, setMergeOpen] = useState(false);
  const isEdit = mode === "edit";
  const mut = useMutation({
    mutationFn: () => mode === "create"
      ? createTransportador({ nome: nome.trim(), cnpj: cnpj.trim() || null })
      : updateTransportador(transportador!.id, { nome: nome.trim(), cnpj: cnpj.trim() || null }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["transportadores"] }); toast.success("Salvo"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{mode === "create" ? "Novo transportador" : "Editar transportador"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label className="text-xs">Nome</Label><Input autoFocus value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label className="text-xs">CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {isEdit && todos.length > 1 && (
              <Button variant="outline" type="button" onClick={() => setMergeOpen(true)}><Merge className="size-4 mr-1" /> Unificar com…</Button>
            )}
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={!nome.trim() || mut.isPending} onClick={() => mut.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {isEdit && <MergeDialog open={mergeOpen} onOpenChange={setMergeOpen} tipo="transportador" itens={todos.map((t) => ({ id: t.id, nome: t.nome }))} preselectRemoverId={transportador!.id} />}
    </>
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
  const [del, setDel] = useState<Destinador | null>(null);
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Toolbar onAdd={() => setAdd(true)} onMerge={() => setMerge(true)} onImport={() => setImp(true)} mergeDisabled={lista.length < 2} />
        <div className="border rounded-md divide-y">
          {lista.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum destinador.</div> : lista.map((d) => (
            <div key={d.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{d.nome}</span>
                {d.cnpj && <span className="text-xs text-muted-foreground ml-2">{formatCNPJ(d.cnpj)}</span>}
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => setEdit(d)}><Pencil className="size-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => setDel(d)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
        {add && <DestinadorFullDialog mode="create" onClose={() => setAdd(false)} />}
        {edit && <DestinadorFullDialog mode="edit" destinador={edit} onClose={() => setEdit(null)} todos={lista} />}
        <MergeDialog open={merge} onOpenChange={setMerge} tipo="destinador" itens={lista.map((d) => ({ id: d.id, nome: d.nome }))} />
        {del && <EntityDeleteDialog open onOpenChange={(o) => !o && setDel(null)} tipo="destinador" id={del.id} nome={del.nome} alternativos={lista.map((d) => ({ id: d.id, nome: d.nome }))} />}
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
function MergeDialog({ open, onOpenChange, tipo, itens, preselectRemoverId }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  tipo: "destinador" | "transportador" | "unidade" | "residuo" | "tratamento";
  itens: { id: string; nome: string }[];
  preselectRemoverId?: string;
}) {
  const qc = useQueryClient();
  const [manterId, setManterId] = useState("");
  const [removerId, setRemoverId] = useState("");
  const [conflitos, setConflitos] = useState<any[]>([]);
  const [escolhas, setEscolhas] = useState<Record<number, "A" | "B">>({});

  useEffect(() => {
    if (!open) { setManterId(""); setRemoverId(""); setConflitos([]); setEscolhas({}); }
    else if (preselectRemoverId) { setRemoverId(preselectRemoverId); }
  }, [open, preselectRemoverId]);

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

  const resolveAndMergeMut = useMutation<void, Error, void>({
    mutationFn: async () => {
      const { deleteColeta } = await import("@/lib/data");
      const idsParaExcluir: string[] = [];
      conflitos.forEach((c, i) => {
        const escolha = escolhas[i];
        if (escolha === "A") idsParaExcluir.push(c.com.id);
        else if (escolha === "B") idsParaExcluir.push(c.original.id);
      });
      for (const id of idsParaExcluir) {
        await deleteColeta(id);
      }
    },
    onSuccess: () => {
      mut.mutate();
    },
    onError: (e: any) => toast.error("Erro ao resolver conflitos: " + e.message),
  });

  const checkMut = useMutation<any[], Error, void>({
    mutationFn: async () => {
      if (tipo === "destinador" || tipo === "transportador") {
        return checkMergeConflicts(tipo, manterId, removerId);
      }
      return [];
    },
    onSuccess: (conf) => {
      if (conf.length > 0) {
        setConflitos(conf);
        setEscolhas({});
      } else {
        mut.mutate();
      }
    },
    onError: (e: any) => toast.error("Erro na verificação: " + e.message),
  });

  const valid = manterId && removerId && manterId !== removerId;
  const todasResolvidas = conflitos.length > 0 && conflitos.every((_, i) => escolhas[i]);

  if (conflitos.length > 0) {
    const setAll = (lado: "A" | "B") => {
      const next: Record<number, "A" | "B"> = {};
      conflitos.forEach((_, i) => { next[i] = lado; });
      setEscolhas(next);
    };
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Resolver conflitos da unificação ({conflitos.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto">
            <div className="text-sm text-amber-700 bg-amber-50 p-3 rounded border border-amber-200">
              Para cada par, escolha qual coleta manter. A outra será excluída antes da unificação (registrada no Histórico).
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setAll("A")}>Manter todas A</Button>
              <Button size="sm" variant="outline" onClick={() => setAll("B")}>Manter todas B</Button>
              <Button size="sm" variant="ghost" onClick={() => setEscolhas({})}>Limpar</Button>
            </div>
            <div className="space-y-3">
              {conflitos.map((c, i) => {
                const escolha = escolhas[i];
                const card = (lado: "A" | "B", coleta: any, label: string) => (
                  <div
                    className={`flex-1 border rounded p-3 cursor-pointer transition-colors ${
                      escolha === lado ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                    }`}
                    onClick={() => setEscolhas((p) => ({ ...p, [i]: lado }))}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold uppercase text-muted-foreground">{label}</span>
                      <input type="radio" checked={escolha === lado} readOnly />
                    </div>
                    <div className="text-sm font-medium">{coleta.data} · MTR: {coleta.mtr || "—"}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Destinador: {coleta.destinador || "—"} · Transportador: {coleta.transportador || "—"}
                    </div>
                    <div className="text-xs mt-1">
                      {(coleta.itens ?? []).map((it: any) => `${it.tipo_residuo_nome} (${it.peso_kg}kg)`).join(", ") || "—"}
                    </div>
                  </div>
                );
                return (
                  <div key={i} className="border rounded p-2 bg-background">
                    <div className="text-xs text-muted-foreground mb-2">
                      {c.razao === "mtr" ? `MTR duplicado: ${c.original.mtr}` : "Mesma data, destinador, transportador e itens"}
                    </div>
                    <div className="flex gap-2">
                      {card("A", c.original, "A — Será modificada")}
                      {card("B", c.com, "B — Já existe")}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConflitos([])}>Voltar</Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button
              disabled={!todasResolvidas || resolveAndMergeMut.isPending || mut.isPending}
              onClick={() => resolveAndMergeMut.mutate()}
            >
              {resolveAndMergeMut.isPending || mut.isPending ? "Aplicando…" : "Resolver e unificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

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
          <Button disabled={!valid || checkMut.isPending || mut.isPending} onClick={() => checkMut.mutate()}>{checkMut.isPending || mut.isPending ? "Unificando…" : "Confirmar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DestinadorFullDialog({ mode, destinador, onClose, todos = [] }: { mode: "create" | "edit"; destinador?: Destinador; onClose: () => void; todos?: Destinador[] }) {
  const [mergeOpen, setMergeOpen] = useState(false);
  const [expandResiduos, setExpandResiduos] = useState(false);
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
    let base = tipos;
    // Quando edição e não expandido: mostrar apenas vinculados (selecionados)
    if (mode === "edit" && !expandResiduos && !q) {
      base = tipos.filter((t) => vinculos[t.id]?.selected);
    }
    if (!q) return base;
    return base.filter((t) => t.nome.toLowerCase().includes(q) || (t.codigo ?? "").toLowerCase().includes(q));
  }, [tipos, busca, mode, expandResiduos, vinculos]);

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
            <div className="flex items-center justify-between mb-1 gap-2">
              <Label className="text-xs">Resíduos aceitos por este destinador</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{totalSelecionados} selecionado(s)</span>
                {mode === "edit" && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setExpandResiduos((v) => !v)}>
                    {expandResiduos ? "Ver só vinculados" : "Expandir lista"}
                  </Button>
                )}
              </div>
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
          <DialogFooter className="flex-wrap gap-2">
            {mode === "edit" && todos.length > 1 && (
              <Button variant="outline" type="button" onClick={() => setMergeOpen(true)}><Merge className="size-4 mr-1" /> Unificar com…</Button>
            )}
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={!nome.trim() || mut.isPending || !ready} onClick={() => mut.mutate()}>
              {mut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {mode === "edit" && <MergeDialog open={mergeOpen} onOpenChange={setMergeOpen} tipo="destinador" itens={todos.map((d) => ({ id: d.id, nome: d.nome }))} preselectRemoverId={destinador!.id} />}

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
