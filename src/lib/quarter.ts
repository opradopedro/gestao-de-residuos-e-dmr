export type QuarterKey = `${number}-T${1 | 2 | 3 | 4}`;

export function quarterOf(date: Date | string): { ano: number; trimestre: 1 | 2 | 3 | 4; key: QuarterKey; label: string } {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : date;
  const ano = d.getFullYear();
  const trimestre = (Math.floor(d.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  const labels = ["Jan-Mar", "Abr-Jun", "Jul-Set", "Out-Dez"];
  return { ano, trimestre, key: `${ano}-T${trimestre}`, label: `${labels[trimestre - 1]} ${ano}` };
}

export function quarterRange(ano: number, trimestre: 1 | 2 | 3 | 4): { start: string; end: string } {
  const startMonth = (trimestre - 1) * 3;
  const start = new Date(ano, startMonth, 1);
  const end = new Date(ano, startMonth + 3, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export function currentQuarter() {
  return quarterOf(new Date());
}
