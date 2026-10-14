# Integracao de Mods no Pack Unificado

Guia executavel para integrar um mod modular validado in-game no pack `Mods Pietro e Manoel`.

Este documento e o complemento detalhado da skill `.claude/skills/integridade-projeto/SKILL.md`.
A skill define os 5 protocolos tecnicos; este arquivo define o passo-a-passo operacional.

---

## 0. Quando aplicar este guia

### Trigger obrigatorio
O fluxo so inicia quando o usuario solicita explicitamente a integracao.
Frases que disparam o guia:
- "integre o mod X no unificado"
- "sincronize o Pistola Laser para o Mods Pietro e Manoel"
- "replique [arquivo/feature] no pack unificado"
- "rode os 4 protocolos de integridade para o mod X"

### Pre-requisito intransponivel
- Mod modular **validado in-game** com ATIVACAO ISOLADA (sem o unificado ativo no mundo de teste)
- Usuario confirmou que esta funcionando sem bugs

### Fora do escopo deste guia
- Criacao do mod modular (usar skills `criar-mob`, `planejar-entidade`, etc.)
- Testes in-game (responsabilidade manual do usuario)
- Instalacao do pack no Minecraft (usar `instalar.bat`)
- Distribuicao/empacotamento `.mcaddon`

---

## 1. Visao geral do fluxo

```
[Mod modular validado in-game]
            v
[Passo 0: Diagnostico inicial]  -- auditar_paridade.mjs
            v
[Passo 1: Inventario de mudancas]
            v
[Passo 2: Paridade de arquivos (Protocolo 1)]
            v
[Passo 3: Mesclagem de metadados (Protocolo 2)]
            v
[Passo 4: Sincronizacao de scripts (Protocolo 3)]
            v
[Passo 5: Validacao final (Protocolo 4)]
            v
[Unificado em estado consistente, 0 bloqueios]
```

Cada passo tem entrada/saida claras e ponto de validacao proprio.

---

## 2. Fase 1 - Desenvolvimento Isolado (resumo)

Antes de chegar neste guia, o mod modular ja deve estar pronto e estruturado.

### Estrutura de pastas obrigatoria
```
<Nome do Mod>/
  <Nome do Mod> BP/
    manifest.json
    pack_icon.png
    items/*.item.json
    entities/*.entity.json      (se tiver entidades)
    recipes/*.recipe.json       (se tiver receitas)
    loot_tables/*.json          (se aplicavel)
    scripts/main.js             (se tiver logica)
  <Nome do Mod> RP/
    manifest.json
    pack_icon.png
    attachables/*.json          (para items wearable/segurados)
    entity/*.entity.json
    models/entity/*.geo.json
    render_controllers/*.json
    animations/*.animation.json
    textures/items/*.png
    textures/entity/*.png
    textures/item_texture.json
    textures/terrain_texture.json (se tiver blocos)
    texts/pt_BR.lang
    texts/en_US.lang
```

### Convencoes obrigatorias
- **Namespace**: snake_case unico (ex: `pistola_laser`, `cactus_zumbi`)
- **UUIDs**: gerar 4 novos (BP header, BP module, RP header, RP module) - nunca reutilizar
- **Identifiers**: `namespace:nome_em_snake_case`
- **Dependency BP->RP**: o `dependencies` do BP aponta para o UUID do header do RP

### Skills a usar na fase 1
- `planejar-entidade` -> antes de criar mob/entidade
- `criar-mob` -> cria entidade completa
- `comportamento-mob` -> adiciona AI/comportamento
- `revisar-mod` -> checklist de 13 itens antes de testar
- `varredura-bugs` -> antes de declarar pronto

---

## 3. Fase 2 - Validacao In-Game (resumo)

Responsabilidade do usuario, mas o Agent deve lembrar:

