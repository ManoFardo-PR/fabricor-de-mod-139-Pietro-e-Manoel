# Plano: Addon "Flechas Especiais"

## Contexto

Criar um novo addon Minecraft Bedrock contendo **4 flechas customizadas** — TNT, Veneno, Lerdeza e Paralisia — disparadas pelo **arco vanilla**, cada uma com efeitos únicos ao acertar bloco ou entidade. O addon segue os padrões do projeto (estrutura BP/RP, namespace snake_case, scripts API `@minecraft/server` v1.12.0, traduções pt-BR/en-US).

A complicação técnica central: o arco vanilla só aceita `minecraft:arrow` como munição. Portanto será necessário **interceptar o disparo** via scripts, spawnar a flecha customizada manualmente e suprimir a flecha vanilla.

## Decisões aprovadas

| Decisão | Escolha |
|---|---|
| Modo de disparo | **Arco vanilla** com interceptação por script |
| Quantidade por receita | **8 flechas** |
| Detecção de impacto | `world.afterEvents.projectileHitEntity` + `projectileHitBlock` |
| Namespace | `flechas_especiais:` |
| Idioma | pt-BR (en-US também incluído) |

## Estratégia técnica do disparo (Híbrida — validada)

1. **`world.afterEvents.itemReleaseUse`** detecta o disparo do arco vanilla. O evento entrega `source` (player), `itemStack` (verificar `minecraft:bow`) e `useDuration` (ticks segurando → calcula power).
2. Buscar primeira flecha customizada no inventário (prioridade por slot). Se nenhuma, retorna.
3. Calcular `power = min(useDuration/20, 1.0)`. Ignorar disparos com `power < 0.1`.
4. **Spawnar flecha customizada** em `player.location + 1.5y` usando `dimension.spawnEntity()`, aplicar `applyImpulse(viewDirection * power * 3.0)` dentro de `system.run()`.
5. Consumir 1 flecha customizada do inventário.
6. Marcar player com `setDynamicProperty("flecha_custom:disparo_tick", system.currentTick)`.
7. **`world.afterEvents.entitySpawn`**: se entidade é `minecraft:arrow` e há player próximo (raio 3) com flag setada neste tick → `entity.remove()` (suprime a flecha vanilla).
8. **`system.runInterval(10)`**: enquanto player segura arco e tem flecha customizada mas não tem `minecraft:arrow`, inserir 1 arrow vanilla "fantasma" no inventário; remover quando trocar item ou pegar arrow real.

## Efeitos no impacto

Listeners `projectileHitEntity` / `projectileHitBlock` filtram por `event.projectile.typeId` e aplicam:

| Flecha | Identificador entidade | Efeito |
|---|---|---|
| TNT | `flechas_especiais:proj_tnt` | `dimension.createExplosion(loc, 3, { breaksBlocks: true, causesFire: false })` |
| Veneno | `flechas_especiais:proj_veneno` | `addEffect("poison", 200, {amplifier:1})`, `addEffect("hunger", 160, {amplifier:0})`, `addEffect("nausea", 120)`, `addEffect("weakness", 200)` |
| Lerdeza | `flechas_especiais:proj_lerdeza` | `addEffect("slowness", 160, {amplifier:3})`, `addEffect("mining_fatigue", 120, {amplifier:1})` |
| Paralisia | `flechas_especiais:proj_paralisia` | `addEffect("slowness", 100, {amplifier:4})`, `addEffect("mining_fatigue", 100, {amplifier:4})`, `addEffect("blindness", 100)` |

Particulas/sons no impacto: 
- TNT → som vanilla pela explosion API
- Veneno → `spawnParticle("minecraft:villager_angry", loc)` + som `mob.zombie.infect`
- Lerdeza → `spawnParticle("minecraft:basic_smoke_particle", loc)`
- Paralisia → `spawnParticle("minecraft:critical_hit_emitter", loc)` + som `random.orb`

## Estrutura de arquivos a criar

