import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Recycle, LayoutDashboard, ClipboardList, AlertTriangle, BarChart3, FileSpreadsheet, Settings, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { listUnidades } from "@/lib/data";
import { useUnidadeAtiva, setUnidadeAtiva } from "@/hooks/use-unidade";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: any; exact?: boolean };
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/coletas", label: "Coletas", icon: ClipboardList },
  { to: "/pendencias", label: "Pendências", icon: AlertTriangle },
  { to: "/consolidacao", label: "Consolidação", icon: BarChart3 },
  { to: "/dmr", label: "DMR", icon: FileSpreadsheet },
  { to: "/cadastros", label: "Cadastros", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const unidadeAtiva = useUnidadeAtiva();
  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });

  // Auto-select primeira unidade
  useEffect(() => {
    if (!unidadeAtiva && unidades.length > 0) setUnidadeAtiva(unidades[0].id);
    if (unidadeAtiva && unidades.length > 0 && !unidades.find((u) => u.id === unidadeAtiva)) {
      setUnidadeAtiva(unidades[0].id);
    }
  }, [unidadeAtiva, unidades]);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-64 border-r border-border bg-sidebar text-sidebar-foreground flex-col">
        <div className="p-6 flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Recycle className="size-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">DMR Conferência</div>
            <div className="text-xs text-muted-foreground">Gestão de Resíduos</div>
          </div>
        </div>
        <div className="px-4 pb-2">
          <label className="text-xs uppercase tracking-wide text-muted-foreground px-2">Unidade ativa</label>
          {unidades.length === 0 ? (
            <Link to="/cadastros" className="mt-1 block text-sm text-primary underline px-2">Cadastrar unidade</Link>
          ) : (
            <Select value={unidadeAtiva ?? undefined} onValueChange={(v) => setUnidadeAtiva(v)}>
              <SelectTrigger className="mt-1 w-full bg-card">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {unidades.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button asChild className="w-full" size="sm">
            <Link to="/coletas/nova"><Plus className="size-4 mr-1" /> Nova coleta</Link>
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="md:hidden border-b border-border p-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Recycle className="size-5 text-primary" />
            <span className="font-semibold">DMR</span>
          </div>
          {unidades.length > 0 && (
            <Select value={unidadeAtiva ?? undefined} onValueChange={(v) => setUnidadeAtiva(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="md:hidden border-b border-border overflow-x-auto">
          <div className="flex gap-1 p-2">
            {NAV.map((item) => {
              const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to} className={cn("text-xs px-3 py-2 rounded-md whitespace-nowrap", active ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
