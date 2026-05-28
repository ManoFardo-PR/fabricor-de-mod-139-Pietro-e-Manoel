// ============================================================
// FLECHAS ESPECIAIS - Script Principal
// Intercepta o disparo do arco vanilla, spawna projetil custom
// e aplica efeitos (TNT, Veneno, Lerdeza, Paralisia)
// ============================================================

import { world, system, ItemStack } from "@minecraft/server";

// ==== CONFIGURACAO ====
const CONFIG = {
    powerMinimo: 0.1,           // ignora tap-fire do arco (< 0.1 do useDuration)
    velocidadeBase: 3.0,        // multiplicador de impulse aplicado ao projetil
    raioSupressao: 4.0,         // distancia maxima para considerar player como "atirador" da arrow vanilla
    janelaSupressaoTicks: 3,    // ticks aceitos entre disparo e spawn da arrow vanilla
    intervaloFantasma: 10,      // ticks entre verificacoes da arrow fantasma
    arrowVanilla: "minecraft:arrow",
    arco: "minecraft:bow"
};

// Mapeamento item -> projetil
const MAPA_FLECHA_PROJETIL = {
    "flechas_especiais:flecha_tnt":       "flechas_especiais:proj_tnt",
    "flechas_especiais:flecha_veneno":    "flechas_especiais:proj_veneno",
    "flechas_especiais:flecha_lerdeza":   "flechas_especiais:proj_lerdeza",
    "flechas_especiais:flecha_paralisia": "flechas_especiais:proj_paralisia"
};

const TIPOS_PROJETIL_CUSTOM = new Set(Object.values(MAPA_FLECHA_PROJETIL));

// ==== ESTADO (efemero por sessao - Map em memoria) ====
const tickDisparoPorPlayer = new Map();  // player.id -> tick do disparo (para supressao)
const playerTemFantasma = new Set();     // player.id -> tem arrow fantasma inserida pelo script

// ==== HELPERS ====

function getInventario(jogador) {
    try {
        return jogador.getComponent("minecraft:inventory")?.container ?? null;
    } catch (e) {
        return null;
    }
}

function primeiraFlechaCustomizada(jogador) {
    const container = getInventario(jogador);
    if (!container) return null;
    for (let i = 0; i < container.size; i++) {
        try {
            const item = container.getItem(i);
            if (item && MAPA_FLECHA_PROJETIL[item.typeId]) {
                return { slot: i, typeId: item.typeId, amount: item.amount };
            }
        } catch (e) {}
    }
    return null;
}

function temArrowVanilla(jogador) {
    const container = getInventario(jogador);
    if (!container) return false;
    for (let i = 0; i < container.size; i++) {
        try {
            const item = container.getItem(i);
            if (item && item.typeId === CONFIG.arrowVanilla) return true;
        } catch (e) {}
    }
    return false;
}

function temArcoNaMao(jogador) {
    const container = getInventario(jogador);
    if (!container) return false;
    try {
        const slot = jogador.selectedSlotIndex ?? 0;
        const item = container.getItem(slot);
        return item?.typeId === CONFIG.arco;
    } catch (e) {
        return false;
    }
}

function consumirFlechaCustom(jogador, slot) {
    const container = getInventario(jogador);
    if (!container) return;
    try {
        const item = container.getItem(slot);
        if (!item) return;
        if (item.amount > 1) {
            item.amount -= 1;
            container.setItem(slot, item);
        } else {
            container.setItem(slot, undefined);
        }
    } catch (e) {}
}

function inserirArrowFantasma(jogador) {
    const container = getInventario(jogador);
    if (!container) return false;
    try {
        // tenta achar slot vazio
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (!item) {
                container.setItem(i, new ItemStack(CONFIG.arrowVanilla, 1));
                return true;
            }
        }
    } catch (e) {}
    return false;
}

function removerArrowFantasma(jogador) {
    const container = getInventario(jogador);
    if (!container) return;
    try {
        // remove apenas 1 arrow (a fantasma); preserva arrows reais que o player ja tinha
        for (let i = 0; i < container.size; i++) {
            const item = container.getItem(i);
            if (item && item.typeId === CONFIG.arrowVanilla && item.amount === 1) {
                container.setItem(i, undefined);
                return;
            }
        }
    } catch (e) {}
}

// ==== LOOP: GARANTIR ARROW FANTASMA ====
// Quando player segura arco + tem flecha custom mas nao tem arrow vanilla,
// inserimos uma arrow vanilla temporaria para o arco aceitar o disparo.
system.runInterval(() => {
    try {
        for (const jogador of world.getAllPlayers()) {
            try {
                const segurandoArco = temArcoNaMao(jogador);
                const flechaCustom = primeiraFlechaCustomizada(jogador);
                const temArrow = temArrowVanilla(jogador);

                if (segurandoArco && flechaCustom && !temArrow) {
                    if (inserirArrowFantasma(jogador)) {
                        playerTemFantasma.add(jogador.id);
                    }
                } else if (!segurandoArco || !flechaCustom) {
                    // se nao segura mais arco OU nao tem mais flecha custom, remove fantasma
                    if (playerTemFantasma.has(jogador.id)) {
                        removerArrowFantasma(jogador);
                        playerTemFantasma.delete(jogador.id);
                    }
                }
            } catch (e) {}
        }
    } catch (e) {}
}, CONFIG.intervaloFantasma);