```
Flechas Especiais/
├── Flechas Especiais BP/
│   ├── manifest.json                              (UUIDs novos, dep no RP, @minecraft/server 1.12.0)
│   ├── pack_icon.png
│   ├── scripts/main.js                            (LÓGICA COMPLETA — único arquivo de script)
│   ├── items/
│   │   ├── flecha_tnt.item.json                   (icon, display_name, max_stack 64, menu_category equipment/arrow)
│   │   ├── flecha_veneno.item.json
│   │   ├── flecha_lerdeza.item.json
│   │   └── flecha_paralisia.item.json
│   ├── entities/
│   │   ├── proj_tnt.entity.json                   (runtime_identifier minecraft:arrow, projectile, collision_box 0.25x0.25, physics)
│   │   ├── proj_veneno.entity.json
│   │   ├── proj_lerdeza.entity.json
│   │   └── proj_paralisia.entity.json
│   └── recipes/
│       ├── flecha_tnt.recipe.json                 (shaped, 1 arrow + 1 TNT → 8, formato vertical)
│       ├── flecha_veneno.recipe.json              (1 arrow + 1 spider_eye + 1 fermented_spider_eye → 8)
│       ├── flecha_lerdeza.recipe.json             (1 arrow + 1 packed_ice → 8)
│       └── flecha_paralisia.recipe.json           (1 arrow + 1 redstone + 1 glowstone_dust → 8)
└── Flechas Especiais RP/
    ├── manifest.json                              (UUIDs novos, dep no BP)
    ├── pack_icon.png
    ├── entity/
    │   ├── proj_tnt.entity.json                   (client_entity, material entity_alphatest, geometry simples)
    │   ├── proj_veneno.entity.json
    │   ├── proj_lerdeza.entity.json
    │   └── proj_paralisia.entity.json
    ├── textures/
    │   ├── item_texture.json                      (mapeia 4 ícones)
    │   ├── items/
    │   │   ├── flecha_tnt.png                     (16x16, ponta vermelha+listras pretas)
    │   │   ├── flecha_veneno.png                  (16x16, ponta verde escura)
    │   │   ├── flecha_lerdeza.png                 (16x16, ponta azul claro)
    │   │   └── flecha_paralisia.png               (16x16, ponta dourada)
    │   └── entity/
    │       ├── proj_tnt.png                       (textura da entidade em voo)
    │       ├── proj_veneno.png
    │       ├── proj_lerdeza.png
    │       └── proj_paralisia.png
    └── texts/
        ├── languages.json                         (["en_US","pt_BR"])
        ├── pt_BR.lang
        └── en_US.lang
```

## Arquivos de referência do projeto (reutilizar padrões)

- [Pistola Laser BP/scripts/main.js](Pistola Laser/Pistola Laser BP/scripts/main.js) — padrão de `itemReleaseUse`, projétil customizado com `runtime_identifier: minecraft:arrow`, eventos de impacto, CONFIG estruturado.
- [Pistola Laser BP/entities/laser_projetil.entity.json](Pistola Laser/Pistola Laser BP/entities/laser_projetil.entity.json) — template de entidade projétil com `minecraft:projectile`.
- [Cactus Zumbi BP/items/pocao_cactus.item.json](Cactus Zumbi/Cactus Zumbi BP/items/pocao_cactus.item.json) — padrão de item arremessável (referência de receita e estrutura).
- [Cactus Zumbi BP/recipes/pocao_cactus.recipe.json](Cactus Zumbi/Cactus Zumbi BP/recipes/pocao_cactus.recipe.json) — padrão de receita shaped.
- [Cactus Zumbi RP/textures/item_texture.json](Cactus Zumbi/Cactus Zumbi RP/textures/item_texture.json) — padrão de mapeamento de textura de item.
- [Cactus Zumbi RP/texts/pt_BR.lang](Cactus Zumbi/Cactus Zumbi RP/texts/pt_BR.lang) — padrão de tradução.
- [CLAUDE.md](CLAUDE.md) — convenções gerais do projeto.

