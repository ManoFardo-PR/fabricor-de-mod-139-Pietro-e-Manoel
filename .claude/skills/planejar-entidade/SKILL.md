---
name: planejar-entidade
description: Planeja todos os componentes, arquivos e comportamentos necessarios antes de criar uma entidade/mob no Minecraft Bedrock. Use ANTES de criar-mob para garantir que nada seja esquecido. Gera um plano completo com checklist de arquivos, componentes, animacoes e scripts.
argument-hint: "[nome-do-mob] [descricao-detalhada-do-mob]"
---

# Planejar Entidade - Minecraft Bedrock Addon

Quando invocado, analise a descricao do mob e gere um **plano completo** antes de criar qualquer arquivo.
O primeiro argumento e o nome do mob (snake_case), o segundo e a descricao detalhada do comportamento desejado.

## Fluxo Obrigatorio

### Fase 1 - Pesquisa
Antes de planejar, pesquise:
1. Use o agent `mob-researcher` para verificar se existe mob similar no codebase
2. Pesquise na wiki do Bedrock (wiki.bedrock.dev) entidades vanilla similares
3. Verifique qual addon/namespace sera usado (escavadora:, slime_armor:, multiplicador:, ou novo)
4. Identifique o `runtime_identifier` vanilla mais adequado

### Fase 2 - Classificacao do Tipo
Classifique a entidade em uma das categorias abaixo e use como base:

| Tipo | runtime_identifier | Componentes-chave |
|------|-------------------|-------------------|
| Hostil bipede | minecraft:zombie | melee_attack, nearest_attackable_target, hurt_by_target, burns_in_daylight |
| Hostil ranged | minecraft:skeleton | ranged_attack, shooter, nearest_attackable_target |
| Passivo quadrupede | minecraft:cow | tempt, breed, follow_parent, panic |
| Passivo voador | minecraft:bee | movement.hover, navigation.hover |
| NPC/Trader | minecraft:villager_v2 | trade_table, interact, scheduler |
| Boss | minecraft:ender_dragon | damage_sensor (imunidades), area_attack, custom_hit_test, health alto |
| Projetil | minecraft:snowball ou minecraft:arrow | projectile, collision_box pequeno (0.25), sem AI goals |
| Montavel | minecraft:horse | rideable, input_ground_controlled, tamemount, jump_strength |
| Aquatico | minecraft:dolphin | movement.amphibious, navigation.swim, breathable |
| Neutro | minecraft:wolf | ataca so quando provocado (damage_sensor + events) |

### Fase 3 - Componentes BP (Server-Side)
Liste TODOS os componentes necessarios, organizados por categoria:

#### Obrigatorios (toda entidade)
- `minecraft:collision_box` - width e height em blocos
- `minecraft:physics` - gravidade e colisao
- `minecraft:pushable` - se pode ser empurrado
- `minecraft:type_family` - familias/tags (mob, monster, animal, etc.)

#### Obrigatorios (exceto projeteis)
- `minecraft:health` - value e max
- `minecraft:nameable` - pode receber name tag
- `minecraft:experience_reward` - XP ao morrer

#### Fisicos (conforme necessidade)
- `minecraft:scale` - tamanho visual (1.0 = normal)
- `minecraft:knockback_resistance` - resistencia a knockback (0.0 a 1.0)
- `minecraft:fire_immune` - imune a fogo
- `minecraft:floats_in_liquid` - flutua em agua
- `minecraft:breathable` - configuracao de respiracao
- `minecraft:burns_in_daylight` - queima de dia (mortos-vivos)

#### Movimento (escolher um de cada)
Tipo de movimento:
- `minecraft:movement` - velocidade base (value: 0.25 padrao)
- `minecraft:movement.basic` - terrestre padrao
- `minecraft:movement.fly` - voo
- `minecraft:movement.hover` - paira no ar
- `minecraft:movement.amphibious` - terra e agua
- `minecraft:movement.glide` - planador
- `minecraft:movement.skip` - pulos (coelho)

