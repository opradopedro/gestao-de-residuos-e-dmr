import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listUnidades, createUnidade, deleteUnidade, listTiposResiduo, upsertTipoResiduo, deleteTipoResiduo } from "@/lib/data";
import { PageHeader } from "@/components/NoUnidade";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/cadastros")({
  head: () => ({ meta: [{ title: "Cadastros — DMR" }] }),
  component: Cadastros,
});

function Cadastros() {
  return (
    <div className="p-6 max-w-5xl">
      <PageHeader title="Cadastros" description="Gerencie unidades e tipos de resíduo." />
      <Tabs defaultValue="unidades">
        <TabsList>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
          <TabsTrigger value="residuos">Tipos de resíduo</TabsTrigger>
        </TabsList>
        <TabsContent value="unidades"><UnidadesTab /></TabsContent>
        <TabsContent value="residuos"><ResiduosTab /></TabsContent>
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

function ResiduosTab() {
  const qc = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const [nome, setNome] = useState("");
  const [trat, setTrat] = useState("");
  const mutAdd = useMutation({
    mutationFn: () => upsertTipoResiduo({ nome: nome.trim(), tratamento_padrao: trat.trim() }),
    onSuccess: () => { setNome(""); setTrat(""); qc.invalidateQueries({ queryKey: ["tipos_residuo"] }); toast.success("Adicionado"); },
    onError: (e: any) => toast.error(e.message),
  });
  const mutDel = useMutation({
    mutationFn: (id: string) => deleteTipoResiduo(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tipos_residuo"] }); },
  });
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <form className="grid gap-2 md:grid-cols-3" onSubmit={(e) => { e.preventDefault(); if (nome.trim() && trat.trim()) mutAdd.mutate(); }}>
          <div><Label className="text-xs">Nome do resíduo</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label className="text-xs">Tratamento padrão</Label><Input value={trat} onChange={(e) => setTrat(e.target.value)} /></div>
          <Button type="submit" className="self-end" disabled={!nome.trim() || !trat.trim()}><Plus className="size-4 mr-1" />Adicionar</Button>
        </form>
        <div className="border rounded-md divide-y">
          {tipos.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <div><span className="font-medium">{t.nome}</span> <span className="text-muted-foreground text-sm">→ {t.tratamento_padrao}</span></div>
              <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Remover ${t.nome}?`)) mutDel.mutate(t.id); }}><Trash2 className="size-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
