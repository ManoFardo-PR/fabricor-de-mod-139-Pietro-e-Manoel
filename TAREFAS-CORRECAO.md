# Tarefas de Correcao - Revisao de 2026-10-14

Lista de tarefas autocontidas para resolver os defeitos encontrados na revisao completa do projeto.
Cada tarefa traz: arquivos exatos, o que mudar e como verificar. Nenhuma depende de contexto fora deste arquivo.

Ordem recomendada: corrigir primeiro nos packs **modulares** (T01 a T16), depois sincronizar o **unificado** (T17 a T19)
e por fim validar tudo (T20 a T22). Convencao: `U` = `Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js`.

Verificacao padrao de script, usada em varias tarefas:
```bash
node --check "<caminho do main.js>"
```

---

## Bloco A - Bugs de script que quebram funcionalidade

### T01 - Corrigir `damagedEntity` -> `hitEntity` (Armadura de Slime)
- **Defeito:** `EntityHitEntityAfterEvent` nao tem `damagedEntity`; o alvo fica `undefined` e o handler retorna. Repulsao (3+ pecas) e arremesso (4 pecas) nunca rodam.
- **Arquivos:**
  - `Armadura de Slime/Armadura de Slime BP/scripts/main.js` linha 553
  - `U` linha 1424
- **Mudanca:** trocar `event.damagedEntity` por `event.hitEntity` nas duas linhas.
- **Verificar:** `grep -rn damagedEntity --include=main.js .` deve retornar vazio; `node --check` nos dois arquivos.

### T02 - Multiplicador: inventario cheio e itens nao empilhaveis
- **Defeito 1:** `container.addItem` nao lanca excecao; devolve o `ItemStack` que nao coube (ou `undefined`). O `catch` nunca roda e o excedente some.
- **Defeito 2:** `output.amount = 10` e limitado ao stack maximo do item. Ferramentas e armaduras (max 1) pagam 10 diamantes e recebem 1.
- **Arquivos:**
  - `Multiplicador/Multiplicador BP/scripts/main.js` linhas 79-88
  - `U` linhas 1221-1230
- **Mudanca:** substituir o bloco "Dar 10 copias do item" por:
  ```js
  const copias = 10;
  const porStack = Math.max(1, Math.min(copias, itemClone.maxAmount));
  let restantes = copias;
  while (restantes > 0) {
      const lote = itemClone.clone();
      lote.amount = Math.min(porStack, restantes);
      restantes -= lote.amount;
      let sobra;
      try { sobra = container.addItem(lote); } catch (e) { sobra = lote; }
      if (sobra) {
          try { player.dimension.spawnItem(sobra, player.location); } catch (e2) {}
      }
  }
  ```
- **Verificar:** `node --check`; in-game: multiplicar uma picareta de diamante deve render 10 picaretas; com inventario cheio os itens caem no chao.

### T03 - Multiplicador: cancelar interacao vanilla e evitar disparo duplo
- **Defeito:** `afterEvents.playerInteractWithBlock` nao cancela a acao vanilla (bloco segurado e colocado; comida e arco iniciam uso) e tende a disparar 2x por clique (mao principal + secundaria).
- **Arquivos:** `Multiplicador/Multiplicador BP/scripts/main.js` linha 8; `U` linha 1159.
- **Mudanca:**
  1. Debounce: `const ultimoUso = new Map();` no topo da secao; no inicio do handler:
     ```js
     const agora = system.currentTick;
     if (ultimoUso.get(player.id) === agora) return;
     ultimoUso.set(player.id, agora);
     ```
     e limpar `ultimoUso` em `playerLeave`.
  2. Trocar para `world.beforeEvents.playerInteractWithBlock.subscribe((event) => { ...; event.cancel = true; system.run(() => { /* logica atual */ }); })`.
     Se o Content Log reclamar que `beforeEvents.playerInteractWithBlock` nao existe em 1.12.0, manter o afterEvent apenas com o debounce do passo 1.