Tipo de navegacao:
- `minecraft:navigation.walk` - caminhada (avoid_water, can_walk, etc.)
- `minecraft:navigation.fly` - voo (can_path_from_air)
- `minecraft:navigation.swim` - natacao
- `minecraft:navigation.hover` - hover
- `minecraft:navigation.climb` - escalada (aranhas)
- `minecraft:navigation.generic` - combina todos

Pulo:
- `minecraft:jump.static` - pulo padrao
- `minecraft:jump.dynamic` - pulo baseado em velocidade

#### Combate (se o mob ataca)
- `minecraft:attack` - dano base, effect_name, effect_duration
- `minecraft:behavior.nearest_attackable_target` - priority, entity_types com filters
- `minecraft:behavior.hurt_by_target` - priority (retalia ao ser atacado)
- `minecraft:behavior.melee_attack` - priority, speed_multiplier, track_target
- `minecraft:behavior.ranged_attack` - priority, attack_interval, attack_radius
- `minecraft:shooter` - def (projetil), power, aux_val (para ranged)
- `minecraft:behavior.charge_attack` - investida
- `minecraft:behavior.stomp_attack` - pisao
- `minecraft:behavior.leap_at_target` - pular no alvo
- `minecraft:follow_range` - distancia maxima de perseguicao
- `minecraft:damage_sensor` - triggers com filtros e eventos

#### AI Goals (listar em ordem de prioridade, menor numero = maior prioridade)
Prioridade 0:
- `minecraft:behavior.float` - flutua na agua (quase todo mob precisa)

Prioridade 1-2:
- `minecraft:behavior.panic` - foge quando toma dano (passivos)
- `minecraft:behavior.hurt_by_target` - retalia (hostis/neutros)
- `minecraft:behavior.avoid_mob_type` - foge de certo tipo

Prioridade 2-3:
- `minecraft:behavior.melee_attack` - ataque corpo a corpo
- `minecraft:behavior.ranged_attack` - ataque a distancia
- `minecraft:behavior.nearest_attackable_target` - busca alvo

Prioridade 3-4:
- `minecraft:behavior.tempt` - atraido por item
- `minecraft:behavior.breed` - reproducao
- `minecraft:behavior.follow_owner` - segue dono (pets)
- `minecraft:behavior.follow_parent` - segue pai (bebes)

Prioridade 5-6:
- `minecraft:behavior.random_stroll` - andar aleatorio
- `minecraft:behavior.eat_block` - comer blocos (ovelha)

Prioridade 7-8:
- `minecraft:behavior.look_at_player` - olhar para jogador
- `minecraft:behavior.random_look_around` - olhar aleatorio
- `minecraft:behavior.look_at_entity` - olhar para entidades

#### Interacao
- `minecraft:interact` - interacao com jogador (cooldown, itens, sons)
- `minecraft:rideable` - montavel (seat_count, seats positions)
- `minecraft:tameable` - domesticavel (tame_items, tame_event)
- `minecraft:leashable` - pode usar guia
- `minecraft:sittable` - pode sentar (pets)
- `minecraft:giveable` - pode receber itens
- `minecraft:breedable` - pode reproduzir (breed_items, breeds_with)
- `minecraft:ageable` - envelhece (duration, grow_up event)
- `minecraft:healable` - pode ser curado (items, filters)

#### Spawn/Despawn
- `minecraft:despawn` - despawn_from_distance (min_distance, max_distance)
- `minecraft:persistent` - nunca desaparece
- `minecraft:instant_despawn` - desaparece imediatamente

#### Drops/Loot
- `minecraft:loot` - table: "loot_tables/entities/[nome].json"
- `minecraft:experience_reward` - on_death (Molang)
- `minecraft:spawn_entity` - spawna entidades periodicamente (ovos)
- `minecraft:economy_trade_table` / `minecraft:trade_table` - trocas (NPCs)

#### Sensores
- `minecraft:entity_sensor` - detecta entidades proximas (subsensors)
- `minecraft:environment_sensor` - condicoes ambientais (triggers)
- `minecraft:target_nearby_sensor` - range de deteccao (inside_range, outside_range)
- `minecraft:damage_sensor` - reage a tipos de dano (triggers, events)

