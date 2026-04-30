import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useImportJob } from "@/hooks/use-import-job";
import { clearImportJob } from "@/lib/import-job";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ImportStatusBanner() {
  const job = useImportJob();
  const qc = useQueryClient();

  // Quando concluído, invalidar caches relevantes
  useEffect(() => {
    if (job?.status === "done") {
      qc.invalidateQueries({ queryKey: ["coletas"] });
      qc.invalidateQueries({ queryKey: ["tipos_residuo"] });
      qc.invalidateQueries({ queryKey: ["tratamentos"] });
      qc.invalidateQueries({ queryKey: ["destinadores"] });
      qc.invalidateQueries({ queryKey: ["transportadores"] });
      qc.invalidateQueries({ queryKey: ["audit_log"] });
    }
  }, [job?.status, qc]);

  if (!job) return null;

  const pct = job.total > 0 ? Math.round((job.done / job.total) * 100) : 0;
  const isRunning = job.status === "running";
  const isDone = job.status === "done";
  const isError = job.status === "error";

  return (
    <div
      className={cn(
        "border-b px-4 py-2 flex items-center gap-3 text-sm",
        isRunning && "bg-primary/10 border-primary/30",
        isDone && "bg-success/10 border-success/30",
        isError && "bg-destructive/10 border-destructive/30",
      )}
    >
      <div className="shrink-0">
        {isRunning && <Loader2 className="size-4 animate-spin text-primary" />}
        {isDone && <CheckCircle2 className="size-4 text-success" />}
        {isError && <AlertTriangle className="size-4 text-destructive" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {isRunning && `Importando "${job.fileName}"… ${job.done}/${job.total} (${pct}%)`}
          {isDone && `Importação concluída: ${job.criadas} criadas, ${job.atualizadas} atualizadas, ${job.ignoradas} ignoradas`}
          {isError && `Erro na importação: ${job.errorMsg ?? "desconhecido"}`}
        </div>
        {isRunning && (
          <div className="w-full bg-muted rounded h-1.5 overflow-hidden mt-1">
            <div className="bg-primary h-full transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
      {!isRunning && (
        <Button size="sm" variant="ghost" onClick={() => clearImportJob()}>
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
