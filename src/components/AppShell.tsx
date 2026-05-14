import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Recycle, LayoutDashboard, ClipboardList, BarChart3, FileSpreadsheet, Settings, Plus, ShieldAlert, Calendar, History } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { listUnidades, listColetasByUnidade, totalPesoColeta, isPendenciaSemMtr, isSemMtrOperacao, isPendenciaSemPeso, isErroPreenchimento, countMtrsDuplicadosUnicos, listAnosComColetas, listDestinadores, listTiposResiduo } from "@/lib/data";
import { useUnidadeAtiva, setUnidadeAtiva } from "@/hooks/use-unidade";
import { usePeriodoAtivo, setPeriodoAtivo } from "@/hooks/use-periodo";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { ImportStatusBanner } from "@/components/ImportStatusBanner";
import { HistoryDialog } from "@/components/HistoryDialog";

type NavItem = { to: string; label: string; icon: any; exact?: boolean; badge?: "risco" };
const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/coletas", label: "Coletas", icon: ClipboardList },
  { to: "/risco", label: "Riscos & Pendências", icon: ShieldAlert, badge: "risco" },
  { to: "/consolidacao", label: "Consolidação", icon: BarChart3 },
  { to: "/dmr", label: "DMR", icon: FileSpreadsheet },
  { to: "/cadastros", label: "Cadastros", icon: Settings },
];

