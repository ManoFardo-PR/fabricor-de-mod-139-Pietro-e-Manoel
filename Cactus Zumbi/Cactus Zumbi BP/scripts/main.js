// ============================================================
// CACTUS ZUMBI - Script Principal
// Pocao arremessavel que transforma cactus em Cactus Zumbi
// ============================================================

import { world, system } from "@minecraft/server";

// ==== CONFIGURACAO ====
const CONFIG = {
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
const pocaoData = new Map();
const processedPocoes = new Set();

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
                if (processedPocoes.has(pocao.id)) continue;

                const loc = pocao.location;

                // Primeiro registro
                if (!pocaoData.has(pocao.id)) {
                    pocaoData.set(pocao.id, {
                        tickSpawn: system.currentTick,
                        ultimoX: loc.x,
                        ultimoY: loc.y,
                        ultimoZ: loc.z,
                    });
                    continue;
                }

                const dados = pocaoData.get(pocao.id);
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
                if (idade > CONFIG.timeoutProjetil) {
                    processedPocoes.add(pocao.id);
                    try { pocao.kill(); } catch (e) {}
                    continue;
                }

                // Ainda se movendo
                if (velocidade > CONFIG.limiteVelocidade) continue;

                // Parou! Procurar cactus
                processedPocoes.add(pocao.id);
                processarImpactoPocao(dim, loc, pocao);
            }
        } catch (e) {}
    }

    // Limpeza de dados de projeteis mortos
    for (const [id] of pocaoData) {
        if (!idsVivos.has(id)) {
            pocaoData.delete(id);
            processedPocoes.delete(id);
        }
    }
}, CONFIG.intervaloTracking);

// ==== FUNCAO: PROCESSAR IMPACTO DA POCAO ====
function processarImpactoPocao(dim, loc, pocao) {
    const raio = CONFIG.raioDeteccaoCactus;
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
                atacante.applyDamage(CONFIG.danoEspinhos, { cause: "contact" });

                // Particula de espinho
                const loc = atacante.location;
                const dim = atacante.dimension;
                dim.spawnParticle("minecraft:crit_emitter", loc);
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
        const raio = CONFIG.raioExplosaoMorte;

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
                ent.applyDamage(CONFIG.danoExplosaoMorte, { cause: "contact" });

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
                dim.spawnParticle("minecraft:crit_emitter", {
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

// ==== LOOP AMBIENTAL: REGENERACAO, DANO AGUA, PLANTAR CACTUS ====
system.runInterval(() => {
    const nomeDimensoes = ["overworld", "nether", "the_end"];

    for (const nomeDim of nomeDimensoes) {
        try {
            const dim = world.getDimension(nomeDim);
            const mobsBom = dim.getEntities({ type: "cactus_zumbi:cactus_zumbi_bom" });
            const mobsMau = dim.getEntities({ type: "cactus_zumbi:cactus_zumbi_mau" });
            const todosMobs = [...mobsBom, ...mobsMau];

            for (const mob of todosMobs) {
                try {
                    if (!mob.isValid()) continue;
                    const loc = mob.location;
                    const bx = Math.floor(loc.x);
                    const by = Math.floor(loc.y);
                    const bz = Math.floor(loc.z);

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
                                        saude.currentValue + CONFIG.regeneracaoAreia,
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

                    // Plantar cactus ao andar
                    if (mob.isValid() && Math.random() < CONFIG.chancePlantarCactus) {
                        try {
                            // Verificar se bloco anterior era areia e posicao atual e ar
                            const blocoAtras = dim.getBlock({ x: bx, y: by, z: bz });
                            const blocoBase = dim.getBlock({ x: bx, y: by - 1, z: bz });

                            if (blocoAtras && blocoAtras.typeId === "minecraft:air" &&
                                blocoBase && blocoBase.typeId === "minecraft:sand") {
                                // Verificar se nao ha blocos adjacentes (cactus precisa espaco)
                                const adj1 = dim.getBlock({ x: bx + 1, y: by, z: bz });
                                const adj2 = dim.getBlock({ x: bx - 1, y: by, z: bz });
                                const adj3 = dim.getBlock({ x: bx, y: by, z: bz + 1 });
                                const adj4 = dim.getBlock({ x: bx, y: by, z: bz - 1 });

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
}, CONFIG.intervaloAmbiental);
