---
name: criar-mob
description: Cria um novo mob/entidade customizada para Minecraft Bedrock Edition com todos os arquivos necessarios (BP entity, RP entity, modelo, textura placeholder, animacao, render controller e registro no script). Use quando o usuario pedir para criar um mob, criatura, entidade ou monstro novo.
disable-model-invocation: true
argument-hint: "[nome-do-mob] [descricao-do-comportamento]"
---

# Criar Mob - Minecraft Bedrock Addon

Quando invocado, crie um mob/entidade completo seguindo esta checklist.
O primeiro argumento e o nome do mob, o segundo e a descricao do comportamento desejado.

## Checklist de Arquivos

### 1. Behavior Pack (BP) - Entidade Server-Side
Criar `[AddonName] BP/entities/[nome_mob].entity.json`:

```json
{
    "format_version": "1.16.0",
    "minecraft:entity": {
        "description": {
            "identifier": "[namespace]:[nome_mob]",
            "is_spawnable": true,
            "is_summonable": true,
            "runtime_identifier": "minecraft:[entidade_vanilla_similar]"
        },
        "component_groups": {},
        "components": {
            "minecraft:collision_box": { "width": 0.6, "height": 1.8 },
            "minecraft:health": { "value": 20, "max": 20 },
            "minecraft:physics": {},
            "minecraft:pushable": { "is_pushable": true, "is_pushable_by_piston": true },
            "minecraft:movement": { "value": 0.25 },
            "minecraft:navigation.walk": {
                "can_walk": true,
                "avoid_water": true,
                "can_path_over_water": false
            },
            "minecraft:movement.basic": {},
            "minecraft:jump.static": {},
            "minecraft:type_family": { "family": ["mob", "[nome_mob]"] },
            "minecraft:breathable": { "total_supply": 15, "suffocate_time": 0 },
            "minecraft:nameable": {},
            "minecraft:loot": { "table": "" },
            "minecraft:experience_reward": {
                "on_death": "query.last_hit_by_player ? Math.Random(1,3) : 0"
            }
        }
    }
}
```

### 2. Resource Pack (RP) - Entidade Client-Side
Criar `[AddonName] RP/entity/[nome_mob].entity.json`:

```json
{
    "format_version": "1.10.0",
    "minecraft:client_entity": {
        "description": {
            "identifier": "[namespace]:[nome_mob]",
            "materials": { "default": "entity_alphatest" },
            "textures": { "default": "textures/entity/[nome_mob]" },
            "geometry": { "default": "geometry.[nome_mob]" },
            "render_controllers": ["controller.render.[nome_mob]"],
            "animations": {},
            "scripts": { "animate": [] }
        }
    }
}
```

### 3. Modelo (RP)
Criar `[AddonName] RP/models/entity/[nome_mob].geo.json`:
- Usar formato Blockbench (format_version "1.12.0")
- Criar geometria basica com bones: body, head, leg0-3 (para quadrupede) ou body, head, leftArm, rightArm, leftLeg, rightLeg (bipede)
- Incluir `"visible_bounds_width"` e `"visible_bounds_height"` adequados

### 4. Render Controller (RP)
Criar `[AddonName] RP/render_controllers/[nome_mob].render_controllers.json`:

```json
{
    "format_version": "1.8.0",
    "render_controllers": {
        "controller.render.[nome_mob]": {
            "geometry": "Geometry.default",
            "materials": [{ "*": "Material.default" }],
            "textures": ["Texture.default"]
        }
    }
}
```

### 5. Textura Placeholder (RP)
Informar ao usuario que precisa criar a textura PNG em:
`[AddonName] RP/textures/entity/[nome_mob].png`

### 6. Traducoes (RP)
Adicionar em `texts/pt_BR.lang`:
```
entity.[namespace]:[nome_mob].name=[Nome Legivel do Mob]
```
Adicionar em `texts/en_US.lang`:
```
entity.[namespace]:[nome_mob].name=[Readable Mob Name]
```

### 7. Script (BP)
Se o mob tiver comportamento customizado via script, adicionar logica em `scripts/main.js`.

## Regras
- Substituir `[namespace]` pelo namespace do addon atual
- Substituir `[nome_mob]` pelo nome em snake_case
- Substituir `[AddonName]` pelo nome da pasta do addon
- Escolher `runtime_identifier` baseado no tipo: `minecraft:zombie` para hostil bipede, `minecraft:cow` para passivo quadrupede, `minecraft:snowball` para projetil
- UUIDs: nao sao necessarios nos arquivos de entidade, apenas no manifest.json
- Sempre verificar se o manifest.json do RP ja existe; se nao, criar
- Ao final, listar todos os arquivos criados e o que falta (textura, etc.)
