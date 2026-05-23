# Plano de Acao: Correcao de Integridade do Projeto

## Contexto

A auditoria automatizada `node .claude/skills/integridade-projeto/auditar_paridade.mjs` identificou **75 bloqueios de paridade** entre o pack unificado `Mods Pietro e Manoel` e os 5 addons modulares, alem de **4 bugs comportamentais criticos** documentados na investigacao anterior. Este plano organiza as correcoes em ondas sequenciais, cada uma seguindo um protocolo da skill `integridade-projeto` e terminando com auditoria automatizada para garantir que nenhuma regressao foi introduzida.

## Sumario dos problemas

| ID | Sistema | Causa raiz | Severidade |
|----|---------|-----------|-----------|
| B1 | Pack unificado - Armadura de Slime | 4 attachables + 2 PNGs de modelo ausentes em `Mods Pietro e Manoel RP` | Alta |
| B2 | Pack unificado - Pistola Laser | 40 arquivos ausentes (BP completo, RP completo, item_texture, lang) | Critica |
| B3 | Pack unificado - Cactus Zumbi | 34 arquivos ausentes (mesmo padrao) | Critica |
| B4 | Pistola Sinalizadora - luz persistente | `landedFlares = new Map()` sem espelhamento em DynamicProperty; chunks descarregados orfanam light_blocks | Alta |
| B5 | Pistola Sinalizadora - quique excessivo | `FLARE_CONFIG.bounce.maxBounces: 2` + `velocityLoss: 0.3` + `minVertical: 0.1` | Media |
| B6 | Rifle Sniper - zoom invisivel | `camera.setFov` dentro de `try/catch (e) {}` silencioso; impossivel saber se API falhou | Media |
| B7 | Rifle Sniper - pan rapido | Limitacao da Bedrock Engine (sensibilidade nao escala com FOV); aceitar trade-off | Baixa |

## Mapa de ondas

| Onda | Foco | Protocolos da skill `integridade-projeto` | Validacao final |
|------|------|------------------------------------------|-----------------|
| 0 | Fixes Mecanizaveis (acelerador opcional) | Aplica subsets dos Protocolos 1, 2 e 4 via script | `node corrigir-bugs.js` termina com 0 erros |
| 1 | Sincronizacao de Assets | Protocolo 1 (Paridade) + Protocolo 4 (Referencias) | `auditar_paridade.mjs` retorna 0 bloqueios |
| 2 | Correcao de Identificadores | Protocolo 2 (Consistencia BP/RP) + Protocolo 4 | Skill `revisar-mod` em cada addon |
| 3 | Refatoracao de Scripts | Protocolo 3 (DynamicProperties) | Skill `varredura-bugs` no main.js |
| 4 | Ajustes Comportamentais | Skills `revisar-mod` + `varredura-bugs` | Roteiro de teste in-game |

Cada onda deve ser commitada separadamente para facilitar rollback.

---

## Onda 0 - Fixes Mecanizaveis (acelerador opcional)

**Objetivo:** aplicar em batch os fixes 100% auto-corrigiveis (sem decisao de design) antes de iniciar a Onda 1, reduzindo trabalho manual nas ondas subsequentes.

**Escopo:** 4 fixes mecanizaveis ja diagnosticados:
1. **Slime parity** (subset da Onda 1A) - copiar 4 attachables + 2 PNGs de modelo
2. **empty.json** (Onda 2C primeiro bullet) - criar arquivo nos 2 BPs
3. **Render controller do Rifle** (subset da Onda 2A) - troca `controller.render.default` -> `controller.render.item_default` no `Pistola Laser RP/attachables/rifle_sniper.json`
4. **Bounce tuning** (Onda 4A completa) - aplicar valores novos em `Super Picareta BP/scripts/main.js:452-454` e `Mods Pietro e Manoel BP/scripts/main.js:431-433`

**Implementacao sugerida:** script `corrigir-bugs.js` na raiz do projeto, conforme plano detalhado em `vou-criar-um-script-snug-leaf.md` (ver tambem Apendice A). Caracteristicas obrigatorias:
- Idempotente (rodar varias vezes nao tem efeito colateral - usar hash MD5 para comparar arquivos binarios)
- `--dry-run` mostra o que faria sem escrever
- `--no-backup` desativa criacao de `.bak` (padrao: criar backup)
- `--apenas <fixN>` / `--pular <fixN>` para granularidade
- `--strict` para no primeiro erro (padrao: continuar)
- Zero dependencias externas (so `node:fs`, `node:path`, `node:crypto`)
- Apos aplicar tudo, executa validacao automatica (`node --check` nos scripts editados + parse de JSONs alterados)

