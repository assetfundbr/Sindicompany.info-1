import { createAdminClient } from "@/lib/supabase/admin";
import type { MarcaSlug } from "@/lib/sindicompany/marcas-db";

export type CarrosselStatus = "rascunho" | "em_producao" | "publicada" | "erro";

export interface CarrosselSlide {
  tipo: string;
  titulo: string;
  body: string;
}

export interface CarrosselCopy {
  slides: CarrosselSlide[];
  legenda: string;
}

// Slug da marca. A lista valida vive na tabela `marcas` (marcas-db.ts);
// nao e mais um union chumbado.
export type CarrosselBrand = MarcaSlug;

// Arquetipos de capa do Brand Hub Sindicompany 2026-05-17. Espelha o
// registry COVER_ARCHETYPES_SC do revista-engine/api/carrossel_generate.py.
// hasPhoto indica se o arquetipo consome a foto da etapa 3 do
// /sindicompany/carrossel/novo. Aplica so a sindicompanybr +
// bysindicompany — Consvicta sempre usa a capa propria.
export type CarrosselCoverArchetype =
  | "numbered-guide"
  | "manifesto"
  | "pattern-explosion"
  | "sticky-note"
  | "brackets"
  | "type-tower"
  | "corner-tape"
  | "foto-editorial"
  | "dark-premium"
  | "magazine-cover"
  | "split-portrait"
  | "hero-portrait"
  | "photo-circle"
  | "photo-banner"
  | "photo-blur"
  | "cinema"
  | "polaroid"
  | "portrait-frame";

export const CARROSSEL_COVER_ARCHETYPES: {
  id: CarrosselCoverArchetype;
  label: string;
  hasPhoto: boolean;
  hint: string;
}[] = [
  // SEM foto (7) — selecionados pela Juliana 2026-05-18
  { id: "numbered-guide", label: "Numbered guide", hasPhoto: false, hint: "Split número Navy / headline" },
  { id: "manifesto", label: "Manifesto", hasPhoto: false, hint: "Italic gigante sobre fundo Cyan" },
  { id: "pattern-explosion", label: "Pattern explosion", hasPhoto: false, hint: "Pattern topo + card Paper na base" },
  { id: "sticky-note", label: "Sticky note", hasPhoto: false, hint: "Card Beige tipo post-it rotacionado" },
  { id: "brackets", label: "Brackets", hasPhoto: false, hint: "Colchetes Beige gigantes envolvendo headline" },
  { id: "type-tower", label: "Type tower", hasPhoto: false, hint: "Palavras empilhadas em tamanhos crescentes" },
  { id: "corner-tape", label: "Corner tape", hasPhoto: false, hint: "Fitas Cyan diagonais nos 4 cantos + headline centralizada" },
  // COM foto (11) — consomem foto_capa_url da etapa 3
  { id: "foto-editorial", label: "Foto Editorial", hasPhoto: true, hint: "Foto full + degradê + tarja de formato + título e subtítulo (capa clássica nomeada)" },
  { id: "dark-premium", label: "Dark Premium", hasPhoto: true, hint: "Foto full + gradient Navy" },
  { id: "magazine-cover", label: "Magazine cover", hasPhoto: true, hint: "Masthead + foto + faixa Paper" },
  { id: "split-portrait", label: "Split portrait", hasPhoto: true, hint: "Foto 45% esquerda + texto 55% Paper" },
  { id: "hero-portrait", label: "Hero portrait", hasPhoto: true, hint: "Foto full + tag mono + box Beige" },
  { id: "photo-circle", label: "Foto circular", hasPhoto: true, hint: "Círculo grande centralizado + texto abaixo" },
  { id: "photo-banner", label: "Photo banner", hasPhoto: true, hint: "Foto top 60% + Paper bottom com headline" },
  { id: "photo-blur", label: "Photo blur", hasPhoto: true, hint: "Foto desfocada como background + headline crisp" },
  { id: "cinema", label: "Cinema", hasPhoto: true, hint: "Foto em faixa cinemascope central (imagem sempre centrada)" },
  { id: "polaroid", label: "Polaroid", hasPhoto: true, hint: "Foto em moldura polaroid rotacionada com sombra" },
  { id: "portrait-frame", label: "Portrait frame", hasPhoto: true, hint: "Foto em quadro Beige com inner border Navy" },
];

const COVER_ARCHETYPE_IDS = new Set(CARROSSEL_COVER_ARCHETYPES.map((a) => a.id));

export function isValidCoverArchetype(s: string): s is CarrosselCoverArchetype {
  return COVER_ARCHETYPE_IDS.has(s as CarrosselCoverArchetype);
}

