// ================================================================
//  MODS PIETRO E MANOEL - Script Unificado
//  1. Super Picareta (escavacao, TNT, Bomba, Pistola Sinalizadora, Espada de Fogo)
//  2. Multiplicador x10 (duplicacao de itens)
//  3. Armadura de Slime v2 (repulsao, saltos, quique, folhas, teto, arremesso)
//  4. Pistola Laser e Rifle Sniper (HUD de municao, luneta)
//  5. Cactus Zumbi (pocao, mobs, espinhos)
// ================================================================

import { world, system, EquipmentSlot, BlockPermutation } from "@minecraft/server";

// ████████████████████████████████████████████████████████████████
// ██  1. SUPER PICARETA, TNT, BOMBA, SINALIZADORA, ESPADA        ██
// ████████████████████████████████████████████████████████████████

// Blocos que o tunel nunca apaga (alem de minerios e bedrock)
const BLOCOS_PRESERVADOS_PICARETA = new Set([
    "minecraft:chest", "minecraft:trapped_chest", "minecraft:barrel",
    "minecraft:mob_spawner", "minecraft:ender_chest", "minecraft:shulker_box",
    "minecraft:undyed_shulker_box", "minecraft:end_portal_frame", "minecraft:spore_blossom"
]);

world.afterEvents.playerBreakBlock.subscribe((event) => {
    const player = event.player;
    const item = event.itemStackBeforeBreak;

    // Verifica se o jogador esta usando a Super Picareta
    if (!item || item.typeId !== "escavadora:super_picareta") return;

    const dimension = player.dimension;
    const x = event.block.location.x;
    const y = event.block.location.y;
    const z = event.block.location.z;

    // Determina a direcao cardinal baseada na visao do jogador
    const viewDir = player.getViewDirection();
    const absX = Math.abs(viewDir.x);
    const absZ = Math.abs(viewDir.z);

    let dx = 0, dz = 0;
    let wx = 0, wz = 0;

    if (absX > absZ) {
        dx = viewDir.x > 0 ? 1 : -1;
        wz = 1;
    } else {
        dz = viewDir.z > 0 ? 1 : -1;
        wx = 1;
    }

    // Calcular profundidade: base 10 + 2 por nivel de efficiency
    let tunnelDepth = 10;
    try {
        const inv = player.getComponent("minecraft:inventory").container;
        const heldItem = inv.getItem(player.selectedSlotIndex);
        if (heldItem) {
            const enchComp = heldItem.getComponent("minecraft:enchantable");
            if (enchComp) {
                const enchList = enchComp.getEnchantments();
                for (const ench of enchList) {
                    if (ench.type.id === "efficiency") {
                        tunnelDepth += ench.level * 2;
                        break;
                    }
                }
            }
        }
    } catch (e) {}
    const depth = tunnelDepth - 1;

    // Limites do tunel
    const minX = Math.min(x - wx, x + wx + dx * depth);
    const maxX = Math.max(x - wx, x + wx + dx * depth);
    const minY = y - 1;
    const maxY = y + 4;
    const minZ = Math.min(z - wz, z + wz + dz * depth);
    const maxZ = Math.max(z - wz, z + wz + dz * depth);

    system.run(() => {
        try {
            for (let bx = minX; bx <= maxX; bx++) {
                for (let by = minY; by <= maxY; by++) {
                    for (let bz = minZ; bz <= maxZ; bz++) {
                        const block = dimension.getBlock({ x: bx, y: by, z: bz });
                        if (!block) continue;

                        const id = block.typeId;

                        // Preserva minerios, ancient debris, bedrock e blocos com conteudo
                        if (id.endsWith("_ore") || id === "minecraft:ancient_debris" || id === "minecraft:bedrock") continue;
                        if (BLOCOS_PRESERVADOS_PICARETA.has(id)) continue;

                        // Remove tudo que nao for minerio ou bedrock
                        block.setType("minecraft:air");
                    }
                }
            }

            // Consumir durabilidade (10 por uso)
            try {
                const inv = player.getComponent("minecraft:inventory").container;
                const slot = player.selectedSlotIndex;
                const currentItem = inv.getItem(slot);
                if (currentItem && currentItem.typeId === "escavadora:super_picareta") {
                    const durComp = currentItem.getComponent("minecraft:durability");
                    if (durComp) {
                        durComp.damage = Math.min(durComp.damage + 10, durComp.maxDurability);
                        if (durComp.damage >= durComp.maxDurability) {
                            inv.setItem(slot, undefined);
                            player.playSound("random.break");
                        } else {
                            inv.setItem(slot, currentItem);
                        }
                    }
                }
            } catch (e) {}
        } catch (e) {
            world.sendMessage("§c[Super Picareta] Erro: " + e.message);
        }
    });
});

// ============================================================
// Funcao auxiliar: Knockback de explosao
// ============================================================

function applyExplosionKnockback(dimension, center, radius, horizontalStrength, verticalStrength) {
    try {
        const nearby = dimension.getEntities({
            location: center,
            maxDistance: radius
        });
        for (const entity of nearby) {
            try {
                const dx = entity.location.x - center.x;
                const dz = entity.location.z - center.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                let normX, normZ;
                if (dist < 0.1) {
                    const angle = Math.random() * Math.PI * 2;
                    normX = Math.cos(angle);
                    normZ = Math.sin(angle);
                } else {
                    normX = dx / dist;
                    normZ = dz / dist;
                }

                // Mais perto = knockback mais forte
                const distanceFactor = 1 - (dist / radius);
                const hStr = horizontalStrength * Math.max(distanceFactor, 0.3);
                const vStr = verticalStrength * Math.max(distanceFactor, 0.3);
                entity.applyKnockback(normX, normZ, hStr, vStr);
            } catch (e) {
                // Entidade pode ter morrido ou ser invalida
            }
        }
    } catch (e) {}
}

// ============================================================
// Funcao auxiliar: Quebra blocos em esfera (para uso subaquatico)
// ============================================================

function breakBlocksInSphere(dimension, center, radius) {
    const r = Math.ceil(radius);
    const cx = Math.floor(center.x);
    const cy = Math.floor(center.y);
    const cz = Math.floor(center.z);
    for (let x = cx - r; x <= cx + r; x++) {
        for (let y = cy - r; y <= cy + r; y++) {
            for (let z = cz - r; z <= cz + r; z++) {
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2);
                if (dist > radius) continue;
                try {
                    const block = dimension.getBlock({ x, y, z });
                    if (!block) continue;
                    const id = block.typeId;
                    if (id === "minecraft:bedrock" || id === "minecraft:air") continue;
                    if (id === "minecraft:water" || id === "minecraft:flowing_water") continue;
                    block.setType("minecraft:air");
                } catch (e) {}
            }
        }
    }
}

// ============================================================
// TNT Arremessavel - Granada de Dinamite
// ============================================================

// Controle para evitar explosao dupla
const explodedTNTs = new Set();

function explodeTNT(projectile, location, dimension, isEntityHit, hitEntity) {
    let entityId;
    try { entityId = projectile.id; } catch (e) { return; }
    if (explodedTNTs.has(entityId)) return;
    explodedTNTs.add(entityId);

    system.run(() => {
        try {
            if (isEntityHit) {
                applyExplosionKnockback(dimension, location, 8, 8.0, 3.5);

                if (hitEntity) {
                    try {
                        hitEntity.applyDamage(25, { cause: "entityExplosion" });
                    } catch (e) {}
                }

                dimension.createExplosion(location, 3, {
                    breaksBlocks: true,
                    causesFire: false
                });
            } else {
                applyExplosionKnockback(dimension, location, 6, 5.0, 2.0);

                dimension.createExplosion(location, 2, {
                    breaksBlocks: true,
                    causesFire: false
                });
            }
        } catch (e) {
            world.sendMessage("§c[TNT] Erro explosao: " + e.message);
        } finally {
            try { projectile.kill(); } catch (e) {}
            system.runTimeout(() => explodedTNTs.delete(entityId), 10);
        }
    });
}

// Quando a TNT atinge um BLOCO
world.afterEvents.projectileHitBlock.subscribe((event) => {
    try {
        if (event.projectile.typeId !== "escavadora:tnt_arremessavel") return;
        explodeTNT(event.projectile, event.location, event.dimension, false, null);
    } catch (e) {}
});

// Quando a TNT atinge uma ENTIDADE
world.afterEvents.projectileHitEntity.subscribe((event) => {
    try {
        if (event.projectile.typeId !== "escavadora:tnt_arremessavel") return;
        let hitEntity = null;
        try {
            const hitInfo = event.getEntityHit();
            if (hitInfo && hitInfo.entity) hitEntity = hitInfo.entity;
        } catch (e) {}
        explodeTNT(event.projectile, event.location, event.dimension, true, hitEntity);
    } catch (e) {}
});

// Fallback: detecta TNT presa (parada ha mais de 2s) ou perdida (viva ha mais de 10s)
const TNT_FALLBACK_IDADE_MIN = 40;     // ticks antes de considerar "presa"
const TNT_FALLBACK_IDADE_MAX = 200;    // teto absoluto: explode mesmo em movimento
const TNT_FALLBACK_VEL_PARADA = 0.05;  // deslocamento (blocos / 2 ticks) abaixo do qual esta parada
const tntTrack = new Map(); // id -> { spawnTick, lastX, lastY, lastZ }
system.runInterval(() => {
    const aliveTntIds = new Set();
    const tntDimNames = ["overworld", "nether", "the_end"];
    for (const tntDimName of tntDimNames) {
        try {
            const dim = world.getDimension(tntDimName);
            const tnts = dim.getEntities({ type: "escavadora:tnt_arremessavel" });
            for (const tnt of tnts) {
                aliveTntIds.add(tnt.id);
                if (explodedTNTs.has(tnt.id)) continue;
                const loc = tnt.location;
                if (!tntTrack.has(tnt.id)) {
                    tntTrack.set(tnt.id, { spawnTick: system.currentTick, lastX: loc.x, lastY: loc.y, lastZ: loc.z });
                    continue;
                }
                const t = tntTrack.get(tnt.id);
                const age = system.currentTick - t.spawnTick;
                const tdx = loc.x - t.lastX, tdy = loc.y - t.lastY, tdz = loc.z - t.lastZ;
                const vel = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
                t.lastX = loc.x; t.lastY = loc.y; t.lastZ = loc.z;

                const presa = age > TNT_FALLBACK_IDADE_MIN && vel < TNT_FALLBACK_VEL_PARADA;
                if (presa || age > TNT_FALLBACK_IDADE_MAX) {
                    explodeTNT(tnt, loc, dim, false, null);
                    tntTrack.delete(tnt.id);
                }
            }
        } catch (e) {}
    }
    for (const [tid] of tntTrack) {
        if (!aliveTntIds.has(tid)) tntTrack.delete(tid);
    }
}, 2);

// ============================================================
// Bomba Submarina - Funciona na agua
// ============================================================

const explodedSubmarines = new Set();
const submarineData = new Map();

function explodeSubmarineLand(entity, dimension, location) {
    if (explodedSubmarines.has(entity.id)) return;
    explodedSubmarines.add(entity.id);

    system.run(() => {
        try {
            applyExplosionKnockback(dimension, location, 4, 3.0, 1.0);
            dimension.createExplosion(location, 1.5, {
                breaksBlocks: true,
                causesFire: false
            });
        } catch (e) {
            world.sendMessage("§c[Bomba] Erro terra: " + e.message);
        }
        try { entity.kill(); } catch (e) {}
        submarineData.delete(entity.id);
        system.runTimeout(() => explodedSubmarines.delete(entity.id), 10);
    });
}

function explodeSubmarineWater(entity, dimension, location) {
    if (explodedSubmarines.has(entity.id)) return;
    explodedSubmarines.add(entity.id);

    system.run(() => {
        try {
            applyExplosionKnockback(dimension, location, 6, 5.0, 2.0);
            dimension.createExplosion(location, 4, {
                breaksBlocks: false,
                causesFire: false
            });
            breakBlocksInSphere(dimension, location, 5);
        } catch (e) {
            world.sendMessage("§c[Bomba] Erro agua: " + e.message);
        }
        try { entity.kill(); } catch (e) {}
        submarineData.delete(entity.id);
        system.runTimeout(() => explodedSubmarines.delete(entity.id), 10);
    });
}