### Checklist minimo de teste
- [ ] Pack modular ativado no mundo
- [ ] Pack unificado **DESATIVADO** no mesmo mundo
- [ ] Beta APIs ativadas
- [ ] Items aparecem no inventario criativo (`/give @s namespace:item`)
- [ ] Receitas funcionam (testar craft)
- [ ] Entidades spawnam (`/summon namespace:entidade`)
- [ ] Logica de script roda (testar acao principal)
- [ ] Sem erros no Content Log do Minecraft

### Aviso critico
Ativar pack unificado **junto** com o modular causa **double-subscribe** de eventos.
Sintomas: dano dobrado, particulas duplicadas, mensagens repetidas, `light_block` em dobro.
Regra do `CLAUDE.md`: nunca os dois ao mesmo tempo.

So apos o usuario confirmar "esta funcionando", prosseguir para a Fase 3.

---

## 4. Fase 3 - Integracao (passo a passo detalhado)

### 4.1 Passo 0 - Diagnostico inicial

Antes de mover qualquer arquivo, conhecer o estado atual.

**Comando:**
```bash
node .claude/skills/integridade-projeto/auditar_paridade.mjs
```

**Output esperado:**
```
=========== TOTAL DE BLOQUEIOS: 0 ===========
```

**Se aparecerem bloqueios pre-existentes:**
- Listar para o usuario
- Perguntar: corrigir agora ou prosseguir mesmo com drift conhecido?
- NUNCA mascarar bloqueios pre-existentes com a integracao nova

---

### 4.2 Passo 1 - Inventario de mudancas

Listar tudo que o mod modular tem que precisa ir para o unificado.

**Template de inventario (preencher para cada mod):**

| Categoria | Arquivos no modular | Ja existe no unificado? | Acao |
|-----------|--------------------|------------------------|------|
| BP/items | `X.item.json` | nao | copiar |
| BP/entities | `X.entity.json` | nao | copiar |
| BP/recipes | `X.recipe.json` | nao | copiar |
| BP/loot_tables | `X.json` | nao | copiar |
| RP/attachables | `X.json` | nao | copiar |
| RP/entity | `X.entity.json` | nao | copiar |
| RP/models/entity | `X.geo.json` | nao | copiar |
| RP/render_controllers | `X.json` | nao | copiar |
| RP/animations | `X.animation.json` | nao | copiar |
| RP/textures/items | `X.png` | nao | copiar |
| RP/textures/entity | `X.png` | nao | copiar |
| Metadata: item_texture.json | N chaves novas | parcial | mesclar |
| Metadata: terrain_texture.json | N chaves novas | parcial | mesclar |
| Metadata: pt_BR.lang | N linhas novas | parcial | append |
| Metadata: en_US.lang | N linhas novas | parcial | append |
| Script: main.js | bloco com N globals | nao | namespacing + insert |

Mostrar a tabela preenchida para o usuario **antes** de copiar nada.

---

### 4.3 Passo 2 - Paridade de arquivos (Protocolo 1)

**Regra:** copia byte-a-byte. Sem reformatar JSON, sem reordenar chaves.
Isso garante que o hash MD5 do arquivo no unificado seja identico ao do modular.

**Mapeamento de pastas:**

| Origem (modular) | Destino (unificado) |
|------------------|---------------------|
| `<Mod> BP/items/` | `Mods Pietro e Manoel BP/items/` |
| `<Mod> BP/entities/` | `Mods Pietro e Manoel BP/entities/` |
| `<Mod> BP/recipes/` | `Mods Pietro e Manoel BP/recipes/` |
| `<Mod> BP/loot_tables/` | `Mods Pietro e Manoel BP/loot_tables/` |
| `<Mod> RP/attachables/` | `Mods Pietro e Manoel RP/attachables/` |
| `<Mod> RP/entity/` | `Mods Pietro e Manoel RP/entity/` |
| `<Mod> RP/models/entity/` | `Mods Pietro e Manoel RP/models/entity/` |
| `<Mod> RP/render_controllers/` | `Mods Pietro e Manoel RP/render_controllers/` |
| `<Mod> RP/animations/` | `Mods Pietro e Manoel RP/animations/` |
| `<Mod> RP/textures/items/` | `Mods Pietro e Manoel RP/textures/items/` |
| `<Mod> RP/textures/entity/` | `Mods Pietro e Manoel RP/textures/entity/` |
| `<Mod> RP/textures/blocks/` | `Mods Pietro e Manoel RP/textures/blocks/` |
| `<Mod> RP/textures/models/armor/` | `Mods Pietro e Manoel RP/textures/models/armor/` |

