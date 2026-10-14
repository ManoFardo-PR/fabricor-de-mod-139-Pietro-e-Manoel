# Especificacao: Laser de Choque

Addon modular para Minecraft Bedrock (min_engine_version 1.21.0, `@minecraft/server` 1.12.0).
Documento de planejamento. **Nenhum arquivo de addon foi criado ainda** - este e o plano a ser
aprovado antes de rodar `/criar-mob` e o restante do fluxo.

Data: 2026-10-14
Status: APROVADO E IMPLEMENTADO (v1.0) - aguardando validacao in-game. Ver secao 19 para o que mudou na implementacao.

---

## 0. Resumo em uma frase

Um dispositivo pequeno (menor que um bloco) colocado no chao dispara uma segunda peca que sobe,
gruda no teto, e entre as duas se forma um feixe de laser vertical que da choque eletrico em
qualquer coisa que atravessar.

---

## 1. Decisoes assumidas (corrigir aqui antes de aprovar)

Cada item abaixo e uma escolha feita para destravar a spec. Se alguma estiver errada,
basta trocar o valor - o resto do documento se ajusta.

| # | Decisao | Valor assumido | Alternativa |
|---|---------|----------------|-------------|
| D1 | Nome do mod | **Laser de Choque** | Barreira Laser, Cerca Eletrica |
| D2 | Namespace | `laser_choque` | - |
| D3 | Pasta | `Laser de Choque/` | - |
| D4 | Prefixo no script unificado | `CHOQUE_` | `LASER_CHOQUE_` (evitar: confunde com `LASER_` da Pistola) |
| D5 | Base e receptor sao **blocos** customizados (nao entidades) | blocos | entidades (pior: despawn, piston, persistencia manual) |
| D6 | Feixe visual no MVP | **particulas** (`minecraft:endrod`) | entidade emissiva esticada (backlog v1.1) |
| D7 | Quem colocou o dispositivo **nao** toma choque | `imuneDono: true` | `false` (todos tomam) |
| D8 | Dano do choque | 2 (1 coracao) a cada 10 ticks | ajustavel em `CONFIG.dano` |
| D9 | Altura maxima de busca do teto | 32 blocos | - |
| D10 | Agua **nao** bloqueia o feixe; qualquer bloco solido bloqueia | - | `aguaBloqueia: true` |
| D11 | Liga/desliga: interagir na base com a **mao vazia** | - | agachar + interagir |

---

## 2. Classificacao

- **Tipo de addon**: bloco funcional + entidade visual efemera + script
- **Namespace**: `laser_choque:`
- **Addon**: `Laser de Choque` (modular, separado; integrar no unificado so depois de validado in-game)
- **Depende de Beta APIs?** Nao. Usa apenas API estavel 1.12.0 (`playerPlaceBlock`, `playerBreakBlock`,
  `playerInteractWithBlock`, `getBlockFromRay`, `setPermutation`, `applyDamage`, `applyKnockback`,
  `spawnParticle`, DynamicProperties). Mesmo assim o projeto recomenda Beta APIs ligadas por causa dos outros mods.

### Pecas do sistema

| Peca | Identifier | Tipo | Papel |
|------|-----------|------|-------|
| Base | `laser_choque:base_laser` | bloco (com item) | Colocada no chao pelo jogador. Dispara a ancora. Liga/desliga. Guarda o estado. |
| Ancora voadora | `laser_choque:ancora_voadora` | entidade (efemera, 1-3 s) | So visual: sobe da base ate o teto. Ao chegar, e removida e vira o bloco receptor. |
| Receptor | `laser_choque:receptor_laser` | bloco (sem item, oculto no criativo) | Fica grudado no teto. Marca o fim do feixe. |
| Feixe | (nao e bloco nem entidade) | particulas + logica de script | Coluna entre base e receptor. Da choque. |

---

## 3. Experiencia do jogador (fluxo in-game)

1. Jogador crafta a **Base do Laser de Choque** (receita na secao 7).
2. Coloca a base no chao. Ela so pode ser colocada **em cima** de um bloco solido (`placement_filter`).
3. No instante da colocacao, o script:
   - Faz um raycast para cima a partir da base (ate 32 blocos).
   - **Se nao achar teto**: mensagem `§cNenhum teto encontrado em ate 32 blocos` + som `note.bass`. A base fica
     colocada mas inativa (apagada). Interagir nela tenta de novo.
   - **Se achar teto**: spawna a ancora voadora em cima da base, som `firework.launch`.
4. A ancora sobe (0,5 bloco/tick = 10 blocos/s) com trilha de particulas, girando.
5. Ao chegar na celula de ar logo abaixo do teto: entidade removida, bloco **receptor** colocado ali,
   som `random.anvil_use` com pitch alto (clique metalico) + particulas `minecraft:electric_spark_particle`.
6. Feixe liga: base muda para estado `ativo` (lente acesa, emite luz), som `beacon.activate`.
   Coluna de particulas `minecraft:endrod` entre base e receptor, com faiscas eletricas aleatorias.
7. Qualquer entidade (mob, jogador que nao e o dono, animal) que entrar na coluna toma:
   - 2 de dano (causa `lightning`),
   - empurrao para fora do feixe (knockback radial),
   - lentidao II por 2 s,
   - faiscas + som `random.fizz` no ponto do choque.
8. Interagir na base com a mao vazia alterna ligado/desligado (`beacon.activate` / `beacon.deactivate`).
9. Quebrar a base: o receptor some sozinho, base dropa como item. Quebrar o receptor: base volta a inativa.
10. Se alguem colocar um bloco no meio do feixe: feixe entra em estado `bloqueado` (particulas param,
    sem dano, lente pisca em vermelho via `critical_hit_emitter` na obstrucao). Tirar o bloco religa.