// FORMATO do carrossel — define a estrutura narrativa e o COPY do post
// (historia real, lista, etc). Espelha o dict FORMATO_INSTRUCOES do
// openai-text.ts (gerador de copy) e do carrossel_generate.py (render).
// O slug bate 1:1 com carrosseis.formato. 7 formatos com copy completo
// e testado. NAO confundir com "Flow" — Flow sera a variacao ESTETICA
// dos slides 2..penultimo e nao toca no copy.
export type CarrosselFormato =
  | "historia_real"
  | "lista"
  | "mito_verdade"
  | "antes_depois"
  | "dado_choca"
  | "tutorial"
  | "opiniao"
  | "hook_punch"
  | "pov"
  | "tweet"
  | "expectativa_realidade"
  | "erro_fatal"
  | "bastidor"
  | "camada_invisivel"
  | "dialogo"
  | "desabafo"
  | "escalada";

export const CARROSSEL_FORMATOS: {
  id: CarrosselFormato;
  label: string;
  hint: string;
}[] = [
  { id: "historia_real", label: "História real", hint: "O que mais engaja e salva" },
  { id: "lista", label: "Lista", hint: "5–7 itens numerados" },
  { id: "mito_verdade", label: "Mito vs. Verdade", hint: "Compara crenças com fatos" },
  { id: "antes_depois", label: "Antes / Depois", hint: "Mostra transformação" },
  { id: "dado_choca", label: "Dado que choca", hint: "Estatística com peso" },
  { id: "tutorial", label: "Tutorial rápido", hint: "Passo a passo prático" },
  { id: "opiniao", label: "Opinião forte", hint: "Posição com argumento" },
  { id: "hook_punch", label: "Hook Punch", hint: "Frases curtas, alto impacto, ritmo rápido" },
  { id: "pov", label: "POV", hint: "Identificação extrema: 'isso sou eu'" },
  { id: "tweet", label: "Tweet style", hint: "Frase curta, printável, repostável" },
  { id: "expectativa_realidade", label: "Expectativa vs Realidade", hint: "Humor e identificação" },
  { id: "erro_fatal", label: "Erro fatal", hint: "Medo de errar + solução" },
  { id: "bastidor", label: "Bastidor real", hint: "Documental, humaniza a marca" },
  { id: "camada_invisivel", label: "Camada invisível", hint: "Profundidade: 'nunca pensei nisso'" },
  { id: "dialogo", label: "Diálogo", hint: "Conversa com punch final" },
  { id: "desabafo", label: "Desabafo controlado", hint: "Vulnerabilidade íntima, cria comunidade" },
  { id: "escalada", label: "A escalada", hint: "Tensão crescente, cinematográfica" },
];

const FORMATO_IDS = new Set(CARROSSEL_FORMATOS.map((f) => f.id));

export function isValidFormato(s: string): s is CarrosselFormato {
  return FORMATO_IDS.has(s as CarrosselFormato);
}

// Templates de CTA — define o FECHAMENTO do carrossel (ultimo slide).
// Cada CTA tem uma intencao de acao distinta. Quando preenchido em
// carrosseis.cta_template, sobrescreve o CTA default embedado em
// FORMATO_INSTRUCOES da engine. Slug bate 1:1 com os leaves em
// social-media/ctas/ do asset-hierarchy.
export type CarrosselCtaTemplate =
  | "comente"
  | "compartilhe"
  | "salve"
  | "segue"
  | "whatsapp"
  | "link";