- **Verificar:** `node --check`; in-game: segurar um bloco de pedra e clicar no multiplicador NAO deve colocar a pedra; um clique gasta exatamente 10 diamantes.

### T04 - Flechas Especiais: refazer o mecanismo de disparo
- **Defeitos** (todos em `Flechas Especiais/Flechas Especiais BP/scripts/main.js`):
  - linha 165: `useDuration` e tempo RESTANTE, nao decorrido; o filtro de power esta invertido.
  - linha 172: projetil nasce dentro da hitbox do jogador, sem owner; pode acertar o atirador (a TNT explode nele).
  - linhas 97-153: a "flecha fantasma" vanilla e reinserida a cada 10 ticks, permitindo duplicacao infinita ao jogar ou guardar a flecha; `removerArrowFantasma` apaga stacks reais de 1 flecha.
  - linhas 230 e 246: `projetil.dimension` lido apos `remove_on_hit`; se a entidade ja for invalida lanca e nenhum efeito e aplicado.
  - com flechas vanilla reais no inventario, cada tiro consome 1 real + 1 especial; a supressao tambem apaga flechas de esqueletos a menos de 4 blocos.
- **Solucao recomendada (A): arco proprio com `minecraft:shooter`**, eliminando flecha fantasma, supressao e `applyImpulse`:
  1. Criar `Flechas Especiais BP/items/arco_especial.item.json` (`flechas_especiais:arco_especial`, format 1.21.10) com:
     ```json
     "minecraft:shooter": {
       "ammunition": [
         { "item": "flechas_especiais:flecha_tnt",       "use_offhand": true, "search_inventory": true, "use_in_creative": true },
         { "item": "flechas_especiais:flecha_veneno",    "use_offhand": true, "search_inventory": true, "use_in_creative": true },
         { "item": "flechas_especiais:flecha_lerdeza",   "use_offhand": true, "search_inventory": true, "use_in_creative": true },
         { "item": "flechas_especiais:flecha_paralisia", "use_offhand": true, "search_inventory": true, "use_in_creative": true }
       ],
       "max_draw_duration": 1.0, "scale_power_by_draw_duration": true, "charge_on_draw": false
     },
     "minecraft:use_modifiers": { "use_duration": 3.0, "movement_modifier": 0.35 },
     "minecraft:durability": { "max_durability": 384 }
     ```
     mais `minecraft:icon`, `minecraft:display_name`, `minecraft:max_stack_size: 1` e `menu_category` equipment / `itemGroup.name.bow`.
  2. Nos 4 `items/flecha_*.item.json`, adicionar `"minecraft:projectile": { "projectile_entity": "flechas_especiais:proj_<tipo>" }` (o `shooter` usa esse componente para saber o que disparar).
  3. Receita `recipes/arco_especial.recipe.json` (ex.: arco vanilla + redstone + diamante), textura `textures/items/arco_especial.png`, chave em `item_texture.json`, `item.flechas_especiais:arco_especial.name` em `pt_BR.lang` e `en_US.lang`.
  4. No `main.js`: remover `CONFIG.arco/arrowVanilla/powerMinimo/velocidadeBase/raioSupressao/janelaSupressaoTicks/intervaloFantasma`, o loop de flecha fantasma, os handlers `itemReleaseUse` e `entitySpawn`, as funcoes `temArrowVanilla/temArcoNaMao/consumirFlechaCustom/inserirArrowFantasma/removerArrowFantasma` e os Maps `tickDisparoPorPlayer/playerTemFantasma` (ajustar `playerLeave`). Manter `aplicarEfeito` e os dois handlers `projectileHit*`, trocando `const dim = projetil.dimension;` por `const dim = evento.dimension;`.
  5. Nas 4 entidades `proj_*.entity.json`, manter `remove_on_hit` (o shooter define owner, entao o projetil nao acerta o atirador).