11. Tudo sobrevive a sair/entrar do mundo e a `/reload` (DynamicProperty).

---

## 4. Maquina de estados do dispositivo

Cada base tem um registro em memoria (espelhado em DynamicProperty) com este estado:

```
             colocou base
                  |
                  v
          +---------------+   sem teto / falhou    +--------------+
          |   INATIVO     | <--------------------- |   LANCANDO   |
          | (sem receptor)| ---------------------> | (ancora voa) |
          +---------------+  interagir / colocacao +--------------+
                  ^                                        |
                  | receptor quebrado                      | ancora chegou -> receptor colocado
                  |                                        v
          +---------------+   bloco no caminho     +--------------+
          |  BLOQUEADO    | <--------------------- |    ATIVO     |
          | (sem dano)    | ---------------------> | (feixe + dano)|
          +---------------+   caminho livre        +--------------+
                                                           |
                                                           | interagir (mao vazia)
                                                           v
                                                   +--------------+
                                                   |  DESLIGADO   |  (receptor fica, feixe apagado)
                                                   +--------------+
                                                           | interagir
                                                           +--> ATIVO

  base quebrada / sumiu (de qualquer estado) --> remover receptor + apagar registro
```

### Registro por dispositivo (formato persistido)

```javascript
{
  dim: "minecraft:overworld",   // dimension.id
  x: 10, y: 64, z: -3,          // posicao da base (inteiros)
  yTeto: 70,                    // y do bloco receptor (null se INATIVO)
  dono: "-4294967295",          // player.id de quem colocou (string)
  estado: "ativo",              // "inativo" | "lancando" | "ativo" | "bloqueado" | "desligado"
  ligado: true                  // escolha do jogador (sobrevive ao bloqueio)
}
```

Chave: `"x,y,z,dim"`. DynamicProperty: `laser_choque:dispositivos` (JSON de array de registros).
Limite: `maxDispositivos: 32` por mundo (32 registros * ~120 bytes = ~4 KB, bem abaixo dos 32 KB do engine).
Ao exceder: mensagem `§cLimite de 32 lasers no mundo` e a base nao ativa (fica INATIVO).

---

## 5. Geometria da coluna (definicao precisa)

```
y = yTeto + 1   ####### bloco solido do teto (qualquer bloco nao-ar, nao-liquido)
y = yTeto       [ R ]   RECEPTOR (bloco customizado, ocupa a celula de ar abaixo do teto)
y = yTeto - 1     |     \
   ...            |      > FEIXE: celulas de ar entre base e receptor
y = y + 1         |     /
y = y           [ B ]   BASE (bloco customizado, no chao)
y = y - 1       ####### bloco solido do chao
```

- **Raycast**: origem `(x+0.5, y+1.0, z+0.5)`, direcao `(0, 1, 0)`, `maxDistance: 32`, `includeLiquidBlocks: false`,
  `includePassableBlocks: false`. O bloco atingido e o teto; `yTeto = teto.y - 1`.
- **Validacoes antes de lancar** (todas geram mensagem e deixam a base INATIVO):
  - raycast nulo -> "Nenhum teto encontrado em ate 32 blocos"
  - `yTeto - y < 2` -> "Teto muito baixo (precisa de pelo menos 2 blocos de vao)"
  - bloco atingido e `laser_choque:receptor_laser` -> "Ja existe um laser nesta coluna"
  - celula `yTeto` nao e ar (ex: agua) -> "A celula abaixo do teto precisa estar vazia"
- **Volume de choque**: cilindro de raio `raioChoque = 0.6` centrado em `(x+0.5, z+0.5)`,
  de `y + 1.0` ate `yTeto - 0.0` (inclui a celula do receptor por baixo, nao inclui a base).
  Entidades sao buscadas por esfera (`getEntities({ location: centro, maxDistance: altura/2 + 1 })`)
  e depois filtradas manualmente por distancia horizontal e faixa de y.
- **Verificacao de obstrucao**: a cada 20 ticks, percorrer `y+1 .. yTeto-1`; se algum bloco for
  `!isAir && !isLiquid` -> BLOQUEADO. Se `getBlock()` retornar `undefined` (chunk descarregado),
  **pular o dispositivo neste tick sem mudar estado** - undefined nao significa removido.

---

## 6. Blocos (BP)

### 6.1 `blocks/base_laser.block.json` - `laser_choque:base_laser`

- `format_version`: `"1.21.10"` (mesmo do Multiplicador)
- `menu_category`: `{ "category": "items", "group": "itemGroup.name.redstoneContainers" }`
- `description.states`: `{ "laser_choque:ativo": [false, true] }`
- Componentes:
  - `minecraft:geometry`: `"geometry.laser_choque.base_laser"`
  - `minecraft:collision_box`: `{ "origin": [-5, 0, -5], "size": [10, 4, 10] }` (10x4x10 pixels = 0,625 x 0,25 x 0,625 bloco)
  - `minecraft:selection_box`: idem
  - `minecraft:material_instances`:
    - `"*"`: `{ "texture": "laser_choque_base", "render_method": "alpha_test" }`
    - `"lente"`: `{ "texture": "laser_choque_lente", "render_method": "alpha_test" }`
  - `minecraft:placement_filter`: `{ "conditions": [{ "allowed_faces": ["up"] }] }`
  - `minecraft:destructible_by_mining`: `{ "seconds_to_destroy": 1.0 }`
  - `minecraft:destructible_by_explosion`: `{ "explosion_resistance": 3.0 }`
  - `minecraft:light_emission`: `0`
  - `minecraft:map_color`: `"#2b2b2b"`
  - (sem `minecraft:loot` -> dropa ele mesmo ao quebrar)
