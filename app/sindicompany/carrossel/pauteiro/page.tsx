import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import {
  listCarrosseis,
  type Carrossel,
} from "@/lib/sindicompany/carrosseis";
import { listMarcas } from "@/lib/sindicompany/marcas-db";
import { describeError } from "@/lib/sindicompany/errors";
import { DashboardShell } from "../../shell";

const DIAS_SEMANA = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"];
const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const FORMATO_LABEL: Record<string, string> = {
  mito_verdade: "Mito vs Verdade",
  historia_real: "História Real",
  lista: "Lista",
  antes_depois: "Antes / Depois",
  tutorial: "Tutorial",
  opiniao: "Opinião",
  pergunta: "Pergunta",
  dado: "Dado",
  dialogo: "Diálogo",
  manifesto: "Manifesto",
  bastidor: "Bastidor",
  contraste: "Contraste",
};

const STATUS_DOT: Record<Carrossel["status"], string> = {
  rascunho: "bg-onix-300",
  em_producao: "bg-mint-400",
  publicada: "bg-mint-600",
  erro: "bg-red-500",
};

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Monta a grade do mes em linhas de 7 dias comecando na SEGUNDA — mesmo
 *  layout do pauteiro PDF (SEG, TER, QUA, QUI, SEX, SAB, DOM). Inclui dias
 *  do mes anterior/posterior pra completar as semanas das pontas. Devolve
 *  strings ISO YYYY-MM-DD pra casar direto com a coluna data_postagem. */
