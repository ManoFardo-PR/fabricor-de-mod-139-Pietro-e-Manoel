// Validador de addons Minecraft Bedrock
// Uso: node _validar.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT = process.cwd();
const ADDONS = [
  "Super Picareta",
  "Armadura de Slime",
  "Pistola Laser",
  "Cactus Zumbi",
  "Multiplicador",
  "Mods Pietro e Manoel",
];

const C = (s, c) => `\x1b[${c}m${s}\x1b[0m`;
const ok = (s) => C(`  [OK]   ${s}`, "32");
const warn = (s) => C(`  [WARN] ${s}`, "33");
const err = (s) => C(`  [ERR]  ${s}`, "31");

function walk(dir, ext) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, ext));
    else if (!ext || p.endsWith(ext)) out.push(p);
  }
  return out;
}

function parseJson(file) {
  try {
    const raw = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
    return { data: JSON.parse(raw), error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}

function existsAnyExt(base, exts) {
  return exts.some((e) => fs.existsSync(base + e));
}

const report = { critico: [], alto: [], medio: [], baixo: [], info: [] };
const push = (sev, addon, msg) => report[sev].push(`[${addon}] ${msg}`);

for (const addon of ADDONS) {
  console.log(C(`\n=== ${addon} ===`, "36"));
  const bpDir = path.join(ROOT, addon, `${addon} BP`);
  const rpDir = path.join(ROOT, addon, `${addon} RP`);

  if (!fs.existsSync(bpDir)) { console.log(err(`BP nao encontrado: ${bpDir}`)); push("critico", addon, "BP nao encontrado"); continue; }
  if (!fs.existsSync(rpDir)) { console.log(err(`RP nao encontrado: ${rpDir}`)); push("critico", addon, "RP nao encontrado"); continue; }

  // === MANIFESTS ===
  const bpMan = parseJson(path.join(bpDir, "manifest.json"));
  const rpMan = parseJson(path.join(rpDir, "manifest.json"));
  if (bpMan.error) { console.log(err(`BP manifest invalido: ${bpMan.error}`)); push("critico", addon, `BP manifest invalido: ${bpMan.error}`); }
  if (rpMan.error) { console.log(err(`RP manifest invalido: ${rpMan.error}`)); push("critico", addon, `RP manifest invalido: ${rpMan.error}`); }

  let rpHeaderUuid = null;
  if (rpMan.data) rpHeaderUuid = rpMan.data.header?.uuid;
  if (bpMan.data) {
    const bpDeps = bpMan.data.dependencies || [];
    const hasRpDep = bpDeps.some((d) => d.uuid === rpHeaderUuid);
    if (rpHeaderUuid && !hasRpDep) { console.log(warn(`BP nao tem dependency para UUID do RP (${rpHeaderUuid})`)); push("medio", addon, "BP sem dependency para UUID do RP"); }
    const hasScriptMod = (bpMan.data.modules || []).some((m) => m.type === "script");
    const hasServerDep = bpDeps.some((d) => d.module_name === "@minecraft/server");
    if (hasScriptMod && !hasServerDep) { console.log(warn("modulo script sem dependency @minecraft/server")); push("medio", addon, "modulo script sem dependency @minecraft/server"); }
    if (hasScriptMod) {
      const scriptMod = bpMan.data.modules.find((m) => m.type === "script");
      const entry = scriptMod.entry;
      if (entry && !fs.existsSync(path.join(bpDir, entry))) { console.log(err(`entry de script nao existe: ${entry}`)); push("critico", addon, `entry de script nao existe: ${entry}`); }
    }
  }

  // === JSONs ===
  const allJson = [...walk(bpDir, ".json"), ...walk(rpDir, ".json")];
  let jsonErrs = 0;
  for (const f of allJson) {
    const r = parseJson(f);
    if (r.error) { jsonErrs++; console.log(err(`JSON invalido: ${path.relative(ROOT, f)} -> ${r.error}`)); push("critico", addon, `JSON invalido: ${path.relative(ROOT, f)}`); }
  }
  if (jsonErrs === 0) console.log(ok(`${allJson.length} JSONs parseados`));

  // === SCRIPTS ===
  const scripts = walk(path.join(bpDir, "scripts"), ".js");
  for (const s of scripts) {
    try {
      execSync(`node --check "${s}"`, { stdio: "pipe" });
      console.log(ok(`sintaxe JS ok: ${path.relative(ROOT, s)}`));
    } catch (e) {
      const m = (e.stderr || e.stdout || "").toString().slice(0, 300);
      console.log(err(`sintaxe JS: ${path.relative(ROOT, s)} -> ${m.split("\n")[0]}`));
      push("critico", addon, `sintaxe JS: ${path.relative(ROOT, s)}`);
    }
  }

  // === ITENS ===
  const itemFiles = walk(path.join(bpDir, "items"), ".item.json");
  const itemIds = new Set();
  const itemIcons = new Map();
  for (const f of itemFiles) {
    const r = parseJson(f);
    if (!r.data) continue;
    const it = r.data["minecraft:item"];
    if (!it) continue;
    const id = it.description?.identifier;
    if (id) itemIds.add(id);
    const icon = it.components?.["minecraft:icon"];
    let iconName = null;
    if (typeof icon === "string") iconName = icon;
    else if (icon?.textures?.default) iconName = icon.textures.default;
    if (id && iconName) itemIcons.set(id, iconName);
  }

  // === item_texture.json ===
  const itexFile = path.join(rpDir, "textures", "item_texture.json");
  let itexMap = {};
  if (fs.existsSync(itexFile)) {
    const r = parseJson(itexFile);
    if (r.data) itexMap = r.data.texture_data || {};
  } else if (itemFiles.length > 0) {
    console.log(err("item_texture.json nao existe mas ha itens"));
    push("critico", addon, "item_texture.json ausente");
  }
  for (const [id, icon] of itemIcons) {
    const entry = itexMap[icon];
    if (!entry) { console.log(err(`icon "${icon}" do item ${id} nao mapeado em item_texture.json`)); push("alto", addon, `icon "${icon}" nao mapeado (item ${id})`); continue; }
    const tex = entry.textures;
    const texPath = path.join(rpDir, tex);
    if (!existsAnyExt(texPath, [".png", ".tga", ".jpg"])) { console.log(err(`textura nao existe: ${tex} (icon ${icon})`)); push("alto", addon, `textura nao existe: ${tex}`); }
  }
  if (itemFiles.length > 0 && fs.existsSync(itexFile)) console.log(ok(`${itemFiles.length} itens, item_texture mapeia ${Object.keys(itexMap).length}`));

  // === ATTACHABLES ===
  const attFiles = walk(path.join(rpDir, "attachables"), ".json");
  const attIds = new Set();
  for (const f of attFiles) {
    const r = parseJson(f);
    if (!r.data) continue;
    const a = r.data["minecraft:attachable"];
    const id = a?.description?.identifier;
    if (id) attIds.add(id);
    const texs = a?.description?.textures || {};
    for (const k of Object.keys(texs)) {
      const tex = texs[k];
      if (tex.startsWith("textures/misc/")) continue; // vanilla
      const texPath = path.join(rpDir, tex);
      if (!existsAnyExt(texPath, [".png", ".tga"])) { console.log(warn(`attachable ${id} textura ${k} ausente: ${tex}`)); push("medio", addon, `attachable ${id} textura ausente: ${tex}`); }
    }
    if (id && !itemIds.has(id)) { console.log(warn(`attachable ${id} sem item BP correspondente`)); push("medio", addon, `attachable sem item BP: ${id}`); }
  }

  // === ENTIDADES BP/RP ===
  const entBp = walk(path.join(bpDir, "entities"), ".entity.json");
  const entRpDir = path.join(rpDir, "entity");
  const entRp = walk(entRpDir, ".entity.json");
  const entBpIds = new Set();
  for (const f of entBp) {
    const r = parseJson(f);
    if (!r.data) continue;
    const id = r.data["minecraft:entity"]?.description?.identifier;
    if (id) entBpIds.add(id);
  }
  const entRpIds = new Set();
  for (const f of entRp) {
    const r = parseJson(f);
    if (!r.data) continue;
    const d = r.data["minecraft:client_entity"]?.description;
    const id = d?.identifier;
    if (id) entRpIds.add(id);
    if (id && !entBpIds.has(id)) { console.log(warn(`client_entity ${id} sem entidade BP`)); push("medio", addon, `client_entity sem BP: ${id}`); }
    // textura
    for (const [k, v] of Object.entries(d?.textures || {})) {
      const p = path.join(rpDir, v + ".png");
      if (!fs.existsSync(p) && !fs.existsSync(path.join(rpDir, v + ".tga"))) { console.log(err(`textura entidade ${id} (${k}) ausente: ${v}.png`)); push("alto", addon, `textura entidade ausente: ${v}.png (${id})`); }
    }
    // geometria
    for (const [k, v] of Object.entries(d?.geometry || {})) {
      const geoFiles = walk(path.join(rpDir, "models"), ".geo.json");
      let found = false;
      for (const gf of geoFiles) {
        const gr = parseJson(gf);
        if (!gr.data) continue;
        if (gr.data["minecraft:geometry"]) {
          for (const g of gr.data["minecraft:geometry"]) {
            if (g.description?.identifier === v) { found = true; break; }
          }
        } else if (gr.data[v]) found = true;
        if (found) break;
      }
      if (!found) { console.log(err(`geometria nao encontrada: ${v} (entidade ${id})`)); push("alto", addon, `geometria nao encontrada: ${v} (${id})`); }
    }
    // animacoes
    for (const [k, v] of Object.entries(d?.animations || {})) {
      const animFiles = walk(path.join(rpDir, "animations"), ".json");
      let found = false;
      for (const af of animFiles) {
        const ar = parseJson(af);
        if (ar.data?.animations?.[v]) { found = true; break; }
      }
      // animation controllers
      if (!found && v.startsWith("controller.")) {
        const acFiles = walk(path.join(rpDir, "animation_controllers"), ".json");
        for (const af of acFiles) {
          const ar = parseJson(af);
          if (ar.data?.animation_controllers?.[v]) { found = true; break; }
        }
      }
      if (!found) { console.log(warn(`animacao nao encontrada: ${v} (entidade ${id})`)); push("medio", addon, `animacao nao encontrada: ${v} (${id})`); }
    }
  }
  for (const bpId of entBpIds) {
    if (!entRpIds.has(bpId)) { console.log(warn(`entidade BP ${bpId} sem client_entity RP`)); push("medio", addon, `entidade BP sem RP: ${bpId}`); }
  }

  // === RECEITAS ===
  const recipes = walk(path.join(bpDir, "recipes"), ".recipe.json");
  for (const f of recipes) {
    const r = parseJson(f);
    if (!r.data) continue;
    const rec = r.data["minecraft:recipe_shaped"] || r.data["minecraft:recipe_shapeless"] || r.data["minecraft:recipe_furnace"];
    if (!rec) continue;
    const result = rec.result?.item;
    if (result && result.includes(":") && !result.startsWith("minecraft:")) {
      if (!itemIds.has(result)) { console.log(warn(`receita produz item desconhecido: ${result} em ${path.basename(f)}`)); push("medio", addon, `receita produz item desconhecido: ${result}`); }
    }
    // ingredientes
    const ingredients = rec.key ? Object.values(rec.key) : (rec.ingredients || []);
    for (const ing of ingredients) {
      const it = ing.item;
      if (it && it.includes(":") && !it.startsWith("minecraft:") && !itemIds.has(it)) {
        console.log(warn(`receita usa ingrediente desconhecido: ${it} em ${path.basename(f)}`));
        push("medio", addon, `receita usa ingrediente desconhecido: ${it}`);
      }
    }
    // pattern keys
    if (rec.pattern && rec.key) {
      const usedChars = new Set(rec.pattern.join("").replace(/ /g, "").split(""));
      const definedChars = new Set(Object.keys(rec.key));
      for (const c of usedChars) if (!definedChars.has(c)) { console.log(err(`receita ${path.basename(f)}: char '${c}' usado no pattern mas nao em key`)); push("alto", addon, `receita ${path.basename(f)}: char '${c}' nao definido`); }
    }
  }

  // === TRADUCOES ===
  for (const lang of ["pt_BR.lang", "en_US.lang"]) {
    const lf = path.join(rpDir, "texts", lang);
    if (!fs.existsSync(lf)) { console.log(warn(`${lang} ausente`)); push("medio", addon, `${lang} ausente`); continue; }
    const content = fs.readFileSync(lf, "utf8");
    const keys = new Set(content.split(/\r?\n/).map((l) => l.split("=")[0].trim()).filter(Boolean));
    for (const id of itemIds) {
      const key = `item.${id}.name`;
      if (!keys.has(key)) { console.log(warn(`${lang} sem traducao: ${key}`)); push("medio", addon, `${lang} sem traducao: ${key}`); }
    }
    for (const id of entBpIds) {
      const key = `entity.${id}.name`;
      if (!keys.has(key)) { console.log(warn(`${lang} sem traducao: ${key}`)); push("medio", addon, `${lang} sem traducao: ${key}`); }
    }
  }
}

// === RESUMO FINAL ===
console.log(C("\n\n================== RESUMO ==================", "35"));
for (const sev of ["critico", "alto", "medio", "baixo"]) {
  const list = report[sev];
  if (!list.length) continue;
  const col = sev === "critico" ? "31" : sev === "alto" ? "31" : sev === "medio" ? "33" : "36";
  console.log(C(`\n--- ${sev.toUpperCase()} (${list.length}) ---`, col));
  for (const m of list) console.log("  " + m);
}
console.log(C(`\nTotal: ${report.critico.length} criticos, ${report.alto.length} altos, ${report.medio.length} medios, ${report.baixo.length} baixos`, "35"));