- Permutacao `q.block_state('laser_choque:ativo')`:
  - `minecraft:light_emission`: `10`
  - `minecraft:material_instances.lente.texture`: `"laser_choque_lente_ativa"`

O script alterna o estado com `block.setPermutation(block.permutation.withState("laser_choque:ativo", true))`.

### 6.2 `blocks/receptor_laser.block.json` - `laser_choque:receptor_laser`

- `menu_category`: `{ "category": "none" }` (oculto no criativo; so o script coloca)
- `description.states`: nenhum
- Componentes:
  - `minecraft:geometry`: `"geometry.laser_choque.receptor_laser"` (caixa pendurada no topo da celula)
  - `minecraft:collision_box`: `{ "origin": [-5, 12, -5], "size": [10, 4, 10] }`
  - `minecraft:selection_box`: idem
  - `minecraft:material_instances`: `"*"`: `{ "texture": "laser_choque_receptor", "render_method": "alpha_test" }`
  - `minecraft:destructible_by_mining`: `{ "seconds_to_destroy": 0.5 }`
  - `minecraft:destructible_by_explosion`: `{ "explosion_resistance": 3.0 }`
  - `minecraft:light_emission`: `7`
  - `minecraft:loot`: `"loot_tables/empty.json"` (nunca dropa; o item e so a base)
  - `minecraft:map_color`: `"#2b2b2b"`

### 6.3 `loot_tables/empty.json`

```json
{ "pools": [] }
```

---

## 7. Receita - `recipes/base_laser.recipe.json`

`minecraft:recipe_shaped`, tags `["crafting_table"]`, resultado 1x `laser_choque:base_laser`.

```
 . A .      A = minecraft:amethyst_shard   (lente)
 R L R      R = minecraft:redstone          (energia)
 I I I      L = minecraft:lightning_rod     (choque eletrico - tematico)
            I = minecraft:iron_ingot        (carcaca)
```

Justificativa: custo medio (para-raios exige cobre), tematicamente coerente com "choque eletrico".
Se quiser mais barato para teste: trocar `lightning_rod` por `copper_ingot`.

---

## 8. Entidade: ancora voadora (BP + RP)

### 8.1 BP `entities/ancora_voadora.entity.json` - `laser_choque:ancora_voadora`

- `format_version`: `"1.16.0"`
- `is_spawnable: false`, `is_summonable: true`
- **Sem** `runtime_identifier` (entidade generica controlada 100% por script).
  - Hipotese a validar in-game: se nao renderizar ou se comportar estranho, fallback =
    `runtime_identifier: "minecraft:snowball"` com `minecraft:projectile.gravity: 0.0` (padrao ja usado no projeto).
- Componentes:
  - `minecraft:collision_box`: `{ "width": 0.3, "height": 0.3 }`
  - `minecraft:physics`: `{ "has_gravity": false, "has_collision": false }`
  - `minecraft:pushable`: `{ "is_pushable": false, "is_pushable_by_piston": false }`
  - `minecraft:damage_sensor`: `{ "triggers": { "deals_damage": false } }` (invulneravel)
  - `minecraft:type_family`: `{ "family": ["laser_choque", "inanimate"] }`
  - `minecraft:conditional_bandwidth_optimization` (copiar do laser_projetil)
- Movimento: **script** faz `entidade.teleport({x, y + velocidadeSubida, z})` a cada tick.
  Nao usar `applyImpulse` (sem gravidade e com `has_collision:false` o impulso nao para no teto).
- Timeout: se viva ha mais de `timeoutAncora = 100` ticks (5 s) ou sem registro no Map (sobrou de um
  `/reload`) -> `remove()`. Varredura via `dimension.getEntities({ type })` a cada 20 ticks (padrao Cactus Zumbi).

### 8.2 RP `entity/ancora_voadora.entity.json`

- `format_version`: `"1.10.0"`
- `materials.default`: `"entity_emissive_alpha"`
- `textures.default`: `"textures/entity/ancora_voadora"`
- `geometry.default`: `"geometry.laser_choque.ancora_voadora"` (arquivo proprio em `models/entity/`,
  mesmo desenho do receptor mas com origem no pe da entidade e lente apontando para baixo.
  Implementacao optou por nao reutilizar a geometria do bloco para eliminar a hipotese de que
  geometrias em `models/blocks/` nao sejam visiveis para entidades.)
- `render_controllers`: `["controller.render.laser_choque.ancora_voadora"]`
- `animations.spin`: `"animation.laser_choque.ancora_voadora.spin"`, `scripts.animate: ["spin"]`

### 8.3 RP `render_controllers/ancora_voadora.render_controllers.json`

Copiar o padrao de `laser_projetil.render_controllers.json`, chave `controller.render.laser_choque.ancora_voadora`.

### 8.4 RP `animations/ancora_voadora.animation.json`

`animation.laser_choque.ancora_voadora.spin`: loop, 0.5 s, `root.rotation` de `[0,0,0]` a `[0,360,0]`
(copiar de `laser_projetil.animation.json`).

---

## 9. Modelos e texturas (RP)

### 9.1 `models/blocks/base_laser.geo.json` - `geometry.laser_choque.base_laser`