- **Solucao alternativa (B), se quiser manter o arco vanilla:** corrigir pelo menos: usar `evento.dimension` nos handlers; spawnar em `jogador.getHeadLocation()` deslocado `direcao * 1.0` e disparar com `getComponent("minecraft:projectile")` (`proj.owner = jogador; proj.shoot(vel)`); registrar o tick em `itemStartUse` para calcular o tempo segurado; inserir a flecha fantasma uma unica vez por "sessao de arco" (marcar o slot) e remove-la ao trocar de item; so disparar custom quando NAO houver flecha vanilla real. A opcao B continua exploravel; prefira A.
- **Verificar:** `node --check`; in-game: atirar cada flecha em mob e em bloco aplica o efeito; nenhuma flecha vanilla aparece no inventario; o atirador nao se fere.

### T05 - Espada de Fogo: reativar o bloco comentado no Super Picareta modular
- **Defeito:** todo o codigo da espada esta dentro de `/* ... */` ("COMENTADO PARA TESTE"); o item e so uma espada comum no pack modular.
- **Arquivo:** `Super Picareta/Super Picareta BP/scripts/main.js` linhas 955 (`/*`) e 1195 (`*/`).
- **Mudanca:** remover as duas linhas e o sufixo `[COMENTADO PARA TESTE]` do cabecalho (linha 953). O conteudo deve ficar identico ao bloco "Espada de Fogo" do `U` (linhas 935-1153, do cabecalho `// Espada de Fogo` ate o fim do handler `entityHitBlock`).
- **Verificar:** `node --check`; in-game: segurar a espada acende luz e particulas.

### T06 - Sinalizador: persistencia sobrevivendo a reabertura do mundo
- **Defeito:** `landTick: system.currentTick` e salvo em DynamicProperty, mas `currentTick` reinicia ao reabrir o mundo; a idade fica negativa e luz e fumaca nunca expiram.
- **Arquivos:** `Super Picareta/Super Picareta BP/scripts/main.js` linhas ~480-495 (`salvarLandedFlares` / `carregarLandedFlares`) e 714; `U` linhas ~485-500 e 719.
- **Mudanca:** em `salvarLandedFlares`, gravar `restante = maxDuration - (system.currentTick - landTick)` em vez de `landTick` (calcular `maxDuration` com a mesma regra de `updateLandedFlares`: agua 600 / terra 1200, metade se `halfDuration`). Em `carregarLandedFlares`, reconstruir `landTick = system.currentTick - (maxDuration - restante)`, descartando entradas com `restante <= 0` (enfileirar `queueLightRemoval` para a `lightPos` delas).
- **Verificar:** `node --check`; in-game: pousar um flare, sair e reabrir o mundo; a luz deve apagar no tempo restante.

### T07 - TNT arremessavel: fallback nao deve explodir em voo
- **Defeito:** o fallback explode qualquer TNT viva ha mais de 40 ticks, sem checar se parou.
- **Arquivos:** `Super Picareta/Super Picareta BP/scripts/main.js` linhas 244-270 (interval `tntSpawnTick`); `U` linhas 245-271.
- **Mudanca:** guardar tambem a ultima posicao por id (como `submarineData` faz). Explodir quando `age > 40 && velocidade < 0.05`, ou como teto absoluto `age > 200`.
- **Verificar:** `node --check`; in-game: arremessar TNT de uma torre de 30 blocos deve explodir ao tocar o chao, nao no ar.

### T08 - Pistola Laser: efeitos de impacto usam o evento errado
- **Defeito:** `entityHitEntity` so dispara para ataque corpo a corpo; para projeteis o evento e `projectileHitEntity`. O handler de particulas e sons do laser e codigo morto.
- **Arquivos:** `Pistola Laser/Pistola Laser BP/scripts/main.js` linhas 223-260; `U` linhas 1659-1696.
- **Mudanca:** trocar para `world.afterEvents.projectileHitEntity.subscribe((evento) => { const tipoProjetil = evento.projectile?.typeId; const alvo = evento.getEntityHit()?.entity; const dim = evento.dimension; const pos = evento.location; ... })`, usando `dim` e `pos` em vez de `alvo.dimension` e `alvo.location`. Alternativa: apagar o bloco, pois as entidades ja tem `particle_on_hit` e `hit_sound`.
- **Verificar:** `node --check`; in-game: acertar um mob com o laser mostra as particulas do script.