**Importante:** Onda 0 NAO substitui as ondas seguintes - apenas resolve os 8 arquivos mecanizaveis. Ainda restam manuais:
- Onda 1B/1C (Pistola Laser + Cactus Zumbi: 74 arquivos exigem decisao de merge de scripts)
- Onda 2A demais attachables + Onda 2B (auditoria de identifiers BP<->RP)
- Onda 3 (refatoracao arquitetural para DynamicProperty)
- Onda 4B/4C (feedback de zoom + documentacao de limitacao do Bedrock)

### Validacao da Onda 0
```
# 1. Script de fix terminou com 0 erros
node corrigir-bugs.js

# 2. JSONs alterados continuam validos
node --check "Super Picareta/Super Picareta BP/scripts/main.js"
node --check "Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js"

# 3. Paridade da Slime resolvida (deve ter sumido do relatorio)
node .claude/skills/integridade-projeto/auditar_paridade.mjs
# Esperado: bloqueios da Armadura de Slime caem de 6 para 0;
# bloqueios totais caem de 75 para 69 (restam Pistola Laser + Cactus Zumbi).
```

---

## Onda 1 - Sincronizacao de Assets (resolve B1+B2+B3)

**Objetivo:** zerar os 75 bloqueios de paridade. Ao final desta onda, ativar apenas o pack unificado entrega os 5 mods completos.

**Protocolo aplicado:** Protocolo 1 (Paridade de Pacotes Unificados) - copia 1-para-1 de cada arquivo do addon modular para o unificado, preservando estrutura de pastas e identifiers.

### 1A. Armadura de Slime (6 arquivos)
**Causa raiz:** quando o pack unificado foi consolidado, a etapa de copia de attachables e texturas de modelo da armadura foi omitida. O item BP esta presente e o icone funciona, mas o engine nao tem instrucao para renderizar a armadura no corpo do jogador.

Copiar do modular para o unificado:
- `Armadura de Slime RP/attachables/capacete_slime.json` -> `Mods Pietro e Manoel RP/attachables/`
- `Armadura de Slime RP/attachables/peitoral_slime.json` -> idem
- `Armadura de Slime RP/attachables/calcas_slime.json` -> idem
- `Armadura de Slime RP/attachables/botas_slime.json` -> idem
- `Armadura de Slime RP/textures/models/armor/slime_armor_1.png` -> `Mods Pietro e Manoel RP/textures/models/armor/`
- `Armadura de Slime RP/textures/models/armor/slime_armor_2.png` -> idem

**Estrategia de idempotencia:** para retomadas seguras (script abortado no meio, multipla execucao), comparar hash MD5 do arquivo origem com destino antes de copiar. Se identicos, pular. Esta logica e a base da Onda 0 e deve ser preservada em qualquer automacao futura de sincronizacao de packs.

### 1B. Pistola Laser (40 arquivos)
**Causa raiz:** addon nao foi incluido na consolidacao inicial; apenas 4 PNGs de icone foram copiados (orfaos sem definicao de item no BP).

Copiar todos os arquivos listados no relatorio do `auditar_paridade.mjs`, preservando estrutura:
- BP: 4 items (`pistola_laser, rifle_sniper, municao_laser, municao_sniper`), 2 entities (`laser_projetil, sniper_projetil`), 4 recipes
- RP: 1 attachable (`rifle_sniper.json` - 3D na mao), 2 client_entity, 2 models/entity, 1 render_controller, 1 animation, 8 PNGs (4 icones + 4 entidades)
- Adicionar 4 chaves em `Mods Pietro e Manoel RP/textures/item_texture.json`: `pistola_laser`, `municao_laser`, `rifle_sniper`, `municao_sniper`
- Adicionar 6 chaves em cada `texts/{pt_BR,en_US}.lang` do unificado
- Concatenar logica de `Pistola Laser BP/scripts/main.js` no `Mods Pietro e Manoel BP/scripts/main.js` (Onda 3 trata script)