- `texture_width/height`: 32x32
- Bones:
  - `base` (pivot `[0,0,0]`): cubo `origin [-5, 0, -5]`, `size [10, 3, 10]` - carcaca
  - `lente` (pivot `[0,3,0]`): cubo `origin [-2, 3, -2]`, `size [4, 1, 4]` - emissor no topo.
    Para que este cubo use a material_instance `"lente"`, cada face dele declara
    `"material_instance": "lente"` dentro do objeto de UV por face
    (ex: `"uv": { "up": { "uv": [0, 0], "uv_size": [4, 4], "material_instance": "lente" }, ... }`).
    Hipotese H3 da secao 18; se falhar, usar textura unica `"*"` trocada inteira na permutacao ativa.
- `visible_bounds`: 1 x 1 x 1

### 9.2 `models/blocks/receptor_laser.geo.json` - `geometry.laser_choque.receptor_laser`

- Mesmo cubo da base, espelhado para o topo: `origin [-5, 13, -5]`, `size [10, 3, 10]` + lente
  `origin [-2, 12, -2]`, `size [4, 1, 4]` apontando para baixo.
- **Esta mesma geometria e usada pela entidade ancora voadora** (ver 8.2). Como entidade,
  o modelo e renderizado com origem no pe da entidade; a ancora deve ser spawnada com
  `y = base.y + 1 - 13/16` para o visual coincidir. Detalhe menor; ajustar no teste.

### 9.3 Texturas (CRIAR MANUALMENTE - pixel art)

| Arquivo | Tamanho | Uso |
|---------|---------|-----|
| `textures/blocks/laser_choque_base.png` | 32x32 | carcaca da base (cinza escuro metalico, parafusos) |
| `textures/blocks/laser_choque_lente.png` | 16x16 | lente apagada (vidro escuro) |
| `textures/blocks/laser_choque_lente_ativa.png` | 16x16 | lente acesa (ciano brilhante) |
| `textures/blocks/laser_choque_receptor.png` | 32x32 | receptor (igual a base, lente sempre acesa) |
| `textures/entity/ancora_voadora.png` | 32x32 | copia de `laser_choque_receptor.png` |
| `BP/pack_icon.png` e `RP/pack_icon.png` | 256x256 | icone do pack |

Pasta de referencia do projeto para texturas: `zz-texturas criadas/`.

### 9.4 `textures/terrain_texture.json`

```json
{
  "resource_pack_name": "Laser de Choque",
  "texture_name": "atlas.terrain",
  "texture_data": {
    "laser_choque_base":        { "textures": "textures/blocks/laser_choque_base" },
    "laser_choque_lente":       { "textures": "textures/blocks/laser_choque_lente" },
    "laser_choque_lente_ativa": { "textures": "textures/blocks/laser_choque_lente_ativa" },
    "laser_choque_receptor":    { "textures": "textures/blocks/laser_choque_receptor" }
  }
}
```

`item_texture.json` **nao e necessario**: o item da base e o proprio bloco (renderiza em 3D no inventario).

---

## 10. Traducoes

`texts/languages.json`: `["en_US", "pt_BR"]`

`texts/pt_BR.lang`:
```
tile.laser_choque:base_laser.name=Base do Laser de Choque
tile.laser_choque:receptor_laser.name=Receptor do Laser de Choque
entity.laser_choque:ancora_voadora.name=Ancora do Laser de Choque
```

`texts/en_US.lang`:
```
tile.laser_choque:base_laser.name=Shock Laser Base
tile.laser_choque:receptor_laser.name=Shock Laser Receiver
entity.laser_choque:ancora_voadora.name=Shock Laser Anchor
```

(Blocos usam prefixo `tile.`, nao `item.` - confirmado pelo Multiplicador.)

---

## 11. Script - `scripts/main.js`

### 11.1 Imports

```javascript
import { world, system, EntityDamageCause } from "@minecraft/server";
```

### 11.2 CONFIG

```javascript
const CONFIG = {
    // Identificadores
    idBase: "laser_choque:base_laser",
    idReceptor: "laser_choque:receptor_laser",
    idAncora: "laser_choque:ancora_voadora",
    estadoAtivo: "laser_choque:ativo",
    chavePersistencia: "laser_choque:dispositivos",

    // Busca de teto
    alturaMaxima: 32,          // blocos de raycast para cima
    vaoMinimo: 2,              // yTeto - yBase >= 2 (pelo menos 1 celula de feixe)
    maxDispositivos: 32,       // por mundo (limite de DynamicProperty e performance)

    // Ancora voadora
    velocidadeSubida: 0.5,     // blocos por tick (10 blocos/s)
    timeoutAncora: 100,        // ticks ate matar ancora perdida

    // Choque
    dano: 2,                   // 1 coracao por choque
    intervaloChoque: 10,       // ticks entre choques (2x por segundo)
    raioChoque: 0.6,           // raio horizontal do cilindro
    knockback: 1.2,            // forca do empurrao radial
    knockbackVertical: 0.2,
    efeito: { nome: "slowness", duracao: 40, amplificador: 1 },
    imuneDono: true,           // D7
    tiposIgnorados: new Set(["minecraft:item", "minecraft:xp_orb", "laser_choque:ancora_voadora"]),

    // Visual do feixe
    intervaloFeixe: 2,         // ticks entre "frames" de particula
    espacamentoFeixe: 0.5,     // blocos entre particulas na coluna
    particulaFeixe: "minecraft:endrod",
    particulaFaisca: "minecraft:electric_spark_particle",   // hipotese: validar nome in-game
    particulaBloqueio: "minecraft:critical_hit_emitter",
    chanceFaiscaAmbiente: 0.15, // por frame, uma faisca em ponto aleatorio do feixe
    distanciaRender: 48,       // so emite particulas se houver jogador a ate 48 blocos

    // Manutencao
    intervaloReconciliacao: 20, // ticks entre verificacoes de integridade (blocos existem? obstrucao?)

    // Sons (todos vanilla; validar in-game)
    sons: {
        lancar: "firework.launch",
        grudar: "random.anvil_use",
        ligar: "beacon.activate",
        desligar: "beacon.deactivate",
        choque: "random.fizz",
        erro: "note.bass",
        bloqueado: "random.fizz"
    }
};
```

