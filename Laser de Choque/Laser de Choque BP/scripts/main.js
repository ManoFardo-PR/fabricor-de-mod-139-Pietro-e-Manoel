// ============================================================
// LASER DE CHOQUE - Script Principal
// Base no chao dispara uma ancora ate o teto; entre base e
// receptor forma-se um feixe laser que da choque eletrico.
// Duas variantes: VERMELHO (chama vermelha, cerca eletrica) e
// RELAMPAGO (faiscas tremulando, raio real em quem atravessa).
// Especificacao completa: documentacao/ESPECIFICACAO.md
// ============================================================

import { world, system, EntityDamageCause, ItemStack, BlockPermutation, MolangVariableMap, EquipmentSlot } from "@minecraft/server";

// ==== CONFIGURACAO ====
const CONFIG = {
    // Identificadores compartilhados
    idReceptor: "laser_choque:receptor_laser",
    idAncora: "laser_choque:ancora_voadora",
    estadoAtivo: "laser_choque:ativo",      // block state da base (lente acesa + luz)
    estadoTipo: "laser_choque:tipo",        // block state do receptor (cor da lente)
    chavePersistencia: "laser_choque:dispositivos",

    // Busca de teto
    alturaMaxima: 32,           // blocos de raycast para cima
    vaoMinimo: 2,               // yTeto - yBase >= 2 (pelo menos 1 celula de feixe)
    maxDispositivos: 32,        // por mundo

    // Ancora voadora
    velocidadeSubida: 0.5,      // blocos por tick (10 blocos/s)
    timeoutAncora: 100,         // ticks ate matar ancora perdida
    offsetAncoraTeto: 0.8125,   // 13/16: pe da entidade quando "grudada" (coincide com o bloco receptor)

    // Choque (comum as variantes)
    raioChoque: 0.9,            // raio horizontal do cilindro
    alturaCorpoPadrao: 1.8,     // altura assumida do corpo da entidade (sem API estavel de bounding box)
    knockback: 1.2,             // forca do empurrao radial
    knockbackVertical: 0.2,
    imuneDono: false,           // true = quem colocou nao toma choque (nota: criativo nunca toma dano)
    // Armadura isolante: qualquer peca destes materiais (capacete, peitoral, calca ou bota)
    // torna a entidade imune ao feixe (sem dano, raio, efeito ou empurrao)
    armaduraIsolante: {
        ativo: true,
        materiais: ["diamond", "netherite"],
        particula: "minecraft:critical_hit_emitter",
        som: "random.fizz",
        cooldownAviso: 20       // ticks entre avisos visuais na mesma entidade
    },
    tiposIgnorados: new Set([
        "minecraft:item",
        "minecraft:xp_orb",
        "minecraft:lightning_bolt",
        "laser_choque:ancora_voadora"
    ]),

    // Visual do feixe (comum)
    intervaloFeixe: 2,          // ticks entre "frames" de particula
    espacamentoFeixe: 0.5,      // blocos entre particulas na coluna
    distanciaRender: 48,        // so emite particulas se houver jogador a ate 48 blocos
    particulaBloqueio: "minecraft:critical_hit_emitter",
    particulaAncora: "minecraft:endrod",

    // Manutencao
    intervaloReconciliacao: 20, // ticks entre verificacoes de integridade
    cooldownInteracao: 10,      // ticks minimos entre dois cliques na mesma base

    // Sons (vanilla)
    sons: {
        lancar: "firework.launch",
        grudar: "random.anvil_use",
        ligar: "beacon.activate",
        desligar: "beacon.deactivate",
        erro: "note.bass",
        bloqueado: "random.fizz"
    }
};