### 1C. Cactus Zumbi (34 arquivos)
**Causa raiz:** mesmo padrao de B2.
- BP: 1 item (`pocao_cactus`), 3 entities (`cactus_zumbi_bom, cactus_zumbi_mau, pocao_projetil`), 1 recipe, 2 loot_tables
- RP: 3 client_entity, 2 models/entity, 2 render_controllers, 2 animations, 4 PNGs
- Adicionar chave `pocao_cactus` em `item_texture.json`
- Adicionar 4 chaves em cada `texts/*.lang`
- Concatenar logica de `Cactus Zumbi BP/scripts/main.js` no script unificado (Onda 3)

### Validacao da Onda 1
```
node .claude/skills/integridade-projeto/auditar_paridade.mjs
```
**Criterio de aprovacao:** `TOTAL DE BLOQUEIOS: 0`. Caso contrario, identificar arquivo faltante na saida e completar antes de avancar para Onda 2.

---

## Onda 2 - Correcao de Identificadores e Referencias (resolve bugs estruturais)

**Objetivo:** garantir que toda referencia em RP resolve em arquivo/identifier existente.

**Protocolos aplicados:** Protocolo 2 (Consistencia BP <-> RP) e Protocolo 4 (Validacao de Referencias).

### 2A. Auditar render_controllers de attachables
Para cada `*/attachables/*.json` em todos os packs (modulares e unificado):
- Se o array `render_controllers` contem `controller.render.default` (que **nao existe** vanilla), **substituir** por:
  - `controller.render.armor` - para armaduras
  - `controller.render.item_default` - para itens segurados em 3D (ex: rifle sniper)
- Verificar particularmente o attachable do Rifle Sniper conforme observacao 4.2 do diagnostico anterior

**Rationale - por que usar vanilla em vez de custom:** os attachables atuais (rifle sniper, armaduras) **nao tem variantes condicionais** de material/textura (sem multiplos `arrays.textures`, sem `Math.random` em material, sem geometrias alternativas por estado). Render controllers vanilla cobrem 100% das necessidades. Criar um `controller.render.rifle_sniper` custom adicionaria 1 arquivo por addon sem ganho funcional. Se no futuro um attachable precisar de logica condicional (ex: textura encantada), entao criar custom; ate la, vanilla e a escolha correta.

### 2B. Auditar identifiers BP <-> RP
Para cada addon, aplicar o mapa do Protocolo 2 da skill:

| Origem | Destino | Verificar |
|--------|---------|-----------|
| `items/*.item.json` -> `identifier` | `attachables/*.json` -> `identifier` | identico |
| `items/*.item.json` -> `minecraft:icon` | chave em `textures/item_texture.json` | identico |
| `entities/*.entity.json` -> `identifier` | `entity/*.entity.json` -> `identifier` | identico |
| client_entity -> `geometry.default` | `models/entity/*.geo.json` -> identifier | `geometry.<nome>` identico |
| client_entity -> `render_controllers[]` | `render_controllers/*.json` -> chave | identico ou vanilla |

Discrepancias devem ser corrigidas **no RP** (preservar identifier do BP como fonte de verdade).

### 2C. Limpar referencias quebradas
- `Multiplicador x10 BP` (e a copia no pack unificado) referencia `loot_tables/empty.json` que nao existe -> **criar o arquivo nos dois caminhos**:
  - `Multiplicador x10/Multiplicador x10 BP/loot_tables/empty.json`
  - `Mods Pietro e Manoel/Mods Pietro e Manoel BP/loot_tables/empty.json`
  - Conteudo identico nos dois: `{ "pools": [] }`
  - Alternativa equivalente: **remover** o componente `minecraft:loot` do bloco (a omissao tambem evita drop), mas exige editar 2 blocos. Criar o arquivo vazio e menor delta.
- Apagar chaves em `item_texture.json` que apontam para PNGs inexistentes
- Apos remover qualquer chave de `item_texture.json` no modular, repetir remocao no unificado para manter paridade

### Validacao da Onda 2
- `node .claude/skills/integridade-projeto/auditar_paridade.mjs` (continua 0 bloqueios)
- Aplicar mentalmente a skill `revisar-mod` em cada addon, focando nos itens **10** (render controllers), **11** (attachables) e **13** (scripts persistentes)
- No teste in-game, confirmar que o Content Log do Minecraft **nao** mostra warnings de `geometry not found`, `render controller not found` ou `texture not found`