### 11.3 Estado

| Dado | Onde | Por que |
|------|------|---------|
| `dispositivos: Map<chave, registro>` | memoria **+** DynamicProperty `laser_choque:dispositivos` | Protocolo 3: blocos colocados por script devem sobreviver a reload |
| `ancorasEmVoo: Map<entityId, { chaveBase, yAlvo, tickSpawn }>` | memoria | efemero (voo dura < 5 s); varredura mata orfas |
| `dispositivosCarregados: boolean` | memoria | carrega DynamicProperty no primeiro tick (padrao Flare) |

Funcoes `salvarDispositivos()` / `carregarDispositivos()` identicas em forma a `salvarLandedFlares` /
`carregarLandedFlares` da Super Picareta (`Super Picareta BP/scripts/main.js:483-500`).

### 11.4 Eventos

| Evento | Filtro | Acao |
|--------|--------|------|
| `world.afterEvents.playerPlaceBlock` | `block.typeId === idBase` | `registrarBase(dim, pos, player.id)` -> `tentarLancar(chave)` |
| `world.afterEvents.playerBreakBlock` | `brokenBlockPermutation.type.id === idBase` | `removerDispositivo(chave)` (apaga receptor, deleta registro, salva) |
| `world.afterEvents.playerBreakBlock` | `... === idReceptor` | achar registro por `(x, z, dim, yTeto === y)` -> `estado = "inativo"`, `yTeto = null`, apagar luz da base |
| `world.afterEvents.playerInteractWithBlock` | `block.typeId === idBase && !event.itemStack` | se INATIVO -> `tentarLancar`; se ATIVO/BLOQUEADO -> `ligado=false`, DESLIGADO; se DESLIGADO -> `ligado=true`, ATIVO |
| `world.afterEvents.entityRemove` | `typeId === idAncora` | `ancorasEmVoo.delete(id)` (limpeza) |

Observacao: `playerInteractWithBlock` tambem dispara quando o jogador coloca um bloco com a mao cheia;
por isso o filtro `!event.itemStack` (mao vazia) e obrigatorio para nao alternar o laser sem querer.

### 11.5 Loops (`system.runInterval`)

**Loop A - voo da ancora** (`1` tick):
```
para cada [id, voo] em ancorasEmVoo:
    entidade = world.getEntity(id); se nao existe -> delete, continue
    novoY = entidade.location.y + velocidadeSubida
    se novoY >= voo.yAlvo:
        teleport para yAlvo; entidade.remove()
        colocarReceptor(voo.chaveBase)      // setType(idReceptor) na celula yTeto
        ativarFeixe(voo.chaveBase)          // estado = ativo, permutacao ativo=true, som ligar
    senao:
        teleport({x, novoY, z}); particula endrod atras
```

**Loop B - feixe + choque** (`intervaloChoque` = 10 ticks; particulas em sub-frequencia `intervaloFeixe`):
```
para cada dispositivo com estado == "ativo":
    dim = world.getDimension(reg.dim)
    centro = { x: x+0.5, y: (y+1 + yTeto)/2, z: z+0.5 }
    altura = yTeto - (y+1)
    // particulas
    se tick % intervaloFeixe == 0 e ha jogador a <= distanciaRender:
        para yy de y+1 ate yTeto passo espacamentoFeixe: spawnParticle(particulaFeixe, {x+0.5, yy, z+0.5})
        se Math.random() < chanceFaiscaAmbiente: spawnParticle(particulaFaisca, ponto aleatorio da coluna)
    // choque
    entidades = dim.getEntities({ location: centro, maxDistance: altura/2 + 1 })
    para cada ent:
        se tiposIgnorados.has(ent.typeId) -> continue
        se imuneDono && ent.id === reg.dono -> continue
        dx = ent.location.x - (x+0.5); dz = ent.location.z - (z+0.5)
        se sqrt(dx*dx+dz*dz) > raioChoque -> continue
        se ent.location.y < y+1 || ent.location.y > yTeto -> continue
        aplicarChoque(ent, dx, dz)
```
`aplicarChoque`: `applyDamage(dano, { cause: EntityDamageCause.lightning })`, `addEffect(...)`,
`applyKnockback(dx/|d|, dz/|d|, knockback, knockbackVertical)` (se |d| ~ 0, direcao aleatoria),
particulas de faisca no corpo, som `choque`. Tudo em try/catch individual.