// ==== VARIANTES (uma por item/base) ====
const VARIANTES = {
    vermelho: {
        idBase: "laser_choque:base_laser_vermelho",
        dano: 2,                    // 1 coracao
        cooldownChoque: 10,         // ticks entre choques na mesma entidade (2x/s)
        efeito: { nome: "slowness", duracao: 40, amplificador: 1 },
        raioReal: false,
        feixe: {
            particula: "minecraft:colored_flame_particle",
            cor: { red: 1.0, green: 0.12, blue: 0.08 },   // chama vermelha
            tremor: 0.0,            // sem deslocamento horizontal
            nucleo: null
        },
        faisca: "minecraft:colored_flame_particle",       // no corpo de quem toma choque
        faiscaAmbiente: { particula: "minecraft:redstone_wire_dust_particle", chance: 0.3 },
        somChoque: "random.fizz"
    },
    relampago: {
        idBase: "laser_choque:base_laser_relampago",
        dano: 3,                    // garantia caso o raio real falhe em spawnar
        cooldownChoque: 40,         // raio real a cada 2 s na mesma entidade
        efeito: { nome: "slowness", duracao: 60, amplificador: 2 },
        raioReal: true,             // invoca minecraft:lightning_bolt em quem atravessa
        feixe: {
            particula: "minecraft:electric_spark_particle",
            cor: null,
            tremor: 0.25,           // faiscas deslocadas aleatoriamente: visual de raio tremulando
            nucleo: "minecraft:endrod"   // nucleo branco a cada 1 bloco
        },
        faisca: "minecraft:electric_spark_particle",
        faiscaAmbiente: { particula: "minecraft:electric_spark_particle", chance: 0.5 },
        somChoque: null             // o raio real ja faz o trovao
    }
};

const DIMENSOES = ["overworld", "nether", "the_end"];
const SLOTS_ARMADURA = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
// Ex: /^minecraft:(diamond|netherite)_(helmet|chestplate|leggings|boots)$/
const REGEX_ARMADURA_ISOLANTE = new RegExp(
    "^minecraft:(" + CONFIG.armaduraIsolante.materiais.join("|") + ")_(helmet|chestplate|leggings|boots)$"
);

// Cor da chama vermelha (MolangVariableMap reutilizado em todo spawn)
const corVermelha = new MolangVariableMap();
try { corVermelha.setColorRGB("variable.color", VARIANTES.vermelho.feixe.cor); } catch (e) {}

// ==== ESTADO ====
// dispositivos: chave "x,y,z,dim" -> registro (espelhado em DynamicProperty)
//   registro = { dim, x, y, z, tipo, yTeto, dono, estado, ligado }
//   estado   = "inativo" | "lancando" | "ativo" | "bloqueado" | "desligado"
const dispositivos = new Map();
// ancorasEmVoo: entityId -> { chave, yAlvo, tickSpawn }  (efemero)
const ancorasEmVoo = new Map();
// ultimaInteracao: chave -> tick do ultimo clique na base (efemero, anti-repeticao)
const ultimaInteracao = new Map();
// ultimoChoque: entityId -> tick do ultimo choque recebido (efemero, cooldown por entidade)
const ultimoChoque = new Map();
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
            // Registros antigos (antes das variantes) nao tinham tipo
            if (!VARIANTES[reg.tipo]) reg.tipo = "vermelho";
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

// Retorna o nome da variante ("vermelho"/"relampago") para um typeId de base, ou null
function tipoDaBase(typeId) {
    for (const tipo in VARIANTES) {
        if (VARIANTES[tipo].idBase === typeId) return tipo;
    }
    return null;
}

function varianteDe(reg) {
    return VARIANTES[reg.tipo] || VARIANTES.vermelho;
}

function obterDimensao(id) {
    try { return world.getDimension(id); } catch (e) { return null; }
}

function avisar(jogador, msg) {
    try { if (jogador) jogador.sendMessage(msg); } catch (e) {}
}

function tocarSom(dim, nome, pos, opcoes) {
    if (!nome) return;
    try { dim.playSound(nome, pos, opcoes); } catch (e) {}
}

function particula(dim, nome, pos, molang) {
    try {
        if (molang) dim.spawnParticle(nome, pos, molang);
        else dim.spawnParticle(nome, pos);
    } catch (e) {}
}

// Particula do feixe de uma variante (aplica cor quando houver)
function particulaFeixe(dim, variante, pos) {
    const molang = variante.feixe.cor ? corVermelha : null;
    particula(dim, variante.feixe.particula, pos, molang);
}

function centroBase(reg) {
    return { x: reg.x + 0.5, y: reg.y + 0.5, z: reg.z + 0.5 };
}

function novoRegistro(dimId, x, y, z, tipo, donoId) {
    return { dim: dimId, x, y, z, tipo, yTeto: null, dono: donoId, estado: "inativo", ligado: true };
}

