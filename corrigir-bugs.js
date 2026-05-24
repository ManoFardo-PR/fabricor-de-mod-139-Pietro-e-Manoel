#!/usr/bin/env node
// corrigir-bugs.js
// Aplica em batch os fixes mecanizaveis identificados pela auditoria de integridade.
// Zero dependencias externas. Idempotente. Suporta --dry-run, --no-backup, --apenas, --pular, --strict, --no-validate.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");

// ==== Configuracao ==========================================================

const RAIZ = __dirname;

const COR = {
    reset: "\x1b[0m",
    verde: "\x1b[32m",
    amarelo: "\x1b[33m",
    vermelho: "\x1b[31m",
    ciano: "\x1b[36m",
    cinza: "\x1b[90m",
    negrito: "\x1b[1m",
};

// ==== Parser de argumentos ==================================================

function parseArgs(argv) {
    const args = {
        dryRun: false,
        backup: true,
        validate: true,
        strict: false,
        apenas: null,
        pular: [],
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === "--dry-run") args.dryRun = true;
        else if (a === "--no-backup") args.backup = false;
        else if (a === "--no-validate") args.validate = false;
        else if (a === "--strict") args.strict = true;
        else if (a === "--apenas") args.apenas = argv[++i];
        else if (a === "--pular") args.pular.push(argv[++i]);
        else if (a === "--help" || a === "-h") {
            imprimirAjuda();
            process.exit(0);
        } else {
            console.error(`${COR.vermelho}Argumento desconhecido: ${a}${COR.reset}`);
            imprimirAjuda();
            process.exit(2);
        }
    }
    return args;
}

function imprimirAjuda() {
    console.log(`
Uso: node corrigir-bugs.js [opcoes]

Opcoes:
  --dry-run         Mostra o que faria sem escrever
  --no-backup       Nao cria arquivo .bak antes de modificar
  --apenas <fixN>   Roda apenas um dos fixes (ex: --apenas fix3)
  --pular <fixN>    Pula um fix especifico (pode repetir)
  --strict          Para no primeiro erro (padrao: continua)
  --no-validate     Pula validacao final (parse JSON + node --check)
  -h, --help        Mostra esta ajuda

Fixes:
  fix1  Sincronizar Armadura de Slime no pack unificado (6 arquivos)
  fix2  Criar loot_tables/empty.json em 2 BPs
  fix3  Corrigir render_controller do Rifle Sniper
  fix4  Calmar bounce do Sinalizador (2 main.js)
`);
}

// ==== Helpers ===============================================================

function hashMd5(buf) {
    return crypto.createHash("md5").update(buf).digest("hex");
}

function arquivosIdenticos(origem, destino) {
    if (!fs.existsSync(destino)) return false;
    const a = fs.readFileSync(origem);
    const b = fs.readFileSync(destino);
    if (a.length !== b.length) return false;
    return hashMd5(a) === hashMd5(b);
}

function fazerBackup(destino, args) {
    if (!args.backup) return;
    if (!fs.existsSync(destino)) return;
    const bak = destino + ".bak";
    if (fs.existsSync(bak)) return; // ja existe backup; nao sobrescrever
    fs.copyFileSync(destino, bak);
}

function criarPastaSeNecessario(diretorio, args) {
    if (fs.existsSync(diretorio)) return;
    if (args.dryRun) {
        log("cinza", `      [dry-run] mkdir -p ${path.relative(RAIZ, diretorio)}`);
        return;
    }
    fs.mkdirSync(diretorio, { recursive: true });
}

function copiarArquivo(origem, destino, args) {
    if (!fs.existsSync(origem)) {
        throw new Error(`Origem nao encontrada: ${origem}`);
    }
    if (arquivosIdenticos(origem, destino)) {
        log("cinza", `      ja identico: ${path.relative(RAIZ, destino)}`);
        return false; // nao copiou
    }
    criarPastaSeNecessario(path.dirname(destino), args);
    if (args.dryRun) {
        log("cinza", `      [dry-run] copiaria: ${path.relative(RAIZ, origem)} -> ${path.relative(RAIZ, destino)}`);
        return true;
    }
    fazerBackup(destino, args);
    fs.copyFileSync(origem, destino);
    log("verde", `      copiado: ${path.relative(RAIZ, destino)}`);
    return true;
}