## Esqueleto do `scripts/main.js`

```javascript
import { world, system, EquipmentSlot, ItemStack } from "@minecraft/server";

// ========== CONFIG ==========
const CONFIG = {
  propDisparo: "flechas_especiais:disparo_tick",
  propAtirador: "flechas_especiais:atirador_id",
  powerMinimo: 0.1,
  velocidadeBase: 3.0,
};

const MAPA_FLECHA_PROJETIL = {
  "flechas_especiais:flecha_tnt":       "flechas_especiais:proj_tnt",
  "flechas_especiais:flecha_veneno":    "flechas_especiais:proj_veneno",
  "flechas_especiais:flecha_lerdeza":   "flechas_especiais:proj_lerdeza",
  "flechas_especiais:flecha_paralisia": "flechas_especiais:proj_paralisia",
};

const PRIORIDADE_FLECHA = Object.keys(MAPA_FLECHA_PROJETIL);

// ========== HELPERS ==========
function primeiraFlechaCustomizada(player) { /* varre inventario, retorna {slot,typeId} */ }
function consumirFlecha(player, typeId, qtd) { /* decrementa item no slot */ }
function temArrowVanilla(player) { /* boolean */ }
function garantirArrowFantasma(player) { /* inserir 1 minecraft:arrow temporaria */ }

// ========== LOOP: arrow fantasma ==========
system.runInterval(() => { /* iterar players com bow + flecha custom */ }, 10);

// ========== DISPARO ==========
world.afterEvents.itemReleaseUse.subscribe((ev) => {
  if (ev.itemStack?.typeId !== "minecraft:bow") return;
  const player = ev.source;
  const flecha = primeiraFlechaCustomizada(player);
  if (!flecha) return;
  
  const power = Math.min(ev.useDuration / 20, 1.0);
  if (power < CONFIG.powerMinimo) return;
  
  const dir = player.getViewDirection();
  const vel = CONFIG.velocidadeBase * power;
  const pos = { x: player.location.x, y: player.location.y + 1.5, z: player.location.z };
  const tipoProj = MAPA_FLECHA_PROJETIL[flecha.typeId];
  
  player.setDynamicProperty(CONFIG.propDisparo, system.currentTick);
  
  system.run(() => {
    const proj = player.dimension.spawnEntity(tipoProj, pos);
    proj.applyImpulse({ x: dir.x * vel, y: dir.y * vel, z: dir.z * vel });
    proj.setDynamicProperty(CONFIG.propAtirador, player.id);
  });
  
  consumirFlecha(player, flecha.typeId, 1);
});

// ========== SUPRESSAO DA ARROW VANILLA ==========
world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (e.typeId !== "minecraft:arrow") return;
  const tickAgora = system.currentTick;
  const players = e.dimension.getPlayers({ location: e.location, maxDistance: 3 });
  for (const p of players) {
    const t = p.getDynamicProperty(CONFIG.propDisparo);
    if (t !== undefined && tickAgora - t <= 1) {
      e.remove();
      p.setDynamicProperty(CONFIG.propDisparo, undefined);
      return;
    }
  }
});

// ========== EFEITOS NO IMPACTO ==========
world.afterEvents.projectileHitEntity.subscribe((ev) => {
  const alvo = ev.getEntityHit()?.entity;
  if (!alvo) return;
  aplicarEfeito(ev.projectile.typeId, alvo, ev.location, ev.projectile.dimension);
  ev.projectile.remove();
});

world.afterEvents.projectileHitBlock.subscribe((ev) => {
  const bloco = ev.getBlockHit()?.block;
  if (!bloco) return;
  aplicarEfeito(ev.projectile.typeId, null, bloco.location, ev.projectile.dimension);
  ev.projectile.remove();
});

function aplicarEfeito(tipoProj, alvo, loc, dim) {
  switch (tipoProj) {
    case "flechas_especiais:proj_tnt":
      dim.createExplosion(loc, 3, { breaksBlocks: true, causesFire: false });
      break;
    case "flechas_especiais:proj_veneno":
      if (alvo) {
        alvo.addEffect("poison", 200, { amplifier: 1 });
        alvo.addEffect("hunger", 160);
        alvo.addEffect("nausea", 120);
        alvo.addEffect("weakness", 200);
      }
      dim.spawnParticle("minecraft:villager_angry", loc);
      break;
    case "flechas_especiais:proj_lerdeza":
      if (alvo) {
        alvo.addEffect("slowness", 160, { amplifier: 3 });
        alvo.addEffect("mining_fatigue", 120, { amplifier: 1 });
      }
      dim.spawnParticle("minecraft:basic_smoke_particle", loc);
      break;
    case "flechas_especiais:proj_paralisia":
      if (alvo) {
        alvo.addEffect("slowness", 100, { amplifier: 4 });
        alvo.addEffect("mining_fatigue", 100, { amplifier: 4 });
        alvo.addEffect("blindness", 100);
      }
      dim.spawnParticle("minecraft:critical_hit_emitter", loc);
      dim.playSound("random.orb", loc);
      break;
  }
}
```

