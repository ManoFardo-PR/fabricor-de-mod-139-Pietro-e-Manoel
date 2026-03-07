// ================================================================
//  MODS PIETRO E MANOEL - Script Unificado
//  1. Super Picareta (escavação, TNT, Bomba, Pistola, Espada)
//  2. Multiplicador x10 (duplicação de itens)
//  3. Armadura de Slime (repulsão, saltos, quique)
// ================================================================

import { world, system, EquipmentSlot, BlockPermutation } from "@minecraft/server";

// ████████████████████████████████████████████████████████████████
// ██  1. SUPER PICARETA                                        ██
// ████████████████████████████████████████████████████████████████

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

                        // Preserva minerios, ancient debris e bedrock
                        if (id.includes("ore") || id === "minecraft:ancient_debris" || id === "minecraft:bedrock") continue;

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

// Fallback: detecta TNT presa
const tntSpawnTick = new Map();
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
                if (!tntSpawnTick.has(tnt.id)) {
                    tntSpawnTick.set(tnt.id, system.currentTick);
                    continue;
                }
                const age = system.currentTick - tntSpawnTick.get(tnt.id);
                if (age > 40) {
                    explodeTNT(tnt, tnt.location, dim, false, null);
                    tntSpawnTick.delete(tnt.id);
                }
            }
        } catch (e) {}
    }
    for (const [tid] of tntSpawnTick) {
        if (!aliveTntIds.has(tid)) tntSpawnTick.delete(tid);
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
        maxBounces: 2,
        default: { velocityLoss: 0.3, minVertical: 0.1, maxVertical: -0.1 },
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
    flightTimeout: 200
};

const flightFlares = new Map();
const landedFlares = new Map();

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
        blockTypeId.includes("vine") || blockTypeId.includes("grass") ||
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
            try {
                const oldDim = world.getDimension(old.dimId);
                removeSingleLight(oldDim, old.lightPos);
            } catch (e) {}
            landedFlares.delete(oldestKey);
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
}

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
        removeSingleLight(dim, data.lightPos);
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
        removeSingleLight(dim, hitData.lightPos);
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
            try {
                const cleanDim = world.getDimension(data.dimName || "overworld");
                removeSingleLight(cleanDim, data.lightPos);
            } catch (e) {}
            flightFlares.delete(id);
        }
    }
}

function updateLandedFlares(now) {
    for (const [key, data] of landedFlares) {
        try {
            const dim = world.getDimension(data.dimId);
            const age = now - data.landTick;
            let maxDuration = data.inWater ? FLARE_CONFIG.duration.water : FLARE_CONFIG.duration.land;
            if (data.halfDuration) maxDuration = Math.floor(maxDuration / 2);

            spawnSmokeEffects(dim, data.loc);

            if (now % 6 < 2) {
                try {
                    dim.spawnParticle(FLARE_CONFIG.effects.trail.particle, {
                        x: data.loc.x, y: data.loc.y + 0.3, z: data.loc.z
                    });
                } catch (e) {}
            }

            if (age > maxDuration) {
                const removed = removeSingleLight(dim, data.lightPos);
                if (removed || age > maxDuration + 400) {
                    landedFlares.delete(key);
                }
            }
        } catch (e) {}
    }
}

system.runInterval(() => {
    const now = system.currentTick;

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
// ██  2. MULTIPLICADOR x10                                     ██
// ████████████████████████████████████████████████████████████████

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.block.typeId !== "multiplicador:multiplicador_x10") return;

    const player = event.player;
    const inventory = player.getComponent("minecraft:inventory");
    if (!inventory) return;
    const container = inventory.container;
    if (!container) return;

    const slot = player.selectedSlotIndex;
    const held = container.getItem(slot);

    if (!held) {
        player.sendMessage("§e[Multiplicador x10] §cSegure um item na mao para multiplicar!");
        return;
    }

    if (held.typeId === "minecraft:diamond") {
        player.sendMessage("§e[Multiplicador x10] §cNao e possivel multiplicar diamantes!");
        return;
    }

    let diamondCount = 0;
    const diamondSlots = [];
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && item.typeId === "minecraft:diamond") {
            diamondCount += item.amount;
            diamondSlots.push(i);
        }
    }

    if (diamondCount < 10) {
        player.sendMessage(`§e[Multiplicador x10] §cPrecisa de 10 diamantes! (voce tem ${diamondCount})`);
        return;
    }

    const itemClone = held.clone();
    itemClone.amount = 1;

    if (held.amount > 1) {
        held.amount -= 1;
        container.setItem(slot, held);
    } else {
        container.setItem(slot, undefined);
    }

    let toConsume = 10;
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

    const output = itemClone.clone();
    output.amount = 10;
    try {
        container.addItem(output);
    } catch (e) {
        try {
            player.dimension.spawnItem(output, player.location);
        } catch (e2) {}
    }

    const loc = event.block.location;
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

    player.sendMessage(`§e[Multiplicador x10] §a${itemClone.typeId.replace("minecraft:", "")} multiplicado x10!`);
});

// ████████████████████████████████████████████████████████████████
// ██  3. ARMADURA DE SLIME                                     ██
// ████████████████████████████████████████████████████████████████

const SLIME_IDS = {
    head:  "slime_armor:capacete_slime",
    chest: "slime_armor:peitoral_slime",
    legs:  "slime_armor:calcas_slime",
    feet:  "slime_armor:botas_slime"
};

