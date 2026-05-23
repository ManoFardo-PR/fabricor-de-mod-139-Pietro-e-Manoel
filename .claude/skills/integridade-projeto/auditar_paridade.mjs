// Protocolo 1 - Paridade de Pacotes Unificados
// Compara cada addon modular com o pack unificado "Mods Pietro e Manoel"
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const UNIFIED_BP = "Mods Pietro e Manoel/Mods Pietro e Manoel BP";
const UNIFIED_RP = "Mods Pietro e Manoel/Mods Pietro e Manoel RP";

const ADDONS = [
    { nome: "Super Picareta",     bp: "Super Picareta/Super Picareta BP",     rp: "Super Picareta/Super Picareta RP" },
    { nome: "Armadura de Slime",  bp: "Armadura de Slime/Armadura de Slime BP", rp: "Armadura de Slime/Armadura de Slime RP" },
    { nome: "Pistola Laser",      bp: "Pistola Laser/Pistola Laser BP",       rp: "Pistola Laser/Pistola Laser RP" },
    { nome: "Cactus Zumbi",       bp: "Cactus Zumbi/Cactus Zumbi BP",         rp: "Cactus Zumbi/Cactus Zumbi RP" },
    { nome: "Multiplicador x10",  bp: "Multiplicador x10/Multiplicador x10 BP", rp: "Multiplicador x10/Multiplicador x10 RP" }
];

// Pastas auditadas (caminho relativo ao BP ou RP)
const PATHS_BP = ["items", "entities", "recipes", "blocks", "loot_tables"];
const PATHS_RP = ["attachables", "entity", "models/entity", "render_controllers", "animations",
                  "textures/items", "textures/entity", "textures/blocks", "textures/models"];

function walk(base, sub) {
    const dir = join(base, sub);
    if (!existsSync(dir)) return [];
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(base, join(sub, entry.name)));
        else out.push(relative(base, p).replace(/\\/g, "/"));
    }
    return out;
}

function auditarPasta(addonBase, unifiedBase, subPaths) {
    const faltando = [];
    for (const sub of subPaths) {
        const arquivos = walk(addonBase, sub);
        for (const arq of arquivos) {
            const alvo = join(unifiedBase, arq);
            if (!existsSync(alvo)) faltando.push(arq);
        }
    }
    return faltando;
}

function auditarItemTexture(addonRp, unifiedRp) {
    const a = join(addonRp, "textures/item_texture.json");
    const b = join(unifiedRp, "textures/item_texture.json");
    if (!existsSync(a)) return { ausentes: [], naoLido: false };
    try {
        const addonKeys = Object.keys(JSON.parse(readFileSync(a, "utf8")).texture_data || {});
        const unifiedKeys = existsSync(b)
            ? Object.keys(JSON.parse(readFileSync(b, "utf8")).texture_data || {})
            : [];
        return { ausentes: addonKeys.filter(k => !unifiedKeys.includes(k)), naoLido: false };
    } catch { return { ausentes: [], naoLido: true }; }
}

function auditarLang(addonRp, unifiedRp, idioma) {
    const a = join(addonRp, `texts/${idioma}.lang`);
    const b = join(unifiedRp, `texts/${idioma}.lang`);
    if (!existsSync(a)) return [];
    const linhas = (s) => readFileSync(s, "utf8").split("\n")
        .map(l => l.trim()).filter(l => l && !l.startsWith("#"))
        .map(l => l.split("=")[0].trim()).filter(Boolean);
    const aKeys = linhas(a);
    const bKeys = existsSync(b) ? linhas(b) : [];
    return aKeys.filter(k => !bKeys.includes(k));
}

console.log("=".repeat(70));
console.log("AUDITORIA DE PARIDADE - Pack Unificado vs Addons Modulares");
console.log("=".repeat(70));

let totalFaltando = 0;
for (const addon of ADDONS) {
    console.log(`\n### ${addon.nome}`);
    const faltaBp = auditarPasta(addon.bp, UNIFIED_BP, PATHS_BP);
    const faltaRp = auditarPasta(addon.rp, UNIFIED_RP, PATHS_RP);
    const faltaItemTex = auditarItemTexture(addon.rp, UNIFIED_RP);
    const faltaLangPt = auditarLang(addon.rp, UNIFIED_RP, "pt_BR");
    const faltaLangEn = auditarLang(addon.rp, UNIFIED_RP, "en_US");

    const total = faltaBp.length + faltaRp.length + faltaItemTex.ausentes.length
                + faltaLangPt.length + faltaLangEn.length;
    totalFaltando += total;

    if (total === 0) { console.log("  OK - paridade completa"); continue; }

    if (faltaBp.length) {
        console.log(`  [BP] ${faltaBp.length} arquivo(s) ausente(s):`);
        faltaBp.forEach(f => console.log(`    - ${f}`));
    }
    if (faltaRp.length) {
        console.log(`  [RP] ${faltaRp.length} arquivo(s) ausente(s):`);
        faltaRp.forEach(f => console.log(`    - ${f}`));
    }
    if (faltaItemTex.ausentes.length) {
        console.log(`  [item_texture.json] ${faltaItemTex.ausentes.length} chave(s) nao presentes no unificado:`);
        faltaItemTex.ausentes.forEach(k => console.log(`    - ${k}`));
    }
    if (faltaLangPt.length) {
        console.log(`  [pt_BR.lang] ${faltaLangPt.length} chave(s) ausentes no unificado:`);
        faltaLangPt.slice(0, 5).forEach(k => console.log(`    - ${k}`));
        if (faltaLangPt.length > 5) console.log(`    ... +${faltaLangPt.length - 5}`);
    }
    if (faltaLangEn.length) {
        console.log(`  [en_US.lang] ${faltaLangEn.length} chave(s) ausentes no unificado:`);
        faltaLangEn.slice(0, 5).forEach(k => console.log(`    - ${k}`));
        if (faltaLangEn.length > 5) console.log(`    ... +${faltaLangEn.length - 5}`);
    }
}

console.log(`\n${"=".repeat(70)}\nTOTAL DE BLOQUEIOS: ${totalFaltando}\n${"=".repeat(70)}`);