#### Efeitos/Status
- `minecraft:spell_effects` - efeitos de status ao adicionar/remover
- `minecraft:mob_effect` - aplica efeito a entidades proximas (area)
- `minecraft:fire_immune` - imune a fogo
- `minecraft:burns_in_daylight` - queima de dia

#### Component Groups e Events (comportamento condicional)
Definir grupos de componentes para estados diferentes:
```json
"component_groups": {
    "estado_calmo": { /* componentes de estado calmo */ },
    "estado_agressivo": { /* componentes de estado agressivo */ },
    "bebe": { "minecraft:is_baby": {}, "minecraft:scale": 0.5 },
    "adulto": { "minecraft:scale": 1.0 }
},
"events": {
    "ficou_bravo": {
        "add": { "component_groups": ["estado_agressivo"] },
        "remove": { "component_groups": ["estado_calmo"] }
    },
    "minecraft:entity_born": {
        "add": { "component_groups": ["bebe"] }
    },
    "minecraft:ageable_grow_up": {
        "remove": { "component_groups": ["bebe"] },
        "add": { "component_groups": ["adulto"] }
    }
}
```

### Fase 4 - Visual RP (Client-Side)
Planeje todos os elementos visuais:

#### Material
Escolher baseado no visual:
- `entity_alphatest` - padrao com transparencia
- `entity` - solido sem transparencia
- `entity_emissive` - brilha no escuro
- `entity_emissive_alpha` - brilha com transparencia
- `entity_change_color` - muda cor
- `entity_multitexture` - multiplas texturas sobrepostas

#### Modelo/Geometria
Listar todos os bones necessarios:

**Bipede padrao:**
- root, body, head, leftArm, rightArm, leftLeg, rightLeg

**Quadrupede padrao:**
- root, body, head, leg0, leg1, leg2, leg3

**Voador:**
- root, body, head, leftWing, rightWing, tail

**Customizado:**
- Descrever cada bone, seu pivot, tamanho e funcao

Definir:
- Tamanho da textura (potencia de 2: 16x16, 32x32, 64x64, 128x128)
- visible_bounds_width e visible_bounds_height

#### Animacoes
Listar todas as animacoes necessarias:
- `idle` - parado (breathing, balanco leve) - OBRIGATORIA
- `walk` - andando (pernas movendo, bracos balancando) - OBRIGATORIA para mobs que andam
- `attack` - atacando (braco levantando, boca abrindo) - se o mob ataca
- `death` - morrendo (caindo, desaparecendo) - opcional
- `fly` - voando (asas batendo) - se voa
- `swim` - nadando (corpo ondulando) - se nada
- `special` - habilidade especial (descricao) - se tem habilidade unica

#### Animation Controller
Definir state machine:
- Estado `default` (idle) - transicao para walk quando `query.is_moving`
- Estado `walking` - transicao para default quando `!query.is_moving`
- Estado `attacking` - transicao quando `query.is_attacking`
- Blend transitions entre estados (0.2 segundos padrao)

#### Render Controller
- Geometria: `Geometry.default`
- Material: `Material.default`
- Textura: `Texture.default`
- Part visibility condicional (se necessario)
- Overlay de textura (se necessario)

#### Spawn Egg (se spawnable)
- Cores primaria e secundaria (hex)
- Textura customizada (se desejado)

### Fase 5 - Script (se necessario)
Planejar integracao com `scripts/main.js`:

#### Quando usar script
- Comportamento muito customizado que nao existe em componentes nativos
- Particulas e sons customizados
- Interacoes complexas com jogador
- Spawning programatico

#### O que planejar
- Eventos a escutar: `entityHitEntity`, `entityDie`, `entityHurt`, etc.
- `system.runInterval()` - intervalo em ticks e logica
- Particulas a spawnar: `dimension.spawnParticle()`
- Sons a tocar: `dimension.playSound()`
- Estado por entidade: `Map()` com `entity.id`
- Cleanup em `entityRemove` ou `playerLeave`

### Fase 6 - Arquivos Auxiliares
Listar todos os arquivos extras necessarios:

#### Loot Table (se tem drops)
Arquivo: `[Addon] BP/loot_tables/entities/[nome_mob].json`
- Definir pools com itens, quantidades, probabilidades
- Funcoes: set_count, looting_enchant, etc.