// Monitora bombas submarinas
system.runInterval(() => {
    const dimNames = ["overworld", "nether", "the_end"];
    const aliveSubIds = new Set();

    for (const dimName of dimNames) {
        let dim;
        try { dim = world.getDimension(dimName); } catch (e) { continue; }

        let submarines;
        try { submarines = dim.getEntities({ type: "escavadora:bomba_submarina" }); } catch (e) { continue; }

        for (const sub of submarines) {
            aliveSubIds.add(sub.id);
            if (explodedSubmarines.has(sub.id)) continue;

            try {
                const loc = sub.location;

                if (!submarineData.has(sub.id)) {
                    submarineData.set(sub.id, {
                        spawnTick: system.currentTick,
                        lastX: loc.x,
                        lastY: loc.y,
                        lastZ: loc.z
                    });
                    continue;
                }

                const data = submarineData.get(sub.id);
                const age = system.currentTick - data.spawnTick;

                // Bolhas quando na agua
                try {
                    const waterCheck = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
                    if (waterCheck && (waterCheck.typeId === "minecraft:water" || waterCheck.typeId === "minecraft:flowing_water")) {
                        for (let b = 0; b < 5; b++) {
                            dim.spawnParticle("minecraft:basic_bubble_particle", {
                                x: loc.x + (Math.random() - 0.5) * 0.6,
                                y: loc.y + Math.random() * 0.3,
                                z: loc.z + (Math.random() - 0.5) * 0.6
                            });
                        }
                    }
                } catch (e) {}

                // Grace period
                if (age < 10) {
                    data.lastX = loc.x;
                    data.lastY = loc.y;
                    data.lastZ = loc.z;
                    continue;
                }

                // Calcula velocidade
                const sdx = loc.x - data.lastX;
                const sdy = loc.y - data.lastY;
                const sdz = loc.z - data.lastZ;
                const speed = Math.sqrt(sdx * sdx + sdy * sdy + sdz * sdz);

                data.lastX = loc.x;
                data.lastY = loc.y;
                data.lastZ = loc.z;

                if (speed > 0.05) {
                    if (age > 200) {
                        const block = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
                        const inWater = block && (block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water");
                        if (inWater) {
                            explodeSubmarineWater(sub, dim, loc);
                        } else {
                            explodeSubmarineLand(sub, dim, loc);
                        }
                    }
                    continue;
                }

                // Entidade parou! Detectar ambiente
                const blockAtPos = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
                if (!blockAtPos) continue;

                const blockId = blockAtPos.typeId;
                const isInWater = blockId === "minecraft:water" || blockId === "minecraft:flowing_water";

                if (isInWater) {
                    explodeSubmarineWater(sub, dim, loc);
                } else {
                    explodeSubmarineLand(sub, dim, loc);
                }
            } catch (e) {}
        }
    }

    for (const [sid] of submarineData) {
        if (!aliveSubIds.has(sid)) submarineData.delete(sid);
    }
    if (explodedSubmarines.size > 50) {
        for (const sid of explodedSubmarines) {
            if (!aliveSubIds.has(sid)) explodedSubmarines.delete(sid);
        }
    }
}, 2);

// ████████████████████████████████████████████████████████████████
// ██  PISTOLA SINALIZADORA - FLARE GUN                         ██
// ████████████████████████████████████████████████████████████████

const FLARE_CONFIG = {
    duration: { land: 1200, water: 600 },
    trail: { enabled: true, lightLevel: 14 },
    bounce: {
        maxBounces: 1,
        default: { velocityLoss: 0.2, minVertical: 0.05, maxVertical: -0.05 },
        exceptions: {
            "minecraft:snow_layer":    { action: "land", halfDuration: true },
            "minecraft:snow":          { action: "land", halfDuration: true },
            "minecraft:powder_snow":   { action: "land", halfDuration: true },
            "minecraft:water":         { action: "land", halfDuration: false },
            "minecraft:flowing_water": { action: "land", halfDuration: false },
            "minecraft:lava":          { action: "land", halfDuration: false },
            "minecraft:flowing_lava":  { action: "land", halfDuration: false }
        }
    },
    fire: { enabled: true, radius: 5, chance: 0.3, entityDuration: 5 },
    effects: {
        trail:  { particle: "minecraft:basic_flame_particle", count: 3 },
        smoke:  { particle: "minecraft:campfire_tall_smoke_particle", columns: 8 },
        impact: { particle: "minecraft:basic_flame_particle", count: 5 }
    },
    maxLanded: 5,
    flightTimeout: 200,
    gun: {
        itemId: "escavadora:pistola_sinalizadora",
        power: 1.2,           // velocidade inicial do sinalizador (blocos/tick)
        spawnDistance: 0.8    // distancia a frente da cabeca onde o projetil nasce
    }
};

const flightFlares = new Map();
const landedFlares = new Map();
const pendingLightRemovals = [];
const MAX_LIGHT_REMOVAL_RETRIES = 600;

// --- [FLARE] Persistencia (sobrevive a /reload e recarga de mundo) ---
const FLARE_PROP_KEY = "escavadora:landed_flares";
let landedFlaresLoaded = false;

// Duracao total de um flare pousado (ticks), conforme agua/terra e meia-duracao
function flareDuracaoMaxima(data) {
    let maxDuration = data.inWater ? FLARE_CONFIG.duration.water : FLARE_CONFIG.duration.land;
    if (data.halfDuration) maxDuration = Math.floor(maxDuration / 2);
    return maxDuration;
}

// Salva o tempo RESTANTE (nao o tick absoluto): system.currentTick reinicia ao reabrir o mundo
function salvarLandedFlares() {
    try {
        const now = system.currentTick;
        const arr = [];
        for (const [k, d] of landedFlares) {
            const copia = Object.assign({}, d);
            copia.restante = flareDuracaoMaxima(d) - (now - d.landTick);
            delete copia.landTick;
            arr.push([k, copia]);
        }
        world.setDynamicProperty(FLARE_PROP_KEY, JSON.stringify(arr));
    } catch (e) {}
}

function carregarLandedFlares() {
    try {
        const raw = world.getDynamicProperty(FLARE_PROP_KEY);
        if (typeof raw !== "string" || !raw) return;
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return;
        const now = system.currentTick;
        for (const [k, v] of arr) {
            if (!v || landedFlares.has(k)) continue;
            const max = flareDuracaoMaxima(v);
            let restante;
            if (typeof v.restante === "number") {
                restante = v.restante;
            } else if (typeof v.landTick === "number") {
                // Formato antigo (tick absoluto): so e confiavel na mesma sessao
                restante = max - (now - v.landTick);
            } else {
                restante = 0;
            }
            if (restante <= 0) {
                // Ja expirou: so garantir que a luz seja removida
                queueLightRemoval(v.dimId || "overworld", v.lightPos);
                continue;
            }
            v.landTick = now - (max - restante);
            delete v.restante;
            landedFlares.set(k, v);
        }
        salvarLandedFlares();
    } catch (e) {}
}

// ====  Enfileira remocao de luz para retry garantido  ====
function queueLightRemoval(dimId, pos) {
    if (!pos) return;
    pendingLightRemovals.push({
        dimId: dimId,
        pos: { x: pos.x, y: pos.y, z: pos.z },
        retries: 0
    });
}

// ====  Processa fila de remocao de luzes pendentes  ====
function processPendingLightRemovals() {
    for (let i = pendingLightRemovals.length - 1; i >= 0; i--) {
        const entry = pendingLightRemovals[i];
        try {
            const dim = world.getDimension(entry.dimId);
            if (removeSingleLight(dim, entry.pos)) {
                pendingLightRemovals.splice(i, 1);
            } else {
                entry.retries++;
                if (entry.retries > MAX_LIGHT_REMOVAL_RETRIES) {
                    try {
                        const block = dim.getBlock(entry.pos);
                        if (block) block.setType("minecraft:air");
                    } catch (e) {}
                    pendingLightRemovals.splice(i, 1);
                }
            }
        } catch (e) {
            entry.retries++;
            if (entry.retries > MAX_LIGHT_REMOVAL_RETRIES) {
                pendingLightRemovals.splice(i, 1);
            }
        }
    }
}

function placeSingleLight(dimension, loc) {
    const x = Math.floor(loc.x), y = Math.floor(loc.y), z = Math.floor(loc.z);
    try {
        const block = dimension.getBlock({ x, y, z });
        if (block && block.typeId === "minecraft:air") {
            block.setPermutation(
                BlockPermutation.resolve("minecraft:light_block",
                    { "block_light_level": FLARE_CONFIG.trail.lightLevel })
            );
            return { x, y, z };
        }
    } catch (e) {}
    return null;
}

function removeSingleLight(dimension, pos) {
    if (!pos) return true;
    try {
        const block = dimension.getBlock(pos);
        if (block && block.typeId === "minecraft:light_block") {
            block.setType("minecraft:air");
            return true;
        }
        return block ? true : false;
    } catch (e) { return false; }
}

function isFlammable(blockTypeId) {
    if (blockTypeId.includes("log") || blockTypeId.includes("planks") ||
        blockTypeId.includes("leaves") || blockTypeId.includes("wood") ||
        blockTypeId.includes("wool") || blockTypeId.includes("fence") ||
        blockTypeId.includes("carpet") || blockTypeId.includes("bamboo") ||
        blockTypeId.includes("vine") ||
        blockTypeId === "minecraft:short_grass" || blockTypeId === "minecraft:tall_grass" ||
        blockTypeId === "minecraft:grass" ||
        blockTypeId.includes("fern") || blockTypeId.includes("wheat") ||
        blockTypeId.includes("flower") || blockTypeId.includes("azalea") ||
        blockTypeId.includes("moss") || blockTypeId.includes("hanging_roots") ||
        blockTypeId.includes("sweet_berry") || blockTypeId.includes("dead_bush")) return true;
    const extras = ["minecraft:hay_block", "minecraft:bookshelf", "minecraft:lectern",
        "minecraft:crafting_table", "minecraft:dried_kelp_block", "minecraft:scaffolding",
        "minecraft:bee_nest", "minecraft:beehive", "minecraft:carrots",
        "minecraft:potatoes", "minecraft:beetroot", "minecraft:tnt"];
    return extras.includes(blockTypeId);
}

function isInWaterAt(dimension, x, y, z) {
    try {
        const block = dimension.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) });
        return block && (block.typeId === "minecraft:water" || block.typeId === "minecraft:flowing_water");
    } catch (e) { return false; }
}

function spawnTrailEffects(dimension, pos) {
    try {
        for (let i = 0; i < FLARE_CONFIG.effects.trail.count; i++) {
            dimension.spawnParticle(FLARE_CONFIG.effects.trail.particle, {
                x: pos.x + (Math.random() - 0.5) * 0.3,
                y: pos.y + Math.random() * 0.3,
                z: pos.z + (Math.random() - 0.5) * 0.3
            });
        }
    } catch (e) {}
}

function spawnSmokeEffects(dimension, loc) {
    try {
        for (let sy = 1; sy <= FLARE_CONFIG.effects.smoke.columns; sy++) {
            dimension.spawnParticle(FLARE_CONFIG.effects.smoke.particle, {
                x: loc.x, y: loc.y + sy, z: loc.z
            });
        }
    } catch (e) {}
}

function spawnImpactParticles(dimension, loc) {
    try {
        for (let i = 0; i < FLARE_CONFIG.effects.impact.count; i++) {
            dimension.spawnParticle(FLARE_CONFIG.effects.impact.particle, {
                x: loc.x + (Math.random() - 0.5) * 0.5,
                y: loc.y + Math.random() * 0.5,
                z: loc.z + (Math.random() - 0.5) * 0.5
            });
        }
    } catch (e) {}
}

