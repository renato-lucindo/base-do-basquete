---
id: TSK-007
tipo: decisao
dependencias: [TSK-003, TSK-004, TSK-005]
risco: alto
---

# Definir rollout, compatibilidade e rollback

## Objetivo

Impedir que mudanças de modelo, rotas ou cache interrompam o painel existente.

## Escopo permitido

Plano de implantação; sem mudança de produto.

## Passos

1. Classificar cada migration como aditiva, backfill ou retirada futura.
2. Definir ordem: banco compatível → código leitor → código escritor → validação.
3. Definir feature flags para novas rotas, estatísticas avançadas e súmula manual.
4. Definir sinais de rollback e procedimento reversível.
5. Preservar `/admin` e os fluxos atuais durante a transição.
6. Proibir rollback por exclusão de dados.

## Critérios de aceite

- Cada marco M1–M5 tem entrada, saída e reversão.
- Há caminho de compatibilidade com dados legados.
- Responsável e janela de observação estão definidos.

## Não alterar

Ambientes, flags ou banco.