### T09 - Cactus Zumbi: plantar cactus atras do mob, nao embaixo dele
- **Defeito:** usa a posicao atual do mob como "bloco atras"; o cactus nasce dentro do proprio mob.
- **Arquivos:** `Cactus Zumbi/Cactus Zumbi BP/scripts/main.js` linhas 345-368 (bloco que comeca em `chancePlantarCactus`); `U` linhas 2000-2023.
- **Mudanca:** criar `const ultimaPosMob = new Map();` (mob.id -> {x,y,z}). No loop ambiental, ler a posicao anterior; se existir e for diferente da atual, usar a anterior como candidata a plantio (mesmas checagens: ar, areia embaixo, sem bloco adjacente). Atualizar o Map com a posicao atual; remover ids que nao aparecem mais em `todosMobs`.
- **Verificar:** `node --check`; in-game: o cactus nasce no rastro do mob, nunca na posicao dele.

### T10 - Pistola Laser: estado de mira preso
- **Defeito:** `jogadorMirando` so e resetado em `itemStopUse` / `itemReleaseUse`; morte ou teleporte com o botao pressionado deixa a HUD de luneta ligada.
- **Arquivos:** `Pistola Laser/Pistola Laser BP/scripts/main.js` loop `system.runInterval` da linha 91; `U` loop da linha 1551.
- **Mudanca:** no loop de HUD, se `tipoItem !== identificadorSniper` e `jogadorMirando.get(id)` for true, fazer `set(false)` e `desativarZoom(jogador)`. Tambem resetar em `world.afterEvents.playerSpawn` (respawn).
- **Verificar:** `node --check`; in-game: mirar, morrer, respawnar e pegar o rifle: HUD normal, sem "Carregando...".

---

## Bloco B - Bugs de JSON e assets

### T11 - Attachables 3D sem binding a mao
- **Defeito:** as geometrias dos itens segurados nao tem `binding`; o Bedrock renderiza o modelo na origem do jogador (pes), nao na mao.
- **Arquivos (6 geometrias):**
  - `Super Picareta/Super Picareta RP/models/entity/pistola_sinalizadora.geo.json` (bone `root`)
  - `Super Picareta/Super Picareta RP/models/entity/tnt_arremessavel.geo.json` (bone `root`; usado tambem pela bomba submarina)
  - `Pistola Laser/Pistola Laser RP/models/entity/rifle_sniper.geo.json` (bone `bb_main`)
  - os 3 equivalentes em `Mods Pietro e Manoel/Mods Pietro e Manoel RP/models/entity/`
- **Mudanca:** em cada arquivo, mudar `"format_version": "1.12.0"` para `"1.16.0"` (o campo `binding` exige >= 1.16.0) e adicionar ao bone raiz `"binding": "q.item_slot_to_bone_name(c.item_slot)"`. Se o modelo ficar grande ou mal posicionado na mao, adicionar em cada attachable (`attachables/*.json`) animacoes `first_person` / `third_person` com `position`, `rotation` e `scale` no bone raiz, e `scripts.animate` condicionado a `c.is_first_person`.
- **Verificar:** JSON valido; in-game: segurar pistola sinalizadora, TNT, bomba e rifle em 1a e 3a pessoa; o modelo deve aparecer na mao.

