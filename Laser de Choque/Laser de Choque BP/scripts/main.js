// ============================================================
// LASER DE CHOQUE - Script Principal
// Base no chao dispara uma ancora ate o teto; entre base e
// receptor forma-se um feixe laser que da choque eletrico.
// Especificacao completa: documentacao/ESPECIFICACAO.md
// ============================================================

import { world, system, EntityDamageCause, ItemStack } from "@minecraft/server";

// ==== CONFIGURACAO ====
const CONFIG = {
    // Identificadores
    idBase: "laser_choque:base_laser",
    idReceptor: "laser_choque:receptor_laser",
    idAncora: "laser_choque:ancora_voadora",
    estadoAtivo: "laser_choque:ativo",
    chavePersistencia: "laser_choque:dispositivos",

    // Busca de teto
    alturaMaxima: 32,           // blocos de raycast para cima
    vaoMinimo: 2,               // yTeto - yBase >= 2 (pelo menos 1 celula de feixe)
    maxDispositivos: 32,        // por mundo

    // Ancora voadora
    velocidadeSubida: 0.5,      // blocos por tick (10 blocos/s)
    timeoutAncora: 100,         // ticks ate matar ancora perdida
    offsetAncoraTeto: 0.8125,   // 13/16: pe da entidade quando "grudada" (coincide com o bloco receptor)

    // Choque
    dano: 2,                    // 1 coracao por choque
    intervaloChoque: 10,        // ticks entre choques (2x por segundo)
    raioChoque: 0.6,            // raio horizontal do cilindro
    alturaCorpoPadrao: 1.8,     // altura assumida do corpo da entidade (sem API estavel de bounding box)
    knockback: 1.2,             // forca do empurrao radial
    knockbackVertical: 0.2,
    efeito: { nome: "slowness", duracao: 40, amplificador: 1 },
    imuneDono: true,            // quem colocou nao toma choque
    tiposIgnorados: new Set([
        "minecraft:item",
        "minecraft:xp_orb",
        "laser_choque:ancora_voadora"
    ]),

    // Visual do feixe
    intervaloFeixe: 2,          // ticks entre "frames" de particula
    espacamentoFeixe: 0.5,      // blocos entre particulas na coluna
    particulaFeixe: "minecraft:endrod",
    particulaFaisca: "minecraft:electric_spark_particle",
    particulaBloqueio: "minecraft:critical_hit_emitter",
    chanceFaiscaAmbiente: 0.15, // por frame, uma faisca em ponto aleatorio do feixe
    distanciaRender: 48,        // so emite particulas se houver jogador a ate 48 blocos

    // Manutencao
    intervaloReconciliacao: 20, // ticks entre verificacoes de integridade
    cooldownInteracao: 10,      // ticks minimos entre dois cliques na mesma base (evita liga/desliga ao segurar)

    // Sons (vanilla)
    sons: {
        lancar: "firework.launch",
        grudar: "random.anvil_use",
        ligar: "beacon.activate",
        desligar: "beacon.deactivate",
        choque: "random.fizz",
        erro: "note.bass",
        bloqueado: "random.fizz"
    }
};

const DIMENSOES = ["overworld", "nether", "the_end"];

// ==== ESTADO ====
// dispositivos: chave "x,y,z,dim" -> registro (espelhado em DynamicProperty)
//   registro = { dim, x, y, z, yTeto, dono, estado, ligado, tickLancamento }
//   estado   = "inativo" | "lancando" | "ativo" | "bloqueado" | "desligado"
const dispositivos = new Map();
// ancorasEmVoo: entityId -> { chave, yAlvo, tickSpawn }  (efemero)
const ancorasEmVoo = new Map();
// ultimaInteracao: chave -> tick do ultimo clique na base (efemero, anti-repeticao)
const ultimaInteracao = new Map();
let dispositivosCarregados = false;

