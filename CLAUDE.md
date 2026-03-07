# Fabricor de Mod 139 - Pietro e Manoel

## Sobre o Projeto
Colecao de addons para **Minecraft Bedrock Edition** (min_engine_version 1.21.0).
Cada addon e composto por um **Behavior Pack (BP)** e um **Resource Pack (RP)**.
Scripts usam a API `@minecraft/server` v1.12.0 em JavaScript.

## Estrutura de Pastas (padrao por addon)
```
NomeDoAddon/
  NomeDoAddon BP/
    manifest.json          # format_version: 2, modulo "script", entry: scripts/main.js
    scripts/main.js        # logica principal (import @minecraft/server)
    items/*.item.json      # itens customizados (format_version "1.21.10")
    entities/*.entity.json # entidades server-side (format_version "1.16.0")
    recipes/*.recipe.json  # receitas de crafting
    pack_icon.png
  NomeDoAddon RP/
    manifest.json          # modulo "resources"
    entity/*.entity.json   # client_entity (render, textura, modelo, animacoes)
    models/entity/*.geo.json       # geometria Blockbench
    animations/*.animation.json    # animacoes
    render_controllers/*.render_controllers.json
    attachables/*.json             # para itens segurados/vestidos
    textures/entity/*.png          # texturas de entidades
    textures/items/*.png           # texturas de itens
    textures/blocks/*.png          # texturas de blocos
    textures/item_texture.json     # mapeamento textura->icone de item
    textures/terrain_texture.json  # mapeamento textura->bloco
    texts/pt_BR.lang               # traducoes pt-BR
    texts/en_US.lang               # traducoes en-US
    pack_icon.png
```

## Convencoes de Nomenclatura
- Namespaces existentes: `escavadora:`, `slime_armor:`, `multiplicador:`
- Para novos addons: usar namespace em snake_case (ex: `meu_addon:nome_item`)
- Arquivos JSON: `nome_item.tipo.json` (ex: `capacete_slime.item.json`)
- Identificadores: `namespace:nome_em_snake_case`
- Traduzir nomes para portugues brasileiro (pt_BR.lang)

## Padroes de Codigo (scripts/main.js)
- Importar de `@minecraft/server`: `world`, `system`, `EquipmentSlot`, etc.
- Usar `system.runInterval()` para loops (especificar intervalo em ticks)
- Usar `world.afterEvents.*` para eventos (entityHitEntity, playerLeave, etc.)
- Manter estado por jogador usando `Map()` com `player.id` como chave
- Limpar estado em `playerLeave`
- Usar try/catch ao redor de operacoes de entidade/jogador
- Constantes de configuracao no topo do arquivo em objeto `CONFIG`
- Comentarios em portugues com headers de secao `// ====`

## Fluxo de Criacao de Entidade
Para criar uma nova entidade/mob, seguir este fluxo obrigatorio:
```
/planejar-entidade [nome] [descricao] → usuario aprova plano → /criar-mob → /comportamento-mob → /revisar-mod → /varredura-bugs
```
1. **Planejar**: `/planejar-entidade` gera checklist completo de componentes, arquivos e comportamentos
2. **Criar**: `/criar-mob` implementa os arquivos seguindo o plano aprovado
3. **Comportamento**: `/comportamento-mob` adiciona AI e comportamentos customizados
4. **Revisar**: `/revisar-mod` valida integridade do addon
5. **Bugs**: `/varredura-bugs` encontra e corrige problemas

## Padroes de Entidade (BP - server-side)
- `runtime_identifier`: usar entidade vanilla similar (ex: `minecraft:snowball` para projeteis)
- Componentes comuns: `minecraft:collision_box`, `minecraft:projectile`, `minecraft:physics`
- `is_spawnable: false` para entidades que nao devem aparecer no spawn egg
- `is_summonable: true` para entidades invocaveis por script

## Padroes de Entidade (RP - client-side)
- `materials.default`: `"entity_alphatest"` para entidades com transparencia
- Referenciar textura, geometria, render_controller e animacoes
- Usar `scripts.animate` para animacoes automaticas

## Padroes de Item
- `menu_category.category`: "equipment", "items", "construction", etc.
- `menu_category.group`: grupo do creative (ex: `"itemGroup.name.helmet"`)
- Incluir `minecraft:icon` com referencia ao item_texture.json
- `minecraft:display_name.value`: chave de traducao `"item.namespace:nome.name"`
- Para armaduras: `minecraft:wearable`, `minecraft:durability`, `minecraft:enchantable`, `minecraft:repairable`

## Padroes de Receita
- Usar `minecraft:recipe_shaped` para receitas com formato
- Usar `minecraft:recipe_shapeless` para receitas sem formato
- Tags de receita: `["crafting_table"]`

## UUIDs
- Cada pack precisa de UUIDs unicos no manifest.json
- O BP deve ter dependency apontando para o UUID do header do RP correspondente
- Nunca reutilizar UUIDs entre packs

## Instalacao (Windows)
- Copiar BP para `%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\`
- Copiar RP para `%LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs\`
- Pode usar script `instalar.bat` quando disponivel

## Verificacao
- Abrir Minecraft Bedrock > Criar mundo > Ativar packs em "Behavior Packs" e "Resource Packs"
- Verificar que itens aparecem no inventario criativo
- Testar funcionalidades no jogo (efeitos, receitas, entidades)
- Checar Content Log no Minecraft para erros de JSON

## Idioma
- Todo o codigo, comentarios, nomes de variaveis e documentacao devem ser em **portugues brasileiro**
- Excecao: palavras-chave do JavaScript/JSON e identificadores da API Minecraft permanecem em ingles