**Validacao por arquivo copiado:** hash MD5 antes/depois deve ser identico.

---

### 4.4 Passo 3 - Mesclagem de metadados (Protocolo 2)

#### 4.4.1 item_texture.json

**Estrutura:**
```json
{
  "resource_pack_name": "vanilla",
  "texture_name": "atlas.items",
  "texture_data": {
    "chave_curta_1": { "textures": "textures/items/x" },
    "chave_curta_2": { "textures": "textures/items/y" }
  }
}
```

**Regra de merge:**
1. Ler `texture_data` do modular
2. Ler `texture_data` do unificado
3. Para cada chave do modular:
   - Se NAO existe no unificado -> adicionar
   - Se existe e valor identico -> nao fazer nada
   - Se existe com valor diferente -> **PARAR e perguntar ao usuario**
4. Salvar JSON preservando indentacao (2 espacos)

**Nunca substituir o `texture_data` inteiro pelo do modular** - apaga chaves dos outros mods.

#### 4.4.2 terrain_texture.json
Mesma logica do `item_texture.json`. Aplica-se se o mod tiver blocos.

#### 4.4.3 pt_BR.lang e en_US.lang

**Estrutura:**
```
## Comentario opcional
item.namespace:item.name=Nome em PT
entity.namespace:entidade.name=Nome em PT
```

**Regra de merge:**
1. Ler chaves existentes do unificado (linhas com `=`, ignorar `#` e vazias)
2. Para cada linha do modular:
   - Se chave NAO existe -> append no final, agrupado por mod
   - Se existe e valor identico -> nao fazer
   - Se existe com valor diferente -> **PARAR e perguntar**
3. Manter comentarios `#` originais; adicionar `## ==== Nome do Mod ====` antes do bloco novo

Append (nao reordenar), para minimizar diff em revisao.

---


### 4.5 Passo 4 - Sincronizacao de scripts (Protocolo 3)

#### Tabela de prefixos ativos

| Mod | Prefixo de namespace |
|-----|----------------------|
| Super Picareta (base) | sem prefixo (variaveis genericas ainda permitidas) |
| Pistola Laser | `LASER_` (ex: `LASER_CONFIG`, `laserJogadorAvisadoZoom`) |
| Cactus Zumbi | `CACTUS_` (ex: `CACTUS_CONFIG`, `cactusProcessedPocoes`) |
| Flare/Sinalizador | `FLARE_` (ex: `FLARE_CONFIG`) |
| Laser de Choque | `CHOQUE_` (ex: `CHOQUE_CONFIG`, `choqueDispositivos`) |
| Multiplicador | `MULTI_` (sugerido se for adicionado) |
| Armadura de Slime | `SLIME_ARMOR_` (sugerido se for adicionado) |

#### Processo de namespacing

1. **Identificar globals do modular:**
   - `const X = ...` no topo do arquivo
   - `let X = ...` no topo
   - `new Map()`, `new Set()` em escopo de arquivo
   - Functions em escopo de arquivo
   - DynamicProperty keys (ja devem usar `namespace:` por convencao)

2. **Aplicar prefixo:**
   - Find/replace em **todas** as ocorrencias dentro do bloco do mod
   - Funcoes utilitarias triviais podem ficar sem prefixo se nao colidirem (avaliar caso a caso)
   - Constantes (`CONFIG`) **sempre** prefixar - sao quase certo de colidir

