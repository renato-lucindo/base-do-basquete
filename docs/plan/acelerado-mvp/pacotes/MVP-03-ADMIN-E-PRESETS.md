# MVP-03 — Administração e criação por presets

- **Estado atual:** `DONE` — evidências em `docs/execution/MVP-03.md`
- **Incorpora:** `06A`, `06B`, `07A`, `07B`, `07C`, `07D`, `06E`, `06F`
- **Meta:** 2–3 janelas.

## Entregar

- Navegação administrativa separada em Competições, Equipes, Atletas e Segurança.
- Hub de equipes em accordion acessível, recolhido por padrão e com retorno por URL.
- Schema versionado/imutável de regulamento, hierarquia de etapas/grupos/rodadas, vagas, confrontos e partidas.
- Compilação e ativação atômica pelo banco, com constraints, detecção de ciclo e capacidades locais.
- Dois presets validados: grupo único e eliminatória simples.
- Criação transacional de edição privada com série, categoria, naipe, perfil, período, fonte e preset.
- Wizard responsivo que termina no hub e não expõe editor estrutural livre.

## Corte consciente

Remoção/retirada, clonagem e editor genérico ficam em `POST-02`. O MVP cria uma revisão independente a partir de presets internos versionados.

## Gate

Falha não deixa edição parcial; revisão ativa é imutável; formato não deriva do nome; limites esportivos e concorrência são testados; edições masculina/feminina e histórica/futura nascem privadas e coerentes; UI passa em 390/768/desktop.
