// ============================================================
// FLECHAS ESPECIAIS - Script Principal
// O Arco Especial (minecraft:shooter) dispara as flechas custom
// nativamente; o script so aplica os efeitos no impacto
// (TNT, Veneno, Lerdeza, Paralisia).
// ============================================================

import { world } from "@minecraft/server";

// ==== CONFIGURACAO ====
const CONFIG = {
    tnt: { raio: 3, quebraBlocos: true, causaFogo: false },
    veneno: {
        poison:   { duracao: 200, amplificador: 1 },
        hunger:   { duracao: 160, amplificador: 0 },
        nausea:   { duracao: 120, amplificador: 0 },
        weakness: { duracao: 200, amplificador: 0 }
    },
    lerdeza: {
        slowness:       { duracao: 160, amplificador: 3 },
        mining_fatigue: { duracao: 120, amplificador: 1 }
    },
    paralisia: {
        slowness:       { duracao: 100, amplificador: 4 },
        mining_fatigue: { duracao: 100, amplificador: 4 },
        blindness:      { duracao: 100, amplificador: 0 }
    }
};

const TIPOS_PROJETIL_CUSTOM = new Set([
    "flechas_especiais:proj_tnt",
    "flechas_especiais:proj_veneno",
    "flechas_especiais:proj_lerdeza",
    "flechas_especiais:proj_paralisia"
]);

// ==== HELPERS ====

function tipoDoProjetil(evento) {
    try {
        const projetil = evento.projectile;
        if (!projetil) return null;
        const tipo = projetil.typeId;
        return TIPOS_PROJETIL_CUSTOM.has(tipo) ? tipo : null;
    } catch (e) {
        // Entidade ja removida (remove_on_hit): sem como identificar
        return null;
    }
}

function aplicarEfeitosEm(alvo, tabela) {
    if (!alvo) return;
    for (const [efeito, cfg] of Object.entries(tabela)) {
        try {
            alvo.addEffect(efeito, cfg.duracao, { amplifier: cfg.amplificador });
        } catch (e) {}
    }
}

// ==== APLICACAO DE EFEITO ====
// dim e loc vem do EVENTO (evento.dimension / evento.location), nunca do projetil,
// pois com remove_on_hit a entidade pode ja estar invalida.
function aplicarEfeito(tipoProj, alvo, loc, dim) {
    switch (tipoProj) {
        case "flechas_especiais:proj_tnt":
            try {
                dim.createExplosion(loc, CONFIG.tnt.raio, {
                    breaksBlocks: CONFIG.tnt.quebraBlocos,
                    causesFire: CONFIG.tnt.causaFogo
                });
            } catch (e) {}
            break;

        case "flechas_especiais:proj_veneno":
            aplicarEfeitosEm(alvo, CONFIG.veneno);
            try { dim.spawnParticle("minecraft:villager_angry", loc); } catch (e) {}
            try { dim.playSound("mob.zombie.infect", loc, { volume: 0.6 }); } catch (e) {}
            break;

        case "flechas_especiais:proj_lerdeza":
            aplicarEfeitosEm(alvo, CONFIG.lerdeza);
            try { dim.spawnParticle("minecraft:basic_smoke_particle", loc); } catch (e) {}
            break;

        case "flechas_especiais:proj_paralisia":
            aplicarEfeitosEm(alvo, CONFIG.paralisia);
            try { dim.spawnParticle("minecraft:critical_hit_emitter", loc); } catch (e) {}
            try { dim.playSound("random.orb", loc, { volume: 0.6 }); } catch (e) {}
            break;
    }
}

// ==== EFEITOS NO IMPACTO (entidade) ====
world.afterEvents.projectileHitEntity.subscribe((evento) => {
    try {
        const tipo = tipoDoProjetil(evento);
        if (!tipo) return;

        let alvo = null;
        try { alvo = evento.getEntityHit()?.entity ?? null; } catch (e) {}

        aplicarEfeito(tipo, alvo, evento.location, evento.dimension);
    } catch (e) {}
});

// ==== EFEITOS NO IMPACTO (bloco) ====
world.afterEvents.projectileHitBlock.subscribe((evento) => {
    try {
        const tipo = tipoDoProjetil(evento);
        if (!tipo) return;

        aplicarEfeito(tipo, null, evento.location, evento.dimension);
    } catch (e) {}
});
