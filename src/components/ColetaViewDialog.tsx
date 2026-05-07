import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getColeta } from "@/lib/data";
import { formatDate, formatKgPlain } from "@/lib/format";
import { Pencil } from "lucide-react";

export function ColetaViewDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: c, isLoading } = useQuery({
    queryKey: ["coleta", id],
    queryFn: () => getColeta(id!),
    enabled: !!id,
  });
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Visualizar coleta</DialogTitle></DialogHeader>
        {isLoading || !c ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data" value={formatDate(c.data)} />
              <Field label="MTR" value={c.mtr || "—"} />
              <Field label="Destinador" value={c.destinador || "—"} />
              <Field label="Transportador" value={c.transportador || "—"} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {c.peso_estimado && <Badge variant="outline">Peso estimado</Badge>}
              {c.dmr_manual && <Badge>DMR manual</Badge>}
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Itens</div>
              <div className="border rounded divide-y">
                {(c.itens ?? []).map((it) => (
                  <div key={it.id} className="flex justify-between p-2">
                    <span>{it.tipo_residuo_nome} <span className="text-muted-foreground text-xs">· {it.tratamento}</span></span>
                    <span className="tabular-nums">{formatKgPlain(Number(it.peso_kg))}</span>
                  </div>
                ))}
              </div>
            </div>
            {c.observacoes && (
              <div>
                <div className="text-xs uppercase text-muted-foreground mb-1">Observações</div>
                <div className="text-sm whitespace-pre-wrap">{c.observacoes}</div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          {c && (
            <Button asChild onClick={onClose}>
              <Link to="/coletas/$id" params={{ id: c.id }}><Pencil className="size-4 mr-1" /> Abrir / editar</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