### T12 - Bloco Multiplicador: orientacao da face frontal e drop
- **Defeito 1:** sem `y_rotation_offset`, a textura `front` (face `north`, rotacao 0) fica virada para longe do jogador.
- **Defeito 2 (decisao):** `minecraft:loot: "loot_tables/empty.json"` faz o bloco nao dropar nada ao ser quebrado.
- **Arquivos:** `Multiplicador/Multiplicador BP/blocks/multiplicador_x10.block.json` e `Mods Pietro e Manoel/Mods Pietro e Manoel BP/blocks/multiplicador_x10.block.json`.
- **Mudanca:** em `traits.minecraft:placement_direction` adicionar `"y_rotation_offset": 180`. Para o drop, **decidir** se o bloco deve voltar ao ser quebrado: se sim, remover a linha `minecraft:loot` (drop padrao = o proprio bloco) e apagar `loot_tables/empty.json` dos dois BPs; se nao, manter e documentar que o bloco e consumivel.
- **Verificar:** JSON valido; in-game: colocar o bloco olhando para ele; a face com desenho frontal deve ficar voltada para o jogador.

### T13 - Cactus Zumbi: particula inexistente, item legado e animacao de ataque
- **Defeitos:**
  - `minecraft:crit_emitter` nao existe (correto: `minecraft:critical_hit_emitter`). `Cactus Zumbi/Cactus Zumbi BP/scripts/main.js` linhas 231 e 276; `U` linhas 1899 e 1938.
  - `minecraft:red_flower` e ID legado. `Cactus Zumbi/Cactus Zumbi BP/loot_tables/entities/cactus_zumbi_bom.json` linha 28 e `Mods Pietro e Manoel/Mods Pietro e Manoel BP/loot_tables/entities/cactus_zumbi_bom.json` linha 28: trocar por `minecraft:poppy`.
  - `query.is_delayed_attacking` so e setada por `minecraft:behavior.delayed_attack`; os mobs usam `melee_attack`, entao `animation.cactus_zumbi.attack` provavelmente nunca toca. Em `Cactus Zumbi BP/entities/cactus_zumbi_bom.entity.json`, `cactus_zumbi_mau.entity.json` e nas copias do `U` BP, trocar `minecraft:behavior.melee_attack` por `minecraft:behavior.delayed_attack` com `{ "priority": 3, "attack_duration": 0.75, "hit_delay_pct": 0.5, "speed_multiplier": 1.2, "track_target": true }`.
- **Verificar:** JSON valido e `node --check`; in-game: bater no cactus zumbi mostra particula de critico; o mob mexe o corpo ao atacar; o cactus bom dropa papoula ocasionalmente.

### T14 - `texts/languages.json` ausente em 6 RPs
- **Defeito:** so `Flechas Especiais RP` declara os idiomas; os outros 6 RPs dependem de carregamento implicito.
- **Arquivos a criar:** `texts/languages.json` em `Super Picareta RP`, `Armadura de Slime RP`, `Multiplicador RP`, `Pistola Laser RP`, `Cactus Zumbi RP` e `Mods Pietro e Manoel RP`, com conteudo `["en_US", "pt_BR"]`.
- **Verificar:** `ls */*\ RP/texts/languages.json` lista 7 arquivos; JSON valido.

### T15 - Pistola Sinalizadora: decidir se e consumivel ou reutilizavel
- **Defeito / decisao:** o item usa `minecraft:throwable`, logo a "pistola" e consumida a cada tiro (1 craft com balde de lava = 1 disparo).
- **Arquivos:** `Super Picareta/Super Picareta BP/items/pistola_sinalizadora.item.json` e copia no `U` BP; scripts `Super Picareta BP/scripts/main.js` (secao FLARE) e `U`.
- **Mudanca (se reutilizavel):** remover `minecraft:throwable` e `minecraft:projectile` do item; definir `max_stack_size: 1` e `minecraft:durability` (ex.: 64); no script adicionar `world.afterEvents.itemUse` que, se `itemStack.typeId === "escavadora:pistola_sinalizadora"`, spawna `escavadora:sinalizador_projetil` em `getHeadLocation()` deslocado `direcao * 0.8`, faz `proj.owner = jogador; proj.shoot({ x: d.x * 1.2, y: d.y * 1.2, z: d.z * 1.2 }, { uncertainty: 0 })`, aplica 1 de dano de durabilidade e toca `firework.blast`. Opcional: criar item municao `escavadora:sinalizador` e usar `minecraft:shooter` em vez de script. Atualizar `documentacao/04_pistola_sinalizadora.md`.
- **Mudanca (se consumivel):** registrar a decisao em `documentacao/04_pistola_sinalizadora.md` e revisar a receita para render mais unidades (ex.: `count: 4`).
- **Verificar:** in-game: atirar nao consome a pistola (ou consome, conforme a decisao).