function applyFlareFire(dimension, cx, cy, cz) {
    const r = FLARE_CONFIG.fire.radius;
    try {
        const nearby = dimension.getEntities({
            location: { x: cx, y: cy, z: cz },
            maxDistance: r
        });
        for (const entity of nearby) {
            try {
                if (entity.typeId === "escavadora:sinalizador_projetil") continue;
                if (entity.typeId === "minecraft:item") continue;
                entity.setOnFire(FLARE_CONFIG.fire.entityDuration, true);
            } catch (e) {}
        }
    } catch (e) {}

    const ir = Math.ceil(r);
    const icx = Math.floor(cx);
    const icy = Math.floor(cy);
    const icz = Math.floor(cz);
    for (let x = icx - ir; x <= icx + ir; x++) {
        for (let y = icy - ir; y <= icy + ir; y++) {
            for (let z = icz - ir; z <= icz + ir; z++) {
                const dist = Math.sqrt((x - icx) ** 2 + (y - icy) ** 2 + (z - icz) ** 2);
                if (dist > r) continue;
                try {
                    const block = dimension.getBlock({ x, y, z });
                    if (!block) continue;
                    if (isFlammable(block.typeId) && Math.random() < FLARE_CONFIG.fire.chance) {
                        const above = dimension.getBlock({ x, y: y + 1, z });
                        if (above && above.typeId === "minecraft:air") {
                            above.setType("minecraft:fire");
                        }
                    }
                } catch (e) {}
            }
        }
    }
}

function calculateBouncedVelocity(face, hitVector) {
    const loss = FLARE_CONFIG.bounce.default.velocityLoss;
    let vx = hitVector.x * loss;
    let vy = hitVector.y * loss;
    let vz = hitVector.z * loss;

    if (face === "Up" || face === "Down") {
        vy = -vy;
        if (face === "Up" && vy < FLARE_CONFIG.bounce.default.minVertical) vy = FLARE_CONFIG.bounce.default.minVertical;
        if (face === "Down" && vy > FLARE_CONFIG.bounce.default.maxVertical) vy = FLARE_CONFIG.bounce.default.maxVertical;
    } else if (face === "North" || face === "South") {
        vz = -vz;
    } else if (face === "East" || face === "West") {
        vx = -vx;
    }

    return { x: vx, y: vy, z: vz };
}

function handleBounce(hitBlockTypeId, face, hitVector, bounceCount) {
    const exception = FLARE_CONFIG.bounce.exceptions[hitBlockTypeId];
    if (exception) {
        return { action: exception.action, halfDuration: exception.halfDuration };
    }

    if (bounceCount < FLARE_CONFIG.bounce.maxBounces) {
        const velocity = calculateBouncedVelocity(face, hitVector);
        return { action: "bounce", velocity };
    }

    return { action: "land", halfDuration: false };
}

function flareLand(dimension, loc, halfDuration) {
    const cx = Math.floor(loc.x);
    const cy = Math.floor(loc.y);
    const cz = Math.floor(loc.z);
    const key = `${cx},${cy},${cz}`;

    if (landedFlares.has(key)) return;

    if (landedFlares.size >= FLARE_CONFIG.maxLanded) {
        let oldestKey = null;
        let oldestTick = Infinity;
        for (const [k, d] of landedFlares) {
            if (d.landTick < oldestTick) {
                oldestTick = d.landTick;
                oldestKey = k;
            }
        }
        if (oldestKey) {
            const old = landedFlares.get(oldestKey);
            queueLightRemoval(old.dimId, old.lightPos);
            landedFlares.delete(oldestKey);
            salvarLandedFlares();
        }
    }

    const inWater = isInWaterAt(dimension, loc.x, loc.y, loc.z);
    const lightPos = placeSingleLight(dimension, loc);

    if (!halfDuration && !inWater) {
        try {
            const blockBelow = dimension.getBlock({ x: cx, y: cy - 1, z: cz });
            if (blockBelow && isFlammable(blockBelow.typeId) && Math.random() < FLARE_CONFIG.fire.chance) {
                applyFlareFire(dimension, loc.x, loc.y, loc.z);
            }
        } catch (e) {}
    }

    const did = dimension.id;
    let dimName = did.replace("minecraft:", "");
    if (!["overworld", "nether", "the_end"].includes(dimName)) dimName = "overworld";

    landedFlares.set(key, {
        landTick: system.currentTick,
        inWater: inWater,
        halfDuration: !!halfDuration,
        dimId: dimName,
        loc: { x: loc.x, y: loc.y, z: loc.z },
        lightPos: lightPos
    });
    salvarLandedFlares();
}

// Flare: disparo pela Pistola Sinalizadora (arma reutilizavel com durabilidade)
world.afterEvents.itemUse.subscribe((event) => {
    try {
        const jogador = event.source;
        const item = event.itemStack;
        if (!item || item.typeId !== FLARE_CONFIG.gun.itemId) return;
        if (!jogador || jogador.typeId !== "minecraft:player") return;

        const dir = jogador.getViewDirection();
        const head = jogador.getHeadLocation();
        const dist = FLARE_CONFIG.gun.spawnDistance;
        const pos = { x: head.x + dir.x * dist, y: head.y + dir.y * dist - 0.1, z: head.z + dir.z * dist };
        const dim = jogador.dimension;
        const dimName = dim.id.replace("minecraft:", "");
        const power = FLARE_CONFIG.gun.power;

        system.run(() => {
            try {
                const flare = dim.spawnEntity("escavadora:sinalizador_projetil", pos);
                const proj = flare.getComponent("minecraft:projectile");
                if (proj) {
                    try { proj.owner = jogador; } catch (e) {}
                    proj.shoot({ x: dir.x * power, y: dir.y * power, z: dir.z * power }, { uncertainty: 0 });
                }
                flightFlares.set(flare.id, {
                    lastPos: null,
                    bounceCount: 0,
                    spawnTick: system.currentTick,
                    dimName: ["overworld", "nether", "the_end"].includes(dimName) ? dimName : "overworld",
                    lightPos: null
                });
            } catch (e) {}
        });

        // Consumir durabilidade da pistola
        try {
            const inv = jogador.getComponent("minecraft:inventory").container;
            const slot = jogador.selectedSlotIndex;
            const naMao = inv.getItem(slot);
            if (naMao && naMao.typeId === FLARE_CONFIG.gun.itemId) {
                const dur = naMao.getComponent("minecraft:durability");
                if (dur) {
                    dur.damage = Math.min(dur.damage + 1, dur.maxDurability);
                    if (dur.damage >= dur.maxDurability) {
                        inv.setItem(slot, undefined);
                        jogador.playSound("random.break");
                    } else {
                        inv.setItem(slot, naMao);
                    }
                }
            }
        } catch (e) {}

        try { jogador.playSound("firework.blast", { volume: 0.8, pitch: 1.2 }); } catch (e) {}
    } catch (e) {}
});

// Flare: projectileHitBlock (bounce + pouso)
world.afterEvents.projectileHitBlock.subscribe((event) => {
    try {
        if (event.projectile.typeId !== "escavadora:sinalizador_projetil") return;
    } catch (e) { return; }

    const loc = event.location;
    const dim = event.dimension;
    const rawDimId = dim.id.replace("minecraft:", "");
    const dimNameStr = ["overworld", "nether", "the_end"].includes(rawDimId) ? rawDimId : "overworld";

    let projId;
    try { projId = event.projectile.id; } catch (e) { return; }

    let bounceCount = 0;
    const data = flightFlares.get(projId);
    if (data) {
        bounceCount = data.bounceCount;
        queueLightRemoval(dimNameStr, data.lightPos);
    }

    try { event.projectile.remove(); } catch (e) {}
    flightFlares.delete(projId);

    let hitBlockTypeId = "";
    let hitFace = "Up";
    let hitVector = { x: 0, y: -0.5, z: 0 };
    try {
        const hitInfo = event.getBlockHit();
        if (hitInfo.block) hitBlockTypeId = hitInfo.block.typeId;
        hitFace = hitInfo.face;
        hitVector = event.hitVector;
    } catch (e) {}

    system.run(() => {
        spawnImpactParticles(dim, loc);

        const result = handleBounce(hitBlockTypeId, hitFace, hitVector, bounceCount);

        if (result.action === "land") {
            flareLand(dim, loc, result.halfDuration);
        } else {
            try {
                const v = result.velocity;
                const spawnY = (hitFace === "Down") ? loc.y - 0.2 : loc.y + 0.15;
                const newFlare = dim.spawnEntity(
                    "escavadora:sinalizador_projetil",
                    { x: loc.x + v.x * 0.1, y: spawnY, z: loc.z + v.z * 0.1 }
                );
                const proj = newFlare.getComponent("minecraft:projectile");
                proj.shoot({ x: v.x, y: v.y, z: v.z }, { uncertainty: 0 });

                flightFlares.set(newFlare.id, {
                    lastPos: null,
                    bounceCount: bounceCount + 1,
                    spawnTick: system.currentTick,
                    dimName: dimNameStr,
                    lightPos: null
                });
            } catch (e) {
                flareLand(dim, loc, false);
            }
        }
    });
});

// Flare: projectileHitEntity
world.afterEvents.projectileHitEntity.subscribe((event) => {
    try {
        if (event.projectile.typeId !== "escavadora:sinalizador_projetil") return;
    } catch (e) { return; }

    let projId;
    try { projId = event.projectile.id; } catch (e) { return; }

    try {
        const hitInfo = event.getEntityHit();
        if (hitInfo && hitInfo.entity) {
            try { hitInfo.entity.setOnFire(8, true); } catch (e) {}
            try { hitInfo.entity.applyDamage(4, { cause: "entityExplosion" }); } catch (e) {}
        }
    } catch (e) {}

    const loc = event.location;
    const dim = event.dimension;

    const hitData = flightFlares.get(projId);
    if (hitData) {
        const rawId = dim.id.replace("minecraft:", "");
        queueLightRemoval(rawId, hitData.lightPos);
    }

    try { event.projectile.remove(); } catch (e) {}
    flightFlares.delete(projId);

    system.run(() => {
        let groundY = Math.floor(loc.y);
        try {
            for (let y = groundY; y > groundY - 30; y--) {
                const block = dim.getBlock({ x: Math.floor(loc.x), y: y, z: Math.floor(loc.z) });
                if (block && block.typeId !== "minecraft:air") {
                    groundY = y + 1;
                    break;
                }
            }
        } catch (e) {}
        flareLand(dim, { x: loc.x, y: groundY, z: loc.z }, false);
    });
});

// Flare: monitor de voo e pouso
function updateFlightFlares(now, flareEntitiesMap) {
    for (const [id, data] of flightFlares) {
        const entityInfo = flareEntitiesMap.get(id);
        const found = !!entityInfo;

        if (found) {
            const flare = entityInfo.entity;
            data.dimName = entityInfo.dimName;
            const dim = world.getDimension(entityInfo.dimName);
            const loc = flare.location;

            const bx = Math.floor(loc.x);
            const by = Math.floor(loc.y);
            const bz = Math.floor(loc.z);
            const movedBlock = !data.lastPos ||
                data.lastPos.x !== bx || data.lastPos.y !== by || data.lastPos.z !== bz;

            if (movedBlock) {
                removeSingleLight(dim, data.lightPos);
                data.lightPos = placeSingleLight(dim, loc);
                data.lastPos = { x: bx, y: by, z: bz };
                spawnTrailEffects(dim, loc);
            }
        }

        if (!found || (now - data.spawnTick > FLARE_CONFIG.flightTimeout)) {
            queueLightRemoval(data.dimName || "overworld", data.lightPos);
            flightFlares.delete(id);
        }
    }
}