function escreverArquivo(destino, conteudo, args) {
    if (fs.existsSync(destino)) {
        const atual = fs.readFileSync(destino, "utf8");
        if (atual === conteudo) {
            log("cinza", `      ja identico: ${path.relative(RAIZ, destino)}`);
            return false;
        }
    }
    criarPastaSeNecessario(path.dirname(destino), args);
    if (args.dryRun) {
        log("cinza", `      [dry-run] escreveria: ${path.relative(RAIZ, destino)}`);
        return true;
    }
    fazerBackup(destino, args);
    fs.writeFileSync(destino, conteudo, "utf8");
    log("verde", `      escrito: ${path.relative(RAIZ, destino)}`);
    return true;
}

function substituirNoArquivo(destino, encontrar, substituir, args) {
    if (!fs.existsSync(destino)) {
        throw new Error(`Arquivo nao encontrado: ${destino}`);
    }
    const original = fs.readFileSync(destino, "utf8");
    if (original.includes(substituir) && !original.includes(encontrar)) {
        log("cinza", `      ja corrigido: ${path.relative(RAIZ, destino)}`);
        return false;
    }
    if (!original.includes(encontrar)) {
        throw new Error(`Padrao nao encontrado em ${destino}: ${encontrar}`);
    }
    const novo = original.split(encontrar).join(substituir);
    if (args.dryRun) {
        log("cinza", `      [dry-run] substituiria em: ${path.relative(RAIZ, destino)}`);
        return true;
    }
    fazerBackup(destino, args);
    fs.writeFileSync(destino, novo, "utf8");
    log("verde", `      substituido em: ${path.relative(RAIZ, destino)}`);
    return true;
}

function log(cor, msg) {
    console.log(`${COR[cor] || ""}${msg}${COR.reset}`);
}

function logFix(num, descricao) {
    log("ciano", `\n${COR.negrito}[FIX ${num}] ${descricao}${COR.reset}`);
}

// ==== Fixes =================================================================

function fix1_slimeParity(args) {
    const origemBase = path.join(RAIZ, "Armadura de Slime", "Armadura de Slime RP");
    const destinoBase = path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel RP");

    const attachables = [
        "capacete_slime.json",
        "peitoral_slime.json",
        "calcas_slime.json",
        "botas_slime.json",
    ];
    const texturas = ["slime_armor_1.png", "slime_armor_2.png"];

    let mudou = 0;
    for (const nome of attachables) {
        const origem = path.join(origemBase, "attachables", nome);
        const destino = path.join(destinoBase, "attachables", nome);
        if (copiarArquivo(origem, destino, args)) mudou++;
    }
    for (const nome of texturas) {
        const origem = path.join(origemBase, "textures", "models", "armor", nome);
        const destino = path.join(destinoBase, "textures", "models", "armor", nome);
        if (copiarArquivo(origem, destino, args)) mudou++;
    }
    return mudou;
}

