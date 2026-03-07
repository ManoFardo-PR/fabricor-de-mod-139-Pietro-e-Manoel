---
name: revisar-mod
description: Revisa e valida a integridade de um addon Minecraft Bedrock. Verifica se todos os arquivos necessarios existem, JSONs sao validos, referencias cruzadas entre BP e RP estao corretas, e identifica problemas. Use quando quiser verificar se o mod esta completo e correto.
context: fork
agent: Explore
argument-hint: "[nome-do-addon]"
---

# Revisar Mod - Validacao de Addon Minecraft Bedrock

Revise o addon especificado em $ARGUMENTS seguindo esta checklist completa.

## Checklist de Validacao

### 1. Manifests
- [ ] BP/manifest.json existe e tem format_version: 2
- [ ] RP/manifest.json existe e tem format_version: 2
- [ ] UUIDs sao unicos (nao repetidos entre BP e RP)
- [ ] BP tem dependency apontando para UUID do header do RP
- [ ] min_engine_version e compativel (1.21.0+)
- [ ] Se usa scripts: modulo "script" com entry "scripts/main.js"
- [ ] Se usa scripts: dependency para "@minecraft/server"

### 2. Itens (BP)
Para cada arquivo em `items/*.item.json`:
- [ ] format_version e "1.21.10"
- [ ] identifier usa namespace correto
- [ ] minecraft:icon referencia textura que existe em item_texture.json do RP
- [ ] minecraft:display_name.value tem chave de traducao correspondente nos .lang

### 3. Entidades (BP)
Para cada arquivo em `entities/*.entity.json`:
- [ ] format_version e "1.16.0"
- [ ] identifier usa namespace correto
- [ ] runtime_identifier e uma entidade vanilla valida
- [ ] Componentes obrigatorios presentes: collision_box, physics
- [ ] Se tem ataque: inclui behavior para target e attack

### 4. Entidades (RP)
Para cada entidade no BP, verificar correspondente em `RP/entity/`:
- [ ] identifier coincide com o do BP
- [ ] textura referenciada existe em textures/entity/
- [ ] geometria referenciada existe em models/entity/
- [ ] render_controller referenciado existe
- [ ] animacoes referenciadas existem (se houver)

### 5. Modelos (RP)
Para cada arquivo em `models/entity/*.geo.json`:
- [ ] format_version valido ("1.12.0" ou "1.16.0")
- [ ] identifier de geometria corresponde ao referenciado na client_entity

### 6. Texturas
- [ ] Todas as texturas referenciadas por entidades existem como .png
- [ ] item_texture.json mapeia todos os icones de itens
- [ ] terrain_texture.json mapeia todas as texturas de blocos (se houver blocos)
- [ ] Texturas de itens existem em textures/items/

### 7. Traducoes
- [ ] texts/pt_BR.lang existe com traducoes para todos os itens e entidades
- [ ] texts/en_US.lang existe com traducoes para todos os itens e entidades
- [ ] Formato correto: `item.[namespace]:[nome].name=Nome Legivel`
- [ ] Formato correto: `entity.[namespace]:[nome].name=Nome Legivel`

### 8. Receitas (BP)
Para cada arquivo em `recipes/*.recipe.json`:
- [ ] format_version valido
- [ ] identifier do resultado corresponde a um item existente
- [ ] Ingredientes sao itens vanilla validos ou itens do addon

### 9. Scripts (BP)
Se existir `scripts/main.js`:
- [ ] Imports validos de @minecraft/server
- [ ] Nao ha erros de sintaxe JavaScript
- [ ] Identificadores de entidades/itens correspondem aos definidos nos JSONs
- [ ] Event subscriptions usam eventos validos da API

### 10. Animacoes e Render Controllers (RP)
- [ ] Cada animacao referenciada existe
- [ ] Cada render controller referenciado existe
- [ ] Nomes correspondem (controller.render.[nome])

## Output
Gerar um relatorio com:
1. **OK**: itens que passaram na validacao
2. **AVISO**: problemas nao-criticos (ex: falta traducao)
3. **ERRO**: problemas criticos (ex: arquivo faltando, referencia quebrada)
4. **Sugestoes**: melhorias recomendadas