// ==== PERSISTENCIA ====
// Regra: NUNCA salvar antes de carregar, senao um evento no primeiro segundo
// do mundo sobrescreveria os dispositivos salvos com um Map quase vazio.
function salvarDispositivos() {
    if (!dispositivosCarregados) return;
    try {
        const arr = Array.from(dispositivos.entries());
        world.setDynamicProperty(CONFIG.chavePersistencia, JSON.stringify(arr));
    } catch (e) {}
}

// Retorna true se conseguiu ler a DynamicProperty (mesmo que vazia)
function carregarDispositivos() {
    let raw;
    try {
        raw = world.getDynamicProperty(CONFIG.chavePersistencia);
    } catch (e) {
        return false;   // mundo ainda nao pronto: tentar de novo depois
    }
    try {
        if (typeof raw !== "string") return true;
        const arr = JSON.parse(raw);
        for (const [chave, reg] of arr) {
            if (dispositivos.has(chave)) continue;
            // Registro que estava LANCANDO antes do reload: a ancora morreu, volta a INATIVO
            if (reg.estado === "lancando") {
                reg.estado = "inativo";
                reg.yTeto = null;
            }
            dispositivos.set(chave, reg);
        }
    } catch (e) {}
    return true;
}

// Chamada no inicio de todo evento e loop: garante que o estado salvo foi lido
function garantirCarregado() {
    if (dispositivosCarregados) return true;
    if (carregarDispositivos()) {
        dispositivosCarregados = true;
    }
    return dispositivosCarregados;
}

// Tenta carregar o quanto antes (worldInitialize e o evento da API 1.12.0; em
// versoes novas chama-se worldLoad). Se nenhum existir, os loops carregam.
try {
    world.afterEvents.worldInitialize.subscribe(() => { garantirCarregado(); });
} catch (e) {}
try {
    world.afterEvents.worldLoad.subscribe(() => { garantirCarregado(); });
} catch (e) {}

// ==== FUNCOES AUXILIARES ====
function chaveDe(dimId, x, y, z) {
    return `${x},${y},${z},${dimId}`;
}

function obterDimensao(id) {
    try { return world.getDimension(id); } catch (e) { return null; }
}

function avisar(jogador, msg) {
    try { if (jogador) jogador.sendMessage(msg); } catch (e) {}
}

function tocarSom(dim, nome, pos, opcoes) {
    try { dim.playSound(nome, pos, opcoes); } catch (e) {}
}

function particula(dim, nome, pos) {
    try { dim.spawnParticle(nome, pos); } catch (e) {}
}

function centroBase(reg) {
    return { x: reg.x + 0.5, y: reg.y + 0.5, z: reg.z + 0.5 };
}

function novoRegistro(dimId, x, y, z, donoId) {
    return { dim: dimId, x, y, z, yTeto: null, dono: donoId, estado: "inativo", ligado: true };
}

