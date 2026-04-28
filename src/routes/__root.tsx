import { Outlet, createRootRouteWithContext, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/AppShell";

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
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9764e54d-7bb3-44d0-81d5-6f2f02aeb5da/id-preview-560b3fbd--70db2a74-2843-4b69-88cf-11ce5d2c06b6.lovable.app-1777395168413.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9764e54d-7bb3-44d0-81d5-6f2f02aeb5da/id-preview-560b3fbd--70db2a74-2843-4b69-88cf-11ce5d2c06b6.lovable.app-1777395168413.png" },
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
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell>
        <Outlet />
      </AppShell>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