const SLIME_CONFIG = {
    repulsionForce: 3.5,
    repulsionUpward: 0.8,
    slownessDuration: 60,
    slownessAmplifier: 1,
    bounceInitial: 0.6,
    bounceIncrement: 0.04,
    bounceMax: 2.5,
    bounceStartDelay: 20,
    bounceForwardPush: 0.3,
    superBounceMinFall: 3,
    superBounceMultiplier: 0.35,
    superBounceMax: 2.5,
    fallResistanceAmplifier: 4,
    fallVelocityThreshold: -0.5
};

const slimePlayerState = new Map();

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
            bounceHeight: SLIME_CONFIG.bounceInitial,
            ticksSprinting: 0,
            isFalling: false,
            fallStartY: player.location.y
        };
        slimePlayerState.set(player.id, state);
    }
    return state;
}

// Slime: Loop principal (a cada 4 ticks)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const pieces = countSlimePieces(player);

        if (pieces === 0) {
            slimePlayerState.delete(player.id);
            continue;
        }

        const state = getOrCreateSlimeState(player);
        const loc = player.location;
        const dim = player.dimension;

        // 1+ PEÇAS: Partículas verdes
        try {
            for (let i = 0; i < pieces; i++) {
                dim.spawnParticle("minecraft:villager_happy", {
                    x: loc.x + (Math.random() - 0.5) * 1.5,
                    y: loc.y + Math.random() * 1.8,
                    z: loc.z + (Math.random() - 0.5) * 1.5
                });
            }
        } catch (e) {}

        // 2+ PEÇAS: Resistência a veneno
        if (pieces >= 2) {
            try {
                const poison = player.getEffect("poison");
                if (poison) player.removeEffect("poison");
            } catch (e) {}
        }

        // 4 PEÇAS: Saltos progressivos ao correr
        if (pieces === 4 && player.isSprinting) {
            state.ticksSprinting += 4;

            if (state.ticksSprinting > SLIME_CONFIG.bounceStartDelay) {
                state.bounceHeight = Math.min(
                    state.bounceHeight + SLIME_CONFIG.bounceIncrement,
                    SLIME_CONFIG.bounceMax
                );
            }

            if (player.isOnGround) {
                try {
                    const viewDir = player.getViewDirection();
                    player.applyKnockback(
                        viewDir.x, viewDir.z,
                        SLIME_CONFIG.bounceForwardPush,
                        state.bounceHeight
                    );

                    if (state.bounceHeight > 1.0) {
                        dim.playSound("mob.slime.big", loc);
                    } else {
                        dim.playSound("mob.slime.small", loc);
                    }
                } catch (e) {}
            }
        } else {
            state.bounceHeight = SLIME_CONFIG.bounceInitial;
            state.ticksSprinting = 0;
        }
    }
}, 4);

// Slime: Proteção contra queda (a cada 2 ticks)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const pieces = countSlimePieces(player);
        if (pieces < 2) continue;

        const state = slimePlayerState.get(player.id);
        if (!state) continue;

        const vel = player.getVelocity();
        const loc = player.location;

        if (vel.y < -0.3 && !player.isOnGround) {
            if (!state.isFalling) {
                state.isFalling = true;
                state.fallStartY = loc.y;
            }
        }

        if (state.isFalling && player.isOnGround) {
            const fallDist = state.fallStartY - loc.y;
            state.isFalling = false;

            if (pieces === 4 && fallDist > SLIME_CONFIG.superBounceMinFall) {
                const bounceForce = Math.min(
                    fallDist * SLIME_CONFIG.superBounceMultiplier,
                    SLIME_CONFIG.superBounceMax
                );
                system.run(() => {
                    try {
                        player.applyKnockback(0, 0, 0, bounceForce);
                        player.dimension.playSound("mob.slime.big", player.location);
                    } catch (e) {}
                });
            }
        }

        if (vel.y < SLIME_CONFIG.fallVelocityThreshold) {
            try {
                player.addEffect("resistance", 8, {
                    amplifier: SLIME_CONFIG.fallResistanceAmplifier,
                    showParticles: false
                });
            } catch (e) {}
        }
    }
}, 2);

// Slime: Repulsão de ataques (3+ peças)
world.afterEvents.entityHitEntity.subscribe((event) => {
    const target = event.damagedEntity;
    const attacker = event.damagingEntity;

    if (target.typeId !== "minecraft:player") return;

    const pieces = countSlimePieces(target);
    if (pieces < 3) return;

    const dx = attacker.location.x - target.location.x;
    const dz = attacker.location.z - target.location.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.01) return;

    const nx = dx / dist;
    const nz = dz / dist;

    try {
        attacker.applyKnockback(
            nx, nz,
            SLIME_CONFIG.repulsionForce,
            SLIME_CONFIG.repulsionUpward
        );
    } catch (e) {}

    try {
        attacker.addEffect("slowness", SLIME_CONFIG.slownessDuration, {
            amplifier: SLIME_CONFIG.slownessAmplifier,
            showParticles: true
        });
    } catch (e) {}

    try {
        target.dimension.playSound("mob.slime.big", target.location);
    } catch (e) {}
});

// ============================================================
// LIMPEZA GERAL - ao desconectar
// ============================================================
world.afterEvents.playerLeave.subscribe((event) => {
    slimePlayerState.delete(event.playerId);
});