function updateLandedFlares(now) {
    for (const [key, data] of landedFlares) {
        try {
            const dim = world.getDimension(data.dimId);
            const age = now - data.landTick;
            const maxDuration = flareDuracaoMaxima(data);

            spawnSmokeEffects(dim, data.loc);

            if (now % 6 < 2) {
                try {
                    dim.spawnParticle(FLARE_CONFIG.effects.trail.particle, {
                        x: data.loc.x, y: data.loc.y + 0.3, z: data.loc.z
                    });
                } catch (e) {}
            }

            if (age > maxDuration) {
                queueLightRemoval(data.dimId, data.lightPos);
                landedFlares.delete(key);
                salvarLandedFlares();
            }
        } catch (e) {}
    }
}

system.runInterval(() => {
    const now = system.currentTick;

    // Lazy-load do estado persistido no primeiro tick (sobrevive a /reload)
    if (!landedFlaresLoaded) {
        carregarLandedFlares();
        landedFlaresLoaded = true;
    }

    const allDimNames = ["overworld", "nether", "the_end"];
    const flareEntitiesMap = new Map();
    for (const dn of allDimNames) {
        try {
            const d = world.getDimension(dn);
            const ents = d.getEntities({ type: "escavadora:sinalizador_projetil" });
            for (const flare of ents) {
                flareEntitiesMap.set(flare.id, { entity: flare, dimName: dn });
                if (!flightFlares.has(flare.id)) {
                    flightFlares.set(flare.id, {
                        lastPos: null,
                        bounceCount: 0,
                        spawnTick: now,
                        dimName: dn,
                        lightPos: null
                    });
                }
            }
        } catch (e) {}
    }

    updateFlightFlares(now, flareEntitiesMap);
    updateLandedFlares(now);
    processPendingLightRemovals();
}, 2);

// ============================================================
// Espada de Fogo
// ============================================================

const FIRE_SWORD_ID = "escavadora:espada_de_fogo";
const FIRE_SWORD_LIGHT_LEVEL = 15;
const FIRE_SWORD_FIRE_DURATION = 10;
const FIRE_SWORD_EXTRA_DAMAGE = 4;
const FIRE_SWORD_TREE_FIRE_CHANCE = 0.3;

const fireSwordPlayers = new Map();

function isHoldingFireSword(player) {
    try {
        const inventory = player.getComponent("minecraft:inventory");
        if (!inventory) return false;
        const container = inventory.container;
        if (!container) return false;
        const item = container.getItem(player.selectedSlotIndex);
        if (!item) return false;
        return item.typeId === FIRE_SWORD_ID;
    } catch (e) {
        return false;
    }
}

function isTreeBlock(blockTypeId) {
    return blockTypeId.includes("log") ||
           blockTypeId.includes("wood") ||
           blockTypeId.includes("leaves") ||
           blockTypeId.includes("stem") ||
           blockTypeId.includes("hyphae") ||
           blockTypeId.includes("planks");
}

function removeSwordLights(dimension, lights) {
    for (const pos of lights) {
        try {
            const block = dimension.getBlock(pos);
            if (block && block.typeId === "minecraft:light_block") {
                block.setType("minecraft:air");
            }
        } catch (e) {}
    }
}

function placeFireSwordLight(dimension, playerLoc) {
    const placedLights = [];
    const cx = Math.floor(playerLoc.x);
    const cy = Math.floor(playerLoc.y);
    const cz = Math.floor(playerLoc.z);

    try {
        const block = dimension.getBlock({ x: cx, y: cy + 1, z: cz });
        if (block && block.typeId === "minecraft:air") {
            block.setPermutation(
                BlockPermutation.resolve("minecraft:light_block", { "block_light_level": FIRE_SWORD_LIGHT_LEVEL })
            );
            placedLights.push({ x: cx, y: cy + 1, z: cz });
        }
    } catch (e) {}

    return placedLights;
}

system.runInterval(() => {
    const players = world.getAllPlayers();

    for (const player of players) {
        const playerId = player.id;
        const holding = isHoldingFireSword(player);

        if (holding) {
            const loc = player.location;
            const dim = player.dimension;

            try {
                const viewDir = player.getViewDirection();
                const rightX = -viewDir.z * 0.3;
                const rightZ = viewDir.x * 0.3;
                for (let i = 0; i < 3; i++) {
                    dim.spawnParticle("minecraft:basic_flame_particle", {
                        x: loc.x + rightX + (Math.random() - 0.5) * 0.2,
                        y: loc.y + 0.9 + Math.random() * 0.4,
                        z: loc.z + rightZ + (Math.random() - 0.5) * 0.2
                    });
                }

                for (let s = 0; s < 3; s++) {
                    dim.spawnParticle("minecraft:campfire_tall_smoke_particle", {
                        x: loc.x + (Math.random() - 0.5) * 0.3,
                        y: loc.y + 2.0 + s * 0.7,
                        z: loc.z + (Math.random() - 0.5) * 0.3
                    });
                }
            } catch (e) {}

            const data = fireSwordPlayers.get(playerId);

            if (!data) {
                const lights = placeFireSwordLight(dim, loc);
                fireSwordPlayers.set(playerId, {
                    lights: lights,
                    lastPos: { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) }
                });
            } else {
                const newX = Math.floor(loc.x);
                const newY = Math.floor(loc.y);
                const newZ = Math.floor(loc.z);

                if (newX !== data.lastPos.x || newY !== data.lastPos.y || newZ !== data.lastPos.z) {
                    try {
                        removeSwordLights(dim, data.lights);
                    } catch (e) {}

                    const newLights = placeFireSwordLight(dim, loc);
                    data.lights = newLights;
                    data.lastPos = { x: newX, y: newY, z: newZ };
                }
            }
        } else {
            const data = fireSwordPlayers.get(playerId);
            if (data) {
                try {
                    removeSwordLights(player.dimension, data.lights);
                } catch (e) {}
                fireSwordPlayers.delete(playerId);
            }
        }
    }
}, 4);

world.afterEvents.playerLeave.subscribe((event) => {
    const playerId = event.playerId;
    const data = fireSwordPlayers.get(playerId);
    if (data) {
        const dimNames = ["overworld", "nether", "the_end"];
        for (const dimName of dimNames) {
            try {
                const dim = world.getDimension(dimName);
                removeSwordLights(dim, data.lights);
            } catch (e) {}
        }
        fireSwordPlayers.delete(playerId);
    }
});

world.afterEvents.entityHitEntity.subscribe((event) => {
    try {
        const attacker = event.damagingEntity;
        const target = event.hitEntity;

        if (attacker.typeId !== "minecraft:player") return;
        if (!isHoldingFireSword(attacker)) return;

        try {
            target.applyDamage(FIRE_SWORD_EXTRA_DAMAGE, { cause: "fire" });
        } catch (e) {}

        try {
            target.setOnFire(FIRE_SWORD_FIRE_DURATION, true);
        } catch (e) {}

        try {
            const dim = target.dimension;
            const tloc = target.location;
            for (let i = 0; i < 8; i++) {
                dim.spawnParticle("minecraft:basic_flame_particle", {
                    x: tloc.x + (Math.random() - 0.5) * 1.0,
                    y: tloc.y + Math.random() * 1.5,
                    z: tloc.z + (Math.random() - 0.5) * 1.0
                });
            }
            for (let i = 0; i < 3; i++) {
                dim.spawnParticle("minecraft:lava_particle", {
                    x: tloc.x + (Math.random() - 0.5) * 0.5,
                    y: tloc.y + 0.5 + Math.random() * 0.5,
                    z: tloc.z + (Math.random() - 0.5) * 0.5
                });
            }
        } catch (e) {}
    } catch (e) {}
});

world.afterEvents.entityHitBlock.subscribe((event) => {
    try {
        const attacker = event.damagingEntity;

        if (attacker.typeId !== "minecraft:player") return;
        if (!isHoldingFireSword(attacker)) return;

        const block = event.hitBlock;
        if (!block) return;

        const blockId = block.typeId;
        if (!isTreeBlock(blockId)) return;

        if (Math.random() >= FIRE_SWORD_TREE_FIRE_CHANCE) return;

        const dim = block.dimension;
        const loc = block.location;

        try {
            const above = dim.getBlock({ x: loc.x, y: loc.y + 1, z: loc.z });
            if (above && above.typeId === "minecraft:air") {
                above.setType("minecraft:fire");
            }
        } catch (e) {}

        try {
            for (let i = 0; i < 5; i++) {
                dim.spawnParticle("minecraft:basic_flame_particle", {
                    x: loc.x + 0.5 + (Math.random() - 0.5) * 0.8,
                    y: loc.y + 0.5 + Math.random() * 0.5,
                    z: loc.z + 0.5 + (Math.random() - 0.5) * 0.8
                });
            }
        } catch (e) {}
    } catch (e) {}
});

// ████████████████████████████████████████████████████████████████
// ██  2. MULTIPLICADOR x10                                       ██
// ████████████████████████████████████████████████████████████████

// ================================================================
// Multiplicador x10
// 1 item na mao + 10 diamantes no inventario = 10 copias do item
// ================================================================

const MULTI_CONFIG = {
    blocoId: "multiplicador:multiplicador_x10",
    custoDiamantes: 10,
    copias: 10
};

// Debounce: player.id -> tick do ultimo uso (o clique pode disparar 2x no mesmo tick)
const multiUltimoUso = new Map();

function multiProcessar(player, block) {
    try {
        const inventory = player.getComponent("minecraft:inventory");
        if (!inventory) return;
        const container = inventory.container;
        if (!container) return;

        const slot = player.selectedSlotIndex;
        const held = container.getItem(slot);

        // Precisa segurar um item
        if (!held) {
            player.sendMessage("§e[Multiplicador x10] §cSegure um item na mao para multiplicar!");
            return;
        }

        // Nao multiplicar diamantes (evita loop infinito)
        if (held.typeId === "minecraft:diamond") {
            player.sendMessage("§e[Multiplicador x10] §cNao e possivel multiplicar diamantes!");
            return;
        }

        // Contar diamantes no inventario
        let diamondCount = 0;
        const diamondSlots = [];
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && item.typeId === "minecraft:diamond") {
                diamondCount += item.amount;
                diamondSlots.push(i);
            }
        }

        if (diamondCount < MULTI_CONFIG.custoDiamantes) {
            player.sendMessage(`§e[Multiplicador x10] §cPrecisa de ${MULTI_CONFIG.custoDiamantes} diamantes! (voce tem ${diamondCount})`);
            return;
        }

        // --- Tudo OK, processar multiplicacao ---

        // Guardar clone do item (1 unidade)
        const itemClone = held.clone();
        itemClone.amount = 1;

        // Consumir 1 item da mao
        if (held.amount > 1) {
            held.amount -= 1;
            container.setItem(slot, held);
        } else {
            container.setItem(slot, undefined);
        }

        // Consumir os diamantes
        let toConsume = MULTI_CONFIG.custoDiamantes;
        for (const i of diamondSlots) {
            if (toConsume <= 0) break;
            const item = container.getItem(i);
            if (!item) continue;
            if (item.amount <= toConsume) {
                toConsume -= item.amount;
                container.setItem(i, undefined);
            } else {
                item.amount -= toConsume;
                container.setItem(i, item);
                toConsume = 0;
            }
        }

        // Dar as copias em lotes do tamanho maximo do stack do item.
        // addItem NAO lanca erro quando nao cabe: devolve o que sobrou.
        const porStack = Math.max(1, Math.min(MULTI_CONFIG.copias, itemClone.maxAmount));
        let restantes = MULTI_CONFIG.copias;
        while (restantes > 0) {
            const lote = itemClone.clone();
            lote.amount = Math.min(porStack, restantes);
            restantes -= lote.amount;
            let sobra;
            try { sobra = container.addItem(lote); } catch (e) { sobra = lote; }
            if (sobra) {
                // Inventario cheio: spawna no chao
                try { player.dimension.spawnItem(sobra, player.location); } catch (e2) {}
            }
        }

        // Efeitos visuais + sonoros
        const loc = block.location;
        try {
            player.dimension.playSound("random.levelup", {
                x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5
            });
            for (let i = 0; i < 10; i++) {
                player.dimension.spawnParticle("minecraft:villager_happy", {
                    x: loc.x + 0.5 + (Math.random() - 0.5) * 0.8,
                    y: loc.y + 1.0 + Math.random() * 0.5,
                    z: loc.z + 0.5 + (Math.random() - 0.5) * 0.8
                });
            }
        } catch (e) {}

        player.sendMessage(`§e[Multiplicador x10] §a${itemClone.typeId.replace("minecraft:", "")} multiplicado x${MULTI_CONFIG.copias}!`);
    } catch (e) {}
}