---

## Onda 3 - Refatoracao de Scripts para DynamicProperties (resolve B4)

**Objetivo:** aplicar Protocolo 3 (Ciclo de Vida de Scripts) ao codigo do FLARE para eliminar `light_block` orfaos persistentes no mundo apos reload.

### 3A. Refatorar `Super Picareta BP/scripts/main.js`

**Causa raiz:** as estruturas `landedFlares = new Map()` (linha 477) e `flightFlares = new Map()` (linha 476) sao estado puramente em memoria. Apos `/reload`, recarga de mundo ou crash, as luzes ativas no momento ficam orfas permanentes — o `light_block` segue colocado mas o script perdeu o tracking para remove-lo.

Mudancas concretas no script:
1. Adicionar constante: `const FLARE_PROP_KEY = "escavadora:landed_flares";`
2. Funcao `carregarLandedFlares()` - le `world.getDynamicProperty(FLARE_PROP_KEY)`, parse JSON, popula Map
3. Funcao `salvarLandedFlares()` - serializa `Array.from(landedFlares.entries())` para JSON, chama `world.setDynamicProperty(FLARE_PROP_KEY, ...)`
4. Subscribe `world.afterEvents.worldLoad`:
   - Repopular `landedFlares` Map a partir do DynamicProperty
   - Para cada entry expirada, tentar `removeSingleLight` imediatamente; se chunk descarregado, manter no Map para retry no proximo update
5. Em `flareLand` (linha 645) e `updateLandedFlares` (linha 856): chamar `salvarLandedFlares()` apos cada `set`/`delete`
6. Em `removeSingleLight` que falha por chunk descarregado: **NAO** deletar entry do Map - manter para retry; usar fallback `runCommand("tickingarea add ...")` apenas se age > `maxDuration + 1200` (tempo razoavel)
7. **Manter `flightFlares` apenas em Map** (estado efemero - flares em voo nao precisam sobreviver a reload; o loop a cada 2 ticks ja faz reconciliacao via `dimension.getEntities`)
8. Chave de DynamicProperty usa prefixo `escavadora:` para evitar colisao com outros addons (Protocolo 5)

**Limite do engine:** `DynamicProperty` aceita ate 32KB por chave. Com `FLARE_CONFIG.maxLanded: 5` e ~150 bytes por entry, o consumo maximo e ~750 bytes - bem dentro do limite.

### 3B. Re-sincronizar script para pack unificado
Apos validar `Super Picareta BP/scripts/main.js`, replicar mudancas no `Mods Pietro e Manoel BP/scripts/main.js` (a logica do FLARE precisa estar identica nos dois packs - **nao manter divergencias**).

### Validacao da Onda 3
- `node --check "Super Picareta/Super Picareta BP/scripts/main.js"` (zero erros de sintaxe)
- Aplicar skill `varredura-bugs` no script, focando na Etapa 8 (uso correto de DynamicProperty)
- Teste in-game:
  1. Atirar sinalizador em local visivel
  2. Executar `/reload`
  3. Aguardar tempo total de duracao (60s em terra, 30s em agua)
  4. Confirmar que `light_block` foi removido apos expirar (mesmo apos reload)
- `auditar_paridade.mjs` continua 0 bloqueios

---

## Onda 4 - Ajustes Comportamentais (resolve B5+B6+B7)

**Objetivo:** tuning de jogabilidade sem mudancas estruturais.

### 4A. Pistola Sinalizadora - reduzir quique (B5)
Editar `Super Picareta BP/scripts/main.js`, objeto `FLARE_CONFIG.bounce` (linhas 452-454) **E** `Mods Pietro e Manoel BP/scripts/main.js` (linhas 431-433, valores identicos). Os dois precisam ficar em paralelo - divergir entre packs cria comportamento diferente conforme qual pack o usuario ativa.

Substituicao no objeto `bounce.default`:
```diff
- maxBounces: 2,
- default: { velocityLoss: 0.3, minVertical: 0.1, maxVertical: -0.1 },
+ maxBounces: 1,
+ default: { velocityLoss: 0.2, minVertical: 0.05, maxVertical: -0.05 },
```