3. **Inserir no `main.js` unificado:**
   - Posicao: apos a secao do mod anterior, na mesma ordem do arquivo
   - Header obrigatorio: `// ==== NOME DO MOD ====`
   - Subheaders: `// ---- Configuracao ----`, `// ---- Eventos ----`, `// ---- Funcoes auxiliares ----`

4. **Validar sintaxe:**
   ```bash
   node --check "Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js"
   ```
   Saida vazia = OK. Erro = corrigir antes de prosseguir.

#### Casos delicados (pontos de parada)

- **Funcoes utilitarias compartilhadas**: se o modular tem `function distancia(a, b)` e o unificado ja tem identica, NAO duplicar - usar a existente. Se tem nomes iguais mas comportamento diferente, prefixar a do modular.
- **Event listeners no mesmo evento**: dois mods podem registrar `world.afterEvents.entityHitEntity.subscribe(...)` independentemente. Manter dois subscribes separados (nao unificar) - cada um filtra o que e seu.
- **DynamicProperty colisao**: ja prevenido por usar `namespace:chave`. Conferir que o modular respeita isso.
- **system.runInterval com mesmo intervalo**: NAO unificar - cada interval tem seu proprio escopo de variaveis. Performance e desprezivel.

---

### 4.6 Passo 5 - Validacao final (Protocolo 4)

**Comandos obrigatorios em ordem:**

1. **Sintaxe do script:**
   ```bash
   node --check "Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js"
   ```
   Esperado: saida vazia.

2. **Paridade de arquivos:**
   ```bash
   node .claude/skills/integridade-projeto/auditar_paridade.mjs
   ```
   Esperado:
   ```
   =========== TOTAL DE BLOQUEIOS: 0 ===========
   ```

3. **JSONs validos** (todos modificados):
   ```bash
   node -e "JSON.parse(require('fs').readFileSync('Mods Pietro e Manoel/Mods Pietro e Manoel RP/textures/item_texture.json', 'utf8'))"
   ```
   (repetir para cada JSON tocado)

**Se algum dos 3 falhar, corrigir antes de declarar a integracao concluida.**

---


## 5. Casos especiais

### 5.1 Mod novo (nunca existiu)

Fluxo completo desde o inicio:
1. Reservar namespace na tabela do Protocolo 5 da skill
2. Gerar UUIDs novos para BP+RP (header + module) usando `crypto.randomUUID()`
3. Criar pasta modular completa
4. Desenvolver e validar in-game
5. Solicitar integracao -> seguir secao 4 deste guia
6. Atualizar `instalar.bat` da raiz para incluir o modular novo (opcional)

### 5.2 Adicao de feature em mod existente

Fluxo enxuto, so processar o que mudou:
1. Pular Passo 0 se o estado-base ja for conhecido (rodar auditoria mesmo assim por seguranca)
2. Inventario lista APENAS arquivos novos ou modificados (usar `git diff` ou comparar hashes)
3. Pular pastas inteiras nao afetadas
4. Cuidado especial: se um arquivo ja paritario foi MODIFICADO no modular, atualizar a copia no unificado E avisar o usuario do drift

### 5.3 Refatoracao/bugfix em mod existente

- **Mudanca interna ao script** (logica, sem novos identifiers/assets): re-integrar so o bloco do `main.js`
- **Mudanca em valor de componente** (ex: damage de 5 para 7 em `items/X.item.json`): copiar arquivo modificado por cima do unificado
- **Sem novos arquivos**: pular Passos 1 e 2 do fluxo
- **Sempre**: rodar Passo 5 (validacao) ao final

### 5.4 Remocao de feature

Destrutivo. Exige confirmacao explicita.
1. Listar arquivos a remover do modular E do unificado
2. Listar chaves de metadata a remover (`item_texture.json`, `.lang`)
3. Listar blocos de script a remover do `main.js` unificado
4. Avisar: mundos que ja usaram o item terao "missing texture" ou item desaparecido
5. So executar apos "ok" explicito
6. Rodar Passo 5

### 5.5 Renomeacao de identifier