// Limite de dispositivos atingido: remove a base recem-colocada e devolve o item
function recusarPorLimite(dim, x, y, z, idBase, jogador) {
    avisar(jogador, `§cLimite de ${CONFIG.maxDispositivos} lasers no mundo`);
    try {
        const bloco = dim.getBlock({ x, y, z });
        if (bloco && bloco.typeId === idBase) {
            bloco.setType("minecraft:air");
            dim.spawnItem(new ItemStack(idBase, 1), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
        }
    } catch (e) {}
}

// Liga/desliga a lente da base (block state -> luz + textura)
function definirLuzBase(reg, ligada) {
    try {
        const dim = obterDimensao(reg.dim);
        if (!dim) return;
        const bloco = dim.getBlock({ x: reg.x, y: reg.y, z: reg.z });
        if (!bloco || tipoDaBase(bloco.typeId) === null) return;
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

// Ancora chegou: coloca o receptor (com a cor da variante) e liga o feixe
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
        let colocado = false;
        try {
            const perm = BlockPermutation.resolve(CONFIG.idReceptor, { [CONFIG.estadoTipo]: reg.tipo });
            celula.setPermutation(perm);
            colocado = true;
        } catch (e) {}
        if (!colocado) celula.setType(CONFIG.idReceptor);   // fallback: lente padrao
    } catch (e) {
        falharLancamento(reg, null, null);
        return;
    }

    const variante = varianteDe(reg);
    const posReceptor = { x: reg.x + 0.5, y: reg.yTeto + 0.5, z: reg.z + 0.5 };
    tocarSom(dim, CONFIG.sons.grudar, posReceptor, { volume: 0.6, pitch: 1.6 });
    for (let i = 0; i < 4; i++) particula(dim, variante.faisca, posReceptor, variante.feixe.cor ? corVermelha : null);

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

function aplicarChoque(ent, dx, dz, dim, variante) {
    const loc = ent.location;

    // Variante relampago: raio de verdade em cima da entidade
    let raioCaiu = false;
    if (variante.raioReal) {
        try {
            dim.spawnEntity("minecraft:lightning_bolt", { x: loc.x, y: loc.y, z: loc.z });
            raioCaiu = true;
        } catch (e) {}
    }

    // Dano proprio (sempre no vermelho; no relampago so se o raio falhou)
    if (!raioCaiu) {
        let danoAplicado = false;
        try {
            ent.applyDamage(variante.dano, { cause: EntityDamageCause.lightning });
            danoAplicado = true;
        } catch (e) {}
        if (!danoAplicado) {
            try { ent.applyDamage(variante.dano); } catch (e) {}
        }
    }

    try {
        ent.addEffect(variante.efeito.nome, variante.efeito.duracao, {
            amplifier: variante.efeito.amplificador,
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
        const molang = variante.feixe.cor ? corVermelha : null;
        particula(dim, variante.faisca, { x: loc.x, y: loc.y + 1.0, z: loc.z }, molang);
        particula(dim, variante.faisca, { x: loc.x, y: loc.y + 0.3, z: loc.z }, molang);
        tocarSom(dim, variante.somChoque, loc, { volume: 0.7, pitch: 1.3 });
    } catch (e) {}
}

// true se a entidade veste alguma peca de armadura isolante (diamante/netherita)
function estaIsolado(ent) {
    if (!CONFIG.armaduraIsolante.ativo) return false;
    try {
        const equipavel = ent.getComponent("minecraft:equippable");
        if (!equipavel) return false;
        for (const slot of SLOTS_ARMADURA) {
            const item = equipavel.getEquipment(slot);
            if (item && REGEX_ARMADURA_ISOLANTE.test(item.typeId)) return true;
        }
    } catch (e) {}
    return false;
}

// Aviso discreto de que a armadura absorveu o choque
function avisarIsolamento(ent, dim) {
    try {
        const loc = ent.location;
        particula(dim, CONFIG.armaduraIsolante.particula, { x: loc.x, y: loc.y + 1.0, z: loc.z });
        tocarSom(dim, CONFIG.armaduraIsolante.som, loc, { volume: 0.3, pitch: 2.0 });
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
        if (!bloco) return;
        const tipo = tipoDaBase(bloco.typeId);
        if (tipo === null) return;
        const idBase = VARIANTES[tipo].idBase;
        const jogador = evento.player;
        const dim = evento.dimension;
        const dimId = dim.id;
        const { x, y, z } = bloco.location;
        const chave = chaveDe(dimId, x, y, z);

        system.run(() => {
            if (!garantirCarregado()) {
                recusarPorLimite(dim, x, y, z, idBase, jogador);   // estado ainda nao lido: nao arriscar
                return;
            }
            if (!dispositivos.has(chave) && dispositivos.size >= CONFIG.maxDispositivos) {
                recusarPorLimite(dim, x, y, z, idBase, jogador);
                return;
            }
            dispositivos.set(chave, novoRegistro(dimId, x, y, z, tipo, jogador.id));
            salvarDispositivos();
            tentarLancar(chave, jogador);
        });
    } catch (e) {}
});

// ==== EVENTO: BLOCO QUEBRADO (base ou receptor) ====
world.afterEvents.playerBreakBlock.subscribe((evento) => {
    try {
        const tipoBloco = evento.brokenBlockPermutation.type.id;
        const ehBase = tipoDaBase(tipoBloco) !== null;
        if (!ehBase && tipoBloco !== CONFIG.idReceptor) return;
        const dimId = evento.dimension.id;
        const { x, y, z } = evento.block.location;

        if (ehBase) {
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
        if (!bloco) return;
        const tipo = tipoDaBase(bloco.typeId);
        if (tipo === null) return;
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
                reg = novoRegistro(dimId, x, y, z, tipo, jogador.id);
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

// ==== EVENTO: JOGADOR SAIU (limpeza do estado efemero) ====
// O estado dos dispositivos e do mundo, nao do jogador: nao limpar aqui.
world.afterEvents.playerLeave.subscribe(() => {
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
                particula(ancora.dimension, CONFIG.particulaAncora, { x: loc.x, y: loc.y, z: loc.z });
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

    for (const reg of dispositivos.values()) {
        if (reg.estado !== "ativo" || reg.yTeto === null) continue;
        try {
            const dim = obterDimensao(reg.dim);
            if (!dim) continue;
            const variante = varianteDe(reg);

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
                const tremor = variante.feixe.tremor;
                let passo = 0;
                for (let yy = yIni; yy < yFim; yy += CONFIG.espacamentoFeixe, passo++) {
                    const ox = tremor ? (Math.random() - 0.5) * 2 * tremor : 0;
                    const oz = tremor ? (Math.random() - 0.5) * 2 * tremor : 0;
                    particulaFeixe(dim, variante, { x: cx + ox, y: yy, z: cz + oz });
                    if (variante.feixe.nucleo && passo % 2 === 0) {
                        particula(dim, variante.feixe.nucleo, { x: cx, y: yy, z: cz });
                    }
                }
                const amb = variante.faiscaAmbiente;
                if (amb && Math.random() < amb.chance) {
                    particula(dim, amb.particula, { x: cx, y: yIni + Math.random() * altura, z: cz });
                }
            }

            // ---- Choque (verificado a cada frame; cooldown por entidade) ----
            let entidades = [];
            try {
                entidades = dim.getEntities({ location: centro, maxDistance: altura / 2 + 2.0 });
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
                    const ultimo = ultimoChoque.get(ent.id);
                    // Armadura isolante: nenhum efeito, so um aviso visual espacado
                    if (estaIsolado(ent)) {
                        if (ultimo === undefined || (tick - ultimo) >= CONFIG.armaduraIsolante.cooldownAviso) {
                            ultimoChoque.set(ent.id, tick);
                            avisarIsolamento(ent, dim);
                        }
                        continue;
                    }
                    if (ultimo !== undefined && (tick - ultimo) < variante.cooldownChoque) continue;
                    ultimoChoque.set(ent.id, tick);
                    aplicarChoque(ent, dx, dz, dim, variante);
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
            if (tipoDaBase(blocoBase.typeId) === null) {
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

    const agora = system.currentTick;

    // ---- Limpeza do cooldown de choque (entidades que sairam ha > 10 s) ----
    for (const [id, tick] of ultimoChoque) {
        if (agora - tick > 200) ultimoChoque.delete(id);
    }

    // ---- Ancoras orfas (sobraram de /reload ou passaram do timeout) ----
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
