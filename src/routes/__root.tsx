import { Outlet, createRootRouteWithContext, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/AppShell";
import { useEffect } from "react";

import appCss from "../styles.css?url";

interface RouterContext {
  queryClient: QueryClient;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">A página que você procura não existe.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "App TCC Resíduos" },
      { name: "description", content: "Sistema multiunidade para gestão, validação e reconciliação de DMR. EM TESTE" },
      { property: "og:title", content: "App TCC Resíduos" },
      { name: "twitter:title", content: "App TCC Resíduos" },
      { property: "og:description", content: "Sistema multiunidade para gestão, validação e reconciliação de DMR. EM TESTE" },
      { name: "twitter:description", content: "Sistema multiunidade para gestão, validação e reconciliação de DMR. EM TESTE" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    // Remove company-specific browser state once per browser/tab after the data reset.
    // Do not touch sign-in storage or unrelated application settings.
    const resetKey = "dmr.data-reset-2026-11-27";
    let removed = false;
    try {
      if (!localStorage.getItem(resetKey)) {
        for (const key of ["dmr.unidade_ativa", "dmr.periodo", "import-job-state-v1"]) {
          removed = localStorage.getItem(key) !== null || removed;
          localStorage.removeItem(key);
        }
        localStorage.setItem(resetKey, "done");
      }
      if (!sessionStorage.getItem(resetKey)) {
        removed = sessionStorage.getItem("coletas-list-state") !== null || removed;
        sessionStorage.removeItem("coletas-list-state");
        sessionStorage.setItem(resetKey, "done");
      }
      if (removed) window.location.reload();
    } catch {
      // Storage may be blocked by the browser; server data has already been reset.
    }
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