Mais destrutivo ainda - mundos existentes perdem todas as instancias do item/entidade antigo.
1. Recomendar manter o identifier antigo + adicionar o novo como alias (se possivel)
2. Se renomear mesmo: avisar usuario que mundos antigos vao quebrar
3. Aplicar mudanca em modular E unificado simultaneamente
4. Atualizar todas as referencias cruzadas (recipes, attachables, .lang, scripts)
5. Rodar Passo 5

---

## 6. Pontos de parada obrigatorios

Em qualquer um destes casos, o Agent **deve parar** e perguntar ao usuario antes de prosseguir:

| Situacao | Por que parar |
|----------|--------------|
| Colisao de chave em `item_texture.json`/`terrain_texture.json` com valor diferente | Apagar dado de outro mod e silencioso e perigoso |
| Colisao de chave em `.lang` com traducao diferente | Idem |
| Identifier ja existe no unificado com componentes diferentes | Provavel bug ou intencao ambigua |
| Prefixo de namespace nao definido para mod novo | Usuario decide o prefixo |
| Hash diferente em arquivo ja paritario (drift bidirecional) | Alguem editou no unificado, decidir qual versao vence |
| Variavel global sem prefixo durante integracao de script | Risco de colisao silenciosa |
| Auditoria pre-existente ja tem bloqueios | Decidir corrigir antes ou aceitar drift |
| Mod modular nao validado in-game | Fase 2 nao cumprida |

---

## 7. Comandos de referencia rapida

```bash
# Diagnostico/validacao de paridade
node .claude/skills/integridade-projeto/auditar_paridade.mjs

# Validacao sintatica do script unificado
node --check "Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js"

# Validacao sintatica de scripts modulares
node --check "Pistola Laser/Pistola Laser BP/scripts/main.js"
node --check "Cactus Zumbi/Cactus Zumbi BP/scripts/main.js"
node --check "Super Picareta/Super Picareta BP/scripts/main.js"

# Fixes mecanizaveis ja conhecidos (idempotente)
node corrigir-bugs.js --dry-run
node corrigir-bugs.js

# Instalar packs no Minecraft (raiz - so 3 packs)
instalar.bat

# Instalar so 1 modular
Super Picareta\instalar.bat
Multiplicador\instalar.bat
```

---

## 8. Checklist final (copiar para commit/PR)

```
INTEGRACAO DO MOD <Nome> NO PACK UNIFICADO

Fase 1 - Desenvolvimento Isolado
[ ] Pasta modular criada/atualizada
[ ] UUIDs unicos no manifest.json
[ ] Namespace registrado na skill integridade-projeto
[ ] Skills aplicaveis executadas (criar-mob, revisar-mod, varredura-bugs)

Fase 2 - Validacao In-Game
[ ] Pack modular ativado isoladamente (sem unificado)
[ ] Beta APIs habilitadas
[ ] Items/entidades funcionam
[ ] Receitas testadas
[ ] Sem erros no Content Log
[ ] Usuario confirmou "esta funcionando"

Fase 3 - Integracao
[ ] Passo 0: Diagnostico inicial executado
[ ] Passo 1: Inventario listado e aprovado
[ ] Passo 2: Arquivos copiados (hash MD5 identico)
[ ] Passo 3.1: item_texture.json mesclado
[ ] Passo 3.2: terrain_texture.json mesclado (se aplicavel)
[ ] Passo 3.3: pt_BR.lang atualizado
[ ] Passo 3.4: en_US.lang atualizado
[ ] Passo 4: Script integrado com namespacing
[ ] Passo 4: node --check passa

Fase 4 - Validacao
[ ] auditar_paridade.mjs retorna 0 BLOQUEIOS
[ ] JSONs modificados parseiam sem erro
[ ] instalar.bat atualizado (se for mod novo distribuivel)
```

---


## 9. Anexos

### A. Mapa de pastas BP e RP (referencia rapida)