### T16 - Armadura de Slime v2: bugs de estado (no modular, antes de sincronizar)
- **Arquivo:** `Armadura de Slime/Armadura de Slime BP/scripts/main.js`.
- **Defeitos e mudancas:**
  1. linha ~440: `state.superBounceFallDist` so e zerado ao grudar. Zerar tambem ao pousar sem quique (apos `state.isFalling = false`, se nao houve super quique) e quando `pieces < 4`.
  2. linha ~382: `if (pieces === 4 && state.stuckOnCeiling)`; com menos de 4 pecas o estado nunca e liberado. Adicionar antes: `if (state.stuckOnCeiling && pieces < 4) { state.stuckOnCeiling = false; state.ceilingStuckTicks = 0; try { player.removeEffect("levitation"); } catch (e) {} }`.
  3. linhas ~248 e ~356: `removeEffect("slowness")` apaga lentidao de outras fontes. Remover apenas se o outro estado (folhas ou grude com mob) nao estiver ativo.
  4. linhas ~187-189: ao zerar pecas, se `state.leavesStuck` ou `state.stuckWithMobId` estiverem ativos, remover `slowness` e `levitation` antes de `playerState.delete`.
  5. linhas ~500-507: `getEntities({ excludeTypes: [...] })` pega flechas, orbs e barcos. Adicionar `families: ["mob"]` ao filtro.
  6. `attachables/botas_slime.json` linha 11 (RP modular e RP unificado): as botas usam `slime_armor_2`; o vanilla mapeia botas na camada 1. Trocar para `textures/models/armor/slime_armor_1` **somente se** a regiao dos pes em `slime_armor_1.png` estiver desenhada; caso contrario manter.
- **Verificar:** `node --check`; in-game: pulo normal em corredor de 2 blocos nao gruda no teto; tirar uma peca grudado no teto solta o jogador.

---

## Bloco C - Sincronizacao unificado <-> modulares

### T17 - Levar a Armadura de Slime v2 para o unificado
- **Defeito:** o `U` tem a v1 (particulas, veneno, saltos, super quique, repulsao); a v2 (folhas, teto, arremesso, agachar) existe so no modular. O auditor `auditar_paridade.mjs` nao detecta porque compara arquivos, nao secoes de script.
- **Pre-requisito:** T01 e T16 aplicados no modular.
- **Arquivos:** origem `Armadura de Slime/Armadura de Slime BP/scripts/main.js` (linhas 17-637); destino `U` secao "3. ARMADURA DE SLIME" (linhas 1252-1467, de `const SLIME_IDS` ate o fim do `playerLeave` da secao).
- **Mudanca:** substituir a secao inteira pelo codigo do modular com prefixos: `CONFIG` -> `SLIME_CONFIG`, `playerState` -> `slimePlayerState`, `getOrCreateState` -> `getOrCreateSlimeState`, `isLeafBlock/hasCeilingAbove/isTouchingLeaves` -> `slimeIsLeafBlock/slimeHasCeilingAbove/slimeIsTouchingLeaves`. Nao duplicar o `import`. Seguir `INTEGRACAO-UNIFICADO.md` secao 4.5.
- **Verificar:** `node --check "U"`; diff sem comentarios e espacos entre a secao do `U` (apos desfazer os prefixos via `sed`) e o modular deve ser vazio.

