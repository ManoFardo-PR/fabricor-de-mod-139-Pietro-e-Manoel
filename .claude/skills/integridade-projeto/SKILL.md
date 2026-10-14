---
name: integridade-projeto
description: Estabelece protocolos rigidos de integridade e sincronizacao BP/RP em projetos Minecraft Bedrock com multiplos addons. Cobre paridade de pacotes unificados, consistencia de identificadores, ciclo de vida de scripts (DynamicProperties vs Map em memoria), validacao de referencias de assets e padronizacao de namespaces. Use ANTES de empacotar, ANTES de declarar um addon "pronto", e SEMPRE que adicionar um asset novo a um pack consolidado.
argument-hint: "[escopo: nome-do-addon | unificado | todos]"
---

# Integridade de Projeto e Sincronizacao BP/RP

Aplique os 5 protocolos abaixo ao escopo definido em `$ARGUMENTS`.
Cada protocolo tem **regras obrigatorias** (violar = bloqueia release) e **regras recomendadas**.

## Fluxo de Trabalho Obrigatorio para Mods

Toda criacao/edicao de mod segue 4 fases em ordem. Cada fase tem gatilho proprio e
nao pode ser pulada sem autorizacao explicita do usuario.

### Fase 1 - Desenvolvimento Isolado
- Trabalhar APENAS na pasta modular do mod (ex: `Pistola Laser/`, `Cactus Zumbi/`)
- Nao tocar em `Mods Pietro e Manoel/` durante essa fase
- Skills aplicaveis: `criar-mob`, `comportamento-mob`, `planejar-entidade`, `revisar-mod`, `varredura-bugs`

### Fase 2 - Validacao In-Game (responsabilidade do usuario)
- Usuario ativa APENAS o pack modular no mundo Minecraft (nunca junto com o unificado)
- Beta APIs habilitadas
- Usuario testa todas as funcionalidades ate confirmar zero bugs
- So apos o "ok" explicito do usuario, passar para Fase 3

### Fase 3 - Integracao no Pack Unificado
- Disparada SOMENTE por solicitacao explicita ("integre X no unificado", "sincronize X")
- Seguir o passo-a-passo detalhado em `INTEGRACAO-UNIFICADO.md` (raiz do projeto)
- Aplicar os 4 protocolos desta skill em ordem (Paridade -> Identificadores -> Scripts -> Validacao)

### Fase 4 - Validacao de Paridade (obrigatoria ao final da Fase 3)
- Executar: `node .claude/skills/integridade-projeto/auditar_paridade.mjs`
- Executar: `node --check "Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js"`
- Resultado esperado: `0 BLOQUEIOS` + sintaxe valida
- Se houver bloqueios novos, corrigir antes de declarar integracao concluida

### Pontos de parada obrigatorios (Agent pergunta antes de prosseguir)
- Colisao de chave em `item_texture.json` / `terrain_texture.json` / `.lang` com valor diferente
- Colisao de identifier no unificado com componentes diferentes
- Prefixo de namespace ambiguo para mod novo
- Hash diferente em arquivo ja paritario (drift bidirecional suspeito)
- Variavel global sem prefixo claro durante integracao de script

## Protocolo 1 - Paridade de Pacotes Unificados

Quando o projeto tem um pack consolidado (ex: `Mods Pietro e Manoel`) que reune addons individuais, o pack unificado e a **uniao exata** de todos os addons modulares.

### Regras obrigatorias
- [ ] Para cada arquivo em `<Addon> BP/items/*.item.json`, existe arquivo identico (mesmo identifier) em `<Unificado> BP/items/`
- [ ] Para cada `<Addon> BP/entities/*.entity.json`, existe correspondente em `<Unificado> BP/entities/`
- [ ] Para cada `<Addon> BP/recipes/*.recipe.json`, existe correspondente em `<Unificado> BP/recipes/`
- [ ] Para cada `<Addon> RP/attachables/*.json`, existe correspondente em `<Unificado> RP/attachables/`
- [ ] Para cada `<Addon> RP/entity/*.entity.json`, existe correspondente em `<Unificado> RP/entity/`
- [ ] Para cada `<Addon> RP/models/entity/*.geo.json`, existe correspondente em `<Unificado> RP/models/entity/`
- [ ] Para cada PNG em `<Addon> RP/textures/items/`, `textures/entity/`, `textures/blocks/`, `textures/models/`, existe correspondente no unificado
- [ ] Toda chave em `<Addon> RP/textures/item_texture.json` esta presente em `<Unificado> RP/textures/item_texture.json`
- [ ] Toda chave em `<Addon> RP/textures/terrain_texture.json` esta presente em `<Unificado> RP/textures/terrain_texture.json`
- [ ] Toda linha de `<Addon> RP/texts/pt_BR.lang` e `en_US.lang` esta presente nos arquivos `.lang` do unificado
- [ ] Logica do script de cada addon esta presente em `<Unificado> BP/scripts/main.js` (concatenado ou modularizado)