**Loop C - reconciliacao** (`intervaloReconciliacao` = 20 ticks):
```
se !dispositivosCarregados: carregarDispositivos(); dispositivosCarregados = true
para cada [chave, reg] em dispositivos:
    dim = getDimension(reg.dim)
    blocoBase = dim.getBlock({x,y,z})
    se blocoBase === undefined -> continue           // chunk descarregado: NAO mexer
    se blocoBase.typeId !== idBase:                  // base sumiu (explosao, piston, /setblock)
        apagar receptor se existir; dispositivos.delete(chave); salvar; continue
    se reg.estado in (ativo, bloqueado, desligado):
        blocoRec = dim.getBlock({x, yTeto, z})
        se blocoRec === undefined -> continue
        se blocoRec.typeId !== idReceptor: reg.estado = "inativo"; reg.yTeto = null; apagar luz; salvar; continue
        obstruido = algum bloco em y+1..yTeto-1 com !isAir && !isLiquid (undefined -> continue sem mudar)
        se obstruido && reg.estado == "ativo": estado = "bloqueado"; permutacao ativo=false; som bloqueado
        se !obstruido && reg.estado == "bloqueado" && reg.ligado: estado = "ativo"; permutacao ativo=true; som ligar
// ancoras orfas (sobraram de /reload ou timeout)
para cada dim: para cada ent em getEntities({type: idAncora}):
    voo = ancorasEmVoo.get(ent.id)
    se !voo || (tick - voo.tickSpawn) > timeoutAncora: ent.remove(); ancorasEmVoo.delete(ent.id)
```

**Loop D - limpeza em `playerLeave`**: nada a limpar (estado e do mundo, nao do jogador).
Nao usar `playerLeave` para remover dispositivos (anti-padrao do Protocolo 3).

### 11.6 Funcoes auxiliares (assinaturas)

```javascript
function chaveDe(dimId, x, y, z)                 // "x,y,z,dimId"
function salvarDispositivos()                     // JSON -> DynamicProperty
function carregarDispositivos()                   // DynamicProperty -> Map (merge, nao sobrescreve)
function registrarBase(dim, pos, donoId)          // cria registro INATIVO; respeita maxDispositivos
function acharTeto(dim, x, y, z)                  // raycast; retorna { yTeto } ou { erro: "mensagem" }
function tentarLancar(chave, jogadorOpcional)     // valida, spawna ancora, estado LANCANDO
function colocarReceptor(chave)                   // setType(idReceptor) em (x, yTeto, z)
function removerReceptor(chave)                   // se bloco em yTeto for idReceptor -> setType("minecraft:air")
function definirLuzBase(chave, ligada)            // setPermutation(withState(estadoAtivo, ligada))
function ativarFeixe(chave) / desligarFeixe(chave) / removerDispositivo(chave)
function colunaObstruida(dim, x, z, yIni, yFim)   // true | false | undefined (chunk descarregado)
function aplicarChoque(ent, dx, dz, dim)
function avisar(jogador, msg)                     // sendMessage em try/catch
```

### 11.7 Regras de robustez (herdadas do projeto)

- try/catch ao redor de **toda** operacao em entidade/bloco/jogador.
- `getBlock()` undefined = chunk fora; nunca interpretar como "bloco removido".
- Toda mutacao de mundo disparada por evento `afterEvents` vai dentro de `system.run(() => ...)`
  (padrao Flechas Especiais) para evitar erro de escrita em contexto read-only.
- Salvar DynamicProperty **a cada mutacao** do Map (nao em intervalo), como o Flare faz.
- Nunca confiar em `system.runTimeout` para limpeza; tudo passa pelo loop de reconciliacao.

---

## 12. Checklist de arquivos

### BP - `Laser de Choque/Laser de Choque BP/`
1. [ ] `manifest.json` - UUIDs **ja gerados** (secao 13)
2. [ ] `pack_icon.png` - CRIAR MANUALMENTE
3. [ ] `blocks/base_laser.block.json`
4. [ ] `blocks/receptor_laser.block.json`
5. [ ] `entities/ancora_voadora.entity.json`
6. [ ] `recipes/base_laser.recipe.json`
7. [ ] `loot_tables/empty.json`
8. [ ] `scripts/main.js`

### RP - `Laser de Choque/Laser de Choque RP/`
9. [ ] `manifest.json`
10. [ ] `pack_icon.png` - CRIAR MANUALMENTE
11. [ ] `models/blocks/base_laser.geo.json`
12. [ ] `models/blocks/receptor_laser.geo.json`
13. [ ] `entity/ancora_voadora.entity.json`
14. [ ] `render_controllers/ancora_voadora.render_controllers.json`
15. [ ] `animations/ancora_voadora.animation.json`
16. [ ] `textures/blocks/laser_choque_base.png` - CRIAR MANUALMENTE
17. [ ] `textures/blocks/laser_choque_lente.png` - CRIAR MANUALMENTE
18. [ ] `textures/blocks/laser_choque_lente_ativa.png` - CRIAR MANUALMENTE
19. [ ] `textures/blocks/laser_choque_receptor.png` - CRIAR MANUALMENTE
20. [ ] `textures/entity/ancora_voadora.png` - CRIAR MANUALMENTE (copia do receptor)
21. [ ] `textures/terrain_texture.json`
22. [ ] `texts/languages.json`, `texts/pt_BR.lang`, `texts/en_US.lang`

### Registros no projeto (fora da pasta do mod)
23. [ ] `.claude/skills/integridade-projeto/SKILL.md` - adicionar `laser_choque | Laser de Choque | ativo` na tabela do Protocolo 5
24. [ ] `INTEGRACAO-UNIFICADO.md` - adicionar `Laser de Choque | CHOQUE_` na tabela de prefixos e `laser_choque` no Anexo B
25. [ ] `instalar.bat` - opcao `[B] Laser de Choque (modular - novo)` + incluir nas opcoes 7, 8 e 9
26. [ ] `CLAUDE.md` - acrescentar `laser_choque:` na lista de namespaces existentes

---

## 13. Manifests (UUIDs reservados - nao reutilizar em outro pack)