function weekRows(year: number, month0: number): { iso: string; day: number; otherMonth: boolean }[][] {
  const first = new Date(Date.UTC(year, month0, 1));
  const last = new Date(Date.UTC(year, month0 + 1, 0));
  const startWeekday = ((first.getUTCDay() + 6) % 7) + 1; // 1..7 (SEG..DOM)
  const cells: { iso: string; day: number; otherMonth: boolean }[] = [];
  for (let i = 1; i < startWeekday; i++) {
    const d = new Date(Date.UTC(year, month0, 1 - (startWeekday - i)));
    cells.push({ iso: d.toISOString().slice(0, 10), day: d.getUTCDate(), otherMonth: true });
  }
  for (let d = 1; d <= last.getUTCDate(); d++) {
    const dt = new Date(Date.UTC(year, month0, d));
    cells.push({ iso: dt.toISOString().slice(0, 10), day: d, otherMonth: false });
  }
  while (cells.length % 7 !== 0) {
    const tail = cells[cells.length - 1];
    const dt = new Date(Date.UTC(year, month0, tail.day + 1));
    cells.push({
      iso: dt.toISOString().slice(0, 10),
      day: dt.getUTCDate(),
      otherMonth: tail.otherMonth || dt.getUTCMonth() !== month0,
    });
  }
  const rows: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

/** YYYY-MM atual no fuso de SP (evita 'pular' o dia se rodar perto da
 *  meia-noite UTC). */
function currentYearMonthSP(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`;
}

export default async function PauteiroPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; mes?: string }>;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }

  const { brand: brandParam, mes: mesParam } = await searchParams;

  let marcas: { slug: string; handle: string; nome: string }[] = [];
  let dbError: string | null = null;
  try {
    const all = await listMarcas({ ativo: true });
    marcas = all.map((m) => ({ slug: m.slug, handle: m.handle, nome: m.nome }));
  } catch (e) {
    dbError = `Não consegui carregar as marcas: ${describeError(e)}`;
  }

  const brand =
    marcas.find((m) => m.slug === brandParam)?.slug ?? marcas[0]?.slug ?? "";

  // Valida mes (YYYY-MM); default = mes atual em SP
  const mes = /^\d{4}-\d{2}$/.test(mesParam ?? "") ? mesParam! : currentYearMonthSP();
  const [yearStr, monthStr] = mes.split("-");
  const year = parseInt(yearStr, 10);
  const month0 = parseInt(monthStr, 10) - 1;
  const mesLabel = `${MESES_PT[month0]} ${year}`;

  let carrosseisDoMes: Carrossel[] = [];
  if (brand && !dbError) {
    try {
      const all = await listCarrosseis();
      const ini = `${year}-${pad2(month0 + 1)}-01`;
      const fim = `${year}-${pad2(month0 + 1)}-31`;
      carrosseisDoMes = all.filter(
        (c) =>
          c.brand === brand &&
          c.data_postagem != null &&
          c.data_postagem >= ini &&
          c.data_postagem <= fim,
      );
    } catch (e) {
      dbError = `Não consegui carregar os carrosséis: ${describeError(e)}`;
    }
  }

  // Agrupa por data
  const porDia = new Map<string, Carrossel[]>();
  for (const c of carrosseisDoMes) {
    if (!c.data_postagem) continue;
    const arr = porDia.get(c.data_postagem) ?? [];
    arr.push(c);
    porDia.set(c.data_postagem, arr);
  }

  const rows = weekRows(year, month0);
  const prevMes = shiftMonth(mes, -1);
  const nextMes = shiftMonth(mes, +1);
  const brandLink = (slug: string) =>
    `/sindicompany/carrossel/pauteiro?brand=${encodeURIComponent(slug)}&mes=${mes}`;
  const mesLink = (m: string) =>
    `/sindicompany/carrossel/pauteiro?brand=${encodeURIComponent(brand)}&mes=${m}`;

  return (
    <DashboardShell>
      <main className="max-w-6xl mx-auto px-6 py-12">
        <header className="flex items-start justify-between mb-8">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2">
              Carrosséis · Pauteiro
            </div>
            <h1 className="text-4xl font-bold text-onix-900 leading-tight">
              Pauteiro
            </h1>
            <p className="text-sm text-g60 mt-2 max-w-md">
              Calendário de postagens do mês por marca, com base na data de
              postagem informada em cada carrossel.
            </p>
          </div>
          <Link
            href="/sindicompany/carrossel"
            className="inline-flex items-center px-4 py-2.5 rounded-lg border border-onix-200 bg-white text-onix-900 font-medium hover:bg-onix-50 text-sm"
          >
            ← Voltar pra listagem
          </Link>
        </header>

        {dbError && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 mb-6">
            {dbError}
          </div>
        )}

        {/* Tabs de marca */}
        {marcas.length > 0 && (
          <nav
            aria-label="Marca"
            className="flex flex-wrap gap-2 mb-6 border-b border-onix-100 pb-3"
          >
            {marcas.map((m) => {
              const active = m.slug === brand;
              return (
                <Link
                  key={m.slug}
                  href={brandLink(m.slug)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                    active
                      ? "bg-onix-900 text-white"
                      : "bg-onix-50 text-onix-900 hover:bg-onix-100"
                  }`}
                >
                  {m.handle}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Navegador de mes */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={mesLink(prevMes)}
            className="inline-flex items-center px-3 py-1.5 rounded-md border border-onix-200 bg-white text-sm text-onix-900 hover:bg-onix-50"
          >
            ← {(() => {
              const [py, pm] = prevMes.split("-").map(Number);
              return `${MESES_PT[pm - 1]} ${py}`;
            })()}
          </Link>
          <h2 className="text-lg font-semibold text-onix-900">{mesLabel}</h2>
          <Link
            href={mesLink(nextMes)}
            className="inline-flex items-center px-3 py-1.5 rounded-md border border-onix-200 bg-white text-sm text-onix-900 hover:bg-onix-50"
          >
            {(() => {
              const [py, pm] = nextMes.split("-").map(Number);
              return `${MESES_PT[pm - 1]} ${py}`;
            })()}{" "}
            →
          </Link>
        </div>

        {/* Calendario */}
        <div className="rounded-xl border border-onix-100 bg-white overflow-hidden">
          {/* Cabecalho dos dias */}
          <div className="grid grid-cols-7 bg-onix-50 border-b border-onix-100">
            {DIAS_SEMANA.map((d) => (
              <div
                key={d}
                className="px-3 py-2 text-[11px] font-semibold tracking-[0.16em] text-onix-800 text-center"
              >
                {d}
              </div>
            ))}
          </div>
          {/* Semanas */}
          {rows.map((row, ri) => (
            <div
              key={ri}
              className="grid grid-cols-7 border-b border-onix-100 last:border-b-0"
            >
              {row.map((cell) => {
                const items = porDia.get(cell.iso) ?? [];
                return (
                  <div
                    key={cell.iso}
                    className={`min-h-[120px] border-r border-onix-100 last:border-r-0 px-2 py-2 ${
                      cell.otherMonth ? "bg-onix-50/40" : "bg-white"
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold mb-1.5 ${
                        cell.otherMonth ? "text-g60" : "text-onix-900"
                      }`}
                    >
                      {cell.day}
                    </div>
                    <div className="space-y-1.5">
                      {items.map((c) => (
                        <Link
                          key={c.id}
                          href={`/sindicompany/carrossel/${c.id}`}
                          className="block rounded-md border border-mint-200 bg-mint-50 px-2 py-1.5 hover:bg-mint-100"
                          title={c.tema ?? c.titulo}
                        >
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span
                              className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT[c.status]}`}
                              aria-label={c.status}
                            />
                            <span className="text-[10px] uppercase tracking-wider text-mint-800 font-semibold truncate">
                              {c.formato
                                ? FORMATO_LABEL[c.formato] ?? c.formato
                                : "—"}
                            </span>
                          </div>
                          <div className="text-xs text-onix-900 font-medium leading-tight line-clamp-2">
                            {c.tema ?? c.titulo}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {brand && carrosseisDoMes.length === 0 && !dbError && (
          <p className="text-sm text-g60 mt-6">
            Nenhum carrossel agendado pra esse mês em {brand}. Crie um novo
            carrossel e informe a data de postagem pra ele aparecer aqui.
          </p>
        )}
      </main>
    </DashboardShell>
  );
}