```
<Mod> BP/                          <Mods Pietro e Manoel BP>/
  manifest.json (UUID proprio)       manifest.json (UUID proprio)
  pack_icon.png                      pack_icon.png
  items/X.item.json            ===>  items/X.item.json (copia identica)
  entities/X.entity.json       ===>  entities/X.entity.json
  recipes/X.recipe.json        ===>  recipes/X.recipe.json
  loot_tables/X.json           ===>  loot_tables/X.json
  scripts/main.js              ===>  scripts/main.js (concatenado)

<Mod> RP/                          <Mods Pietro e Manoel RP>/
  manifest.json (UUID proprio)       manifest.json (UUID proprio)
  pack_icon.png                      pack_icon.png
  attachables/X.json           ===>  attachables/X.json
  entity/X.entity.json         ===>  entity/X.entity.json
  models/entity/X.geo.json     ===>  models/entity/X.geo.json
  render_controllers/X.json    ===>  render_controllers/X.json
  animations/X.animation.json  ===>  animations/X.animation.json
  textures/items/X.png         ===>  textures/items/X.png
  textures/entity/X.png        ===>  textures/entity/X.png
  textures/item_texture.json   merge> textures/item_texture.json
  textures/terrain_texture.json merge>textures/terrain_texture.json
  texts/pt_BR.lang             merge> texts/pt_BR.lang
  texts/en_US.lang             merge> texts/en_US.lang
```

### B. Namespaces ativos

| Namespace | Pasta | Prefixo no script unificado |
|-----------|-------|---------------------------|
| `escavadora` | Super Picareta | base (sem prefixo geral; `FLARE_` para flare) |
| `slime_armor` | Armadura de Slime | sem prefixo (poucos globals) |
| `pistola_laser` | Pistola Laser | `LASER_` |
| `cactus_zumbi` | Cactus Zumbi | `CACTUS_` |
| `multiplicador` | Multiplicador x10 | sem prefixo (poucos globals) |
| `flechas_especiais` | Flechas Especiais | (a definir na integracao) |
| `laser_choque` | Laser de Choque | `CHOQUE_` |

### C. UUIDs ja usados (NAO reutilizar)

Listados em cada `manifest.json`. Para listar todos de uma vez:

```bash
node -e "const fs=require('fs');for(const p of ['Super Picareta','Armadura de Slime','Pistola Laser','Cactus Zumbi','Multiplicador','Mods Pietro e Manoel']){for(const sufixo of ['BP','RP']){const m=JSON.parse(fs.readFileSync(p+'/'+p+' '+sufixo+'/manifest.json','utf8'));console.log(p+' '+sufixo+':',m.header.uuid,'(header)',m.modules[0].uuid,'(module)')}}"
```

### D. Estrutura esperada do `main.js` unificado

```javascript
// ==== Imports ====
import { world, system } from "@minecraft/server";

// ==== Constantes globais compartilhadas ====
// (se houver)

// ==== SUPER PICARETA ====
// ---- Configuracao ----
const SUPER_PICARETA_CONFIG = { /* ... */ };
// ---- Eventos ----
world.afterEvents.playerBreakBlock.subscribe(/* ... */);
// ---- Funcoes auxiliares ----

// ==== FLARE (Sinalizador) ====
const FLARE_CONFIG = { /* ... */ };
// (logica do flare com DynamicProperty)

// ==== ARMADURA DE SLIME ====
// ...

// ==== PISTOLA LASER ====
const LASER_CONFIG = { /* ... */ };
const laserJogadorAvisadoZoom = new Set();
// ...

// ==== CACTUS ZUMBI ====
const CACTUS_CONFIG = { /* ... */ };
// ...

// ==== MULTIPLICADOR ====
// ...
```

---

## Referencias

- Skill principal: `.claude/skills/integridade-projeto/SKILL.md`
- Script de validacao: `.claude/skills/integridade-projeto/auditar_paridade.mjs`
- Script de fixes conhecidos: `corrigir-bugs.js`
- Regras gerais do projeto: `CLAUDE.md`