**Rationale dos 4 parametros** (validado contra `calculateBouncedVelocity` em `main.js:610-619`):
- `maxBounces: 2 -> 1` - apenas 1 ricochete antes de pousar definitivamente.
- `velocityLoss: 0.3 -> 0.2` - **atencao ao nome enganoso**: este valor e o **multiplicador de retencao**, nao de perda. O codigo faz `vx = hitVector.x * loss`, ou seja `0.3` significa "retem 30%". Baixar para `0.2` = retem 20% = bounce mais discreto. (A versao anterior deste plano dizia `0.55`, o que **aumentaria** a energia do quique - era erro semantico.)
- `minVertical: 0.1 -> 0.05` - piso de "bounce minimo para cima" cai pela metade. Em superficies horizontais o flare quica menos energeticamente. Nao zerar para nao perder o "tiquinho de quique" que da personalidade ao efeito.
- `maxVertical: -0.1 -> -0.05` - simetrico ao anterior, para colisoes em "face Down" (raro, ex: bater num teto). Mantem coerencia.

### 4B. Rifle Sniper - feedback de zoom (B6)
Editar `Pistola Laser BP/scripts/main.js` (funcao `ativarZoom`, linhas 57-67):
- Substituir `catch (e) {}` por `catch (e) { jogador.sendMessage("§cZoom indisponivel - habilite Beta APIs no mundo"); }`
- Avaliar adicionar valor intermediario configuravel: `fovZoom: 25` (zoom 3.2x ao inves de 5.3x), reduzindo o efeito de pan rapido pela metade
- Re-sincronizar com pack unificado

### 4C. Rifle Sniper - documentar limitacao de pan (B7)
Adicionar nota em `CLAUDE.md` (secao "Verificacao") informando que a sensibilidade do mouse no Bedrock **nao escala automaticamente com FOV**. Pan rapido em FOV < 20 e limitacao da plataforma - nao tem fix por addon. Para diminuir o efeito, aumentar `fovZoom` para 25-30.

### Validacao da Onda 4
- Skill `varredura-bugs` em cada `main.js` modificado
- `auditar_paridade.mjs` continua 0 bloqueios
- Roteiro de teste in-game:
  1. Disparar sinalizador no chao -> confirmar **maximo 1 quique**
  2. Recarregar mundo com sinalizador ativo -> confirmar **luz removida** ao expirar
  3. Mirar com sniper sem Beta APIs habilitada -> confirmar **mensagem de erro** na tela
  4. Equipar armadura de Slime ativando **somente o pack unificado** -> confirmar **modelo verde** aparece no corpo
  5. Craftar pistola laser no pack unificado -> confirmar **icone**, **modelo** e **disparo** funcionam
  6. Lancar pocao de Cactus Zumbi no pack unificado -> confirmar **entidade spawna**

---

## Validacao final (gate de release)

Antes de declarar o projeto "estavel", todas as verificacoes abaixo devem passar:

```
# 1. Paridade total
node .claude/skills/integridade-projeto/auditar_paridade.mjs
# Esperado: TOTAL DE BLOQUEIOS: 0

# 2. Sintaxe dos scripts
node --check "Super Picareta/Super Picareta BP/scripts/main.js"
node --check "Pistola Laser/Pistola Laser BP/scripts/main.js"
node --check "Cactus Zumbi/Cactus Zumbi BP/scripts/main.js"
node --check "Armadura de Slime/Armadura de Slime BP/scripts/main.js"
node --check "Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js"
```

Skills a aplicar mentalmente em cada addon (5 modulares + 1 unificado):
- `revisar-mod` - checklist de 13 itens
- `varredura-bugs` - 12 etapas
- `integridade-projeto` - 5 protocolos completos

## Riscos e mitigacao

| Risco | Mitigacao |
|-------|-----------|
| Onda 1 introduz divergencia (mesmo arquivo em modular + unificado com conteudo diferente) | Regra rigida: sempre copiar do modular para o unificado, nunca editar so um lado |
| Onda 3 quebra retrocompatibilidade com luzes ja colocadas em mundos antigos | Funcao de migracao no `worldLoad`: se DynamicProperty vazio mas existem light_blocks com tag conhecida no spawn, aceitar perda de tracking (one-time leak) |
| Onda 4 perde valores de tuning anteriores | Documentar valores antigos em comentario inline antes de substituir |
| Pack unificado fica desincronizado dos modulares apos novas features | Adicionar `auditar_paridade.mjs` ao fluxo das skills `/criar-mob` e `/comportamento-mob` (rodar antes de marcar tarefa como concluida) |
| Usuario ativa simultaneamente pack unificado + modulares | Documentar em `CLAUDE.md` que apenas um dos dois deve estar ativo no mesmo mundo - evita double-subscribe de eventos e duplicacao de light_blocks |

