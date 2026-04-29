import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  label: string;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

export function MultiSelectFilter({ label, options, value, onChange, className }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = options.filter((o) => o.toLowerCase().includes(q.toLowerCase()));

  function toggle(opt: string) {
    if (value.includes(opt)) onChange(value.filter((v) => v !== opt));
    else onChange([...value, opt]);
  }

  const summary = value.length === 0 ? label : value.length === 1 ? value[0] : `${label} (${value.length})`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-between font-normal", className)}>
          <span className="truncate">{summary}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value.length > 0 && (
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); onChange([]); }}
                className="rounded-sm hover:bg-muted p-0.5"
                aria-label="Limpar"
              >
                <X className="size-3" />
              </span>
            )}
            <ChevronDown className="size-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-2 w-72" align="start">
        <Input
          autoFocus
          placeholder="Buscar..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-8 mb-2"
        />
        <div className="max-h-64 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="text-xs text-muted-foreground p-2">Nenhuma opção</div>
          ) : (
            filtered.map((opt) => (
              <label key={opt} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                <Checkbox checked={value.includes(opt)} onCheckedChange={() => toggle(opt)} />
                <span className="truncate">{opt}</span>
              </label>
            ))
          )}
        </div>
        {value.length > 0 && (
          <div className="border-t mt-2 pt-2 flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{value.length} selecionado(s)</span>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onChange([])}>Limpar</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
