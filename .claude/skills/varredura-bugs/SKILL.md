---
name: varredura-bugs
description: Faz uma varredura completa de bugs em addons Minecraft Bedrock. Verifica JSONs invalidos, erros de sintaxe JS, problemas de compatibilidade, componentes deprecados, valores invalidos, e bugs comuns do Bedrock. Use para encontrar e corrigir bugs antes de testar no jogo.
argument-hint: "[nome-do-addon-ou-vazio-para-todos]"
---

# Varredura de Bugs - Minecraft Bedrock Addon

Faca uma varredura completa de bugs no addon especificado em `$ARGUMENTS`.
Se nenhum addon for especificado, varra todos os addons no projeto.

## Etapa 1: Identificar Addons
- Liste todas as pastas de addon (que contenham subpastas BP e RP)
- Se `$ARGUMENTS` especificar um addon, foque apenas nele

## Etapa 2: Validacao de JSON
Para CADA arquivo .json encontrado no addon:
- Tente parsear o JSON e reporte erros de sintaxe (virgulas extras, aspas faltando, etc.)
- Verifique se format_version e uma string valida
- Verifique encoding (deve ser UTF-8)
- Reporte a linha exata do erro quando possivel

## Etapa 3: Bugs Comuns de Manifest
- UUIDs duplicados entre BP e RP
- UUIDs com formato invalido (deve ser UUID v4)
- Versao do pack inconsistente entre BP e RP
- Dependency do BP nao aponta para o UUID correto do RP
- min_engine_version ausente ou menor que 1.21.0
- Modulo de script sem dependency para @minecraft/server
- Versao da API @minecraft/server incompativel com min_engine_version

## Etapa 4: Bugs de Itens
Para cada item em `items/*.item.json`:
- format_version deve ser "1.21.10" (versao atual estavel)
- `minecraft:icon` referencia textura que NAO existe em item_texture.json
- `minecraft:display_name.value` sem traducao correspondente no .lang
- Armaduras sem `minecraft:wearable` ou com slot invalido
- `minecraft:durability` com max_durability <= 0
- `minecraft:enchantable` com slot invalido
- `minecraft:max_stack_size` > 64 ou <= 0
- Componentes deprecados usados (verificar lista abaixo)

## Etapa 5: Bugs de Entidades (BP)
Para cada entidade em `entities/*.entity.json`:
- format_version deve ser "1.16.0"
- `runtime_identifier` usando entidade vanilla que nao existe
- `minecraft:collision_box` com width ou height negativo ou zero
- `minecraft:health` com value ou max <= 0
- `minecraft:movement` com value negativo
- `minecraft:attack` com damage negativo
- AI goals com priority duplicada no mesmo nivel (causa comportamento imprevisivel)
- `minecraft:projectile` sem componente `minecraft:on_hit` definido
- `component_groups` referenciados em eventos que nao existem
- Eventos referenciados em componentes que nao existem na secao `events`
- Filtros com `test` invalido (verificar nomes validos)
- `minecraft:loot` apontando para tabela que nao existe
- `is_spawnable: true` mas sem `minecraft:spawn_entity` ou regra de spawn

## Etapa 6: Bugs de Entidades (RP)
Para cada entidade em `entity/*.entity.json` (RP):
- Identificador nao corresponde a nenhuma entidade no BP
- Textura referenciada nao existe como arquivo .png
- Geometria referenciada nao existe em models/entity/
- Render controller referenciado nao existe
- Animacao referenciada nao existe
- Material invalido (deve ser entity, entity_alphatest, entity_emissive, etc.)
- `scripts.animate` referencia animacao nao definida em `animations`
- Escala de renderizacao com valor 0 ou negativo

## Etapa 7: Bugs de Modelos
Para cada modelo em `models/entity/*.geo.json`:
- format_version invalido
- Identifier de geometria nao referenciado por nenhuma entidade RP
- Bones com nomes duplicados
- UV fora dos limites da textura (se texture_width/height definidos)
- Cubes com tamanho zero em alguma dimensao

## Etapa 8: Bugs de Scripts (main.js)
Se existir `scripts/main.js`:
- Verificar sintaxe com `node --check`
- Imports de APIs que nao existem em @minecraft/server
- Uso de `world.beforeEvents` em contexto read-only (nao pode modificar mundo)
- `system.runInterval` sem guardar referencia (memory leak potencial)
- Event subscribers duplicados (mesmo evento assinado multiplas vezes)
- TypeIds de entidades/itens que nao correspondem aos JSONs definidos
- Uso de `player.runCommand()` onde API nativa seria mais adequada
- Divisao por zero potencial
- Acesso a propriedade de entidade que pode ser undefined (entidade morta/removida)
- Falta de try/catch ao redor de operacoes de entidade

## Etapa 9: Bugs de Animacoes e Render Controllers
- Animacoes com timeline vazia
- Render controllers referenciando geometria/textura/material nao definido
- Animacoes com duracao 0
- Transicoes de animation controller referenciando estado inexistente

## Etapa 10: Bugs de Receitas
Para cada receita em `recipes/*.recipe.json`:
- Resultado (output) referencia item que nao existe
- Ingrediente referencia item que nao existe (nem vanilla nem custom)
- Pattern de receita shaped com caractere sem mapeamento no key
- Tags de receita invalidas
- Receitas duplicadas (mesmo resultado com mesmos ingredientes)

## Etapa 11: Bugs de Traducao
- Chaves de traducao no .lang que nao correspondem a nenhum item/entidade
- Itens/entidades sem traducao em algum dos idiomas
- Caracteres especiais nao escapados corretamente
- Linhas mal formatadas (sem = separando chave e valor)

## Componentes Deprecados (Bedrock 1.21+)
Verificar se algum destes componentes deprecados esta em uso:
- `minecraft:entity_spawned` (usar `minecraft:spawn` event)
- Formatos antigos de item components (pre-1.20.80)
- `minecraft:creative_category` (usar `menu_category`)
- Componentes de item com prefixo `minecraft:` em format_version < 1.20.80

## Output - Relatorio de Bugs
Gerar relatorio organizado por severidade:

### CRITICO (impede o addon de funcionar)
- JSONs invalidos
- Manifests com erros
- Arquivos referenciados que nao existem
- Erros de sintaxe JS

### ALTO (causa bugs visiveis no jogo)
- Referencias cruzadas quebradas (BP<->RP)
- Componentes com valores invalidos
- AI goals mal configuradas
- Scripts com erros de runtime provaveis

### MEDIO (pode causar problemas)
- Traducoes faltando
- Componentes deprecados
- Prioridades de AI duplicadas
- Receitas com problemas

### BAIXO (boas praticas)
- Texturas nao referenciadas (arquivos orfaos)
- Scripts sem try/catch
- Geometria nao utilizada

### RESUMO
- Total de bugs por severidade
- Sugestao de correcao para cada bug encontrado
- Lista de arquivos afetados