## Limitação documentada para o usuário

O arco vanilla **exige uma `minecraft:arrow` no inventário** para disparar (a menos que o jogador tenha o encantamento Infinity ou esteja em modo Criativo). O script cuida disso inserindo uma "arrow fantasma" temporária quando detecta que o player segura arco e tem flecha customizada, e ela será suprimida no spawn. **No modo Sobrevivência sem Infinity**, recomenda-se que o jogador mantenha pelo menos 1 flecha vanilla no inventário como segurança.

## Verificação end-to-end

1. Instalar BP+RP via copiar para `%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_*_packs\`.
2. Criar mundo Criativo de teste, ativar os 2 packs e habilitar **Beta APIs** (se necessário) + **Holiday Creator Features**.
3. Abrir inventário criativo → aba **Equipamento**: confirmar 4 flechas com texturas próprias e nomes traduzidos.
4. Testar cada receita no banco de trabalho: confirmar yield 8 e ingredientes corretos.
5. Pegar arco + 1 flecha vanilla + cada flecha customizada. Atirar contra:
   - Bloco (Flecha TNT) → confirmar explosão de raio ~3.
   - Mob (Veneno) → confirmar `poison`, `hunger`, `nausea`, `weakness` simultâneos.
   - Mob (Lerdeza) → confirmar `slowness IV` + `mining_fatigue II`.
   - Mob (Paralisia) → confirmar `slowness V` + `mining_fatigue V` + `blindness`.
6. Verificar visualmente que a flecha em voo tem **textura customizada** (não branca vanilla).
7. Verificar Content Log do Minecraft (sem erros de JSON ou script).
8. Testar com arco com encantamento Infinity (flecha custom deve continuar sendo consumida; arrow vanilla não).
9. Rodar `/revisar-mod` e `/varredura-bugs` no addon.

## Riscos remanescentes

- **Multiplayer com 2 arqueiros disparando no mesmo tick**: marcação por `player.id` + raio de busca de 3 blocos minimiza colisões; em casos extremos pode haver ambiguidade — aceitável.
- **Arrow fantasma**: cleanup ao trocar item ou sair do mundo (via `playerLeave` event).
- **Power < 0.1**: tap-fire ignorado para evitar uso acidental.
- **Velocidade ajustável**: `velocidadeBase = 3.0` pode precisar de tuning fino após teste in-game.

## Fluxo de implementação

Conforme `CLAUDE.md`, será usado:
1. `/criar-mob` (4x, uma por entidade projétil) — gera entidades + items + receitas + texturas placeholder + traduções
2. `/comportamento-mob` — adiciona lógica completa em `scripts/main.js`
3. `/revisar-mod` — valida integridade
4. `/varredura-bugs` — encontra problemas finais
5. `instalar.bat` (atualizar para incluir o novo addon)
