import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AutocompleteOption = {
  value: string;
  label: string;
  sublabel?: string | null;
  searchTokens?: string[];
};

type Props = {
  value: string;
  onChange: (value: string, option?: AutocompleteOption) => void;
  options: AutocompleteOption[];
  placeholder?: string;
  className?: string;
  emptyText?: string;
};

export function Autocomplete({ value, onChange, options, placeholder, className, emptyText = "Nenhum resultado" }: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options
      .filter((o) => {
        const tokens = [o.label, o.sublabel ?? "", ...(o.searchTokens ?? [])].join(" ").toLowerCase();
        return tokens.includes(q);
      })
      .slice(0, 12);
  }, [value, options]);

  function pick(o: AutocompleteOption) {
    onChange(o.value, o);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <Input
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHighlight(0); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && filtered[highlight]) { e.preventDefault(); pick(filtered[highlight]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-auto">
          {filtered.map((o, i) => (
            <button
              type="button"
              key={o.value + i}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2",
                i === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/60"
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.sublabel && <span className="text-xs text-muted-foreground shrink-0">{o.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
      {open && value.trim() && filtered.length === 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md p-3 text-sm text-muted-foreground">
          {emptyText}
        </div>
      )}
    </div>
  );
}