#### Spawn Rules (se spawna naturalmente)
Arquivo: `[Addon] BP/spawn_rules/[nome_mob].spawn_rule.json`
- Biomas onde spawna
- Condicoes de luz (brightness_filter)
- Dificuldade (difficulty_filter)
- Altura (height_filter)
- Tamanho de grupo (herd)
- Superficie/subterraneo/subaquatico

#### Trade Table (se e NPC/trader)
Arquivo: `[Addon] BP/trading/[nome_mob].json`
- Tiers de troca
- Itens de entrada e saida

#### Receitas (se tem item associado)
Arquivo: `[Addon] BP/recipes/[nome_receita].recipe.json`
- Tipo: shaped ou shapeless
- Ingredientes e resultado

#### Attachable (se o mob tem item segurado/vestido)
Arquivo: `[Addon] RP/attachables/[nome_item].json`
- Material, geometria, render controller

#### Traducoes
Arquivos: `[Addon] RP/texts/pt_BR.lang` e `en_US.lang`
- `entity.[namespace]:[nome_mob].name=[Nome Legivel]`
- `item.[namespace]:[nome_item].name=[Nome Item]` (se tiver item associado)

### Fase 7 - Gerar Checklist Final
Gere o plano completo no formato abaixo e apresente ao usuario para aprovacao:

```markdown
# Plano de Entidade: [Nome do Mob]

## Classificacao
- **Tipo**: [hostil/passivo/neutro/projetil/NPC/boss/montavel]
- **Runtime Identifier**: minecraft:[vanilla]
- **Namespace**: [namespace]:
- **Addon**: [nome do addon]

## Checklist de Arquivos
1. [ ] BP entity: `[caminho completo]`
2. [ ] RP entity (client): `[caminho completo]`
3. [ ] Modelo .geo.json: `[caminho completo]`
4. [ ] Textura .png: `[caminho completo]` ⚠️ CRIAR MANUALMENTE
5. [ ] Animacoes: `[caminho completo]`
6. [ ] Animation Controller: `[caminho completo]`
7. [ ] Render Controller: `[caminho completo]`
8. [ ] Loot Table: `[caminho completo]` (se aplicavel)
9. [ ] Spawn Rules: `[caminho completo]` (se aplicavel)
10. [ ] Traducoes: pt_BR.lang e en_US.lang
11. [ ] Script main.js: [modificar/nao necessario]

## Componentes BP Planejados
### Fisicos
[lista de componentes com valores]

### Movimento
[tipo de movimento e navegacao com valores]

### Combate
[componentes de ataque com valores, ou "N/A"]

### AI Goals (prioridade)
[lista numerada de behavior.* com prioridades]

### Component Groups
[grupos e seus componentes]

### Events
[eventos e suas acoes]

## Visual RP Planejado
### Material: [tipo]
### Modelo: [bones listados]
### Textura: [WxH] pixels
### Animacoes: [lista com descricao]
### Animation Controller: [estados e transicoes]

## Script (se necessario)
[eventos, loops, particulas, sons]

## Traducoes
- pt_BR: entity.[ns]:[nome].name=[Nome]
- en_US: entity.[ns]:[nome].name=[Name]
```

## Regras da Skill

1. **NUNCA criar arquivos durante o planejamento** - apenas gerar o plano
2. **SEMPRE pesquisar antes** - usar mob-researcher para contexto
3. **SEMPRE classificar o tipo** - determina quais componentes sao necessarios
4. **SEMPRE listar caminhos completos** - relativo a pasta do addon
5. **SEMPRE incluir traducoes** - pt_BR e en_US
6. **Prioridades de AI**: numeros menores = maior prioridade (0 = mais alta)
7. **Pedir confirmacao** do usuario antes de prosseguir para criacao
8. **Apos aprovacao**, o usuario deve usar `/criar-mob` para implementar o plano

## Fluxo Completo de Criacao de Entidade
```
/planejar-entidade → usuario aprova → /criar-mob → /comportamento-mob → /revisar-mod → /varredura-bugs
```