## Ordem de commits sugerida

0. `chore: adiciona corrigir-bugs.js para fixes mecanizaveis` (Onda 0 - cria o script)
1. `fix: aplica corrigir-bugs.js (Slime parity + empty.json + render rifle + bounce)` (Onda 0 - executa)
2. `fix(unificado): sincroniza paridade Pistola Laser` (Onda 1B)
3. `fix(unificado): sincroniza paridade Cactus Zumbi` (Onda 1C)
4. `fix(unificado): corrige demais render_controllers e referencias quebradas` (Onda 2 - resto)
5. `refactor(super-picareta): persiste landedFlares via DynamicProperty` (Onda 3A)
6. `chore(unificado): re-sincroniza script do FLARE` (Onda 3B)
7. `fix(pistola-laser): feedback de zoom quando API falha` (Onda 4B)
8. `docs: documenta limitacao de pan/FOV no Bedrock` (Onda 4C)

Nota: Onda 1A e Onda 4A foram absorvidas pela Onda 0 (commit 1). Se preferir NAO usar a Onda 0 (rota manual), substituir commits 0 e 1 pelos antigos `fix(unificado): sincroniza paridade Armadura de Slime` e `tune(super-picareta): reduz quique do sinalizador`.

Apos cada commit, rodar `auditar_paridade.mjs` para garantir paridade preservada.

---

## Apendice A - Automacao com `corrigir-bugs.js`

Plano detalhado: ver `vou-criar-um-script-snug-leaf.md` na raiz do projeto.

Este script automatiza os 4 fixes mecanizaveis identificados (escopo da Onda 0). **NAO substitui** as ondas 1B/1C/2A-resto/2B/3/4B/4C, que exigem decisao manual ou refatoracao arquitetural.

### Quando usar
- Ao iniciar a execucao do plano (substitui passos manuais da Onda 0)
- Apos retomar trabalho de uma sessao anterior (script e idempotente)
- Como gate de pre-release (`--dry-run` confirma que nenhum fix mecanizavel regrediu)

### Fixes cobertos pelo script

| Fix | Onda equivalente | Arquivos tocados |
|-----|------------------|------------------|
| 1 - Slime parity | 1A completa | 6 arquivos (4 attachables + 2 PNGs de modelo) |
| 2 - empty.json | 2C primeiro bullet | 2 arquivos (`empty.json` em 2 BPs) |
| 3 - Render rifle | 2A primeiro bullet | 1 arquivo (`rifle_sniper.json` attachable) |
| 4 - Bounce tuning | 4A completa | 2 arquivos (`Super Picareta` + `Mods Pietro e Manoel` main.js) |

### Flags
- `--dry-run` - reporta sem escrever
- `--no-backup` - desativa criacao de `.bak`
- `--apenas <fixN>` - roda so um fix (ex: `--apenas fix3`)
- `--pular <fixN>` - pula um fix
- `--strict` - para no primeiro erro (padrao: continua)
- `--no-validate` - pula a validacao final automatica

### Pre-condicoes
- Node.js >= 18
- Executar a partir da raiz do projeto
- Working tree limpo (para facilitar revisao do diff)

### Padrao de execucao recomendado
```
# 1. Preview do que sera feito
node corrigir-bugs.js --dry-run

# 2. Aplicar de fato
node corrigir-bugs.js

# 3. Confirmar que paridade da Slime sumiu do relatorio
node .claude/skills/integridade-projeto/auditar_paridade.mjs
# Esperado: TOTAL DE BLOQUEIOS: 69 (de 75)
```

### Limites explicitos do script
- Nao toca em qualquer arquivo da Pistola Laser ou Cactus Zumbi (escopo de merge manual nas Ondas 1B/1C)
- Nao mexe em `landedFlares` / `DynamicProperty` (refatoracao arquitetural da Onda 3)
- Nao altera `Pistola Laser BP/scripts/main.js` para feedback de zoom (Onda 4B exige decisao sobre `fovZoom` intermediario)
- Nao edita `CLAUDE.md` (Onda 4C - documentacao manual)
