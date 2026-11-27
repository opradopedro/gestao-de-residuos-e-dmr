// Modo demonstração (somente leitura).
//
// Ativado no build com VITE_DEMO_MODE=true (é o que o deploy do GitHub Pages usa).
// Toda gravação no banco (insert, update, upsert, delete) é bloqueada aqui, num ponto só,
// e devolve um erro com mensagem amigável. As telas já mostram esse erro num aviso.
// A leitura continua normal, então dá para navegar por tudo.
import { supabase } from "@/integrations/supabase/client";

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export const DEMO_MSG = "Esta é uma demonstração somente leitura. Nada foi salvo.";

const WRITE_METHODS = ["insert", "update", "upsert", "delete"] as const;

/** Resultado no mesmo formato do Supabase, com erro. Aceita qualquer encadeamento
 *  (.select(), .eq(), .single()...) e resolve com o erro quando é aguardado. */
function blockedQuery(): any {
  const result = {
    data: null,
    error: { message: DEMO_MSG, code: "demo_mode", details: null, hint: null },
    count: null,
    status: 403,
    statusText: "Demo mode",
  };
  const proxy: any = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") {
        return (onFulfilled?: (v: any) => any, onRejected?: (e: any) => any) =>
          Promise.resolve(result).then(onFulfilled, onRejected);
      }
      return () => proxy;
    },
    apply() {
      return proxy;
    },
  });
  return proxy;
}

if (DEMO_MODE) {
  // O cliente gerado pelo Lovable é um Proxy que só repassa leituras, então trocar
  // supabase.from não tem efeito. Bloqueamos no protótipo do construtor de consultas,
  // que é o mesmo para qualquer tabela e qualquer instância do cliente.
  const proto = Object.getPrototypeOf((supabase.from as (t: string) => any)("unidades"));
  for (const method of WRITE_METHODS) {
    Object.defineProperty(proto, method, { value: () => blockedQuery(), configurable: true, writable: true });
  }
}