### Regras recomendadas
- Documentar no `manifest.json` do unificado que ele substitui os modulares (`metadata.product_type`)
- **Nao permitir** ativacao simultanea de pack unificado + pack modular no mesmo mundo (causa double-subscribe de eventos)

### Comando de validacao automatizado
Executar `node .claude/skills/integridade-projeto/auditar_paridade.mjs` na raiz do projeto.
O script audita os 5 addons modulares contra o pack unificado e gera relatorio detalhado
listando arquivos ausentes, chaves de `item_texture.json` faltando e linhas de `.lang` nao replicadas.
Codigo de saida = numero total de bloqueios encontrados.

Para adicionar novo addon a auditoria, editar o array `ADDONS` no topo do script.

## Protocolo 2 - Consistencia de Identificadores BP <-> RP

Todo `identifier` (`namespace:nome`) que aparece em uma camada **deve** existir identicamente nas camadas conectadas.

### Mapa de correspondencia obrigatorio

| Origem (BP) | Destino (RP) | Chave de ligacao |
|-------------|--------------|------------------|
| `items/*.item.json` -> `description.identifier` | `attachables/*.json` -> `description.identifier` (se for wearable/segurado 3D) | `namespace:nome` identico |
| `items/*.item.json` -> `minecraft:icon.textures.default` (ou string) | `textures/item_texture.json` -> chave em `texture_data` | nome curto identico |
| `entities/*.entity.json` -> `description.identifier` | `entity/*.entity.json` -> `description.identifier` | `namespace:nome` identico |
| `entities/*.entity.json` -> `runtime_identifier` | (vanilla) | deve ser id vanilla valido |
| RP client_entity -> `geometry.default` | `models/entity/*.geo.json` -> `description.identifier` ou key | `geometry.<nome>` identico |
| RP client_entity -> `render_controllers[]` | `render_controllers/*.json` -> chave em `render_controllers` | `controller.render.<nome>` identico |
| RP client_entity -> `textures.default` | arquivo PNG em `textures/entity/` | caminho relativo identico (sem extensao) |
| `recipes/*.recipe.json` -> result.item / ingredient.item | item vanilla ou `items/*.item.json` | `namespace:nome` identico |
| `display_name.value` em qualquer item/entidade | `texts/*.lang` -> chave | `item.namespace:nome.name` / `entity.namespace:nome.name` |

### Regras obrigatorias
- [ ] Zero referencia "fantasma" (apontar para identifier que nao existe)
- [ ] Zero asset orfao (definir identifier que ninguem referencia) - apenas aviso, nao bloqueia
- [ ] `render_controllers` referenciados existem como chave em algum arquivo de render controller (atencao: `controller.render.default` **NAO** existe vanilla - usar `controller.render.item_default` ou criar o seu)
- [ ] Chaves de `item_texture.json` nao colidem entre packs ativos simultaneamente

## Protocolo 3 - Ciclo de Vida de Scripts (DynamicProperties vs Memoria)

Estado em variaveis globais (`Map`, `Set`, `Array`) **morre** quando: o mundo recarrega, `/reload` e executado, ou o servidor reinicia. Toda referencia em memoria a um objeto persistente no mundo (light_block, location, entity_id) que sobrevive a esse evento vira **orfa permanente**.

### Regra obrigatoria - quando usar cada um

| Tipo de estado | Armazenamento correto |
|----------------|----------------------|
| Posicoes de blocos colocados pelo script (light_block, fire, marcadores) | `world.setDynamicProperty("namespace:chave", JSON.stringify(array))` |
| Contadores globais (kills, dropa, estatisticas) | `world.setDynamicProperty` |
| Estado por jogador persistente entre sessoes (xp custom, flags) | `player.setDynamicProperty("namespace:chave", valor)` |
| Estado **efemero** por sessao (jogador mirando, cooldown de 5s, animacao em curso) | `Map` em memoria (sem persistencia necessaria) |
| Lista de entidades vivas (rastreamento de projeteis em voo) | `Map` em memoria + varredura `dimension.getEntities` a cada N ticks para resincronizar |

### Padrao de implementacao - bloco persistente colocado por script

```javascript
// 1. Definir prefixo unico por feature
const PROP_KEY = "escavadora:flare_lights";

// 2. Carregar na inicializacao
function carregarLuzes() {
    const raw = world.getDynamicProperty(PROP_KEY);
    return raw ? JSON.parse(raw) : [];
}

// 3. Salvar a cada mudanca (ou em batch via runInterval)
function salvarLuzes(lista) {
    world.setDynamicProperty(PROP_KEY, JSON.stringify(lista));
}

// 4. Varrer no boot e limpar orfas
world.afterEvents.worldLoad.subscribe(() => {
    const luzes = carregarLuzes();
    for (const luz of luzes) {
        // se passou o tempo, tentar remover (pode falhar se chunk descarregado - reagendar)
        if (system.currentTick - luz.tick > luz.duracao) {
            tentarRemover(luz);
        }
    }
});
```