// Retorna true se este clique deve ser processado (evita disparo duplo no mesmo tick)
function multiRegistrarClique(player) {
    const agora = system.currentTick;
    if (multiUltimoUso.get(player.id) === agora) return false;
    multiUltimoUso.set(player.id, agora);
    return true;
}

// Preferir o beforeEvent: cancela a interacao vanilla (ex.: colocar o bloco segurado).
// Se a API nao existir nesta versao, cai no afterEvent (sem cancelamento).
let multiUsouBeforeEvent = false;
try {
    if (world.beforeEvents && world.beforeEvents.playerInteractWithBlock) {
        world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
            try {
                if (event.block.typeId !== MULTI_CONFIG.blocoId) return;
                event.cancel = true;
                const player = event.player;
                const block = event.block;
                if (!multiRegistrarClique(player)) return;
                system.run(() => multiProcessar(player, block));
            } catch (e) {}
        });
        multiUsouBeforeEvent = true;
    }
} catch (e) {}

if (!multiUsouBeforeEvent) {
    world.afterEvents.playerInteractWithBlock.subscribe((event) => {
        try {
            if (event.block.typeId !== MULTI_CONFIG.blocoId) return;
            if (!multiRegistrarClique(event.player)) return;
            multiProcessar(event.player, event.block);
        } catch (e) {}
    });
}

world.afterEvents.playerLeave.subscribe((event) => {
    multiUltimoUso.delete(event.playerId);
});

// ████████████████████████████████████████████████████████████████
// ██  3. ARMADURA DE SLIME v2                                    ██
// ████████████████████████████████████████████████████████████████

// === IDS DAS PECAS ===
const SLIME_IDS = {
    head:  "slime_armor:capacete_slime",
    chest: "slime_armor:peitoral_slime",
    legs:  "slime_armor:calcas_slime",
    feet:  "slime_armor:botas_slime"
};

// === CONFIGURACAO ===
const SLIME_CONFIG = {
    // Repulsao de ataque (3+ pecas)
    repulsionForce: 3.5,
    repulsionUpward: 0.8,
    slownessDuration: 60,       // 3 segundos
    slownessAmplifier: 1,

    // Saltos progressivos (4 pecas, set completo)
    bounceInitial: 0.6,
    bounceIncrement: 0.04,
    bounceMax: 2.5,
    bounceStartDelay: 20,       // ticks antes de comecar a crescer
    bounceForwardPush: 0.3,

    // Super quique ao cair (4 pecas)
    superBounceMinFall: 3,      // blocos minimos de queda
    superBounceMultiplier: 0.35,
    superBounceMax: 2.5,

    // Imunidade a queda (2+ pecas)
    fallResistanceAmplifier: 4, // nivel 5 = imunidade total
    fallVelocityThreshold: -0.5,

    // === NOVAS FEATURES v2 ===

    // Agachar para reduzir quique (4 pecas)
    sneakBounceMultiplier: 0.15,
    sneakSuperBounceMultiplier: 0.2,

    // Grudar no teto (4 pecas)
    ceilingStuckDuration: 60,       // 3 segundos grudado no teto
    ceilingMinFallDist: 5,          // queda minima para ativar grude

    // Folhas grudadas (2+ pecas)
    leavesStickChance: 0.30,        // 30% de chance
    leavesStuckDuration: 600,       // 30 segundos (em ticks)
    leavesSlownessAmplifier: 0,     // lentidao leve
    leavesCooldown: 200,            // cooldown entre ativacoes (10s)

    // Arremesso ao atacar (4 pecas)
    flingChance: 0.10,              // 10% de chance
    flingForce: 2.5,
    flingUpward: 0.5,
    flingDetectTicks: 40,           // 2 segundos para detectar colisao
    stuckTogetherDuration: 100,     // 5 segundos grudados
    stuckSlownessAmplifier: 3
};

// === ESTADO POR JOGADOR ===
const slimePlayerState = new Map();

// === FUNCOES AUXILIARES ===

function countSlimePieces(player) {
    try {
        const equip = player.getComponent("minecraft:equippable");
        if (!equip) return 0;
        let count = 0;
        if (equip.getEquipment(EquipmentSlot.Head)?.typeId === SLIME_IDS.head) count++;
        if (equip.getEquipment(EquipmentSlot.Chest)?.typeId === SLIME_IDS.chest) count++;
        if (equip.getEquipment(EquipmentSlot.Legs)?.typeId === SLIME_IDS.legs) count++;
        if (equip.getEquipment(EquipmentSlot.Feet)?.typeId === SLIME_IDS.feet) count++;
        return count;
    } catch (e) {
        return 0;
    }
}

function getOrCreateSlimeState(player) {
    let state = slimePlayerState.get(player.id);
    if (!state) {
        state = {
            // Existentes
            bounceHeight: SLIME_CONFIG.bounceInitial,
            ticksSprinting: 0,
            isFalling: false,
            fallStartY: player.location.y,

            // Grudar no teto
            stuckOnCeiling: false,
            ceilingStuckTicks: 0,
            lastVelY: 0,
            superBounceFallDist: 0,

            // Folhas grudadas
            leavesStuck: false,
            leavesStuckTicks: 0,
            leavesCooldown: 0,

            // Arremesso ao atacar
            isFlungBack: false,
            flungBackTicks: 0,

            // Grudado com mob
            stuckWithMobId: null,
            stuckWithMobTicks: 0
        };
        slimePlayerState.set(player.id, state);
    }
    return state;
}

// Verifica se um bloco e do tipo folha
function slimeIsLeafBlock(block) {
    if (!block) return false;
    const id = block.typeId;
    return id.includes("leaves");
}

// Verifica se ha bloco solido acima da cabeca do jogador
function slimeHasCeilingAbove(player) {
    try {
        const loc = player.location;
        const block = player.dimension.getBlock({
            x: Math.floor(loc.x),
            y: Math.floor(loc.y + 2),
            z: Math.floor(loc.z)
        });
        return block && !block.isAir && !block.isLiquid;
    } catch (e) {
        return false;
    }
}

// Verifica se o jogador esta tocando folhas (blocos ao redor)
function slimeIsTouchingLeaves(player) {
    try {
        const loc = player.location;
        const dim = player.dimension;
        const offsets = [
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 },
            { x: 1, y: 0, z: 0 },
            { x: -1, y: 0, z: 0 },
            { x: 0, y: 0, z: 1 },
            { x: 0, y: 0, z: -1 },
            { x: 1, y: 1, z: 0 },
            { x: -1, y: 1, z: 0 },
            { x: 0, y: 1, z: 1 },
            { x: 0, y: 1, z: -1 }
        ];
        for (const off of offsets) {
            const block = dim.getBlock({
                x: Math.floor(loc.x + off.x * 0.4),
                y: Math.floor(loc.y + off.y),
                z: Math.floor(loc.z + off.z * 0.4)
            });
            if (slimeIsLeafBlock(block)) return true;
        }
    } catch (e) { }
    return false;
}

// ============================================================
//  LOOP PRINCIPAL - a cada 4 ticks
//  Particulas, veneno, saltos progressivos, folhas grudadas
// ============================================================
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const pieces = countSlimePieces(player);

        if (pieces === 0) {
            // Limpar efeitos residuais dos estados ativos antes de descartar o estado
            const antigo = slimePlayerState.get(player.id);
            if (antigo) {
                try {
                    if (antigo.leavesStuck || antigo.stuckWithMobId) player.removeEffect("slowness");
                    if (antigo.stuckOnCeiling) player.removeEffect("levitation");
                } catch (e) { }
            }
            slimePlayerState.delete(player.id);
            continue;
        }

        const state = getOrCreateSlimeState(player);
        const loc = player.location;
        const dim = player.dimension;

        // Menos de 4 pecas: liberar grude no teto e zerar memoria de queda
        if (pieces < 4) {
            if (state.stuckOnCeiling) {
                state.stuckOnCeiling = false;
                state.ceilingStuckTicks = 0;
                try { player.removeEffect("levitation"); } catch (e) { }
            }
            state.superBounceFallDist = 0;
        }

        // --- 1+ PECAS: Particulas verdes de slime ---
        try {
            for (let i = 0; i < pieces; i++) {
                dim.spawnParticle("minecraft:villager_happy", {
                    x: loc.x + (Math.random() - 0.5) * 1.5,
                    y: loc.y + Math.random() * 1.8,
                    z: loc.z + (Math.random() - 0.5) * 1.5
                });
            }
        } catch (e) { }

        // --- 2+ PECAS: Resistencia a veneno ---
        if (pieces >= 2) {
            try {
                const poison = player.getEffect("poison");
                if (poison) player.removeEffect("poison");
            } catch (e) { }
        }

        // --- 2+ PECAS: Folhas grudadas ---
        if (pieces >= 2) {
            // Decrementar cooldown
            if (state.leavesCooldown > 0) {
                state.leavesCooldown -= 4;
            }

            if (state.leavesStuck) {
                // Particulas de folha enquanto grudado
                state.leavesStuckTicks -= 4;
                try {
                    dim.spawnParticle("minecraft:crop_growth_emitter", {
                        x: loc.x,
                        y: loc.y + 1.0,
                        z: loc.z
                    });
                } catch (e) { }

                // Manter lentidao ativa
                if (state.leavesStuckTicks % 40 < 4) {
                    try {
                        player.addEffect("slowness", 60, {
                            amplifier: SLIME_CONFIG.leavesSlownessAmplifier,
                            showParticles: false
                        });
                    } catch (e) { }
                }

                // Expirou
                if (state.leavesStuckTicks <= 0) {
                    state.leavesStuck = false;
                    state.leavesCooldown = SLIME_CONFIG.leavesCooldown;
                    try {
                        // So remove a lentidao se o grude com mob nao estiver ativo
                        if (!state.stuckWithMobId) player.removeEffect("slowness");
                        player.sendMessage("\u00a7aAs folhas se soltaram!");
                    } catch (e) { }
                }
            } else if (state.leavesCooldown <= 0 && slimeIsTouchingLeaves(player)) {
                // Chance de folhas grudarem
                if (Math.random() < SLIME_CONFIG.leavesStickChance) {
                    state.leavesStuck = true;
                    state.leavesStuckTicks = SLIME_CONFIG.leavesStuckDuration;
                    try {
                        player.addEffect("slowness", SLIME_CONFIG.leavesStuckDuration, {
                            amplifier: SLIME_CONFIG.leavesSlownessAmplifier,
                            showParticles: false
                        });
                        dim.playSound("mob.slime.small", loc);
                        player.sendMessage("\u00a72Folhas grudaram em voce!");
                    } catch (e) { }
                }
            }
        }

        // --- 4 PECAS (SET COMPLETO): Saltos progressivos ao correr ---
        // FEATURE: Agachar reduz o bounceHeight gradualmente (freio)
        if (pieces === 4 && player.isSneaking) {
            // Agachando = freia o pulo rapidamente
            state.bounceHeight = Math.max(
                state.bounceHeight * 0.5,   // Reduz 50% a cada tick
                0.0                          // Para completamente
            );
            if (state.bounceHeight < 0.1) {
                state.bounceHeight = 0;
                state.ticksSprinting = 0;
            }
        } else if (pieces === 4 && player.isSprinting) {
            state.ticksSprinting += 4;

            // Aumenta gradualmente a altura do salto
            if (state.ticksSprinting > SLIME_CONFIG.bounceStartDelay) {
                state.bounceHeight = Math.min(
                    state.bounceHeight + SLIME_CONFIG.bounceIncrement,
                    SLIME_CONFIG.bounceMax
                );
            }

            // Aplica o pulo quando toca o chao
            if (player.isOnGround && !state.stuckOnCeiling) {
                try {
                    const viewDir = player.getViewDirection();
                    let finalBounce = state.bounceHeight;
                    let finalPush = SLIME_CONFIG.bounceForwardPush;

                    player.applyKnockback(
                        viewDir.x, viewDir.z,
                        finalPush,
                        finalBounce
                    );

                    // Som de slime proporcional ao salto
                    if (finalBounce > 1.0) {
                        dim.playSound("mob.slime.big", loc);
                    } else if (finalBounce > 0) {
                        dim.playSound("mob.slime.small", loc);
                    }
                } catch (e) { }
            }
        } else if (!state.stuckOnCeiling) {
            // Reset quando para de correr
            state.bounceHeight = SLIME_CONFIG.bounceInitial;
            state.ticksSprinting = 0;
        }

        // --- 4 PECAS: Grudado com mob (manter mob perto) ---
        if (state.stuckWithMobId && state.stuckWithMobTicks > 0) {
            state.stuckWithMobTicks -= 4;
            try {
                const entities = dim.getEntities({
                    location: loc,
                    maxDistance: 20
                });
                const stuckMob = entities.find(e => e.id === state.stuckWithMobId);
                if (stuckMob) {
                    // Teleportar mob para ficar colado ao jogador
                    const viewDir = player.getViewDirection();
                    stuckMob.teleport({
                        x: loc.x + viewDir.x * 0.8,
                        y: loc.y,
                        z: loc.z + viewDir.z * 0.8
                    });
                    // Particulas de slime entre ambos
                    dim.spawnParticle("minecraft:villager_happy", {
                        x: (loc.x + stuckMob.location.x) / 2,
                        y: loc.y + 0.5,
                        z: (loc.z + stuckMob.location.z) / 2
                    });
                } else {
                    // Mob sumiu, liberar
                    state.stuckWithMobId = null;
                    state.stuckWithMobTicks = 0;
                }
            } catch (e) {
                state.stuckWithMobId = null;
                state.stuckWithMobTicks = 0;
            }

            // Expirou
            if (state.stuckWithMobTicks <= 0) {
                try {
                    player.sendMessage("\u00a7aVoce se desgrudou do mob!");
                    // So remove a lentidao se as folhas nao estiverem grudadas
                    if (!state.leavesStuck) player.removeEffect("slowness");
                } catch (e) { }
                state.stuckWithMobId = null;
                state.stuckWithMobTicks = 0;
            }
        }
    }
}, 4);

