## Arquivo 6 de 9 — `app/sindicompany/carrossel/novo/brand-tema-picker.tsx` (substituir TUDO)

**Onde editar:**

1. Abre: `https://github.com/dicadajumoreira/Sindicompany.info/blob/main/app/sindicompany/carrossel/novo/brand-tema-picker.tsx`
2. **Lápis** → "Edit this file" → **Ctrl+A** → **Delete**.
3. Cola o conteúdo abaixo:

```typescript
"use client";

import { useState } from "react";

const inputCls =
  "block w-full rounded-md border border-onix-100 bg-white px-3 py-2 text-sm text-onix-900 focus:outline-none focus:ring-2 focus:ring-mint-300";

// Objetivos GLOBAIS — iguais pra todas as marcas (decisao da Juliana).
// Os ids batem 1:1 com OBJETIVO_INSTRUCOES do openai-text.ts.
const OBJETIVOS = [
  {
    id: "comentarios",
    label: "Gerar comentários (debate)",
    hint: "Divide opiniões. CTA binário (SIM/NÃO). Sucesso = discussão.",
  },
  {
    id: "salvamentos",
    label: "Gerar salvamentos (utilidade)",
    hint: "Tão útil que guarda. Ancora lei/dado. CTA 'Salva esse post'.",
  },
  {
    id: "clientes",
    label: "Atrair clientes",
    hint: "Mostra dor + resultado com número. CTA leve, nunca anúncio.",
  },
  {
    id: "autoridade",
    label: "Posicionar autoridade",
    hint: "Manifesto/tendência/visão de mercado. CTA institucional.",
  },
  {
    id: "educar",
    label: "Educar o público",
    hint: "Surpresa + identificação. Linguagem acessível, sem juridiquês.",
  },
];

export interface MarcaOption {
  slug: string;
  nome: string;
  handle: string;
  temas: string[];
}

interface Props {
  marcas: MarcaOption[];
  defaultBrand: string;
  defaultObjetivo: string;
  defaultTema: string;
  defaultTemaOutro: string;
}

/** Seletor de MARCA + OBJETIVO + TEMA do /carrossel/novo. As marcas e os
 *  temas vem do DB (tabela marcas); o objetivo e global. Trocar a marca
 *  troca a lista de temas e define a voz/estrategia do copy (la no
 *  gerarTresCopies, via persona da marca). */
export function BrandTemaPicker({
  marcas,
  defaultBrand,
  defaultObjetivo,
  defaultTema,
  defaultTemaOutro,
}: Props) {
  const initialBrand = marcas.some((m) => m.slug === defaultBrand)
    ? defaultBrand
    : marcas[0]?.slug ?? "";
  const [brand, setBrand] = useState(initialBrand);
  const temas = marcas.find((m) => m.slug === brand)?.temas ?? [];
  // Ordem alfabetica (pt-BR, ignora acento/caixa) e remove qualquer
  // 'Outro'/'Outros' vindo do DB pra nao duplicar a opcao fixa de tema
  // livre, que sempre fica por ultimo.
  const temasOrdenados = [...temas]
    .filter((t) => t !== "Outro" && t !== "Outros")
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  const [objetivo, setObjetivo] = useState(defaultObjetivo);
  const [tema, setTema] = useState(
    temas.includes(defaultTema) ? defaultTema : "",
  );
  const isOutro = tema === "Outro" || tema === "Outros";

  function onBrandChange(slug: string) {
    setBrand(slug);
    const novaLista = marcas.find((m) => m.slug === slug)?.temas ?? [];
    if (tema !== "Outro" && !novaLista.includes(tema)) setTema("");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-onix-900">Marca</label>
        <p className="text-xs text-g60">
          Pra qual Instagram este carrossel é. Cada marca tem público,
          objetivo e linguagem próprios.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {marcas.map((m) => (
            <label
              key={m.slug}
              className="flex items-start gap-2 rounded-md border border-onix-100 bg-white px-3 py-2 cursor-pointer hover:bg-onix-50"
            >
              <input
                type="radio"
                name="brand"
                value={m.slug}
                checked={brand === m.slug}
                onChange={() => onBrandChange(m.slug)}
                required
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-onix-900">{m.handle}</div>
                <div className="text-xs text-g60">{m.nome}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-onix-900">
          Objetivo do carrossel
        </label>
        <p className="text-xs text-g60">
          O que o post precisa provocar — muda tom, gancho, formato, CTA e
          critério de sucesso. Escolha UM.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OBJETIVOS.map((o) => (
            <label
              key={o.id}
              className="flex items-start gap-2 rounded-md border border-onix-100 bg-white px-3 py-2 cursor-pointer hover:bg-onix-50"
            >
              <input
                type="radio"
                name="objetivo"
                value={o.id}
                checked={objetivo === o.id}
                onChange={() => setObjetivo(o.id)}
                required
                className="mt-1"
              />
              <div>
                <div className="text-sm font-medium text-onix-900">
                  {o.label}
                </div>
                <div className="text-xs text-g60">{o.hint}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-onix-900">Tema</label>
        <p className="text-xs text-g60">
          Assunto principal do carrossel. Selecione &quot;Outro&quot; pra
          digitar um tema livre.
        </p>
        <select
          name="tema"
          value={tema}
          onChange={(e) => setTema(e.target.value)}
          required
          className={inputCls}
        >
          <option value="">— Selecione —</option>
          {temasOrdenados.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
          <option value="Outro">Outro (tema livre)</option>
        </select>
        {isOutro && (
          <input
            type="text"
            name="tema_outro"
            defaultValue={defaultTemaOutro}
            required
            maxLength={120}
            placeholder="Descreva o tema"
            className={`${inputCls} mt-2`}
          />
        )}
      </div>
    </div>
  );
}
```

4. Scroll → **"Commit changes..."** → **"Commit changes"**.

Me confirma pra eu mandar o **arquivo 7** (o `novo/page.tsx` com o input de data).
