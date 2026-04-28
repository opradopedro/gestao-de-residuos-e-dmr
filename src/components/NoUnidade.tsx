import { AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function NoUnidade() {
  return (
    <div className="p-8">
      <div className="max-w-md mx-auto text-center border border-dashed rounded-lg p-8 bg-card">
        <AlertCircle className="size-10 text-muted-foreground mx-auto mb-3" />
        <h2 className="text-lg font-semibold">Nenhuma unidade selecionada</h2>
        <p className="text-sm text-muted-foreground mt-1">Cadastre ou selecione uma unidade para continuar.</p>
        <Button asChild className="mt-4"><Link to="/cadastros">Ir para Cadastros</Link></Button>
      </div>
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
