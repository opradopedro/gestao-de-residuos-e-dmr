import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listDestinadores, listTiposResiduo } from "@/lib/data";
import { renameDmrLinhasDestinador, renameDmrLinhasResiduo } from "@/lib/dmr";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCNPJ } from "@/lib/cnpj";
import { toast } from "sonner";

type Item = { texto: string; ocorrencias: number };
type Kind = "residuo" | "destinador";

export function DmrAlterarEquivalenciasDialog({
  open,
  onOpenChange,
  uploadId,
  residuos,
  destinadores,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  uploadId: string;
  residuos: Item[];
  destinadores: Item[];
}) {
  const qc = useQueryClient();
  const { data: tipos = [] } = useQuery({ queryKey: ["tipos_residuo"], queryFn: listTiposResiduo });
  const { data: destCad = [] } = useQuery({ queryKey: ["destinadores"], queryFn: listDestinadores });

  const [kind, setKind] = useState<Kind | "">("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setKind("");
      setFrom("");
      setTo("");
    }
  }, [open]);

  useEffect(() => {
    setFrom("");
    setTo("");
  }, [kind]);

  const origens = useMemo<Item[]>(() => {
    if (kind === "residuo") return residuos;
    if (kind === "destinador") return destinadores;
    return [];
  }, [kind, residuos, destinadores]);

  async function aplicar() {
    if (!kind || !from || !to) return;
    setBusy(true);
    try {
      if (kind === "residuo") {
        const t = tipos.find((x) => x.id === to);
        if (!t) throw new Error("Resíduo não encontrado");
        await renameDmrLinhasResiduo(uploadId, from, t.nome);
        toast.success(`"${from}" → ${t.nome}`);
      } else {
        const d = destCad.find((x) => x.id === to);
        if (!d) throw new Error("Destinador não encontrado");
        await renameDmrLinhasDestinador(uploadId, from, d.nome);
        toast.success(`"${from}" → ${d.nome}`);
      }
      qc.invalidateQueries({ queryKey: ["dmr_linhas", uploadId] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Alterar equivalências</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div>
            <Label className="text-xs">O que deseja alterar?</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="residuo">Resíduo</SelectItem>
                <SelectItem value="destinador">Destinador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind && (
            <>
              <div>
                <Label className="text-xs">
                  {kind === "residuo" ? "Resíduo da DMR" : "Destinador da DMR"}
                </Label>
                <Select value={from} onValueChange={setFrom}>
                  <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                  <SelectContent>
                    {origens.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Nada disponível.</div>
                    ) : origens.map((o) => (
                      <SelectItem key={o.texto} value={o.texto}>
                        {o.texto} <span className="text-muted-foreground">({o.ocorrencias})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {from && (
                <div>
                  <Label className="text-xs">
                    Nova equivalência ({kind === "residuo" ? "resíduo cadastrado" : "destinador cadastrado"})
                  </Label>
                  <Select value={to} onValueChange={setTo}>
                    <SelectTrigger><SelectValue placeholder="Selecionar…" /></SelectTrigger>
                    <SelectContent>
                      {kind === "residuo"
                        ? tipos.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.nome}{t.codigo ? ` (${t.codigo})` : ""}
                            </SelectItem>
                          ))
                        : destCad.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.nome}{d.cnpj ? ` — ${formatCNPJ(d.cnpj)}` : ""}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!kind || !from || !to || busy} onClick={aplicar}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
