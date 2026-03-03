# Super Picareta

![Textura do item](imagens/textura_item_super_picareta.png)

## Resumo

A Super Picareta e uma ferramenta de mineracao que, ao quebrar um bloco, automaticamente escava um tunel inteiro na direcao em que o jogador esta olhando. Preserva minerios e ancient debris, removendo apenas os blocos que nao interessam ao minerador.

**NAO possui entidade projetil** — e uma ferramenta de mao, nao um arremessavel.

---

## Dados do item

| Propriedade | Valor |
|-------------|-------|
| Identificador | `escavadora:super_picareta` |
| Namespace | `escavadora` |
| Categoria no menu | Equipment > Pickaxe |
| Stack maximo | 1 |
| Durabilidade | 1000 usos |
| Encantavel | Sim (slot: pickaxe, valor: 14) |
| Segurar na mao | Sim (`hand_equipped: true`) |
| Velocidade de mineracao | 10x em blocos stone/metal/diamond_pick/iron_pick |
| Reparavel | Sim — 1 diamante restaura 500 de durabilidade |
| Textura do item | `textures/items/super_picareta` |
| Nome pt_BR | "Super Picareta" |
| Nome en_US | "Super Pickaxe" |

---

## Arquivo: item JSON completo

**Caminho:** `Super Picareta BP/items/super_picareta.item.json`

```json
{
    "format_version": "1.21.10",
    "minecraft:item": {
        "description": {
            "identifier": "escavadora:super_picareta",
            "menu_category": {
                "category": "equipment",
                "group": "itemGroup.name.pickaxe"
            }
        },
        "components": {
            "minecraft:max_stack_size": 1,
            "minecraft:durability": {
                "max_durability": 1000
            },
            "minecraft:enchantable": {
                "slot": "pickaxe",
                "value": 14
            },
            "minecraft:hand_equipped": true,
            "minecraft:icon": {
                "textures": {
                    "default": "super_picareta"
                }
            },
            "minecraft:display_name": {
                "value": "item.escavadora:super_picareta.name"
            },
            "minecraft:digger": {
                "use_efficiency": true,
                "destroy_speeds": [
                    {
                        "block": {
                            "tags": "q.any_tag('stone', 'metal', 'diamond_pick_diggable', 'iron_pick_diggable')"
                        },
                        "speed": 10
                    }
                ]
            },
            "minecraft:repairable": {
                "repair_items": [
                    {
                        "items": ["minecraft:diamond"],
                        "repair_amount": 500
                    }
                ]
            }
        }
    }
}
```

### Explicacao dos componentes

- **`minecraft:digger`**: Define que a picareta minera blocos com tags `stone`, `metal`, `diamond_pick_diggable` e `iron_pick_diggable` a velocidade 10 (muito rapido). O `use_efficiency: true` permite que o encantamento Eficiencia aumente ainda mais a velocidade.
- **`minecraft:enchantable`**: Slot `pickaxe` com valor 14 (equivalente ao diamante), permitindo encantamentos como Eficiencia, Fortuna, Toque Suave, etc.
- **`minecraft:repairable`**: Usar 1 diamante numa bigorna restaura 500 pontos (metade da durabilidade total).
- **`minecraft:hand_equipped`**: Faz o item ser segurado na mao como uma ferramenta (inclinado), nao como um bloco.

---

## Comportamento via Script

**Arquivo:** `Super Picareta BP/scripts/main.js` (linhas 1-61)

**Evento escutado:** `world.afterEvents.playerBreakBlock`

### Fluxo de execucao

1. Jogador quebra um bloco com a Super Picareta equipada
2. O script verifica se o item e `escavadora:super_picareta`
3. Captura a posicao do bloco quebrado (x, y, z) e a dimensao
4. Detecta a direcao cardinal do jogador (Norte/Sul/Leste/Oeste)
5. Calcula os limites do tunel
6. No proximo tick (`system.run`), itera todos os blocos na area do tunel
7. Remove todos os blocos EXCETO minerios e ancient debris

### Deteccao de direcao

Usa `player.getViewDirection()` que retorna um vetor normalizado (x, y, z):

- Calcula `absX = Math.abs(viewDir.x)` e `absZ = Math.abs(viewDir.z)`
- **Se absX > absZ**: Jogador olhando predominantemente para Leste/Oeste
  - Eixo do tunel: X (positivo ou negativo conforme viewDir.x)
  - Largura: ao longo do eixo Z
- **Se absZ >= absX**: Jogador olhando predominantemente para Norte/Sul
  - Eixo do tunel: Z (positivo ou negativo conforme viewDir.z)
  - Largura: ao longo do eixo X

### Dimensoes do tunel

```
Profundidade (eixo de visao): 10 blocos adiante
Largura (perpendicular):      3 blocos (1 esquerda + centro + 1 direita)
Altura:                        6 blocos (1 abaixo + nivel + 4 acima)
```

Ou seja: **10 x 3 x 6 = 180 blocos** processados por uso.

### Blocos preservados

O script NAO remove os seguintes blocos:

- Qualquer bloco cujo `typeId` contenha `"ore"` (todos os minerios: iron_ore, gold_ore, diamond_ore, coal_ore, lapis_ore, redstone_ore, emerald_ore, copper_ore, deepslate variants, nether_gold_ore, nether_quartz_ore, etc.)
- `minecraft:ancient_debris` (material do Netherite)

Todos os outros blocos (stone, dirt, deepslate, netherrack, etc.) sao substituidos por `minecraft:air`.

### Tratamento de erros

Se ocorrer qualquer erro durante a escavacao, uma mensagem e exibida no chat:
```
[Super Picareta] Erro: <mensagem>
```

---

## Arquivos relacionados

| Arquivo | Funcao |
|---------|--------|
| `Super Picareta BP/items/super_picareta.item.json` | Definicao do item |
| `Super Picareta BP/scripts/main.js` (L1-61) | Logica de escavacao |
| `Super Picareta RP/textures/items/super_picareta.png` | Textura do item |
| `Super Picareta RP/textures/item_texture.json` | Mapeamento de textura |
| `Super Picareta RP/texts/pt_BR.lang` | Nome em portugues |
| `Super Picareta RP/texts/en_US.lang` | Nome em ingles |

> **Nota:** A Super Picareta NAO tem entidade, modelo 3D, animacao, render controller ou attachable — e apenas um item com script. Os outros 3 itens (TNT, Bomba, Sinalizadora) tem entidades projetil com modelos 3D proprios.

---

## Imagens de referencia do design

- `imagens/referencia_picareta.png`
- `imagens/referencia_picareta2.jpeg`
- `imagens/referencia_picareta3.png`