### Regras obrigatorias
- [ ] Todo bloco script-placed tem entry em `DynamicProperty` ANTES de ser colocado no mundo
- [ ] Toda remocao re-le `DynamicProperty`, atualiza e re-salva (ou usa fila persistida)
- [ ] Listener em `worldLoad` faz reconciliacao do estado (varre e limpa orfaos)
- [ ] Chaves de `DynamicProperty` usam prefixo `namespace:` para evitar colisao entre addons
- [ ] Tamanho de cada `DynamicProperty` < 32KB (limite do engine); particionar se exceder

### Anti-padroes proibidos
- `new Map()` no topo do arquivo para guardar `light_block` positions sem espelhar em DynamicProperty
- `system.runTimeout` como unica garantia de cleanup (timeout perde no `/reload`)
- Confiar em `playerLeave` para limpar estado mundial (jogador pode crashar)

## Protocolo 4 - Validacao de Referencias de Assets

Toda string que aponta para um arquivo (`textures/...`, `geometry....`, `controller.render....`) deve resolver no filesystem **antes** do commit.

### Checklist obrigatorio
- [ ] `materials.default` no client_entity e attachable usa material valido (`entity`, `entity_alphatest`, `entity_emissive`, `entity_alphatest_one_sided`, `armor`, `armor_enchanted`)
- [ ] `textures.default` aponta para PNG existente (sem extensao no JSON)
- [ ] `geometry.default` aponta para `geometry.<nome>` que existe como chave em algum `models/entity/*.geo.json`
- [ ] `render_controllers[]` aponta para controller que existe em `render_controllers/*.json` OU e vanilla (`controller.render.item_default`, `controller.render.armor`)
- [ ] `animations` mapeia nomes locais para `animation.<arquivo>.<nome>` que existe em `animations/*.animation.json`
- [ ] `scripts.animate` so referencia nomes locais definidos em `animations`
- [ ] `minecraft:loot.table` aponta para `loot_tables/...json` que existe no FS (vazio nao basta - precisa do arquivo)
- [ ] PNGs referenciados existem na resolucao esperada (16x16 para itens, 64x64 ou 64x32 para entidades)
- [ ] Som referenciado em `playSound("nome.evento")` existe em `sounds/sound_definitions.json` ou e vanilla

### Comando rapido de auditoria
Para cada `<Addon> RP/`, gerar lista de todos os caminhos referenciados em JSONs e checar `fs.existsSync` em cada um.

## Protocolo 5 - Organizacao de Namespaces e Pastas

Padronizacao que reduz colisoes e facilita pack unificado.

### Regras obrigatorias
- [ ] Cada addon tem **um unico** namespace (snake_case): `escavadora`, `slime_armor`, `pistola_laser`, `cactus_zumbi`, `multiplicador`
- [ ] Namespaces sao **registrados** no topo deste documento e nao podem ser reutilizados por outro addon
- [ ] Estrutura de pastas segue exatamente o template do `CLAUDE.md` (sem variacoes em capitalizacao)
- [ ] Arquivos seguem padrao `<nome_snake_case>.<tipo>.json` (ex: `capacete_slime.item.json`, `sinalizador_projetil.entity.json`)
- [ ] Chaves de traducao usam o namespace: `item.<namespace>:<nome>.name`, nunca `item.<nome>.name`
- [ ] Chaves de `DynamicProperty` usam prefixo `<namespace>:` para evitar colisao
- [ ] Identificadores de geometria usam `geometry.<namespace>.<nome>` (preferencial) ou `geometry.<nome>` se inequivoco

### Registro de namespaces ativos
| Namespace | Addon | Status |
|-----------|-------|--------|
| `escavadora` | Super Picareta | ativo |
| `slime_armor` | Armadura de Slime | ativo |
| `pistola_laser` | Pistola Laser | ativo |
| `cactus_zumbi` | Cactus Zumbi | ativo |
| `multiplicador` | Multiplicador x10 | ativo |
| `flechas_especiais` | Flechas Especiais | ativo |
| `laser_choque` | Laser de Choque | ativo |

Ao criar novo addon, adicionar linha na tabela acima antes de qualquer outro arquivo.

## Fluxo de uso desta skill

1. **Antes de criar addon novo:** reservar namespace na tabela do Protocolo 5
2. **Apos cada feature:** rodar Protocolos 2 e 4 no addon afetado
3. **Antes de copiar para pack unificado:** rodar Protocolo 1 completo
4. **Antes de release:** rodar todos os 5 protocolos com `$ARGUMENTS = todos`
5. **Ao revisar codigo de script novo:** Protocolo 3 obrigatorio

## Output

Gerar relatorio com 5 secoes (uma por protocolo) marcando cada item como:
- `OK` - regra atendida
- `AVISO` - regra recomendada nao atendida
- `BLOQUEIO` - regra obrigatoria violada (impede release)

Para cada `BLOQUEIO`, incluir caminho do arquivo afetado e correcao sugerida.