// ==== DISPARO: INTERCEPTAR LIBERACAO DO ARCO ====
world.afterEvents.itemReleaseUse.subscribe((evento) => {
    try {
        const jogador = evento.source;
        const item = evento.itemStack;
        if (!item || item.typeId !== CONFIG.arco) return;

        const flecha = primeiraFlechaCustomizada(jogador);
        if (!flecha) return;

        const power = Math.min(evento.useDuration / 20, 1.0);
        if (power < CONFIG.powerMinimo) return;

        const direcao = jogador.getViewDirection();
        const velocidade = CONFIG.velocidadeBase * power;
        const posicao = {
            x: jogador.location.x,
            y: jogador.location.y + 1.5,
            z: jogador.location.z
        };
        const tipoProjetil = MAPA_FLECHA_PROJETIL[flecha.typeId];

        // marca tick do disparo para o listener de entitySpawn suprimir a arrow vanilla
        tickDisparoPorPlayer.set(jogador.id, system.currentTick);

        // spawna o projetil custom no proximo tick (system.run evita erros de "write in read-only")
        system.run(() => {
            try {
                const projetil = jogador.dimension.spawnEntity(tipoProjetil, posicao);
                projetil.applyImpulse({
                    x: direcao.x * velocidade,
                    y: direcao.y * velocidade,
                    z: direcao.z * velocidade
                });
            } catch (e) {}
        });

        // consome 1 flecha customizada (a arrow vanilla fantasma sera comida pelo arco vanilla)
        consumirFlechaCustom(jogador, flecha.slot);
    } catch (e) {}
});

// ==== SUPRESSAO DA ARROW VANILLA ====
// Quando o arco vanilla dispara, ele spawna uma minecraft:arrow.
// Se houve disparo de flecha custom recente do mesmo player, removemos.
world.afterEvents.entitySpawn.subscribe((evento) => {
    try {
        const entidade = evento.entity;
        if (entidade.typeId !== CONFIG.arrowVanilla) return;

        const tickAgora = system.currentTick;
        const players = entidade.dimension.getPlayers({
            location: entidade.location,
            maxDistance: CONFIG.raioSupressao
        });

        for (const jogador of players) {
            const tickDisparo = tickDisparoPorPlayer.get(jogador.id);
            if (tickDisparo !== undefined && (tickAgora - tickDisparo) <= CONFIG.janelaSupressaoTicks) {
                entidade.remove();
                tickDisparoPorPlayer.delete(jogador.id);
                // arrow fantasma foi consumida pelo arco; permite o loop re-inserir se ainda houver flecha custom
                playerTemFantasma.delete(jogador.id);
                return;
            }
        }
    } catch (e) {}
});

// ==== EFEITOS NO IMPACTO (entidade) ====
world.afterEvents.projectileHitEntity.subscribe((evento) => {
    try {
        const projetil = evento.projectile;
        if (!projetil || !TIPOS_PROJETIL_CUSTOM.has(projetil.typeId)) return;

        const dim = projetil.dimension;
        const local = evento.location;
        const alvo = evento.getEntityHit()?.entity;

        aplicarEfeito(projetil.typeId, alvo, local, dim);

        try { projetil.remove(); } catch (e) {}
    } catch (e) {}
});

// ==== EFEITOS NO IMPACTO (bloco) ====
world.afterEvents.projectileHitBlock.subscribe((evento) => {
    try {
        const projetil = evento.projectile;
        if (!projetil || !TIPOS_PROJETIL_CUSTOM.has(projetil.typeId)) return;

        const dim = projetil.dimension;
        const local = evento.location;

        aplicarEfeito(projetil.typeId, null, local, dim);

        try { projetil.remove(); } catch (e) {}
    } catch (e) {}
});

// ==== APLICACAO DE EFEITO ====
function aplicarEfeito(tipoProj, alvo, loc, dim) {
    switch (tipoProj) {
        case "flechas_especiais:proj_tnt":
            try {
                dim.createExplosion(loc, 3, { breaksBlocks: true, causesFire: false });
            } catch (e) {}
            break;

        case "flechas_especiais:proj_veneno":
            if (alvo) {
                try { alvo.addEffect("poison",   200, { amplifier: 1 }); } catch (e) {}
                try { alvo.addEffect("hunger",   160, { amplifier: 0 }); } catch (e) {}
                try { alvo.addEffect("nausea",   120, { amplifier: 0 }); } catch (e) {}
                try { alvo.addEffect("weakness", 200, { amplifier: 0 }); } catch (e) {}
            }
            try { dim.spawnParticle("minecraft:villager_angry", loc); } catch (e) {}
            try { dim.playSound("mob.zombie.infect", loc, { volume: 0.6 }); } catch (e) {}
            break;

        case "flechas_especiais:proj_lerdeza":
            if (alvo) {
                try { alvo.addEffect("slowness",        160, { amplifier: 3 }); } catch (e) {}
                try { alvo.addEffect("mining_fatigue", 120, { amplifier: 1 }); } catch (e) {}
            }
            try { dim.spawnParticle("minecraft:basic_smoke_particle", loc); } catch (e) {}
            break;

        case "flechas_especiais:proj_paralisia":
            if (alvo) {
                try { alvo.addEffect("slowness",        100, { amplifier: 4 }); } catch (e) {}
                try { alvo.addEffect("mining_fatigue", 100, { amplifier: 4 }); } catch (e) {}
                try { alvo.addEffect("blindness",      100, { amplifier: 0 }); } catch (e) {}
            }
            try { dim.spawnParticle("minecraft:critical_hit_emitter", loc); } catch (e) {}
            try { dim.playSound("random.orb", loc, { volume: 0.6 }); } catch (e) {}
            break;
    }
}

// ==== LIMPEZA: JOGADOR SAI ====
world.afterEvents.playerLeave.subscribe((evento) => {
    tickDisparoPorPlayer.delete(evento.playerId);
    playerTemFantasma.delete(evento.playerId);
});
