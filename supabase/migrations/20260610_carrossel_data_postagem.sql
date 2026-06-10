-- =============================================================
-- Sindicompany Carrossel — data de postagem (2026-06-10)
-- =============================================================
-- A editora informa em qual data o carrossel vai ao ar. Substitui
-- o campo "Titulo interno" no form de criacao — o titulo passa a
-- ser auto-derivado da data ("Postagem DD/MM/YYYY") pra manter o
-- AI prompt e o fallback de capa funcionando sem migracao
-- big-bang. Carrosseis antigos conservam o titulo original; novos
-- gravam data_postagem + titulo derivado.

alter table public.carrosseis
  add column if not exists data_postagem date;

-- Indice pro calendario/listagem ordenar por data de postagem.
create index if not exists carrosseis_data_postagem_idx
  on public.carrosseis (data_postagem);