| Pack | header.uuid | modules[0].uuid |
|------|-------------|-----------------|
| BP | `91b5d2e4-1fb1-49d7-b2f0-60e734e1b4ec` | `08aa6828-bd73-4f4e-98eb-5ac7e057dc60` |
| RP | `d5c7f986-8089-49d5-a492-5a1a7892abad` | `3f7a01d2-9927-4b28-b114-214466a116f4` |

BP: `format_version: 2`, modulo `script` (`entry: scripts/main.js`), `dependencies`:
`@minecraft/server 1.12.0` + `{ uuid: d5c7f986-..., version: [1,0,0] }` (header do RP).
RP: modulo `resources`, dependency apontando para o header do BP. `min_engine_version: [1, 21, 0]` em ambos.

---

## 14. Casos de borda e comportamento esperado

| Situacao | Comportamento |
|----------|---------------|
| Base colocada a ceu aberto | Raycast falha -> mensagem, base INATIVO. Interagir tenta de novo. |
| Teto a 1 bloco de distancia | "Teto muito baixo" -> INATIVO |
| Agua entre base e teto | Agua nao bloqueia (D10). Celula do receptor com agua -> erro "precisa estar vazia" |
| Outro laser na mesma coluna | Raycast bate no receptor do outro -> "Ja existe um laser nesta coluna" |
| Bloco colocado no meio do feixe | BLOQUEADO em ate 20 ticks: sem particulas, sem dano, lente apaga |
| Base explodida / empurrada por piston | Reconciliacao detecta base ausente -> receptor removido, registro apagado |
| Receptor quebrado pelo jogador | Base volta a INATIVO (luz apaga). Interagir relanca. |
| `/reload` durante o voo da ancora | Ancora orfa morta pela varredura; registro fica LANCANDO -> reconciliacao trata LANCANDO sem ancora como INATIVO |
| Chunk da base descarregado | Dispositivo pulado silenciosamente; nada e apagado |
| Jogador em criativo atravessa | `applyDamage` nao afeta criativo; knockback e efeito ainda aplicam |
| Dono atravessa | Nenhum efeito (D7). Para testar o choque em si mesmo: `imuneDono: false` |
| 33o dispositivo | "Limite de 32 lasers" -> INATIVO |
| Nether / End | Funciona igual (Nether e ideal: teto em todo lugar) |
| Pack unificado + modular ativos juntos | Double-subscribe: dois receptores? Nao - mesmo bloco, mas dano/particulas dobram. Regra do CLAUDE.md: nunca ativar ambos. |

---

## 15. Performance (estimativa)

| Custo | Valor | Mitigacao |
|-------|-------|-----------|
| Particulas por dispositivo ativo | ~2 x altura a cada 2 ticks (altura 10 -> 20 particulas/2 ticks) | `distanciaRender`: so renderiza com jogador perto |
| Pior caso: 32 dispositivos, altura 30 | ~1900 particulas/2 ticks | inaceitavel se todos visiveis; na pratica poucos ficam no raio de 48 blocos. Se necessario, subir `espacamentoFeixe` para 1.0 |
| `getEntities` por dispositivo | 1 chamada / 10 ticks | esfera pequena; desprezivel |
| Reconciliacao | ~altura `getBlock` por dispositivo / 20 ticks | desprezivel |

---

## 16. MVP vs Backlog

### MVP (v1.0) - o que esta especificado acima
- Base (bloco) + ancora voadora (entidade visual) + receptor (bloco)
- Raycast, validacoes e mensagens de erro
- Feixe por particulas + choque (dano, knockback, lentidao)
- Liga/desliga por interacao; bloqueio por obstrucao
- Persistencia (DynamicProperty) + reconciliacao
- Receita, traducoes, icones

### Backlog (v1.1+) - NAO implementar agora
- **Feixe solido**: entidade `laser_choque:feixe` com material `entity_emissive_alpha` e bone esticado por
  `query.property('laser_choque:altura')` (entity property definida pelo script com `setProperty`). Visual muito melhor; risco medio.
- **Controle por redstone**: exige custom block components (`@minecraft/server` 1.13+) ou leitura de
  `block.getRedstonePower()` no loop (existe na API estavel? verificar). Se existir, e simples.
- **Modo armadilha**: so mobs hostis tomam choque (filtro por `type_family`).
- **Upgrade in-place**: interagir com redstone na mao aumenta o dano (ate 3 niveis), gravado no registro.
- **Laser horizontal** (parede a parede): mesma logica com raycast no eixo da `cardinal_direction` do bloco.
- **Som ambiente continuo** (`beacon.ambient` em loop baixo) enquanto ativo.

---

## 17. Fluxo de implementacao (ordem recomendada)

1. Aprovar este documento (ajustar secao 1 se necessario).
2. Registrar namespace no Protocolo 5 (`integridade-projeto/SKILL.md`) - item 23.
3. Criar manifests + pasta (secao 13).
4. Criar blocos + geometria + terrain_texture + lang (secoes 6, 9, 10). Testar in-game: a base aparece no
   criativo, coloca so no chao, tem o tamanho certo? **Parar aqui e validar antes do script.**
5. Criar entidade ancora (secao 8) e validar `/summon laser_choque:ancora_voadora` (renderiza? gira?).
6. Script (secao 11) em 3 incrementos, testando cada um:
   - 6a. colocar base -> raycast -> ancora sobe -> receptor aparece
   - 6b. feixe de particulas + choque
   - 6c. persistencia + reconciliacao + liga/desliga + bloqueio
7. `/revisar-mod Laser de Choque` e `/varredura-bugs Laser de Choque`.
8. Validacao in-game isolada (checklist abaixo). So depois: integracao no unificado via `INTEGRACAO-UNIFICADO.md`.