// ============================================================
//  PROTECAO CONTRA QUEDA + TETO - a cada 2 ticks
//  Detecta queda, aplica resistencia, super quique e grude no teto
// ============================================================
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const pieces = countSlimePieces(player);
        if (pieces < 2) continue;

        const state = slimePlayerState.get(player.id);
        if (!state) continue;

        const vel = player.getVelocity();
        const loc = player.location;
        const dim = player.dimension;

        // === GRUDAR NO TETO (4 pecas) ===
        if (pieces === 4 && state.stuckOnCeiling) {
            state.ceilingStuckTicks -= 2;

            // Manter jogador "grudado" aplicando levitacao leve
            try {
                player.addEffect("levitation", 4, {
                    amplifier: 0,
                    showParticles: false
                });
                // Particulas no teto
                dim.spawnParticle("minecraft:villager_happy", {
                    x: loc.x + (Math.random() - 0.5) * 0.5,
                    y: loc.y + 2.0,
                    z: loc.z + (Math.random() - 0.5) * 0.5
                });
            } catch (e) { }

            // Soltar do teto: tempo expirou OU jogador agachou
            if (state.ceilingStuckTicks <= 0 || player.isSneaking) {
                state.stuckOnCeiling = false;
                state.ceilingStuckTicks = 0;
                try {
                    player.removeEffect("levitation");
                    dim.playSound("mob.slime.big", loc);
                    player.sendMessage("\u00a7aVoce se soltou do teto!");
                } catch (e) { }
            }

            state.lastVelY = vel.y;
            continue; // Pular logica de queda enquanto grudado
        }

        // Rastrear inicio da queda
        if (vel.y < -0.3 && !player.isOnGround) {
            if (!state.isFalling) {
                state.isFalling = true;
                state.fallStartY = loc.y;
            }
        }

        // Detectar pouso - super quique com set completo
        if (state.isFalling && player.isOnGround) {
            const fallDist = state.fallStartY - loc.y;
            state.isFalling = false;

            // Pouso sem super quique: nao deixa memoria de queda para o grude no teto
            state.superBounceFallDist = 0;

            // 4 PECAS: Quica de volta proporcional a queda
            if (pieces === 4 && fallDist > SLIME_CONFIG.superBounceMinFall) {
                let bounceForce = Math.min(
                    fallDist * SLIME_CONFIG.superBounceMultiplier,
                    SLIME_CONFIG.superBounceMax
                );

                // FEATURE 1: Agachar reduz o super quique
                if (player.isSneaking) {
                    bounceForce *= SLIME_CONFIG.sneakSuperBounceMultiplier;
                }

                // Guardar distancia de queda para deteccao de teto
                state.superBounceFallDist = fallDist;

                system.run(() => {
                    try {
                        player.applyKnockback(0, 0, 0, bounceForce);
                        if (bounceForce > 1.0) {
                            player.dimension.playSound("mob.slime.big", player.location);
                        } else {
                            player.dimension.playSound("mob.slime.small", player.location);
                        }
                    } catch (e) { }
                });
            }
        }

        // === FEATURE 2: Detectar colisao com teto ===
        if (pieces === 4 && !state.stuckOnCeiling) {
            // Estava subindo rapido e de repente parou/desceu = bateu no teto
            if (state.lastVelY > 0.3 && vel.y <= 0.05 && !player.isOnGround) {
                if (state.superBounceFallDist >= SLIME_CONFIG.ceilingMinFallDist && slimeHasCeilingAbove(player)) {
                    state.stuckOnCeiling = true;
                    state.ceilingStuckTicks = SLIME_CONFIG.ceilingStuckDuration;
                    state.superBounceFallDist = 0;
                    try {
                        dim.playSound("mob.slime.squish", loc);
                        player.sendMessage("\u00a72Voce grudou no teto! Agache para soltar.");
                    } catch (e) { }
                }
            }
        }

        // Imunidade a dano de queda via efeito de resistencia
        if (vel.y < SLIME_CONFIG.fallVelocityThreshold) {
            try {
                player.addEffect("resistance", 8, {
                    amplifier: SLIME_CONFIG.fallResistanceAmplifier,
                    showParticles: false
                });
            } catch (e) { }
        }

        state.lastVelY = vel.y;
    }
}, 2);

// ============================================================
//  DETECCAO DE ARREMESSO - a cada 2 ticks
//  Verifica se jogador arremessado colidiu com mob
// ============================================================
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const state = slimePlayerState.get(player.id);
        if (!state || !state.isFlungBack) continue;

        state.flungBackTicks -= 2;
        const loc = player.location;
        const dim = player.dimension;

        // Procurar mobs proximos para grudar
        try {
            const nearbyMobs = dim.getEntities({
                location: loc,
                maxDistance: 1.5,
                families: ["mob"],
                excludeTypes: ["minecraft:player", "minecraft:item"]
            });

            if (nearbyMobs.length > 0) {
                const mob = nearbyMobs[0];
                state.isFlungBack = false;
                state.flungBackTicks = 0;
                state.stuckWithMobId = mob.id;
                state.stuckWithMobTicks = SLIME_CONFIG.stuckTogetherDuration;

                // Aplicar lentidao pesada em ambos
                try {
                    player.addEffect("slowness", SLIME_CONFIG.stuckTogetherDuration, {
                        amplifier: SLIME_CONFIG.stuckSlownessAmplifier,
                        showParticles: true
                    });
                    mob.addEffect("slowness", SLIME_CONFIG.stuckTogetherDuration, {
                        amplifier: SLIME_CONFIG.stuckSlownessAmplifier,
                        showParticles: true
                    });
                } catch (e) { }

                dim.playSound("mob.slime.squish", loc);
                player.sendMessage("\u00a74Voce grudou no mob!");

                // Particulas de impacto
                for (let i = 0; i < 8; i++) {
                    dim.spawnParticle("minecraft:villager_happy", {
                        x: loc.x + (Math.random() - 0.5),
                        y: loc.y + Math.random() * 1.5,
                        z: loc.z + (Math.random() - 0.5)
                    });
                }
            }
        } catch (e) { }

        // Tempo de deteccao expirou
        if (state.flungBackTicks <= 0) {
            state.isFlungBack = false;
            state.flungBackTicks = 0;
        }
    }
}, 2);

// ============================================================
//  REPULSAO DE ATAQUES - 3+ pecas
//  Atacantes sao arremessados para tras e ficam lentos
//  ARREMESSO DO JOGADOR - 4 pecas, 10% chance
// ============================================================
world.afterEvents.entityHitEntity.subscribe((event) => {
    const target = event.hitEntity;
    const attacker = event.damagingEntity;

    if (!target || !attacker) return;

    // --- REPULSAO: jogador e o ALVO (3+ pecas) ---
    if (target.typeId === "minecraft:player") {
        const pieces = countSlimePieces(target);
        if (pieces >= 3) {
            const dx = attacker.location.x - target.location.x;
            const dz = attacker.location.z - target.location.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist > 0.01) {
                const nx = dx / dist;
                const nz = dz / dist;

                try {
                    attacker.applyKnockback(
                        nx, nz,
                        SLIME_CONFIG.repulsionForce,
                        SLIME_CONFIG.repulsionUpward
                    );
                } catch (e) { }

                try {
                    attacker.addEffect("slowness", SLIME_CONFIG.slownessDuration, {
                        amplifier: SLIME_CONFIG.slownessAmplifier,
                        showParticles: true
                    });
                } catch (e) { }

                try {
                    target.dimension.playSound("mob.slime.big", target.location);
                } catch (e) { }
            }
        }
    }

    // --- FEATURE 4: ARREMESSO ao atacar (jogador e o ATACANTE, 4 pecas) ---
    if (attacker.typeId === "minecraft:player") {
        const pieces = countSlimePieces(attacker);
        if (pieces === 4) {
            const state = getOrCreateSlimeState(attacker);

            // Nao ativar se ja esta grudado com mob ou sendo arremessado
            if (state.isFlungBack || state.stuckWithMobId) return;

            if (Math.random() < SLIME_CONFIG.flingChance) {
                // Direcao oposta ao ataque (do mob para o jogador = para tras)
                const dx = attacker.location.x - target.location.x;
                const dz = attacker.location.z - target.location.z;
                const dist = Math.sqrt(dx * dx + dz * dz);

                if (dist > 0.01) {
                    const nx = dx / dist;
                    const nz = dz / dist;

                    try {
                        attacker.applyKnockback(
                            nx, nz,
                            SLIME_CONFIG.flingForce,
                            SLIME_CONFIG.flingUpward
                        );
                    } catch (e) { }

                    state.isFlungBack = true;
                    state.flungBackTicks = SLIME_CONFIG.flingDetectTicks;

                    try {
                        attacker.dimension.playSound("mob.slime.big", attacker.location);
                        attacker.sendMessage("\u00a7cO slime te arremessou!");
                    } catch (e) { }
                }
            }
        }
    }
});

// ============================================================
//  LIMPEZA - remove estado quando jogador desconecta
// ============================================================
world.afterEvents.playerLeave.subscribe((event) => {
    slimePlayerState.delete(event.playerId);
});

// ████████████████████████████████████████████████████████████████
// ██  4. PISTOLA LASER & RIFLE SNIPER                            ██
// ████████████████████████████████████████████████████████████████

