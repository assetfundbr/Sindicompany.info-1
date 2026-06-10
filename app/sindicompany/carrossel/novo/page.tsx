import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import {
  CARROSSEL_COVER_ARCHETYPES,
  CARROSSEL_FORMATOS,
} from "@/lib/sindicompany/carrosseis";
import { listMarcas } from "@/lib/sindicompany/marcas-db";
import { DashboardShell } from "../../shell";
import { iniciarCarrosselAction } from "../actions";
import { BrandTemaPicker } from "./brand-tema-picker";


// FORMATOS vem do registry compartilhado CARROSSEL_FORMATOS
// (lib/sindicompany/carrosseis.ts). 7 formatos com copy completo no
// openai-text.ts e render no carrossel_generate.py.
const FORMATOS = CARROSSEL_FORMATOS;

const inputCls =
  "block w-full rounded-md border border-onix-100 bg-white px-3 py-2 text-sm text-onix-900 focus:outline-none focus:ring-2 focus:ring-mint-300";

export default async function NovoCarrosselPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : "";
  const v = (k: string): string => {
    const val = params[k];
    return Array.isArray(val) ? val[0] ?? "" : val ?? "";
  };

  // Marcas (e seus temas) vem do DB — nova marca aparece aqui sem codigo.
  const marcasOptions = (await listMarcas({ ativo: true })).map((m) => ({
    slug: m.slug,
    nome: m.nome,
    handle: m.handle,
    temas: m.temasSugeridos ?? [],
  }));

  return (
    <DashboardShell>
      <main className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/sindicompany/carrossel"
          className="text-sm text-g60 hover:text-onix-900 mb-6 inline-block"
        >
          ← Voltar
        </Link>

        <header className="mb-8">
          <Stepper step={1} />
          <div className="text-xs uppercase tracking-[0.24em] text-mint-700 font-semibold mb-2 mt-6">
            Etapa 1 · Briefing
          </div>
          <h1 className="text-3xl font-bold text-onix-900">
            Comece pelo briefing
          </h1>
          <p className="text-sm text-g60 mt-2 max-w-xl">
            Conte tema, formato e quantidade de slides. A IA vai gerar 3 opções
            de copy pra você escolher na próxima etapa.
          </p>
        </header>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-6">
            {error}
          </div>
        )}

        <form action={iniciarCarrosselAction} className="space-y-6">
          <BrandTemaPicker
            marcas={marcasOptions}
            defaultBrand={v("brand") || "sindicompanybr"}
            defaultObjetivo={v("objetivo")}
            defaultTema={v("tema")}
            defaultTemaOutro={v("tema_outro")}
          />

          <Field
            label="Data de postagem"
            hint="Quando este carrossel vai ao ar. Identifica a postagem na listagem."
          >
            <input
              type="date"
              name="data_postagem"
              defaultValue={v("data_postagem")}
              required
              className={inputCls}
            />
          </Field>

          <Field label="Formato" hint="Como o conteúdo é apresentado.">
            <div className="grid grid-cols-2 gap-2">
              {FORMATOS.map((f) => (
                <label
                  key={f.id}
                  className="flex items-start gap-2 rounded-md border border-onix-100 bg-white px-3 py-2 cursor-pointer hover:bg-onix-50"
                >
                  <input
                    type="radio"
                    name="formato"
                    value={f.id}
                    defaultChecked={v("formato") === f.id}
                    required
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium text-onix-900">{f.label}</div>
                    <div className="text-xs text-g60">{f.hint}</div>
                  </div>
                </label>
              ))}
            </div>
          </Field>

          <Field
            label="Quantidade de slides"
            hint="De 5 a 10. Recomendado: 6 a 8."
          >
            <select
              name="n_slides"
              defaultValue={v("n_slides") || "6"}
              className={inputCls}
            >
              {Array.from({ length: 6 }, (_, i) => i + 5).map((n) => (
                <option key={n} value={n}>
                  {n} slides
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Estilo da capa"
            hint="Arquétipos do Brand Hub. Os marcados “com foto” usam a foto da etapa 3. Padrão clássica mantém o hero img + overlay escuro atual. Não afeta @consvictabr."
          >
            <select
              name="cover_archetype"
              defaultValue={v("cover_archetype")}
              className={inputCls}
            >
              <option value="">Padrão clássica (capa atual)</option>
              <optgroup label="Sem foto">
                {CARROSSEL_COVER_ARCHETYPES.filter((a) => !a.hasPhoto).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.hint}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Com foto (usa a foto da etapa 3)">
                {CARROSSEL_COVER_ARCHETYPES.filter((a) => a.hasPhoto).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label} — {a.hint}
                  </option>
                ))}
              </optgroup>
            </select>
          </Field>

          <div className="flex gap-3 pt-4 items-center">
            <button
              type="submit"
              className="rounded-lg bg-onix-900 text-white px-5 py-2.5 font-medium hover:bg-onix-800"
            >
              Seguir →
            </button>
            <span className="text-xs text-g60">
              A IA vai gerar 3 opções de copy. Pode levar 10-15 segundos.
            </span>
          </div>
        </form>
      </main>
    </DashboardShell>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: "Briefing" },
    { n: 2, label: "Escolher copy" },
    { n: 3, label: "Foto da capa" },
  ];
  return (
    <nav className="flex items-center gap-2 text-xs">
      {items.map((it, i) => {
        const active = it.n === step;
        const done = it.n < step;
        return (
          <div key={it.n} className="flex items-center gap-2">
            <span
              className={`w-6 h-6 inline-flex items-center justify-center rounded-full font-semibold ${
                active
                  ? "bg-onix-900 text-white"
                  : done
                    ? "bg-mint-100 text-mint-700"
                    : "bg-onix-50 text-g60"
              }`}
            >
              {done ? "✓" : it.n}
            </span>
            <span className={active ? "text-onix-900 font-medium" : "text-g60"}>
              {it.label}
            </span>
            {i < items.length - 1 && <span className="text-g60">›</span>}
          </div>
        );
      })}
    </nav>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-onix-900">{label}</label>
      {hint && <p className="text-xs text-g60">{hint}</p>}
      {children}
    </div>
  );
}
