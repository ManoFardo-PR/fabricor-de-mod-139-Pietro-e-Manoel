---
name: comportamento-mob
description: Adiciona ou modifica comportamentos e AI de um mob existente em Minecraft Bedrock. Use quando o usuario quiser que um mob tenha novos comportamentos, ataques, habilidades, goals de AI, ou interacoes especiais. Tambem ativa quando pedirem para fazer o mob atacar, seguir, fugir, dropar itens, etc.
argument-hint: "[nome-do-mob] [descricao-do-comportamento]"
---

# Comportamento de Mob - Minecraft Bedrock

Adiciona comportamentos a mobs existentes. O primeiro argumento e o nome do mob, o segundo e o comportamento desejado.

## Dois Caminhos para Comportamento

### Caminho 1: Componentes de Entidade (BP entity JSON)
Usar para comportamentos padrao que o Bedrock ja suporta nativamente.

**AI Goals comuns (adicionar em `components`):**
```json
"minecraft:behavior.nearest_attackable_target": {
    "priority": 2,
    "entity_types": [{ "filters": { "test": "is_family", "value": "player" }, "max_dist": 16 }]
}
"minecraft:behavior.melee_attack": { "priority": 3, "speed_multiplier": 1.0, "track_target": true }
"minecraft:behavior.hurt_by_target": { "priority": 1 }
"minecraft:behavior.random_stroll": { "priority": 6, "speed_multiplier": 0.8 }
"minecraft:behavior.look_at_player": { "priority": 7, "look_distance": 8.0 }
"minecraft:behavior.random_look_around": { "priority": 8 }
"minecraft:behavior.float": { "priority": 0 }
"minecraft:behavior.follow_owner": { "priority": 4, "speed_multiplier": 1.0, "start_distance": 10, "stop_distance": 2 }
"minecraft:behavior.flee_sun": { "priority": 2, "speed_multiplier": 1.2 }
"minecraft:behavior.avoid_mob_type": { "priority": 3, "entity_types": [...], "max_dist": 10 }
"minecraft:behavior.tempt": { "priority": 4, "speed_multiplier": 1.0, "items": ["minecraft:wheat"] }
"minecraft:behavior.breed": { "priority": 3, "speed_multiplier": 1.0 }
```

**Atributos de combate:**
```json
"minecraft:attack": { "damage": 4, "effect_name": "poison", "effect_duration": 5 }
"minecraft:knockback_resistance": { "value": 0.5 }
"minecraft:fire_immune": true
```

**Spawning natural:**
```json
"minecraft:spawn_entity": { ... }
"minecraft:despawn": { "despawn_from_distance": { "max_distance": 128, "min_distance": 32 } }
```

**Drops:**
```json
"minecraft:loot": { "table": "loot_tables/entities/[nome_mob].json" }
```

### Caminho 2: Script (scripts/main.js)
Usar para comportamentos customizados que nao existem nos componentes nativos.

**Padroes de script para comportamentos:**

```javascript
import { world, system } from "@minecraft/server";

// Detectar quando o mob e atingido
world.afterEvents.entityHitEntity.subscribe((event) => {
    if (event.damagedEntity.typeId === "[namespace]:[nome_mob]") {
        // Comportamento ao ser atingido
    }
});

// Loop periodico para o mob
system.runInterval(() => {
    const dim = world.getDimension("overworld");
    // Buscar entidades do tipo
    const mobs = dim.getEntities({ type: "[namespace]:[nome_mob]" });
    for (const mob of mobs) {
        // Logica customizada: verificar proximidade de players,
        // spawnar particulas, aplicar efeitos, etc.
    }
}, 20); // a cada 1 segundo

// Detectar morte do mob
world.afterEvents.entityDie.subscribe((event) => {
    if (event.deadEntity.typeId === "[namespace]:[nome_mob]") {
        // Dropar itens customizados, explodir, spawnar outros mobs, etc.
    }
});
```

## Regras
1. Primeiro verificar se o comportamento pode ser feito via componentes JSON (caminho 1)
2. So usar script (caminho 2) quando o comportamento e muito customizado
3. Prioridades de AI goals: numeros menores = maior prioridade
4. Ao adicionar ataque, incluir tambem `nearest_attackable_target` e `hurt_by_target`
5. Sempre manter componentes existentes ao adicionar novos
6. Testar se o mob ja tem um scripts/main.js antes de criar um novo
7. Usar `component_groups` + `events` para comportamentos condicionais (ex: ficar bravo quando atacado)
8. Comentar o codigo em portugues

## Component Groups e Eventos (comportamento condicional)
```json
"component_groups": {
    "calmo": { "minecraft:behavior.random_stroll": { "priority": 5 } },
    "agressivo": { "minecraft:behavior.melee_attack": { "priority": 2 } }
},
"events": {
    "ficou_bravo": { "add": { "component_groups": ["agressivo"] }, "remove": { "component_groups": ["calmo"] } },
    "acalmou": { "add": { "component_groups": ["calmo"] }, "remove": { "component_groups": ["agressivo"] } }
}
```
