// ============================================================
//  ARMADURA DE SLIME - Script Principal
//  Efeitos especiais baseados no número de peças equipadas
// ============================================================
//  1+ peças: Partículas verdes de slime
//  2+ peças: Imunidade a dano de queda + resistência a veneno
//  3+ peças: Repulsão de ataques + lentidão nos atacantes
//  4  peças: Saltos progressivos ao correr + super quique
// ============================================================

import { world, system, EquipmentSlot } from "@minecraft/server";

// === IDs DAS PEÇAS ===
const SLIME_IDS = {
    head:  "slime_armor:capacete_slime",
    chest: "slime_armor:peitoral_slime",
    legs:  "slime_armor:calcas_slime",
    feet:  "slime_armor:botas_slime"
};

// === CONFIGURAÇÃO ===
const CONFIG = {
    // Repulsão de ataque (3+ peças)
    repulsionForce: 3.5,
    repulsionUpward: 0.8,
    slownessDuration: 60,       // 3 segundos
    slownessAmplifier: 1,

    // Saltos progressivos (4 peças, set completo)
    bounceInitial: 0.6,
    bounceIncrement: 0.04,
    bounceMax: 2.5,
    bounceStartDelay: 20,       // ticks antes de começar a crescer
    bounceForwardPush: 0.3,

    // Super quique ao cair (4 peças)
    superBounceMinFall: 3,      // blocos mínimos de queda
    superBounceMultiplier: 0.35,
    superBounceMax: 2.5,

    // Imunidade a queda (2+ peças)
    fallResistanceAmplifier: 4, // nível 5 = imunidade total
    fallVelocityThreshold: -0.5
};

// === ESTADO POR JOGADOR ===
const playerState = new Map();

// === FUNÇÕES AUXILIARES ===

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
            bounceHeight: CONFIG.bounceInitial,
            ticksSprinting: 0,
            isFalling: false,
            fallStartY: player.location.y
        };
        playerState.set(player.id, state);
    }
    return state;
}

// ============================================================
//  LOOP PRINCIPAL - a cada 4 ticks
//  Partículas, veneno, saltos progressivos
// ============================================================
const loopPrincipal = system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const pieces = countSlimePieces(player);

        if (pieces === 0) {
            playerState.delete(player.id);
            continue;
        }

        const state = getOrCreateState(player);
        const loc = player.location;
        const dim = player.dimension;

        // --- 1+ PEÇAS: Partículas verdes de slime ---
        try {
            for (let i = 0; i < pieces; i++) {
                dim.spawnParticle("minecraft:villager_happy", {
                    x: loc.x + (Math.random() - 0.5) * 1.5,
                    y: loc.y + Math.random() * 1.8,
                    z: loc.z + (Math.random() - 0.5) * 1.5
                });
            }
        } catch (e) { console.warn("[SlimeArmor] Erro ao spawnar particulas:", e); }

        // --- 2+ PEÇAS: Resistência a veneno ---
        if (pieces >= 2) {
            try {
                const poison = player.getEffect("poison");
                if (poison) player.removeEffect("poison");
            } catch (e) { console.warn("[SlimeArmor] Erro ao remover veneno:", e); }
        }

        // --- 4 PEÇAS (SET COMPLETO): Saltos progressivos ao correr ---
        if (pieces === 4 && player.isSprinting) {
            state.ticksSprinting += 4;

            // Aumenta gradualmente a altura do salto
            if (state.ticksSprinting > CONFIG.bounceStartDelay) {
                state.bounceHeight = Math.min(
                    state.bounceHeight + CONFIG.bounceIncrement,
                    CONFIG.bounceMax
                );
            }

            // Aplica o pulo quando toca o chão
            if (player.isOnGround) {
                try {
                    const viewDir = player.getViewDirection();
                    player.applyKnockback(
                        viewDir.x, viewDir.z,
                        CONFIG.bounceForwardPush,
                        state.bounceHeight
                    );

                    // Som de slime proporcional ao salto
                    if (state.bounceHeight > 1.0) {
                        dim.playSound("mob.slime.big", loc);
                    } else {
                        dim.playSound("mob.slime.small", loc);
                    }
                } catch (e) { console.warn("[SlimeArmor] Erro no salto:", e); }
            }
        } else {
            // Reset quando para de correr
            state.bounceHeight = CONFIG.bounceInitial;
            state.ticksSprinting = 0;
        }
    }
}, 4);

// ============================================================
//  PROTEÇÃO CONTRA QUEDA - a cada 2 ticks
//  Detecta queda, aplica resistência, e super quique
// ============================================================
const loopQueda = system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const pieces = countSlimePieces(player);
        if (pieces < 2) continue;

        const state = playerState.get(player.id);
        if (!state) continue;

        const vel = player.getVelocity();
        const loc = player.location;

        // Rastrear início da queda
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

            // 4 PEÇAS: Quica de volta proporcional à queda
            if (pieces === 4 && fallDist > CONFIG.superBounceMinFall) {
                const bounceForce = Math.min(
                    fallDist * CONFIG.superBounceMultiplier,
                    CONFIG.superBounceMax
                );
                system.run(() => {
                    try {
                        player.applyKnockback(0, 0, 0, bounceForce);
                        player.dimension.playSound("mob.slime.big", player.location);
                    } catch (e) { console.warn("[SlimeArmor] Erro no super quique:", e); }
                });
            }
        }

        // Imunidade a dano de queda via efeito de resistência
        if (vel.y < CONFIG.fallVelocityThreshold) {
            try {
                player.addEffect("resistance", 8, {
                    amplifier: CONFIG.fallResistanceAmplifier,
                    showParticles: false
                });
            } catch (e) { console.warn("[SlimeArmor] Erro ao aplicar resistencia:", e); }
        }
    }
}, 2);

// ============================================================
//  REPULSÃO DE ATAQUES - 3+ peças
//  Atacantes são arremessados para trás e ficam lentos
// ============================================================
world.afterEvents.entityHitEntity.subscribe((event) => {
    const target = event.damagedEntity;
    const attacker = event.damagingEntity;

    // Só ativa se o alvo é um jogador
    if (target.typeId !== "minecraft:player") return;

    const pieces = countSlimePieces(target);
    if (pieces < 3) return;

    // Calcula direção de repulsão (do jogador para o atacante)
    const dx = attacker.location.x - target.location.x;
    const dz = attacker.location.z - target.location.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < 0.01) return;

    const nx = dx / dist;
    const nz = dz / dist;

    // Arremessa o atacante para trás como se tivesse pulado num bloco de slime
    try {
        attacker.applyKnockback(
            nx, nz,
            CONFIG.repulsionForce,
            CONFIG.repulsionUpward
        );
    } catch (e) { console.warn("[SlimeArmor] Erro na repulsao:", e); }

    // Atacante fica lento - grudou no slime!
    try {
        attacker.addEffect("slowness", CONFIG.slownessDuration, {
            amplifier: CONFIG.slownessAmplifier,
            showParticles: true
        });
    } catch (e) { console.warn("[SlimeArmor] Erro ao aplicar lentidao:", e); }

    // Som de slime no impacto
    try {
        target.dimension.playSound("mob.slime.big", target.location);
    } catch (e) { console.warn("[SlimeArmor] Erro ao tocar som:", e); }
});

// ============================================================
//  LIMPEZA - remove estado quando jogador desconecta
// ============================================================
world.afterEvents.playerLeave.subscribe((event) => {
    playerState.delete(event.playerId);
});