// ==== CONFIGURACAO ====
const LASER_CONFIG = {
    intervaloLuneta: 4,         // ticks entre atualizacoes da mira da luneta

    // Pistola Laser
    identificadorPistola: "pistola_laser:pistola",
    identificadorMunicao: "pistola_laser:municao_laser",
    identificadorProjetil: "pistola_laser:laser_projetil",

    // Rifle Sniper
    identificadorSniper: "pistola_laser:rifle_sniper",
    identificadorMunicaoSniper: "pistola_laser:municao_sniper",
    identificadorProjetilSniper: "pistola_laser:sniper_projetil",

    // Luneta
    fovZoom: 15,                // FOV ao mirar (normal ~80, menor = mais zoom)
    fovNormal: 80,              // FOV padrao
    tempoTransicao: 0.15,       // segundos para transicao suave do zoom
};

// ==== ESTADO ====
const laserJogadorMirando = new Map();       // player.id -> boolean
const laserJogadorInicioMira = new Map();    // player.id -> tick de inicio
const laserJogadorAvisadoZoom = new Set();   // player.id - ja recebeu aviso de Beta APIs

// ==== FUNCAO: CONTAR MUNICAO ====
function laserContarMunicao(jogador, tipoMunicao) {
    try {
        const inventario = jogador.getComponent("minecraft:inventory");
        if (!inventario) return 0;

        const container = inventario.container;
        let total = 0;

        for (let i = 0; i < container.size; i++) {
            try {
                const slot = container.getItem(i);
                if (slot && slot.typeId === tipoMunicao) {
                    total += slot.amount;
                }
            } catch (e) {}
        }
        return total;
    } catch (e) {
        return 0;
    }
}

// ==== FUNCAO: ATIVAR ZOOM (Camera API - nao interfere com shooter) ====
function laserAtivarZoom(jogador) {
    try {
        jogador.camera.setFov({
            fov: LASER_CONFIG.fovZoom,
            easeOptions: {
                easeTime: LASER_CONFIG.tempoTransicao,
                easeType: "Linear"
            }
        });
    } catch (e) {
        if (!laserJogadorAvisadoZoom.has(jogador.id)) {
            laserJogadorAvisadoZoom.add(jogador.id);
            try {
                jogador.sendMessage("§cZoom indisponível - habilite Beta APIs nas configurações do mundo");
            } catch (e2) {}
        }
    }
}

// ==== FUNCAO: DESATIVAR ZOOM ====
function laserDesativarZoom(jogador) {
    try {
        jogador.camera.setFov({
            fov: LASER_CONFIG.fovNormal,
            easeOptions: {
                easeTime: LASER_CONFIG.tempoTransicao,
                easeType: "Linear"
            }
        });
    } catch (e) {}
}

// ==== LOOP: HUD DE MUNICAO (PISTOLA) + MIRA DA LUNETA (SNIPER) ====
system.runInterval(() => {
    try {
        const jogadores = world.getAllPlayers();

        for (const jogador of jogadores) {
            try {
                const equipamento = jogador.getComponent("minecraft:equippable");
                if (!equipamento) continue;

                const itemMao = equipamento.getEquipment(EquipmentSlot.Mainhand);
                const tipoItem = itemMao ? itemMao.typeId : null;

                // Estado de mira preso (morte/teleporte com o botao pressionado): resetar
                if (tipoItem !== LASER_CONFIG.identificadorSniper && laserJogadorMirando.get(jogador.id)) {
                    laserJogadorMirando.set(jogador.id, false);
                    laserDesativarZoom(jogador);
                }

                if (!itemMao) continue;

                // Se esta mirando com sniper, mostra HUD da luneta
                if (tipoItem === LASER_CONFIG.identificadorSniper && laserJogadorMirando.get(jogador.id)) {
                    const totalMunicao = laserContarMunicao(jogador, LASER_CONFIG.identificadorMunicaoSniper);
                    const tickInicio = laserJogadorInicioMira.get(jogador.id) || system.currentTick;
                    const tempoMirando = system.currentTick - tickInicio;

                    // Barra de carga - 1.0s = 20 ticks (max_draw_duration do item)
                    let cargaPct = Math.min(tempoMirando / 20, 1.0);
                    let barraCheia = Math.floor(cargaPct * 8);
                    let corBarra = cargaPct >= 1.0 ? "§a" : "§e";
                    let barra = corBarra + "█".repeat(barraCheia) + "§8" + "░".repeat(8 - barraCheia);

                    let corMunicao = totalMunicao > 0 ? "§b" : "§4";
                    let statusCarga = cargaPct >= 1.0 ? "§a§lPRONTO" : "§eCarregando...";

                    jogador.onScreenDisplay.setActionBar(
                        `§l§3«§f ⊕ §3»§r  ${barra}  ${statusCarga}  ${corMunicao}${totalMunicao}`
                    );
                    continue;
                }

                // HUD normal de municao (pistola ou sniper sem mirar)
                let tipoMunicao = null;
                let nomeArma = "";

                if (tipoItem === LASER_CONFIG.identificadorPistola) {
                    tipoMunicao = LASER_CONFIG.identificadorMunicao;
                    nomeArma = "Pistola";
                } else if (tipoItem === LASER_CONFIG.identificadorSniper) {
                    tipoMunicao = LASER_CONFIG.identificadorMunicaoSniper;
                    nomeArma = "Sniper";
                } else {
                    continue;
                }

                const totalMunicao = laserContarMunicao(jogador, tipoMunicao);

                let cor = "§a";
                if (totalMunicao <= 8) cor = "§e";
                if (totalMunicao <= 3) cor = "§c";
                if (totalMunicao === 0) cor = "§4";

                const mensagem = totalMunicao > 0
                    ? `${cor}⚡ ${nomeArma}: ${totalMunicao} munição`
                    : `§4⚡ SEM MUNIÇÃO! Crafta mais`;

                jogador.onScreenDisplay.setActionBar(mensagem);
            } catch (e) {}
        }
    } catch (e) {}
}, LASER_CONFIG.intervaloLuneta);

// ==== EVENTO: COMECOU A MIRAR (segurando botao) ====
world.afterEvents.itemStartUse.subscribe((evento) => {
    try {
        const jogador = evento.source;
        const item = evento.itemStack;

        if (!item || item.typeId !== LASER_CONFIG.identificadorSniper) return;

        // Marcar que esta mirando
        laserJogadorMirando.set(jogador.id, true);
        laserJogadorInicioMira.set(jogador.id, system.currentTick);

        // Zoom via Camera API (NAO usa Slowness!)
        laserAtivarZoom(jogador);

        // Som de ativar luneta
        try {
            jogador.playSound("armor.equip_iron", { volume: 0.3, pitch: 1.5 });
        } catch (e) {}
    } catch (e) {}
});

// ==== EVENTO: CANCELOU MIRA (soltou sem atirar/trocou item) ====
world.afterEvents.itemStopUse.subscribe((evento) => {
    try {
        const jogador = evento.source;

        if (laserJogadorMirando.get(jogador.id)) {
            laserJogadorMirando.set(jogador.id, false);
            laserDesativarZoom(jogador);
        }
    } catch (e) {}
});

// ==== EVENTO: DISPARO (soltou o botao = atirou) ====
world.afterEvents.itemReleaseUse.subscribe((evento) => {
    try {
        const jogador = evento.source;
        const item = evento.itemStack;
        if (!item) return;

        const tipoItem = item.typeId;

        // Pistola Laser - disparo rapido
        if (tipoItem === LASER_CONFIG.identificadorPistola) {
            try {
                jogador.playSound("firework.blast", { volume: 0.5, pitch: 1.8 });
            } catch (e) {}
        }

        // Rifle Sniper - disparo poderoso + desativar zoom
        if (tipoItem === LASER_CONFIG.identificadorSniper) {
            laserJogadorMirando.set(jogador.id, false);
            laserDesativarZoom(jogador);

            try {
                jogador.playSound("firework.large_blast", { volume: 0.8, pitch: 0.6 });
            } catch (e) {}
            try {
                jogador.onScreenDisplay.setActionBar("§l§3⚡ DISPARO! ⚡");
            } catch (e) {}
        }
    } catch (e) {}
});

// ==== EVENTO: PROJETIL ACERTA ENTIDADE ====
// projectileHitEntity e o evento correto para projeteis (entityHitEntity so cobre corpo a corpo)
world.afterEvents.projectileHitEntity.subscribe((evento) => {
    try {
        let tipoProjetil = null;
        try { tipoProjetil = evento.projectile ? evento.projectile.typeId : null; } catch (e) {}
        if (!tipoProjetil) return;

        const dim = evento.dimension;
        const pos = evento.location;

        // Projetil da Pistola Laser
        if (tipoProjetil === LASER_CONFIG.identificadorProjetil) {
            try {
                dim.spawnParticle("minecraft:basic_flame_particle", {
                    x: pos.x, y: pos.y + 0.5, z: pos.z
                });
            } catch (e) {}
            try {
                dim.playSound("random.fizz", pos, { volume: 0.8, pitch: 1.5 });
            } catch (e) {}
        }

        // Projetil do Sniper
        if (tipoProjetil === LASER_CONFIG.identificadorProjetilSniper) {
            try {
                dim.spawnParticle("minecraft:critical_hit_emitter", {
                    x: pos.x, y: pos.y + 0.5, z: pos.z
                });
                dim.spawnParticle("minecraft:endrod", {
                    x: pos.x, y: pos.y + 1.0, z: pos.z
                });
            } catch (e) {}
            try {
                dim.playSound("random.explode", pos, { volume: 0.6, pitch: 1.2 });
            } catch (e) {}
        }
    } catch (e) {}
});

// ==== EVENTO: RESPAWN - limpa estado de mira ====
world.afterEvents.playerSpawn.subscribe((evento) => {
    try {
        const jogador = evento.player;
        if (laserJogadorMirando.get(jogador.id)) {
            laserJogadorMirando.set(jogador.id, false);
            laserDesativarZoom(jogador);
        }
    } catch (e) {}
});

// ==== LIMPEZA: JOGADOR SAI ====
world.afterEvents.playerLeave.subscribe((evento) => {
    laserJogadorMirando.delete(evento.playerId);
    laserJogadorInicioMira.delete(evento.playerId);
    laserJogadorAvisadoZoom.delete(evento.playerId);
});

// ████████████████████████████████████████████████████████████████
// ██  5. CACTUS ZUMBI                                            ██
// ████████████████████████████████████████████████████████████████

// ==== CONFIGURACAO ====
const CACTUS_CONFIG = {
    raioDeteccaoCactus: 2,
    intervaloTracking: 2,
    limiteVelocidade: 0.05,
    timeoutProjetil: 200,
    danoEspinhos: 2,
    regeneracaoAreia: 1,
    intervaloAmbiental: 20,
    danoExplosaoMorte: 3,
    raioExplosaoMorte: 3,
    chancePlantarCactus: 0.05,
};

// ==== ESTADO ====
const cactusPocaoData = new Map();
const cactusProcessedPocoes = new Set();

// ==== LOOP: TRACKING DE PROJETEIS ====
system.runInterval(() => {
    const nomeDimensoes = ["overworld", "nether", "the_end"];
    const idsVivos = new Set();

    for (const nomeDim of nomeDimensoes) {
        try {
            const dim = world.getDimension(nomeDim);
            const pocoes = dim.getEntities({ type: "cactus_zumbi:pocao_projetil" });

            for (const pocao of pocoes) {
                idsVivos.add(pocao.id);
                if (cactusProcessedPocoes.has(pocao.id)) continue;

                const loc = pocao.location;

                // Primeiro registro
                if (!cactusPocaoData.has(pocao.id)) {
                    cactusPocaoData.set(pocao.id, {
                        tickSpawn: system.currentTick,
                        ultimoX: loc.x,
                        ultimoY: loc.y,
                        ultimoZ: loc.z,
                    });
                    continue;
                }

                const dados = cactusPocaoData.get(pocao.id);
                const idade = system.currentTick - dados.tickSpawn;

                // Calcular velocidade
                const dx = loc.x - dados.ultimoX;
                const dy = loc.y - dados.ultimoY;
                const dz = loc.z - dados.ultimoZ;
                const velocidade = Math.sqrt(dx * dx + dy * dy + dz * dz);

                dados.ultimoX = loc.x;
                dados.ultimoY = loc.y;
                dados.ultimoZ = loc.z;

                // Timeout
                if (idade > CACTUS_CONFIG.timeoutProjetil) {
                    cactusProcessedPocoes.add(pocao.id);
                    try { pocao.kill(); } catch (e) {}
                    continue;
                }

                // Ainda se movendo
                if (velocidade > CACTUS_CONFIG.limiteVelocidade) continue;

                // Parou! Procurar cactus
                cactusProcessedPocoes.add(pocao.id);
                cactusProcessarImpactoPocao(dim, loc, pocao);
            }
        } catch (e) {}
    }

    // Limpeza de dados de projeteis mortos
    for (const [id] of cactusPocaoData) {
        if (!idsVivos.has(id)) {
            cactusPocaoData.delete(id);
            cactusProcessedPocoes.delete(id);
        }
    }
}, CACTUS_CONFIG.intervaloTracking);

