# Fila e dependências

```text
Concluído: 00 → 01A → 01B → 01C → 01D → 01E

Fila principal:
01F → 01G
02A → 02B → 02C → 02D
03A → 03B → 03C → 03D → 03E
04A → 04B → 04C → 04D → 04E
05A → 05B
06A → 06B → 06C → 06D
07A → 07B → 07C → 07D → 07E → 06E → 06F
07F → 07G → 07H → 07I → 07J → 07K
08A → 08B → 08C → 08D
09A → 09B → 09C

Portões condicionais antes do fechamento:
01G → 01H → 09A
02D → 02E → 09A
```

Essa é também a fila padrão de execução: escolher sempre o primeiro cartão não concluído. `01H` e `02E` são condicionais; se a condição ainda não existir, registrar o adiamento no handoff e seguir pelo ramo principal. Ambas precisam estar `DONE` antes de `09A`. Só é permitido pular outro cartão por bloqueio objetivo documentado.
