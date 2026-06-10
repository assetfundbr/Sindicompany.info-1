/**
 * Dispara a geração da revista via GitHub Actions.
 *
 * O workflow `.github/workflows/generate-revista.yml` aceita
 * `workflow_dispatch` e roda a engine Python que escreve o PDF
 * direto no Supabase. Aqui só fazemos um POST de "fire and forget".
 *
 * Env vars necessárias:
 *   GITHUB_DISPATCH_TOKEN   PAT com permissão Actions:write no repo
 *   GITHUB_REPO             "owner/repo" (ex: "dicadajumoreira/Hubstation")
 *
 * Se uma das duas faltar, o disparo é pulado com warning no console
 * (a revista fica em em_producao até alguém intervir manualmente).
 */

const WORKFLOW_FILE = "generate-revista.yml";
const REF = "main";

export interface DispatchResult {
  triggered: boolean;
  reason?: string;
}

export async function dispatchGenerateRevista(revistaId: string): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    console.warn(
      "[engine] GITHUB_DISPATCH_TOKEN ou GITHUB_REPO ausente — geração não disparada",
    );
    return { triggered: false, reason: "missing-env" };
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: REF,
        inputs: { revista_id: revistaId },
      }),
    });

    if (res.status === 204) {
      console.log(`[engine] disparou workflow pra revista ${revistaId}`);
      return { triggered: true };
    }

    const text = await res.text();
    console.error(`[engine] falha no dispatch (${res.status}):`, text);
    return { triggered: false, reason: `gh-${res.status}` };
  } catch (e) {
    console.error("[engine] erro de rede no dispatch:", e);
    return { triggered: false, reason: "network" };
  }
}

const CARROSSEL_WORKFLOW_FILE = "generate-carrossel.yml";

/** Dispara o workflow de geração dos PNGs do carrossel Instagram.
 *  Mesma estratégia do dispatchGenerateRevista — fire and forget. */
export async function dispatchGenerateCarrossel(
  carrosselId: string,
): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;

  if (!token || !repo) {
    console.warn(
      "[engine] GITHUB_DISPATCH_TOKEN ou GITHUB_REPO ausente — carrossel não disparado",
    );
    return { triggered: false, reason: "missing-env" };
  }

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${CARROSSEL_WORKFLOW_FILE}/dispatches`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: REF,
        inputs: { carrossel_id: carrosselId },
      }),
    });

    if (res.status === 204) {
      console.log(`[engine] disparou workflow pra carrossel ${carrosselId}`);
      return { triggered: true };
    }

    const text = await res.text();
    console.error(`[engine] dispatch carrossel falhou (${res.status}):`, text);
    return { triggered: false, reason: `gh-${res.status}` };
  } catch (e) {
    console.error("[engine] erro de rede no dispatch carrossel:", e);
    return { triggered: false, reason: "network" };
  }
}