// Limite de dispositivos atingido: remove a base recem-colocada e devolve o item
function recusarPorLimite(dim, x, y, z, jogador) {
    avisar(jogador, `§cLimite de ${CONFIG.maxDispositivos} lasers no mundo`);
    try {
        const bloco = dim.getBlock({ x, y, z });
        if (bloco && bloco.typeId === CONFIG.idBase) {
            bloco.setType("minecraft:air");
            dim.spawnItem(new ItemStack(CONFIG.idBase, 1), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
        }
    } catch (e) {}
}

// Liga/desliga a lente da base (block state -> luz + textura)
function definirLuzBase(reg, ligada) {
    try {
        const dim = obterDimensao(reg.dim);
        if (!dim) return;
        const bloco = dim.getBlock({ x: reg.x, y: reg.y, z: reg.z });
        if (!bloco || bloco.typeId !== CONFIG.idBase) return;
        const atual = bloco.permutation.getState(CONFIG.estadoAtivo);
        if (atual === ligada) return;
        bloco.setPermutation(bloco.permutation.withState(CONFIG.estadoAtivo, ligada));
    } catch (e) {}
}

// Raycast para cima a partir da base. Retorna { yTeto } ou { erro }
function acharTeto(dim, x, y, z) {
    const origem = { x: x + 0.5, y: y + 1.0, z: z + 0.5 };
    let hit;
    try {
        hit = dim.getBlockFromRay(origem, { x: 0, y: 1, z: 0 }, {
            maxDistance: CONFIG.alturaMaxima,
            includeLiquidBlocks: false,
            includePassableBlocks: false
        });
    } catch (e) {
        hit = undefined;
    }
    if (!hit || !hit.block) {
        return { erro: `§cNenhum teto encontrado em até ${CONFIG.alturaMaxima} blocos` };
    }
    const teto = hit.block;
    if (teto.typeId === CONFIG.idReceptor) {
        return { erro: "§cJá existe um laser nesta coluna" };
    }
    const yTeto = teto.location.y - 1;
    if (yTeto - y < CONFIG.vaoMinimo) {
        return { erro: `§cTeto muito baixo (precisa de pelo menos ${CONFIG.vaoMinimo} blocos de vão)` };
    }
    let celula;
    try { celula = dim.getBlock({ x, y: yTeto, z }); } catch (e) { celula = undefined; }
    if (!celula) {
        return { erro: "§cÁrea não carregada, tente novamente" };
    }
    if (!celula.isAir) {
        return { erro: "§cA célula abaixo do teto precisa estar vazia" };
    }
    return { yTeto };
}

function falharLancamento(reg, jogador, msg) {
    reg.estado = "inativo";
    reg.yTeto = null;
    definirLuzBase(reg, false);
    salvarDispositivos();
    if (msg) avisar(jogador, msg);
    const dim = obterDimensao(reg.dim);
    if (dim) tocarSom(dim, CONFIG.sons.erro, centroBase(reg), { volume: 0.6, pitch: 0.8 });
}

// Valida o teto e dispara a ancora voadora
function tentarLancar(chave, jogador) {
    const reg = dispositivos.get(chave);
    if (!reg) return;
    const dim = obterDimensao(reg.dim);
    if (!dim) return;

    const resultado = acharTeto(dim, reg.x, reg.y, reg.z);
    if (resultado.erro) {
        falharLancamento(reg, jogador, resultado.erro);
        return;
    }

    try {
        const ancora = dim.spawnEntity(CONFIG.idAncora, { x: reg.x + 0.5, y: reg.y + 0.3, z: reg.z + 0.5 });
        ancorasEmVoo.set(ancora.id, { chave, yAlvo: resultado.yTeto, tickSpawn: system.currentTick });
        reg.estado = "lancando";
        reg.yTeto = resultado.yTeto;
        salvarDispositivos();
        tocarSom(dim, CONFIG.sons.lancar, centroBase(reg), { volume: 0.8, pitch: 1.4 });
    } catch (e) {
        falharLancamento(reg, jogador, "§cFalha ao lançar a âncora");
    }
}

// Ancora chegou: coloca o receptor e liga o feixe
function concluirAncoragem(chave) {
    const reg = dispositivos.get(chave);
    if (!reg || reg.yTeto === null) return;
    const dim = obterDimensao(reg.dim);
    if (!dim) return;

    try {
        const celula = dim.getBlock({ x: reg.x, y: reg.yTeto, z: reg.z });
        if (!celula || !celula.isAir) {
            falharLancamento(reg, null, null);
            return;
        }
        celula.setType(CONFIG.idReceptor);
    } catch (e) {
        falharLancamento(reg, null, null);
        return;
    }

    const posReceptor = { x: reg.x + 0.5, y: reg.yTeto + 0.5, z: reg.z + 0.5 };
    tocarSom(dim, CONFIG.sons.grudar, posReceptor, { volume: 0.6, pitch: 1.6 });
    for (let i = 0; i < 4; i++) particula(dim, CONFIG.particulaFaisca, posReceptor);

    reg.ligado = true;
    ativarFeixe(reg);
}

function ativarFeixe(reg) {
    reg.estado = "ativo";
    definirLuzBase(reg, true);
    salvarDispositivos();
    const dim = obterDimensao(reg.dim);
    if (dim) tocarSom(dim, CONFIG.sons.ligar, centroBase(reg), { volume: 0.7, pitch: 1.2 });
}

function desligarFeixe(reg) {
    reg.estado = "desligado";
    definirLuzBase(reg, false);
    salvarDispositivos();
    const dim = obterDimensao(reg.dim);
    if (dim) tocarSom(dim, CONFIG.sons.desligar, centroBase(reg), { volume: 0.7, pitch: 1.0 });
}

function removerReceptor(reg) {
    if (reg.yTeto === null) return;
    try {
        const dim = obterDimensao(reg.dim);
        if (!dim) return;
        const bloco = dim.getBlock({ x: reg.x, y: reg.yTeto, z: reg.z });
        if (bloco && bloco.typeId === CONFIG.idReceptor) {
            bloco.setType("minecraft:air");
        }
    } catch (e) {}
}

function removerDispositivo(chave) {
    const reg = dispositivos.get(chave);
    if (!reg) return;
    removerReceptor(reg);
    dispositivos.delete(chave);
    salvarDispositivos();
}

// Bloco conta como obstrucao se nao for ar, nem liquido, nem atravessavel
// (grama alta, tocha, flor...). Se a API nao expuser isSolid, todo bloco
// nao-ar conta como obstrucao (comportamento conservador).
function blocoObstrui(bloco) {
    if (bloco.isAir || bloco.isLiquid) return false;
    try {
        if (bloco.isSolid === false) return false;
    } catch (e) {}
    return true;
}

// Retorna { y } da primeira obstrucao, false se livre, undefined se chunk descarregado
function colunaObstruida(dim, x, z, yIni, yFim) {
    for (let yy = yIni; yy <= yFim; yy++) {
        let bloco;
        try { bloco = dim.getBlock({ x, y: yy, z }); } catch (e) { bloco = undefined; }
        if (bloco === undefined) return undefined;
        if (blocoObstrui(bloco)) return { y: yy };
    }
    return false;
}

function aplicarChoque(ent, dx, dz, dim) {
    try {
        ent.applyDamage(CONFIG.dano, { cause: EntityDamageCause.lightning });
    } catch (e) {}
    try {
        ent.addEffect(CONFIG.efeito.nome, CONFIG.efeito.duracao, {
            amplifier: CONFIG.efeito.amplificador,
            showParticles: false
        });
    } catch (e) {}
    try {
        const d = Math.sqrt(dx * dx + dz * dz);
        let nx, nz;
        if (d < 0.05) {
            const ang = Math.random() * Math.PI * 2;
            nx = Math.cos(ang);
            nz = Math.sin(ang);
        } else {
            nx = dx / d;
            nz = dz / d;
        }
        ent.applyKnockback(nx, nz, CONFIG.knockback, CONFIG.knockbackVertical);
    } catch (e) {}
    try {
        const loc = ent.location;
        particula(dim, CONFIG.particulaFaisca, { x: loc.x, y: loc.y + 1.0, z: loc.z });
        particula(dim, CONFIG.particulaFaisca, { x: loc.x, y: loc.y + 0.3, z: loc.z });
        tocarSom(dim, CONFIG.sons.choque, loc, { volume: 0.7, pitch: 1.3 });
    } catch (e) {}
}

function ehEspectador(ent) {
    try {
        if (ent.typeId !== "minecraft:player") return false;
        return ent.getGameMode() === "spectator";
    } catch (e) {
        return false;
    }
}

// ==== EVENTO: BASE COLOCADA ====
world.afterEvents.playerPlaceBlock.subscribe((evento) => {
    try {
        const bloco = evento.block;
        if (!bloco || bloco.typeId !== CONFIG.idBase) return;
        const jogador = evento.player;
        const dim = evento.dimension;
        const dimId = dim.id;
        const { x, y, z } = bloco.location;
        const chave = chaveDe(dimId, x, y, z);

        system.run(() => {
            if (!garantirCarregado()) {
                recusarPorLimite(dim, x, y, z, jogador);   // estado ainda nao lido: nao arriscar
                return;
            }
            if (!dispositivos.has(chave) && dispositivos.size >= CONFIG.maxDispositivos) {
                recusarPorLimite(dim, x, y, z, jogador);
                return;
            }
            dispositivos.set(chave, novoRegistro(dimId, x, y, z, jogador.id));
            salvarDispositivos();
            tentarLancar(chave, jogador);
        });
    } catch (e) {}
});

// ==== EVENTO: BLOCO QUEBRADO (base ou receptor) ====
world.afterEvents.playerBreakBlock.subscribe((evento) => {
    try {
        const tipo = evento.brokenBlockPermutation.type.id;
        if (tipo !== CONFIG.idBase && tipo !== CONFIG.idReceptor) return;
        const dimId = evento.dimension.id;
        const { x, y, z } = evento.block.location;

        if (tipo === CONFIG.idBase) {
            system.run(() => {
                if (!garantirCarregado()) return;
                removerDispositivo(chaveDe(dimId, x, y, z));
            });
            return;
        }

        // Receptor quebrado: a base correspondente volta a INATIVO
        system.run(() => {
            if (!garantirCarregado()) return;
            for (const reg of dispositivos.values()) {
                if (reg.dim === dimId && reg.x === x && reg.z === z && reg.yTeto === y) {
                    reg.estado = "inativo";
                    reg.yTeto = null;
                    definirLuzBase(reg, false);
                    salvarDispositivos();
                    break;
                }
            }
        });
    } catch (e) {}
});

// ==== EVENTO: INTERACAO COM A BASE (mao vazia = liga/desliga/relanca) ====
world.afterEvents.playerInteractWithBlock.subscribe((evento) => {
    try {
        const bloco = evento.block;
        if (!bloco || bloco.typeId !== CONFIG.idBase) return;
        if (evento.itemStack) return;                 // so com a mao vazia
        if (evento.isFirstEvent === false) return;    // evita disparo duplo (API >= 1.14)
        const jogador = evento.player;
        const dimId = bloco.dimension.id;
        const { x, y, z } = bloco.location;
        const chave = chaveDe(dimId, x, y, z);

        // Anti-repeticao: segurar o botao nao pode ligar/desligar varias vezes
        const agora = system.currentTick;
        const ultimo = ultimaInteracao.get(chave);
        if (ultimo !== undefined && (agora - ultimo) < CONFIG.cooldownInteracao) return;
        ultimaInteracao.set(chave, agora);

        system.run(() => {
            if (!garantirCarregado()) return;
            let reg = dispositivos.get(chave);
            if (!reg) {
                // Base colocada sem registro (ex: /setblock): adotar, respeitando o limite
                if (dispositivos.size >= CONFIG.maxDispositivos) {
                    avisar(jogador, `§cLimite de ${CONFIG.maxDispositivos} lasers no mundo`);
                    return;
                }
                reg = novoRegistro(dimId, x, y, z, jogador.id);
                dispositivos.set(chave, reg);
                salvarDispositivos();
            }
            switch (reg.estado) {
                case "inativo":
                    tentarLancar(chave, jogador);
                    break;
                case "lancando":
                    break;
                case "ativo":
                case "bloqueado":
                    reg.ligado = false;
                    desligarFeixe(reg);
                    avisar(jogador, "§7Laser desligado");
                    break;
                case "desligado":
                    reg.ligado = true;
                    ativarFeixe(reg);
                    avisar(jogador, "§bLaser ligado");
                    break;
            }
        });
    } catch (e) {}
});

// ==== EVENTO: ANCORA REMOVIDA (limpeza) ====
world.afterEvents.entityRemove.subscribe((evento) => {
    try {
        if (evento.typeId === CONFIG.idAncora) {
            ancorasEmVoo.delete(evento.removedEntityId);
        }
    } catch (e) {}
});

// ==== EVENTO: JOGADOR SAIU (limpeza do estado efemero por jogador) ====
// O estado dos dispositivos e do mundo, nao do jogador: nao limpar aqui.
world.afterEvents.playerLeave.subscribe(() => {
    // ultimaInteracao e por base, nao por jogador; limpar entradas velhas (> 1 min)
    try {
        const agora = system.currentTick;
        for (const [chave, tick] of ultimaInteracao) {
            if (agora - tick > 1200) ultimaInteracao.delete(chave);
        }
    } catch (e) {}
});

// ==== LOOP A: VOO DA ANCORA (1 tick) ====
system.runInterval(() => {
    if (ancorasEmVoo.size === 0) return;
    for (const [id, voo] of ancorasEmVoo) {
        try {
            const ancora = world.getEntity(id);
            if (!ancora) {
                ancorasEmVoo.delete(id);
                continue;
            }
            const loc = ancora.location;
            const yAlvo = voo.yAlvo + CONFIG.offsetAncoraTeto;
            const novoY = loc.y + CONFIG.velocidadeSubida;

            if (novoY >= yAlvo) {
                try { ancora.remove(); } catch (e) {}
                ancorasEmVoo.delete(id);
                concluirAncoragem(voo.chave);
            } else {
                ancora.teleport({ x: loc.x, y: novoY, z: loc.z });
                particula(ancora.dimension, CONFIG.particulaFeixe, { x: loc.x, y: loc.y, z: loc.z });
            }
        } catch (e) {
            ancorasEmVoo.delete(id);
        }
    }
}, 1);

// ==== LOOP B: FEIXE (particulas) + CHOQUE ====
system.runInterval(() => {
    if (!dispositivosCarregados) return;
    const tick = system.currentTick;
    const fazChoque = tick % CONFIG.intervaloChoque === 0;

    for (const reg of dispositivos.values()) {
        if (reg.estado !== "ativo" || reg.yTeto === null) continue;
        try {
            const dim = obterDimensao(reg.dim);
            if (!dim) continue;

            const cx = reg.x + 0.5;
            const cz = reg.z + 0.5;
            const yIni = reg.y + 1;
            const yFim = reg.yTeto;
            const altura = yFim - yIni;
            const centro = { x: cx, y: yIni + altura / 2, z: cz };

            // ---- Particulas (so com jogador perto) ----
            let temJogadorPerto = false;
            try {
                temJogadorPerto = dim.getPlayers({ location: centro, maxDistance: CONFIG.distanciaRender }).length > 0;
            } catch (e) {}
            if (temJogadorPerto) {
                for (let yy = yIni; yy < yFim; yy += CONFIG.espacamentoFeixe) {
                    particula(dim, CONFIG.particulaFeixe, { x: cx, y: yy, z: cz });
                }
                if (Math.random() < CONFIG.chanceFaiscaAmbiente) {
                    particula(dim, CONFIG.particulaFaisca, { x: cx, y: yIni + Math.random() * altura, z: cz });
                }
            }

            // ---- Choque ----
            if (!fazChoque) continue;
            let entidades = [];
            try {
                entidades = dim.getEntities({ location: centro, maxDistance: altura / 2 + 1.5 });
            } catch (e) {}
            for (const ent of entidades) {
                try {
                    if (CONFIG.tiposIgnorados.has(ent.typeId)) continue;
                    if (CONFIG.imuneDono && ent.id === reg.dono) continue;
                    if (ehEspectador(ent)) continue;
                    const loc = ent.location;
                    const dx = loc.x - cx;
                    const dz = loc.z - cz;
                    if (Math.sqrt(dx * dx + dz * dz) > CONFIG.raioChoque) continue;
                    const topo = loc.y + CONFIG.alturaCorpoPadrao;
                    if (topo < yIni || loc.y > yFim) continue;
                    aplicarChoque(ent, dx, dz, dim);
                } catch (e) {}
            }
        } catch (e) {}
    }
}, CONFIG.intervaloFeixe);

// ==== LOOP C: RECONCILIACAO (integridade + obstrucao + ancoras orfas) ====
system.runInterval(() => {
    if (!garantirCarregado()) return;

    let mudou = false;
    for (const [chave, reg] of dispositivos) {
        try {
            const dim = obterDimensao(reg.dim);
            if (!dim) continue;

            let blocoBase;
            try { blocoBase = dim.getBlock({ x: reg.x, y: reg.y, z: reg.z }); } catch (e) { blocoBase = undefined; }
            if (blocoBase === undefined) continue;   // chunk descarregado: nao mexer

            // Base sumiu (explosao, piston, /setblock)
            if (blocoBase.typeId !== CONFIG.idBase) {
                removerReceptor(reg);
                dispositivos.delete(chave);
                mudou = true;
                continue;
            }

            if (reg.estado === "inativo") {
                definirLuzBase(reg, false);
                continue;
            }

            if (reg.estado === "lancando") {
                let emVoo = false;
                for (const voo of ancorasEmVoo.values()) {
                    if (voo.chave === chave) { emVoo = true; break; }
                }
                if (!emVoo) {
                    reg.estado = "inativo";
                    reg.yTeto = null;
                    definirLuzBase(reg, false);
                    mudou = true;
                }
                continue;
            }

            // ativo / bloqueado / desligado: o receptor precisa existir
            let blocoRec;
            try { blocoRec = dim.getBlock({ x: reg.x, y: reg.yTeto, z: reg.z }); } catch (e) { blocoRec = undefined; }
            if (blocoRec === undefined) continue;
            if (blocoRec.typeId !== CONFIG.idReceptor) {
                reg.estado = "inativo";
                reg.yTeto = null;
                definirLuzBase(reg, false);
                mudou = true;
                continue;
            }

            if (reg.estado === "desligado") {
                definirLuzBase(reg, false);
                continue;
            }

            const obstrucao = colunaObstruida(dim, reg.x, reg.z, reg.y + 1, reg.yTeto - 1);
            if (obstrucao === undefined) continue;

            if (obstrucao && reg.estado === "ativo") {
                reg.estado = "bloqueado";
                definirLuzBase(reg, false);
                tocarSom(dim, CONFIG.sons.bloqueado, centroBase(reg), { volume: 0.5, pitch: 0.7 });
                mudou = true;
            } else if (!obstrucao && reg.estado === "bloqueado" && reg.ligado) {
                reg.estado = "ativo";
                definirLuzBase(reg, true);
                tocarSom(dim, CONFIG.sons.ligar, centroBase(reg), { volume: 0.7, pitch: 1.2 });
                mudou = true;
            }
            if (obstrucao && reg.estado === "bloqueado") {
                particula(dim, CONFIG.particulaBloqueio, { x: reg.x + 0.5, y: obstrucao.y + 0.5, z: reg.z + 0.5 });
            }
        } catch (e) {}
    }
    if (mudou) salvarDispositivos();

    // ---- Ancoras orfas (sobraram de /reload ou passaram do timeout) ----
    const agora = system.currentTick;
    for (const nomeDim of DIMENSOES) {
        try {
            const dim = world.getDimension(nomeDim);
            for (const ent of dim.getEntities({ type: CONFIG.idAncora })) {
                const voo = ancorasEmVoo.get(ent.id);
                if (!voo || (agora - voo.tickSpawn) > CONFIG.timeoutAncora) {
                    try { ent.remove(); } catch (e) {}
                    ancorasEmVoo.delete(ent.id);
                }
            }
        } catch (e) {}
    }
}, CONFIG.intervaloReconciliacao);