### T18 - Igualar a secao Super Picareta do unificado ao modular
- **Defeito:** divergencias cruzadas: o `U` tem a fila de retry de remocao de `light_block` (`pendingLightRemovals`, `queueLightRemoval`, `processPendingLightRemovals`) que o modular nao tem; o modular tinha a espada comentada (T05).
- **Pre-requisito:** T05, T06 e T07 aplicados.
- **Arquivos:** `Super Picareta/Super Picareta BP/scripts/main.js` e `U` linhas 14-1153 (ate antes do cabecalho `2. MULTIPLICADOR`).
- **Mudanca:** escolher o `U` como fonte da verdade da secao (ele e mais novo) e copiar as linhas 14-1153 do `U` por cima do corpo do modular (mantendo o `import` do modular, que nao inclui `EquipmentSlot`). Depois aplicar T06 e T07 nos dois.
- **Verificar:** diff codigo-apenas vazio:
  ```bash
  strip(){ sed -E 's#//.*$##; s/[[:space:]]+//g' | grep -v '^$'; }
  diff <(sed -n '14,1153p' "Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js" | strip) <(sed -n '2,$p' "Super Picareta/Super Picareta BP/scripts/main.js" | strip)
  ```

### T19 - Replicar no unificado as correcoes de Multiplicador, Laser e Cactus
- **Pre-requisito:** T02, T03, T08, T09, T10 e T13 aplicados nos modulares.
- **Arquivos:** `U` secoes 2 (Multiplicador, linhas ~1150-1245), 4 (Laser, ~1468-1740) e 5 (Cactus, ~1741-2028); JSONs correspondentes em `Mods Pietro e Manoel BP/blocks`, `entities` e `loot_tables`.
- **Mudanca:** copiar os blocos corrigidos aplicando os prefixos ja usados (`LASER_CONFIG`, `laserJogador*`, `CACTUS_CONFIG`, `cactus*`); copiar byte a byte os JSONs de bloco, entidades e loot tables (Protocolo 1 do `INTEGRACAO-UNIFICADO.md`).
- **Verificar:** `node .claude/skills/integridade-projeto/auditar_paridade.mjs` deve imprimir `TOTAL DE BLOQUEIOS: 0`; diffs codigo-apenas (mesma tecnica de T18, com `sed` dos prefixos) vazios para as 3 secoes.

---

## Bloco D - Documentacao, instalador e detalhes

### T20 - Documentacao e instalador desatualizados
- **Arquivos e mudancas:**
  - `Super Picareta/documentacao/04_pistola_sinalizadora.md` linha 14: "quica ate 2 vezes" -> "quica 1 vez"; "esfera de luz com raio de 7 blocos" -> "um bloco de luz nivel 14 no ponto de pouso". Revisar o resto do arquivo apos T15.
  - `Super Picareta/documentacao/00_visao_geral.md`, secao "Obtendo os itens no jogo": os 5 itens TEM receitas (`Super Picareta BP/recipes/*.recipe.json`); listar as receitas e manter os `/give` como alternativa.
  - `instalar.bat` linha 281: "OU os 5 packs modulares" -> "OU os 6 packs modulares"; commitar a alteracao pendente do `instalar.bat` (as opcoes 7 e 8 ja incluem Flechas Especiais).
  - `Multiplicador/instalar.bat` linha 77: remover a instrucao de ativar "Beta APIs" (o Multiplicador usa so API estavel) ou trocar por "Beta APIs so e necessario para o zoom do Rifle Sniper".
- **Verificar:** leitura; `git diff --stat` mostra apenas os arquivos listados.

### T21 - Pequenos ajustes de robustez (baixa prioridade)
- `Super Picareta/Super Picareta BP/scripts/main.js` linha 70 e `U` linha 81: trocar `id.includes("ore")` por `id.endsWith("_ore") || id === "minecraft:ancient_debris"` e preservar tambem `minecraft:chest`, `minecraft:trapped_chest`, `minecraft:barrel`, `minecraft:mob_spawner`, `minecraft:shulker_box` e `minecraft:ender_chest`.
- `isFlammable` (`function isFlammable` em SP linha 533, `U` linha 546): `includes("grass")` pega `grass_block`; trocar por `id === "minecraft:short_grass" || id === "minecraft:tall_grass" || id === "minecraft:grass"`.
- `Multiplicador/Multiplicador BP/recipes/multiplicador_x10.recipe.json` linha 2 e copia no `U` BP: `"format_version": "1.21.10"` -> `"1.12"` (igual as outras 32 receitas), por seguranca de schema.
- `Pistola Laser/Pistola Laser BP/scripts/main.js` linha 10 e `U` linha 1476: remover `intervaloHUD` (nunca usado) ou usa-lo no `runInterval`.
- **Verificar:** `node --check` nos scripts tocados; JSON valido.

