// ============================================================
// PISTOLA LASER & RIFLE SNIPER - Script Principal
// HUD de municao + luneta com zoom via Camera API
// ============================================================

import { world, system, EquipmentSlot } from "@minecraft/server";

// ==== CONFIGURACAO ====
const CONFIG = {
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
const jogadorMirando = new Map();       // player.id -> boolean
const jogadorInicioMira = new Map();    // player.id -> tick de inicio
const jogadorAvisadoZoom = new Set();   // player.id - ja recebeu aviso de Beta APIs

// ==== FUNCAO: CONTAR MUNICAO ====
function contarMunicao(jogador, tipoMunicao) {
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
function ativarZoom(jogador) {
    try {
        jogador.camera.setFov({
            fov: CONFIG.fovZoom,
            easeOptions: {
                easeTime: CONFIG.tempoTransicao,
                easeType: "Linear"
            }
        });
    } catch (e) {
        if (!jogadorAvisadoZoom.has(jogador.id)) {
            jogadorAvisadoZoom.add(jogador.id);
            try {
                jogador.sendMessage("§cZoom indisponível - habilite Beta APIs nas configurações do mundo");
            } catch (e2) {}
        }
    }
}

// ==== FUNCAO: DESATIVAR ZOOM ====
function desativarZoom(jogador) {
    try {
        jogador.camera.setFov({
            fov: CONFIG.fovNormal,
            easeOptions: {
                easeTime: CONFIG.tempoTransicao,
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
                if (tipoItem !== CONFIG.identificadorSniper && jogadorMirando.get(jogador.id)) {
                    jogadorMirando.set(jogador.id, false);
                    desativarZoom(jogador);
                }

                if (!itemMao) continue;

                // Se esta mirando com sniper, mostra HUD da luneta
                if (tipoItem === CONFIG.identificadorSniper && jogadorMirando.get(jogador.id)) {
                    const totalMunicao = contarMunicao(jogador, CONFIG.identificadorMunicaoSniper);
                    const tickInicio = jogadorInicioMira.get(jogador.id) || system.currentTick;
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

                if (tipoItem === CONFIG.identificadorPistola) {
                    tipoMunicao = CONFIG.identificadorMunicao;
                    nomeArma = "Pistola";
                } else if (tipoItem === CONFIG.identificadorSniper) {
                    tipoMunicao = CONFIG.identificadorMunicaoSniper;
                    nomeArma = "Sniper";
                } else {
                    continue;
                }

                const totalMunicao = contarMunicao(jogador, tipoMunicao);

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
}, CONFIG.intervaloLuneta);

// ==== EVENTO: COMECOU A MIRAR (segurando botao) ====
world.afterEvents.itemStartUse.subscribe((evento) => {
    try {
        const jogador = evento.source;
        const item = evento.itemStack;

        if (!item || item.typeId !== CONFIG.identificadorSniper) return;

        // Marcar que esta mirando
        jogadorMirando.set(jogador.id, true);
        jogadorInicioMira.set(jogador.id, system.currentTick);

        // Zoom via Camera API (NAO usa Slowness!)
        ativarZoom(jogador);

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

        if (jogadorMirando.get(jogador.id)) {
            jogadorMirando.set(jogador.id, false);
            desativarZoom(jogador);
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
        if (tipoItem === CONFIG.identificadorPistola) {
            try {
                jogador.playSound("firework.blast", { volume: 0.5, pitch: 1.8 });
            } catch (e) {}
        }

        // Rifle Sniper - disparo poderoso + desativar zoom
        if (tipoItem === CONFIG.identificadorSniper) {
            jogadorMirando.set(jogador.id, false);
            desativarZoom(jogador);

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
        if (tipoProjetil === CONFIG.identificadorProjetil) {
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
        if (tipoProjetil === CONFIG.identificadorProjetilSniper) {
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
        if (jogadorMirando.get(jogador.id)) {
            jogadorMirando.set(jogador.id, false);
            desativarZoom(jogador);
        }
    } catch (e) {}
});

// ==== LIMPEZA: JOGADOR SAI ====
world.afterEvents.playerLeave.subscribe((evento) => {
    jogadorMirando.delete(evento.playerId);
    jogadorInicioMira.delete(evento.playerId);
    jogadorAvisadoZoom.delete(evento.playerId);
});
