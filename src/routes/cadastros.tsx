import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listUnidades, createUnidade, deleteUnidade,
  listTiposResiduo, upsertTipoResiduo, deleteTipoResiduo, bulkInsertTiposResiduo,
  listTratamentos, upsertTratamento, deleteTratamento, bulkInsertTratamentos,
} from "@/lib/data";
import { PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { parseCsv } from "@/lib/csv";

export const Route = createFileRoute("/cadastros")({
  head: () => ({ meta: [{ title: "Cadastros — DMR" }] }),
  component: Cadastros,
});

function Cadastros() {
  return (
    <div className="p-6 max-w-5xl">
      <PageHeader title="Cadastros" description="Gerencie unidades, tipos de resíduo e tratamentos." />
      <Tabs defaultValue="unidades">
        <TabsList>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="residuos">Tipos de resíduo</TabsTrigger>
          <TabsTrigger value="tratamentos">Tratamentos</TabsTrigger>
        </TabsList>
        <TabsContent value="unidades"><UnidadesTab /></TabsContent>
        <TabsContent value="residuos"><ResiduosTab /></TabsContent>
        <TabsContent value="tratamentos"><TratamentosTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function UnidadesTab() {
  const qc = useQueryClient();
  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const [nome, setNome] = useState("");
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
              <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${u.nome}? Todas as coletas dela serão excluídas.`)) mutDel.mutate(u.id); }}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

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

function ResiduosTab() {
  const qc = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
  const [trat, setTrat] = useState("");
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
        <CsvUploader
          hint="CSV com colunas: nome, codigo (opcional), tratamento (opcional)"
          onParsed={(rows) => mutBulk.mutate(rows)}
        />
        <div className="border rounded-md divide-y">
          {tipos.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{t.nome}</span>
                {t.codigo && <span className="text-xs text-muted-foreground ml-2">({t.codigo})</span>}
                <span className="text-muted-foreground text-sm"> → {t.tratamento_padrao}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${t.nome}?`)) mutDel.mutate(t.id); }}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TratamentosTab() {
  const qc = useQueryClient();
  const { data: tratamentos = [] } = useQuery({ queryKey: ["tratamentos"], queryFn: listTratamentos });
  const [nome, setNome] = useState("");
  const [codigo, setCodigo] = useState("");
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
      bulkInsertTratamentos(rows.map((r) => ({
        nome: r.nome ?? r.name ?? "",
        codigo: r.codigo ?? r.code ?? null,
      }))),
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
        <CsvUploader
          hint="CSV com colunas: nome, codigo (opcional)"
          onParsed={(rows) => mutBulk.mutate(rows)}
        />
        <div className="border rounded-md divide-y">
          {tratamentos.length === 0 ? <div className="p-4 text-sm text-muted-foreground">Nenhum tratamento.</div> : tratamentos.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{t.nome}</span>
                {t.codigo && <span className="text-xs text-muted-foreground ml-2">({t.codigo})</span>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${t.nome}?`)) mutDel.mutate(t.id); }}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