function fix2_emptyLoot(args) {
    const conteudo = JSON.stringify({ pools: [] }, null, 2) + "\n";
    const destinos = [
        path.join(RAIZ, "Multiplicador", "Multiplicador BP", "loot_tables", "empty.json"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel BP", "loot_tables", "empty.json"),
    ];
    let mudou = 0;
    for (const destino of destinos) {
        if (escreverArquivo(destino, conteudo, args)) mudou++;
    }
    return mudou;
}

function fix3_renderRifle(args) {
    const destino = path.join(
        RAIZ,
        "Pistola Laser",
        "Pistola Laser RP",
        "attachables",
        "rifle_sniper.json"
    );
    const encontrar = `"controller.render.default"`;
    const substituir = `"controller.render.item_default"`;
    return substituirNoArquivo(destino, encontrar, substituir, args) ? 1 : 0;
}

function fix4_bounceTuning(args) {
    const arquivos = [
        path.join(RAIZ, "Super Picareta", "Super Picareta BP", "scripts", "main.js"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel BP", "scripts", "main.js"),
    ];
    const encontrar = `        maxBounces: 2,
        default: { velocityLoss: 0.3, minVertical: 0.1, maxVertical: -0.1 },`;
    const substituir = `        maxBounces: 1,
        default: { velocityLoss: 0.2, minVertical: 0.05, maxVertical: -0.05 },`;

    let mudou = 0;
    for (const arquivo of arquivos) {
        if (substituirNoArquivo(arquivo, encontrar, substituir, args)) mudou++;
    }
    return mudou;
}

// ==== Validacao =============================================================

function validar() {
    log("ciano", `\n${COR.negrito}[VALIDACAO]${COR.reset}`);
    let erros = 0;

    const scripts = [
        path.join(RAIZ, "Super Picareta", "Super Picareta BP", "scripts", "main.js"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel BP", "scripts", "main.js"),
    ];
    for (const s of scripts) {
        if (!fs.existsSync(s)) continue;
        try {
            execFileSync(process.execPath, ["--check", s], { stdio: "pipe" });
            log("verde", `      OK syntax: ${path.relative(RAIZ, s)}`);
        } catch (e) {
            log("vermelho", `      ERRO syntax: ${path.relative(RAIZ, s)}`);
            log("vermelho", `        ${(e.stderr || e.stdout || "" + e).toString().trim()}`);
            erros++;
        }
    }

    const jsons = [
        path.join(RAIZ, "Pistola Laser", "Pistola Laser RP", "attachables", "rifle_sniper.json"),
        path.join(RAIZ, "Multiplicador", "Multiplicador BP", "loot_tables", "empty.json"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel BP", "loot_tables", "empty.json"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel RP", "attachables", "capacete_slime.json"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel RP", "attachables", "peitoral_slime.json"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel RP", "attachables", "calcas_slime.json"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel RP", "attachables", "botas_slime.json"),
    ];
    for (const j of jsons) {
        if (!fs.existsSync(j)) {
            log("amarelo", `      ausente (sera criado em rodada nao-dry): ${path.relative(RAIZ, j)}`);
            continue;
        }
        try {
            JSON.parse(fs.readFileSync(j, "utf8"));
            log("verde", `      OK json: ${path.relative(RAIZ, j)}`);
        } catch (e) {
            log("vermelho", `      ERRO json: ${path.relative(RAIZ, j)}: ${e.message}`);
            erros++;
        }
    }

    const pngs = [
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel RP", "textures", "models", "armor", "slime_armor_1.png"),
        path.join(RAIZ, "Mods Pietro e Manoel", "Mods Pietro e Manoel RP", "textures", "models", "armor", "slime_armor_2.png"),
    ];
    for (const p of pngs) {
        if (!fs.existsSync(p)) {
            log("amarelo", `      ausente (sera criado em rodada nao-dry): ${path.relative(RAIZ, p)}`);
            continue;
        }
        const stat = fs.statSync(p);
        if (stat.size === 0) {
            log("vermelho", `      ERRO png vazio: ${path.relative(RAIZ, p)}`);
            erros++;
        } else {
            log("verde", `      OK png (${stat.size} bytes): ${path.relative(RAIZ, p)}`);
        }
    }

    return erros;
}

// ==== Main ==================================================================

function main() {
    const args = parseArgs(process.argv.slice(2));

    log("negrito", "===========================================");
    log("negrito", "  corrigir-bugs.js - fixes mecanizaveis");
    log("negrito", "===========================================");
    if (args.dryRun) log("amarelo", "MODO DRY-RUN: nada sera escrito");
    if (!args.backup) log("amarelo", "Backup desativado");

    const fixes = [
        { id: "fix1", desc: "Sincronizar Armadura de Slime no pack unificado", fn: fix1_slimeParity },
        { id: "fix2", desc: "Criar loot_tables/empty.json", fn: fix2_emptyLoot },
        { id: "fix3", desc: "Render controller do Rifle Sniper", fn: fix3_renderRifle },
        { id: "fix4", desc: "Calmar bounce do Sinalizador", fn: fix4_bounceTuning },
    ];

    let aplicados = 0;
    let pulados = 0;
    let erros = 0;

    for (const f of fixes) {
        if (args.apenas && args.apenas !== f.id) {
            pulados++;
            continue;
        }
        if (args.pular.includes(f.id)) {
            logFix(f.id.replace("fix", ""), f.desc);
            log("amarelo", "      pulado (--pular)");
            pulados++;
            continue;
        }
        logFix(f.id.replace("fix", ""), f.desc);
        try {
            const mudancas = f.fn(args);
            if (mudancas === 0) {
                log("cinza", "      nada a fazer (ja aplicado)");
            } else {
                log("verde", `      ${mudancas} mudanca(s)`);
            }
            aplicados++;
        } catch (e) {
            log("vermelho", `      ERRO: ${e.message}`);
            erros++;
            if (args.strict) {
                log("vermelho", "Abortando (--strict)");
                process.exit(1);
            }
        }
    }

    log("negrito", "\n===========================================");
    log("verde", `Aplicados (sem erro): ${aplicados}`);
    log("cinza", `Pulados: ${pulados}`);
    if (erros > 0) log("vermelho", `Erros: ${erros}`);
    else log("verde", `Erros: 0`);

    if (args.validate) {
        const errosValidacao = validar();
        if (errosValidacao > 0) {
            log("vermelho", `\nValidacao falhou: ${errosValidacao} erro(s)`);
            process.exit(1);
        } else {
            log("verde", "\nValidacao OK");
        }
    }

    process.exit(erros > 0 ? 1 : 0);
}

main();
