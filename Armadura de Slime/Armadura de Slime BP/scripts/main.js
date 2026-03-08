// ============================================================
//  ARMADURA DE SLIME v2 - Script Principal
//  Efeitos especiais baseados no numero de pecas equipadas
// ============================================================
//  1+ pecas: Particulas verdes de slime
//  2+ pecas: Imunidade a dano de queda + resistencia a veneno
//  2+ pecas: Folhas grudadas (30% chance ao encostar em folhas)
//  3+ pecas: Repulsao de ataques + lentidao nos atacantes
//  4  pecas: Saltos progressivos ao correr + super quique
//  4  pecas: Agachar reduz quique drasticamente
//  4  pecas: Gruda no teto ao bater nele apos grande queda
//  4  pecas: 10% chance de ser arremessado ao atacar mob
// ============================================================

import { world, system, EquipmentSlot } from "@minecraft/server";

// === IDS DAS PECAS ===
const SLIME_IDS = {
    head:  "slime_armor:capacete_slime",
    chest: "slime_armor:peitoral_slime",
    legs:  "slime_armor:calcas_slime",
    feet:  "slime_armor:botas_slime"
};

// === CONFIGURACAO ===
const CONFIG = {
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
const playerState = new Map();

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

function getOrCreateState(player) {
    let state = playerState.get(player.id);
    if (!state) {
        state = {
            // Existentes
            bounceHeight: CONFIG.bounceInitial,
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
        playerState.set(player.id, state);
    }
    return state;
}

// Verifica se um bloco e do tipo folha
function isLeafBlock(block) {
    if (!block) return false;
    const id = block.typeId;
    return id.includes("leaves");
}

// Verifica se ha bloco solido acima da cabeca do jogador
function hasCeilingAbove(player) {
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
function isTouchingLeaves(player) {
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
            if (isLeafBlock(block)) return true;
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
            playerState.delete(player.id);
            continue;
        }

        const state = getOrCreateState(player);
        const loc = player.location;
        const dim = player.dimension;

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
                            amplifier: CONFIG.leavesSlownessAmplifier,
                            showParticles: false
                        });
                    } catch (e) { }
                }

                // Expirou
                if (state.leavesStuckTicks <= 0) {
                    state.leavesStuck = false;
                    state.leavesCooldown = CONFIG.leavesCooldown;
                    try {
                        player.removeEffect("slowness");
                        player.sendMessage("\u00a7aAs folhas se soltaram!");
                    } catch (e) { }
                }
            } else if (state.leavesCooldown <= 0 && isTouchingLeaves(player)) {
                // Chance de folhas grudarem
                if (Math.random() < CONFIG.leavesStickChance) {
                    state.leavesStuck = true;
                    state.leavesStuckTicks = CONFIG.leavesStuckDuration;
                    try {
                        player.addEffect("slowness", CONFIG.leavesStuckDuration, {
                            amplifier: CONFIG.leavesSlownessAmplifier,
                            showParticles: false
                        });
                        dim.playSound("mob.slime.small", loc);
                        player.sendMessage("\u00a72Folhas grudaram em voce!");
                    } catch (e) { }
                }
            }
        }

        // --- 4 PECAS (SET COMPLETO): Saltos progressivos ao correr ---
        if (pieces === 4 && player.isSprinting) {
            state.ticksSprinting += 4;

            // Aumenta gradualmente a altura do salto
            if (state.ticksSprinting > CONFIG.bounceStartDelay) {
                state.bounceHeight = Math.min(
                    state.bounceHeight + CONFIG.bounceIncrement,
                    CONFIG.bounceMax
                );
            }

            // Aplica o pulo quando toca o chao
            if (player.isOnGround && !state.stuckOnCeiling) {
                try {
                    const viewDir = player.getViewDirection();
                    let finalBounce = state.bounceHeight;
                    let finalPush = CONFIG.bounceForwardPush;

                    // FEATURE 1: Agachar reduz o quique
                    if (player.isSneaking) {
                        finalBounce *= CONFIG.sneakBounceMultiplier;
                        finalPush *= CONFIG.sneakBounceMultiplier;
                    }

                    player.applyKnockback(
                        viewDir.x, viewDir.z,
                        finalPush,
                        finalBounce
                    );

                    // Som de slime proporcional ao salto
                    if (finalBounce > 1.0) {
                        dim.playSound("mob.slime.big", loc);
                    } else {
                        dim.playSound("mob.slime.small", loc);
                    }
                } catch (e) { }
            }
        } else if (!state.stuckOnCeiling) {
            // Reset quando para de correr
            state.bounceHeight = CONFIG.bounceInitial;
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
                    player.removeEffect("slowness");
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

        const state = playerState.get(player.id);
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

            // 4 PECAS: Quica de volta proporcional a queda
            if (pieces === 4 && fallDist > CONFIG.superBounceMinFall) {
                let bounceForce = Math.min(
                    fallDist * CONFIG.superBounceMultiplier,
                    CONFIG.superBounceMax
                );

                // FEATURE 1: Agachar reduz o super quique
                if (player.isSneaking) {
                    bounceForce *= CONFIG.sneakSuperBounceMultiplier;
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
                if (state.superBounceFallDist >= CONFIG.ceilingMinFallDist && hasCeilingAbove(player)) {
                    state.stuckOnCeiling = true;
                    state.ceilingStuckTicks = CONFIG.ceilingStuckDuration;
                    state.superBounceFallDist = 0;
                    try {
                        dim.playSound("mob.slime.squish", loc);
                        player.sendMessage("\u00a72Voce grudou no teto! Agache para soltar.");
                    } catch (e) { }
                }
            }
        }

        // Imunidade a dano de queda via efeito de resistencia
        if (vel.y < CONFIG.fallVelocityThreshold) {
            try {
                player.addEffect("resistance", 8, {
                    amplifier: CONFIG.fallResistanceAmplifier,
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
        const state = playerState.get(player.id);
        if (!state || !state.isFlungBack) continue;

        state.flungBackTicks -= 2;
        const loc = player.location;
        const dim = player.dimension;

        // Procurar mobs proximos para grudar
        try {
            const nearbyMobs = dim.getEntities({
                location: loc,
                maxDistance: 1.5,
                excludeTypes: ["minecraft:player", "minecraft:item"]
            });

            if (nearbyMobs.length > 0) {
                const mob = nearbyMobs[0];
                state.isFlungBack = false;
                state.flungBackTicks = 0;
                state.stuckWithMobId = mob.id;
                state.stuckWithMobTicks = CONFIG.stuckTogetherDuration;

                // Aplicar lentidao pesada em ambos
                try {
                    player.addEffect("slowness", CONFIG.stuckTogetherDuration, {
                        amplifier: CONFIG.stuckSlownessAmplifier,
                        showParticles: true
                    });
                    mob.addEffect("slowness", CONFIG.stuckTogetherDuration, {
                        amplifier: CONFIG.stuckSlownessAmplifier,
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
    const target = event.damagedEntity;
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
                        CONFIG.repulsionForce,
                        CONFIG.repulsionUpward
                    );
                } catch (e) { }

                try {
                    attacker.addEffect("slowness", CONFIG.slownessDuration, {
                        amplifier: CONFIG.slownessAmplifier,
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
            const state = getOrCreateState(attacker);

            // Nao ativar se ja esta grudado com mob ou sendo arremessado
            if (state.isFlungBack || state.stuckWithMobId) return;

            if (Math.random() < CONFIG.flingChance) {
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
                            CONFIG.flingForce,
                            CONFIG.flingUpward
                        );
                    } catch (e) { }

                    state.isFlungBack = true;
                    state.flungBackTicks = CONFIG.flingDetectTicks;

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
    playerState.delete(event.playerId);
});
