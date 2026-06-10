"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/sindicompany/auth";
import {
  createCarrossel,
  createCarrosselFotoUploadIntent,
  deleteCarrossel,
  getCarrossel,
  isValidCoverArchetype,
  updateCarrossel,
  uploadCarrosselFotoBytes,
  type CarrosselInput,
} from "@/lib/sindicompany/carrosseis";
import { describeError } from "@/lib/sindicompany/errors";
import { dispatchGenerateCarrossel } from "@/lib/sindicompany/engine";
import { getMarca, listMarcas } from "@/lib/sindicompany/marcas-db";
import {
  buildCarrosselPromptSafe,
  generateImage,
} from "@/lib/sindicompany/openai-image";
import {
  descreverCenaParaCapa,
  gerarTresCopies,
  traduzirDescricaoUsuario,
} from "@/lib/sindicompany/openai-text";

const ALLOWED_IMG_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

interface UploadIntentResult {
  ok: true;
  uploadUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}
interface UploadIntentError {
  ok: false;
  error: string;
}

async function requireAuth() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token)) {
    redirect("/sindicompany/login");
  }
}

function getStr(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

function backTo(url: string, message: string, fd: FormData): never {
  const params = new URLSearchParams({ error: message });
  for (const [k, v] of fd.entries()) {
    if (typeof v === "string" && v) params.set(k, v);
  }
  redirect(`${url}?${params.toString()}`);
}

// =============================================================================
// Upload helpers (signed URL pra Storage)
// =============================================================================

export async function getCarrosselFotoUploadIntent(
  ext: string,
): Promise<UploadIntentResult | UploadIntentError> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }
  const e = ext.toLowerCase().replace(/^\./, "");
  if (!ALLOWED_IMG_EXT.has(e)) {
    return { ok: false, error: "Foto precisa ser jpg, png ou webp." };
  }
  try {
    const intent = await createCarrosselFotoUploadIntent(e);
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${baseUrl}/storage/v1/object/upload/sign/condominios-fotos/${intent.path}?token=${intent.token}`;
    return {
      ok: true,
      uploadUrl,
      token: intent.token,
      path: intent.path,
      publicUrl: intent.publicUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Falha desconhecida.",
    };
  }
}

// =============================================================================
// Etapa 1: cria carrossel + gera 3 copies → /[id]/copy
// =============================================================================

export async function iniciarCarrosselAction(formData: FormData): Promise<void> {
  await requireAuth();

  const brandRaw = getStr(formData, "brand");
  const marcasAtivas = await listMarcas({ ativo: true });
  const brand = marcasAtivas.some((m) => m.slug === brandRaw)
    ? brandRaw
    : "sindicompanybr";
  const objetivoRaw = getStr(formData, "objetivo");
  const objetivosValidos = [
    "comentarios",
    "salvamentos",
    "clientes",
    "autoridade",
    "educar",
  ];
  const objetivo = objetivosValidos.includes(objetivoRaw) ? objetivoRaw : "";
  // 'data_postagem' substituiu o antigo 'titulo' no form. O titulo
  // continua existindo na tabela (usado no AI prompt, fallback de capa,
  // ZIPs, listagem) e e auto-derivado da data como "Postagem DD/MM/YYYY".
  // HTML <input type="date"> ja garante o formato ISO YYYY-MM-DD.
  const data_postagem = getStr(formData, "data_postagem");
  const tituloDerivado = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data_postagem);
    return m ? `Postagem ${m[3]}/${m[2]}/${m[1]}` : "";
  })();
  const titulo = tituloDerivado;
  const temaSelecionado = getStr(formData, "tema");
  const temaOutro = getStr(formData, "tema_outro");
  const ehTemaLivre =
    temaSelecionado === "Outro" || temaSelecionado === "Outros";
  const tema = ehTemaLivre ? temaOutro : temaSelecionado;
  const formato = getStr(formData, "formato");
  const briefing = getStr(formData, "briefing");
  const n_slides_raw = parseInt(getStr(formData, "n_slides"), 10);
  const n_slides = Number.isFinite(n_slides_raw)
    ? Math.max(5, Math.min(10, n_slides_raw))
    : 6;
  const coverArchetypeRaw = getStr(formData, "cover_archetype");
  const cover_archetype = isValidCoverArchetype(coverArchetypeRaw)
    ? coverArchetypeRaw
    : undefined;

  if (!titulo) backTo("/sindicompany/carrossel/novo", "Informe a data de postagem.", formData);
  if (!objetivo) {
    backTo("/sindicompany/carrossel/novo", "Selecione o objetivo do carrossel.", formData);
  }
  if (!temaSelecionado) backTo("/sindicompany/carrossel/novo", "Selecione o tema.", formData);
  if (ehTemaLivre && !temaOutro) {
    backTo(
      "/sindicompany/carrossel/novo",
      "Descreva o tema na caixa de texto.",
      formData,
    );
  }
  if (!formato) backTo("/sindicompany/carrossel/novo", "Selecione o formato.", formData);

  const input: CarrosselInput = {
    brand,
    objetivo: objetivo || undefined,
    titulo,
    data_postagem: data_postagem || undefined,
    tema,
    formato,
    briefing: briefing || undefined,
    n_slides,
    cover_archetype,
  };

  let carrossel;
  try {
    carrossel = await createCarrossel(input);
  } catch (e) {
    backTo(
      "/sindicompany/carrossel/novo",
      `Falha ao criar carrossel: ${describeError(e)}`,
      formData,
    );
  }

  revalidatePath("/sindicompany/carrossel");
  redirect(`/sindicompany/carrossel/${carrossel.id}/copy`);
}

// =============================================================================
// Etapa 2: editora escolhe uma das 3 copies → /[id]/foto
// =============================================================================

export async function escolherCopyAction(
  carrosselId: string,
  idx: number,
): Promise<void> {
  await requireAuth();
  const i = Number.isInteger(idx) ? Math.max(0, Math.min(2, idx)) : 0;
  await updateCarrossel(carrosselId, { copy_selected: i });
  revalidatePath(`/sindicompany/carrossel/${carrosselId}`);
  redirect(`/sindicompany/carrossel/${carrosselId}/foto`);
}

export async function regenerarCopiesAction(carrosselId: string): Promise<void> {
  await requireAuth();
  const carrossel = await getCarrossel(carrosselId);
  if (!carrossel) {
    redirect("/sindicompany/carrossel");
  }
  const copies = await gerarTresCopies({
    brand: carrossel.brand ?? "sindicompanybr",
    objetivo: carrossel.objetivo ?? undefined,
    titulo: carrossel.titulo,
    tema: carrossel.tema ?? "",
    formato: carrossel.formato ?? "",
    n_slides: carrossel.n_slides ?? 6,
    briefing: carrossel.briefing ?? undefined,
  });
  if (copies.ok) {
    await updateCarrossel(carrosselId, {
      copy_options: copies.copies,
      copy_selected: null,
    });
  }
  revalidatePath(`/sindicompany/carrossel/${carrosselId}/copy`);
  redirect(`/sindicompany/carrossel/${carrosselId}/copy`);
}

// =============================================================================
// Etapa 3: foto + dispara geração final dos PNGs
// =============================================================================

export async function finalizarCarrosselAction(
  carrosselId: string,
): Promise<void> {
  await requireAuth();
  try {
    await updateCarrossel(carrosselId, { status: "em_producao" });
  } catch {
    // se falhar, segue — o engine tambem atualiza o status
  }
  await dispatchGenerateCarrossel(carrosselId);
  revalidatePath("/sindicompany/carrossel");
  revalidatePath(`/sindicompany/carrossel/${carrosselId}`);
  redirect("/sindicompany/carrossel");
}

export async function salvarSlideFotoAction(
  carrosselId: string,
  slideIdx: number,
  fotoUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada." };
  }
  if (!Number.isInteger(slideIdx) || slideIdx < 0 || slideIdx > 9) {
    return { ok: false, error: "Índice de slide inválido." };
  }
  try {
    const carrossel = await getCarrossel(carrosselId);
    if (!carrossel) return { ok: false, error: "Carrossel não encontrado." };
    const fotos: (string | null)[] = (carrossel.slide_fotos ?? []).slice();
    while (fotos.length <= slideIdx) fotos.push(null);
    fotos[slideIdx] = fotoUrl || null;
    await updateCarrossel(carrosselId, { slide_fotos: fotos });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

export async function salvarFotoCapaAction(
  carrosselId: string,
  fotoUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada." };
  }
  if (!fotoUrl) return { ok: false, error: "URL vazia." };
  try {
    await updateCarrossel(carrosselId, { foto_capa_url: fotoUrl });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: describeError(e) };
  }
}

// =============================================================================
// Geração da foto via DALL-E usando a copy escolhida como contexto
// =============================================================================

interface GenerateFotoOk {
  ok: true;
  publicUrl: string;
  revisedPrompt?: string;
}
interface GenerateFotoErr {
  ok: false;
  error: string;
}

export async function generateFotoCapaWithAI(input: {
  carrosselId: string;
  userPrompt?: string;
}): Promise<GenerateFotoOk | GenerateFotoErr> {
  try {
    await requireAuth();
  } catch {
    return { ok: false, error: "Sessão expirada. Faça login de novo." };
  }

  let carrosselRow: Awaited<ReturnType<typeof getCarrossel>>;
  try {
    carrosselRow = await getCarrossel(input.carrosselId);
  } catch (e) {
    return { ok: false, error: `Banco indisponível: ${describeError(e)}` };
  }
  if (!carrosselRow) return { ok: false, error: "Carrossel não encontrado." };
  const carrossel = carrosselRow;

  const idx = carrossel.copy_selected ?? 0;
  const copy = carrossel.copy_options?.[idx];
  const slide1 = copy?.slides?.[0];
  const tituloCapa = slide1?.titulo || carrossel.titulo;
  const subtitulo = slide1?.body || "";

  let subject = "";
  const userDesc = (input.userPrompt ?? "").trim();
  if (userDesc) {
    const t = await traduzirDescricaoUsuario(userDesc);
    if (t.ok) subject = t.descEn;
  } else {
    const cena = await descreverCenaParaCapa({
      tema: carrossel.tema,
      tituloCapa,
      subtitulo,
    });
    if (cena.ok) subject = cena.sceneEn;
  }

  const marca = await getMarca(carrossel.brand ?? "sindicompanybr");
  function paletteGuidance(): string {
    const pal = marca?.paleta;
    if (!pal) {
      return (
        `Color palette MUST be dominated by soft brand pastels: ` +
        `mint cyan #84C7D3, warm sand beige #DABDA9, soft lavender #B8C0FF, ` +
        `pure white #FFFFFF and very light gray #F4F4F5. Walls, clothing, ` +
        `furniture, plants and ambient light should pull toward this airy, ` +
        `low-saturation pastel range. Avoid heavy reds, oranges, dark blues, ` +
        `forest greens or saturated primaries. `
      );
    }
    const cores = [pal.mint, pal.sand, pal.lavender, pal.purple, pal.gray_5, pal.white]
      .filter(Boolean)
      .join(", ");
    return (
      `Color palette should be dominated by the brand colors: ${cores}. ` +
      `Walls, clothing, furniture, plants and ambient light should pull toward ` +
      `this brand range — harmonious, editorial, low-saturation. Avoid garish ` +
      `saturated primaries and colors that clash with this palette. `
    );
  }

  function buildPrompt(scene: string): string {
    return scene
      ? `Ultra-realistic editorial photograph, 8K quality, hyper-detailed, ` +
        `for Brazilian Instagram cover (4:5 vertical). ` +
        `Scene: ${scene} ` +
        `Style: cinematic documentary photo of a real Brazilian residential ` +
        `building setting, professional DSLR camera, natural daylight, shallow ` +
        `depth of field, sharp focus on subject, photorealistic textures, ` +
        `crisp details on every surface, no text, no logos. ` +
        paletteGuidance() +
        `Composition: subject occupies the TOP HALF of the frame; bottom half ` +
        `is calmer (sky, wall, blurred background) so 50% of the image can be ` +
        `covered by a text overlay added later.`
      : buildCarrosselPromptSafe({
          titulo: tituloCapa,
          tema: carrossel.tema,
        });
  }

  let result = await generateImage(buildPrompt(subject), {
    size: "1024x1792",
    quality: "standard",
    style: "natural",
  });

  if (!result.ok) {
    return {
      ok: false,
      error: /safety|content[_ ]policy|content[_ ]filter/i.test(result.error)
        ? `A OpenAI bloqueou a geração. Reescreva a descrição com cenas mais neutras (ambiente, objetos, clima) ou faça upload manual. (${result.error})`
        : result.error,
    };
  }

  let bytes: Buffer = result.bytes;

  try {
    const sharp = (await import("sharp")).default;
    bytes = await sharp(bytes)
      .resize({ width: 1080, height: 1350, fit: "cover", position: "centre" })
      .png()
      .toBuffer();
  } catch (e) {
    console.error("[carrossel] sharp crop falhou:", e);
    return {
      ok: false,
      error: `Falha ao ajustar imagem pra 4:5: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  let publicUrl: string;
  try {
    publicUrl = await uploadCarrosselFotoBytes(bytes);
  } catch (e) {
    return { ok: false, error: `Falha ao subir pro Storage: ${describeError(e)}` };
  }

  try {
    await updateCarrossel(input.carrosselId, { foto_capa_url: publicUrl });
  } catch {
    // não bloqueia — finalizar action também salva
  }

  return { ok: true, publicUrl, revisedPrompt: result.revised_prompt };
}

// =============================================================================
// Re-dispara geração final (retry / refazer)
// =============================================================================

export async function regenerateCarrosselAction(carrosselId: string): Promise<void> {
  await requireAuth();
  await dispatchGenerateCarrossel(carrosselId);
  revalidatePath(`/sindicompany/carrossel/${carrosselId}`);
}

// =============================================================================
// Excluir carrossel da lista
// =============================================================================

export async function excluirCarrosselAction(carrosselId: string): Promise<void> {
  await requireAuth();
  try {
    await deleteCarrossel(carrosselId);
  } catch (e) {
    console.error("[carrossel] falha ao excluir:", e);
  }
  revalidatePath("/sindicompany/carrossel");
  redirect("/sindicompany/carrossel");
}

export async function excluirVariosCarrosseisAction(
  formData: FormData,
): Promise<void> {
  await requireAuth();
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  for (const id of ids) {
    try {
      await deleteCarrossel(id);
    } catch (e) {
      console.error("[carrossel] falha ao excluir (bulk):", id, e);
    }
  }
  revalidatePath("/sindicompany/carrossel");
  redirect("/sindicompany/carrossel");
}