### T22 - Validacao final do projeto
- **Comandos:**
  ```bash
  for f in */*\ BP/scripts/main.js; do node --check "$f" && echo "OK $f"; done
  node .claude/skills/integridade-projeto/auditar_paridade.mjs
  grep -rn "damagedEntity\|crit_emitter\"\|red_flower" --include=*.js --include=*.json . ; echo "(deve ser vazio)"
  ```
  E validar todos os JSONs (script Node que percorre o projeto e faz `JSON.parse` em cada `.json`, ignorando `.git`).
- Depois rodar `/varredura-bugs` e `/revisar-mod` em cada addon, instalar com `instalar.bat` e testar in-game com **apenas um grupo** de packs ativo (modulares OU unificado), Beta APIs ligadas para o zoom.

---

## Conferencia de cobertura (defeito -> tarefa)

| Defeito encontrado na revisao | Tarefa |
|---|---|
| `damagedEntity` (Slime modular + unificado) | T01 |
| Multiplicador: `addItem` sem catch util; `amount = 10` em nao empilhaveis | T02 |
| Multiplicador: interacao vanilla nao cancelada; disparo duplo | T03 |
| Multiplicador: face frontal invertida; loot vazia | T12 |
| Multiplicador: `format_version` da receita | T21 |
| Attachables sem binding (pistola, TNT, bomba, rifle) | T11 |
| Flechas: `useDuration`, spawn na hitbox, flecha fantasma infinita, `projetil.dimension`, consumo duplo, supressao de flechas alheias | T04 |
| Espada de Fogo comentada no modular | T05 |
| Divergencia Slime v1 / v2 | T17 |
| Divergencia fila de remocao de luz | T18 |
| Flares persistidos nunca expiram | T06 |
| TNT explode em voo apos 40 ticks | T07 |
| Laser: `entityHitEntity` para projetil | T08 |
| Laser: `jogadorMirando` preso; `intervaloHUD` sem uso | T10, T21 |
| Cactus: planta cactus na propria posicao | T09 |
| Cactus: `crit_emitter`, `red_flower`, `is_delayed_attacking` | T13 |
| Cactus: apice do arremesso vertical detectado como parada | nao incluido (baixa, comportamento aceitavel); se desejar, exigir 2 leituras consecutivas paradas no loop de tracking |
| Cactus: pernas da geometria sobrepostas (z-fighting) | nao incluido (cosmetico); se desejar, ajustar `size` z = 2 nos bones `leg_*` |
| Slime v2: `superBounceFallDist`, `stuckOnCeiling` travado, `removeEffect` global, grude em nao-mobs, textura das botas | T16 |
| Slime: resistencia V imuniza a tudo durante a queda | nao incluido (provavelmente intencional); alternativa: anular so dano com causa `fall` via `entityHurt` |
| Bomba Submarina sem tratamento de acerto em entidade (`projectileHitEntity`) | nao incluido (incerto, depende do engine); se desejar, adicionar handler `projectileHitEntity` para `escavadora:bomba_submarina` chamando `explodeSubmarineLand`/`explodeSubmarineWater` conforme `isInWaterAt` |
| Pistola sinalizadora consumivel | T15 |
| `languages.json` ausente | T14 |
| Docs desatualizadas; `instalar.bat` texto e commit; Beta APIs no instalador do Multiplicador | T20 |
| `includes("ore")` / `includes("grass")` frageis | T21 |
| Validacao geral | T22 |