const TRIS: { v: 1 | 2 | 3 | 4; l: string }[] = [
  { v: 1, l: "1º Tri (Jan-Mar)" },
  { v: 2, l: "2º Tri (Abr-Jun)" },
  { v: 3, l: "3º Tri (Jul-Set)" },
  { v: 4, l: "4º Tri (Out-Dez)" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [historyOpen, setHistoryOpen] = useState(false);
  const unidadeAtiva = useUnidadeAtiva();
  const periodo = usePeriodoAtivo();
  const { data: unidades = [] } = useQuery({ queryKey: ["unidades"], queryFn: listUnidades });
  const { data: anosDisponiveis = [] } = useQuery({ queryKey: ["anos-coletas"], queryFn: listAnosComColetas });
  const ANOS = useMemo(() => {
    const y = new Date().getFullYear();
    const set = new Set<number>(anosDisponiveis);
    set.add(y);
    return Array.from(set).sort((a, b) => a - b);
  }, [anosDisponiveis]);
  const { data: coletas = [] } = useQuery({
    queryKey: ["coletas", unidadeAtiva],
    queryFn: () => listColetasByUnidade(unidadeAtiva!),
    enabled: !!unidadeAtiva,
  });

  useEffect(() => {
    if (!unidadeAtiva && unidades.length > 0) setUnidadeAtiva(unidades[0].id);
    if (unidadeAtiva && unidades.length > 0 && !unidades.find((u) => u.id === unidadeAtiva)) {
      setUnidadeAtiva(unidades[0].id);
    }
  }, [unidadeAtiva, unidades]);

  const badges = useMemo(() => {
    const noTri = coletas.filter((c) => c.data >= periodo.start && c.data <= periodo.end);
    const semMtr = noTri.filter(isPendenciaSemMtr).length;
    const semPeso = noTri.filter(isPendenciaSemPeso).length;
    const errosPreench = noTri.filter(isErroPreenchimento).length;
    const dupExcess = countMtrDuplicatesExcess(noTri);
    const pesoSemMtr = noTri.filter(isPendenciaSemMtr).reduce((s, c) => s + totalPesoColeta(c), 0);
    const pendencias = semMtr + semPeso + dupExcess + errosPreench;
    const risco = (semMtr > 5 || pesoSemMtr > 1000 || semPeso > 0)
      ? "alto"
      : pendencias > 0 ? "medio" : "ok";
    return { pendencias, risco, semMtr, semPeso, dupExcess, errosPreench };
  }, [coletas, periodo.start, periodo.end]);

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground flex-col">
        <div className="p-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Recycle className="size-5" />
          </div>
          <div>
            <div className="font-semibold leading-tight">DMR Conferência</div>
            <div className="text-xs text-muted-foreground">Gestão de Resíduos</div>
          </div>
        </div>
        <div className="px-4 pt-4 pb-2 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Unidade</label>
            {unidades.length === 0 ? (
              <Link to="/cadastros" className="mt-1 block text-sm text-primary underline">Cadastrar unidade</Link>
            ) : (
              <Select value={unidadeAtiva ?? undefined} onValueChange={(v) => setUnidadeAtiva(v)}>
                <SelectTrigger className="mt-1 w-full bg-card h-9">
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
          <div>
            <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Período</label>
            <div className="flex gap-2 mt-1">
              <Select value={String(periodo.trimestre)} onValueChange={(v) => setPeriodoAtivo({ ano: periodo.ano, trimestre: Number(v) as 1 | 2 | 3 | 4 })}>
                <SelectTrigger className="bg-card h-9 flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIS.map((t) => <SelectItem key={t.v} value={String(t.v)}>{t.l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(periodo.ano)} onValueChange={(v) => setPeriodoAtivo({ ano: Number(v), trimestre: periodo.trimestre })}>
                <SelectTrigger className="bg-card h-9 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button asChild className="w-full mt-2" size="sm">
            <Link to="/coletas/nova"><Plus className="size-4 mr-1" /> Nova coleta</Link>
          </Button>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          <TooltipProvider delayDuration={150}>
          {NAV.map((item) => {
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            const Icon = item.icon;
            const showRisk = item.badge === "risco" && (badges.risco === "alto" || badges.pendencias > 0);
            const linkEl = (
              <Link
                key={item.to}
                to={item.to as any}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
                {showRisk && (
                  <span className={cn("text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-5 text-center",
                    badges.risco === "alto" ? "bg-destructive text-destructive-foreground" : "bg-warning text-warning-foreground")}>
                    {badges.risco === "alto" ? "!" : String(badges.pendencias)}
                  </span>
                )}
              </Link>
            );
            if (!showRisk) return linkEl;
            return (
              <Tooltip key={item.to}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right" className="text-left">
                  <div className="space-y-0.5">
                    {badges.semMtr > 0 && <div>{badges.semMtr} coleta(s) sem MTR</div>}
                    {badges.semPeso > 0 && <div>{badges.semPeso} coleta(s) sem peso</div>}
                    {badges.dupExcess > 0 && <div>{badges.dupExcess} MTR(s) duplicado(s)</div>}
                    {badges.errosPreench > 0 && <div>{badges.errosPreench} erro(s) de preenchimento</div>}
                    {badges.pendencias === 0 && <div>Sem pendências no período</div>}
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
          </TooltipProvider>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors text-sidebar-foreground hover:bg-sidebar-accent/60"
          >
            <History className="size-4" />
            <span className="flex-1 text-left">Histórico</span>
          </button>
        </nav>
      </aside>
      <main className="flex-1 min-w-0">
        {/* Mobile header */}
        <div className="md:hidden border-b border-border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Recycle className="size-5 text-primary" />
              <span className="font-semibold">DMR</span>
            </div>
            {unidades.length > 0 && (
              <Select value={unidadeAtiva ?? undefined} onValueChange={(v) => setUnidadeAtiva(v)}>
                <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 text-muted-foreground" />
            <Select value={String(periodo.trimestre)} onValueChange={(v) => setPeriodoAtivo({ ano: periodo.ano, trimestre: Number(v) as 1 | 2 | 3 | 4 })}>
              <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIS.map((t) => <SelectItem key={t.v} value={String(t.v)}>{t.l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(periodo.ano)} onValueChange={(v) => setPeriodoAtivo({ ano: Number(v), trimestre: periodo.trimestre })}>
              <SelectTrigger className="h-8 text-xs w-20"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANOS.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="md:hidden border-b border-border overflow-x-auto">
          <div className="flex gap-1 p-2">
            {NAV.map((item) => {
              const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
              return (
                <Link key={item.to} to={item.to as any} className={cn("text-xs px-3 py-2 rounded-md whitespace-nowrap", active ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
        <ImportStatusBanner />
        {children}
      </main>
      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} unidadeId={null} />
    </div>
  );
}