// ==== FUNCAO: PROCESSAR IMPACTO DA POCAO ====
function cactusProcessarImpactoPocao(dim, loc, pocao) {
    const raio = CACTUS_CONFIG.raioDeteccaoCactus;
    const cx = Math.floor(loc.x);
    const cy = Math.floor(loc.y);
    const cz = Math.floor(loc.z);

    for (let x = cx - raio; x <= cx + raio; x++) {
        for (let y = cy - raio; y <= cy + raio; y++) {
            for (let z = cz - raio; z <= cz + raio; z++) {
                try {
                    const bloco = dim.getBlock({ x, y, z });
                    if (!bloco || bloco.typeId !== "minecraft:cactus") continue;

                    // Encontrou cactus! Achar topo da coluna
                    let topoY = y;
                    while (true) {
                        try {
                            const acima = dim.getBlock({ x, y: topoY + 1, z });
                            if (acima && acima.typeId === "minecraft:cactus") {
                                topoY++;
                            } else {
                                break;
                            }
                        } catch (e) { break; }
                    }

                    // Verificar se tem flor acima do topo
                    let temFlor = false;
                    try {
                        const blocoAcimaTopo = dim.getBlock({ x, y: topoY + 1, z });
                        if (blocoAcimaTopo) {
                            const tipoAcima = blocoAcimaTopo.typeId;
                            temFlor = tipoAcima.includes("flower") ||
                                      tipoAcima.includes("poppy") ||
                                      tipoAcima.includes("dandelion") ||
                                      tipoAcima.includes("orchid") ||
                                      tipoAcima.includes("tulip") ||
                                      tipoAcima.includes("cornflower") ||
                                      tipoAcima.includes("lily") ||
                                      tipoAcima.includes("sunflower") ||
                                      tipoAcima.includes("rose");
                        }
                    } catch (e) {}

                    // Achar base da coluna de cactus
                    let baseY = y;
                    while (baseY > cy - 10) {
                        try {
                            const abaixo = dim.getBlock({ x, y: baseY - 1, z });
                            if (abaixo && abaixo.typeId === "minecraft:cactus") {
                                baseY--;
                            } else {
                                break;
                            }
                        } catch (e) { break; }
                    }

                    // Remover flor se existia
                    if (temFlor) {
                        try {
                            const blocoFlor = dim.getBlock({ x, y: topoY + 1, z });
                            if (blocoFlor) blocoFlor.setType("minecraft:air");
                        } catch (e) {}
                    }

                    // Remover todos os blocos de cactus da coluna
                    for (let ry = topoY; ry >= baseY; ry--) {
                        try {
                            const blocoCactus = dim.getBlock({ x, y: ry, z });
                            if (blocoCactus) blocoCactus.setType("minecraft:air");
                        } catch (e) {}
                    }

                    // Spawnar Cactus Zumbi
                    const tipoMob = temFlor
                        ? "cactus_zumbi:cactus_zumbi_bom"
                        : "cactus_zumbi:cactus_zumbi_mau";

                    system.run(() => {
                        try {
                            dim.spawnEntity(tipoMob, {
                                x: x + 0.5,
                                y: baseY,
                                z: z + 0.5,
                            });

                            // Particulas de transformacao
                            for (let p = 0; p < 5; p++) {
                                dim.spawnParticle("minecraft:villager_happy", {
                                    x: x + 0.5 + (Math.random() - 0.5),
                                    y: baseY + 1 + Math.random(),
                                    z: z + 0.5 + (Math.random() - 0.5),
                                });
                            }

                            // Som de transformacao
                            dim.playSound("mob.zombie.remedy", {
                                x: x + 0.5,
                                y: baseY + 1,
                                z: z + 0.5,
                            });

                            // Mensagem
                            const nome = temFlor
                                ? "\u00A7aCactus Zumbi Bom"
                                : "\u00A7cCactus Zumbi Mau";
                            world.sendMessage(
                                `\u00A7e[Cactus Zumbi] ${nome}\u00A7e surgiu!`
                            );
                        } catch (e) {}
                    });

                    // Matar projetil
                    try { pocao.kill(); } catch (e) {}
                    return;
                } catch (e) {}
            }
        }
    }

    // Nao encontrou cactus - pocao desperdicada
    try { pocao.kill(); } catch (e) {}
}

// ==== ESPINHOS DE CONTATO ====
world.afterEvents.entityHitEntity.subscribe((evento) => {
    try {
        const atacante = evento.damagingEntity;
        const alvo = evento.hitEntity;

        // Se alguem bateu no cactus zumbi, toma dano de espinhos
        if (alvo && alvo.typeId && alvo.typeId.startsWith("cactus_zumbi:cactus_zumbi")) {
            try {
                atacante.applyDamage(CACTUS_CONFIG.danoEspinhos, { cause: "contact" });

                // Particula de espinho
                const loc = atacante.location;
                const dim = atacante.dimension;
                dim.spawnParticle("minecraft:critical_hit_emitter", loc);
            } catch (e) {}
        }
    } catch (e) {}
});

// ==== EXPLOSAO DE ESPINHOS AO MORRER ====
world.afterEvents.entityDie.subscribe((evento) => {
    try {
        const entidade = evento.deadEntity;
        if (!entidade || !entidade.typeId) return;
        if (!entidade.typeId.startsWith("cactus_zumbi:cactus_zumbi")) return;

        const loc = entidade.location;
        const dim = entidade.dimension;
        const raio = CACTUS_CONFIG.raioExplosaoMorte;

        // Buscar entidades no raio
        const entidadesProximas = dim.getEntities({
            location: loc,
            maxDistance: raio,
        });

        for (const ent of entidadesProximas) {
            try {
                if (ent.id === entidade.id) continue;
                if (!ent.isValid()) continue;

                // Aplicar dano
                ent.applyDamage(CACTUS_CONFIG.danoExplosaoMorte, { cause: "contact" });

                // Aplicar knockback
                const dx = ent.location.x - loc.x;
                const dz = ent.location.z - loc.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist > 0.1) {
                    const forca = 1.5;
                    ent.applyKnockback(dx / dist, dz / dist, forca, 0.4);
                }
            } catch (e) {}
        }

        // Particulas de explosao
        for (let p = 0; p < 10; p++) {
            try {
                dim.spawnParticle("minecraft:critical_hit_emitter", {
                    x: loc.x + (Math.random() - 0.5) * 3,
                    y: loc.y + Math.random() * 2,
                    z: loc.z + (Math.random() - 0.5) * 3,
                });
            } catch (e) {}
        }

        // Som de explosao
        try {
            dim.playSound("random.explode", loc);
        } catch (e) {}
    } catch (e) {}
});

// Ultima posicao (em blocos) de cada cactus zumbi: mob.id -> {x, y, z}
const cactusUltimaPosMob = new Map();

// ==== LOOP AMBIENTAL: REGENERACAO, DANO AGUA, PLANTAR CACTUS ====
system.runInterval(() => {
    const nomeDimensoes = ["overworld", "nether", "the_end"];
    const idsMobsVivos = new Set();

    for (const nomeDim of nomeDimensoes) {
        try {
            const dim = world.getDimension(nomeDim);
            const mobsBom = dim.getEntities({ type: "cactus_zumbi:cactus_zumbi_bom" });
            const mobsMau = dim.getEntities({ type: "cactus_zumbi:cactus_zumbi_mau" });
            const todosMobs = [...mobsBom, ...mobsMau];

            for (const mob of todosMobs) {
                try {
                    if (!mob.isValid()) continue;
                    idsMobsVivos.add(mob.id);
                    const loc = mob.location;
                    const bx = Math.floor(loc.x);
                    const by = Math.floor(loc.y);
                    const bz = Math.floor(loc.z);

                    // Posicao anterior (onde o mob estava no ultimo ciclo)
                    const posAnterior = cactusUltimaPosMob.get(mob.id);
                    cactusUltimaPosMob.set(mob.id, { x: bx, y: by, z: bz });

                    // Bloco abaixo e bloco na posicao do mob
                    const blocoAbaixo = dim.getBlock({ x: bx, y: by - 1, z: bz });
                    const blocoEm = dim.getBlock({ x: bx, y: by, z: bz });

                    // Regeneracao na areia
                    if (blocoAbaixo && (blocoAbaixo.typeId === "minecraft:sand" ||
                        blocoAbaixo.typeId === "minecraft:red_sand")) {
                        try {
                            const saude = mob.getComponent("minecraft:health");
                            if (saude && saude.currentValue < saude.effectiveMax) {
                                saude.setCurrentValue(
                                    Math.min(
                                        saude.currentValue + CACTUS_CONFIG.regeneracaoAreia,
                                        saude.effectiveMax
                                    )
                                );
                                // Particula de cura
                                dim.spawnParticle("minecraft:villager_happy", {
                                    x: loc.x,
                                    y: loc.y + 1,
                                    z: loc.z,
                                });
                            }
                        } catch (e) {}
                    }

                    // Dano na agua
                    if (blocoEm && (blocoEm.typeId === "minecraft:water" ||
                        blocoEm.typeId === "minecraft:flowing_water")) {
                        try {
                            mob.applyDamage(1, { cause: "drowning" });
                        } catch (e) {}
                    }

                    // Plantar cactus no rastro: so na posicao ANTERIOR, e so se o mob saiu dela
                    const saiuDoBloco = posAnterior &&
                        (posAnterior.x !== bx || posAnterior.y !== by || posAnterior.z !== bz);
                    if (saiuDoBloco && mob.isValid() && Math.random() < CACTUS_CONFIG.chancePlantarCactus) {
                        try {
                            const ax = posAnterior.x, ay = posAnterior.y, az = posAnterior.z;
                            const blocoAtras = dim.getBlock({ x: ax, y: ay, z: az });
                            const blocoBase = dim.getBlock({ x: ax, y: ay - 1, z: az });

                            if (blocoAtras && blocoAtras.typeId === "minecraft:air" &&
                                blocoBase && blocoBase.typeId === "minecraft:sand") {
                                // Verificar se nao ha blocos adjacentes (cactus precisa espaco)
                                const adj1 = dim.getBlock({ x: ax + 1, y: ay, z: az });
                                const adj2 = dim.getBlock({ x: ax - 1, y: ay, z: az });
                                const adj3 = dim.getBlock({ x: ax, y: ay, z: az + 1 });
                                const adj4 = dim.getBlock({ x: ax, y: ay, z: az - 1 });

                                const temBlocoAdjacente =
                                    (adj1 && adj1.typeId !== "minecraft:air") ||
                                    (adj2 && adj2.typeId !== "minecraft:air") ||
                                    (adj3 && adj3.typeId !== "minecraft:air") ||
                                    (adj4 && adj4.typeId !== "minecraft:air");

                                if (!temBlocoAdjacente) {
                                    blocoAtras.setType("minecraft:cactus");
                                }
                            }
                        } catch (e) {}
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }

    // Limpar posicoes de mobs que nao existem mais
    for (const [id] of cactusUltimaPosMob) {
        if (!idsMobsVivos.has(id)) cactusUltimaPosMob.delete(id);
    }
}, CACTUS_CONFIG.intervaloAmbiental);