### Checklist de teste in-game
- [ ] `/give @s laser_choque:base_laser` entrega o item com nome traduzido
- [ ] Receita funciona na mesa de trabalho
- [ ] Base nao pode ser colocada em parede nem teto
- [ ] Colocar sob teto de 5 blocos: ancora sobe, gruda, feixe liga, lente acende
- [ ] Colocar a ceu aberto: mensagem de erro, base fica apagada, interagir tenta de novo
- [ ] `/summon zombie` dentro do feixe: toma dano, e empurrado, fica lento
- [ ] Dono atravessa sem dano; com `imuneDono:false` toma choque
- [ ] Colocar bloco no feixe: apaga; remover: religa
- [ ] Interagir mao vazia: desliga/liga
- [ ] Quebrar base: receptor some, item dropa
- [ ] Quebrar receptor: base apaga; interagir relanca
- [ ] Sair e entrar no mundo: feixe continua ativo
- [ ] `/reload` no meio do voo: sem ancora fantasma
- [ ] Nether: funciona
- [ ] Content Log sem erros

---

## 18. Hipoteses tecnicas a confirmar (fato vs hipotese)

Marcadas honestamente para nao virar bug silencioso:

| # | Hipotese | Status (2026-10-14) | Risco se errada | Plano B |
|---|----------|---------------------|-----------------|---------|
| H1 | `minecraft:electric_spark_particle` existe como particula vanilla | **CONFIRMADO** (wiki.bedrock.dev/particles/vanilla-particles lista `minecraft:electric_spark_particle` e `minecraft:sparkler_emitter`) | - | `minecraft:sparkler_emitter` |
| H2 | Entidade sem `runtime_identifier` renderiza e aceita `teleport` | hipotese | ancora invisivel | `runtime_identifier: minecraft:snowball` + `projectile.gravity: 0` |
| H3 | `material_instances` nomeada (`"lente"`) mapeia para faces da geometria de bloco | **CONFIRMADO em parte**: wiki.bedrock.dev/blocks/block-models confirma que o nome da material instance e atribuido por face **dentro do modelo** (Blockbench: botao direito no cubo > "Edit Material Instances"). O campo gerado no `.geo.json` e `material_instance` no objeto de UV de cada face | lente nao troca textura | textura unica `"*"` trocada inteira na permutacao |
| H4 | `Dimension.getBlockFromRay` e estavel | **CONFIRMADO** (learn.microsoft.com, Dimension class, sem marca de pre-release). Bonus: existe tambem `getBlockAbove(location, options)` que "retorna o primeiro bloco solido acima" - alternativa ainda mais simples ao raycast | - | varredura manual `getBlock` de `y+1` ate `y+32` |
| H5 | `playerPlaceBlock`, `playerBreakBlock`, `playerInteractWithBlock`, `entityRemove` estao em `world.afterEvents` estavel | **CONFIRMADO** (learn.microsoft.com, WorldAfterEvents class, todos sem marca de pre-release) | - | - |
| H6 | Sons `beacon.activate`/`beacon.deactivate`/`firework.launch`/`random.anvil_use` existem | hipotese | silencio | trocar por `random.levelup`, `random.click` |

Observacao sobre H4/H5: a doc da Microsoft reflete a versao estavel **atual** da API; estes membros
sao anteriores a 1.12.0, mas o Content Log na primeira execucao e a confirmacao final.
H2 e H6 se verificam em 30 segundos in-game (`/summon` e `/playsound`).

---

## 19. Diferencas entre a spec e a implementacao (apos /revisar-mod e /varredura-bugs)

| Tema | Spec dizia | Implementado | Motivo |
|------|-----------|--------------|--------|
| Geometria da ancora | reutilizar `geometry.laser_choque.receptor_laser` | arquivo proprio `models/entity/ancora_voadora.geo.json` | elimina hipotese sobre geometria de bloco visivel para entidade |
| Ordem de carregamento | carregar no primeiro tick do loop C | `garantirCarregado()` no inicio de todo evento/loop + `worldInitialize`/`worldLoad`; `salvarDispositivos()` **recusa salvar antes de carregar** | revisao achou que um clique no 1o segundo do mundo apagaria os dispositivos salvos |
| Limite de 32 | base fica INATIVO | base e **removida e o item devolvido** (`recusarPorLimite`); adocao por clique tambem respeita o limite | sem isso o limite era contornavel |
| Clique segurado | filtro `isFirstEvent` | `isFirstEvent` **+** cooldown de 10 ticks por base (`ultimaInteracao`) | `isFirstEvent` pode nao existir na API 1.12.0 |
| Obstrucao | qualquer bloco nao-ar e nao-liquido | blocos **atravessaveis** (grama alta, tocha, flor) nao bloqueiam (`block.isSolid === false`); se a API nao expuser `isSolid`, volta ao conservador | evitar "bloqueado" por uma tocha |
| Sons de bloco | nao previsto | `RP/blocks.json` com `"sound": "metal"` para base e receptor | passos/quebra/colocacao com som coerente |
| `tickLancamento` | campo do registro | removido | nunca era lido; `/reload` ja converte LANCANDO em INATIVO ao carregar |

### Pendencias que so o teste in-game resolve
- H2 (entidade sem `runtime_identifier` renderiza?) e H6 (nomes de sons).
- `itemGroup.name.redstoneContainers` existe? Se nao, o bloco cai no fim da aba (nao quebra nada).
- `isSolid`, `isFirstEvent` e `getGameMode()` na 1.12.0: todos com fallback seguro se ausentes.