export const CARROSSEL_CTA_TEMPLATES: {
  id: CarrosselCtaTemplate;
  label: string;
  hint: string;
  instruction: string;
}[] = [
  {
    id: "comente",
    label: "Comente",
    hint: "Convida pra debate binário",
    instruction:
      "CTA DE COMENTARIO: pergunta binaria que obriga posicionamento " +
      "(ex: 'Comenta SIM ou NAO', 'CONCORDO ou DISCORDO', 'MORADOR CERTO " +
      "ou SINDICO CERTO'). Sucesso = numero de comentarios, nao alcance.",
  },
  {
    id: "compartilhe",
    label: "Compartilhe",
    hint: "Convida pra marcar/enviar",
    instruction:
      "CTA DE COMPARTILHAMENTO: convida a marcar alguem ou enviar pra " +
      "grupo (ex: 'Manda pro morador certo', 'Marca alguem que precisa " +
      "ver isso', 'Envia no grupo do condominio'). Use quando o conteudo " +
      "for util pra circulo proximo.",
  },
  {
    id: "salve",
    label: "Salve",
    hint: "Convida pra guardar pra consulta",
    instruction:
      "CTA DE SALVAMENTO: convida a salvar pra consulta futura (ex: " +
      "'Salva esse post', 'Voce vai precisar', 'Guarda esse checklist'). " +
      "Use quando o conteudo for referencia pratica (tutorial, checklist, " +
      "dado, manual).",
  },
  {
    id: "segue",
    label: "Segue",
    hint: "Convida pra seguir o perfil",
    instruction:
      "CTA DE SEGUIR: convida a seguir o perfil pra mais conteudo do mesmo " +
      "tema (ex: 'Segue pra mais sobre condominio', 'Te entrego mais 1 por " +
      "semana'). Use com moderacao — so quando o perfil ainda nao foi " +
      "introduzido ou quando o tema e nicho.",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    hint: "Convida pra abrir conversa",
    instruction:
      "CTA DE WHATSAPP: convida a iniciar conversa direta (ex: 'Chama no " +
      "WhatsApp', 'Manda \"OI\" no direct e a gente resolve'). Use quando o " +
      "objetivo for converter em atendimento/venda. Adapte o tom: " +
      "sindicompany e direto, by e consultivo, consvicta e boutique.",
  },
  {
    id: "link",
    label: "Link",
    hint: "Convida pra clicar no link da bio",
    instruction:
      "CTA DE LINK: convida a acessar o link da bio/perfil pra material " +
      "completo (ex: 'Link na bio pra baixar o checklist completo', 'No " +
      "perfil voce encontra o template'). Use quando houver oferta " +
      "ancorada (PDF, formulario, calculadora).",
  },
];

const CTA_TEMPLATE_IDS = new Set(CARROSSEL_CTA_TEMPLATES.map((c) => c.id));

export function isValidCtaTemplate(s: string): s is CarrosselCtaTemplate {
  return CTA_TEMPLATE_IDS.has(s as CarrosselCtaTemplate);
}

export interface Carrossel {
  id: string;
  brand: CarrosselBrand;
  objetivo: string | null;
  titulo: string;
  data_postagem: string | null;
  tema: string | null;
  formato: string | null;
  briefing: string | null;
  foto_capa_url: string | null;
  cover_archetype: CarrosselCoverArchetype | null;
  n_slides: number;
  status: CarrosselStatus;
  png_paths: string[] | null;
  zip_url: string | null;
  slide_fotos: string[] | null;
  legenda: string | null;
  erro_mensagem: string | null;
  gerado_em: string | null;
  copy_options: CarrosselCopy[] | null;
  copy_selected: number | null;
  created_at: string;
  updated_at: string;
}

export interface CarrosselInput {
  brand?: CarrosselBrand;
  objetivo?: string;
  titulo: string;
  data_postagem?: string;
  tema?: string;
  formato?: string;
  briefing?: string;
  foto_capa_url?: string;
  cover_archetype?: CarrosselCoverArchetype;
  n_slides?: number;
}

export async function updateCarrossel(
  id: string,
  patch: Partial<{
    foto_capa_url: string;
    copy_options: CarrosselCopy[];
    copy_selected: number | null;
    slide_fotos: (string | null)[];
    status: CarrosselStatus;
  }>,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

const TABLE = "carrosseis";
const BUCKET = "condominios-fotos"; // reaproveita o bucket público

export async function listCarrosseis(): Promise<Carrossel[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Carrossel[];
}

export async function getCarrossel(id: string): Promise<Carrossel | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as Carrossel | null;
}

export async function createCarrossel(input: CarrosselInput): Promise<Carrossel> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      ...input,
      brand: input.brand ?? "sindicompanybr",
      status: "rascunho" as CarrosselStatus,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Carrossel;
}

export async function deleteCarrossel(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

/** Upload da foto de capa do carrossel via signed URL. Path fixo
 *  no bucket público condominios-fotos pra reaproveitar a infra. */
export async function createCarrosselFotoUploadIntent(
  ext: string,
): Promise<{ token: string; path: string; publicUrl: string }> {
  const e = ext.toLowerCase().replace(/^\./, "");
  const path = `__carrosseis/foto-${Date.now()}.${e}`;
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { token: data.token, path, publicUrl: pub.publicUrl };
}

/** Sobe bytes (de uma imagem gerada por IA, por exemplo) direto pro
 *  bucket via service role e devolve a URL pública. */
export async function uploadCarrosselFotoBytes(
  bytes: Buffer,
  contentType = "image/png",
): Promise<string> {
  const path = `__carrosseis/ai-${Date.now()}.png`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return pub.publicUrl;
}
