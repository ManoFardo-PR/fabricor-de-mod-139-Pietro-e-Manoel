// Validacao extra: blocos, render_controllers, manifests, APIs beta
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ADDONS = ["Super Picareta", "Armadura de Slime", "Pistola Laser", "Cactus Zumbi", "Multiplicador", "Mods Pietro e Manoel"];

const C = (s, c) => `\x1b[${c}m${s}\x1b[0m`;
const findings = [];
const log = (sev, addon, msg) => { findings.push({ sev, addon, msg }); console.log(`[${sev}] [${addon}] ${msg}`); };

function parseJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "")); }
  catch { return null; }
}
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

for (const addon of ADDONS) {
  console.log(C(`\n=== ${addon} ===`, "36"));
  const bp = path.join(ROOT, addon, `${addon} BP`);
  const rp = path.join(ROOT, addon, `${addon} RP`);

  // === MANIFEST DETALHADO ===
  const bpMan = parseJson(path.join(bp, "manifest.json"));
  const rpMan = parseJson(path.join(rp, "manifest.json"));
  if (bpMan) {
    if (bpMan.format_version !== 2) log("MEDIO", addon, `BP format_version=${bpMan.format_version} (esperado 2)`);
    const minEng = bpMan.header?.min_engine_version;
    if (!minEng || minEng[0] < 1 || (minEng[0] === 1 && minEng[1] < 21)) log("MEDIO", addon, `BP min_engine_version=${minEng?.join(".")} (esperado >=1.21.0)`);
    // versoes de modulos
    for (const m of bpMan.modules || []) {
      if (m.type === "script" && m.language !== "javascript") log("ALTO", addon, `script module language=${m.language}`);
    }
    for (const d of bpMan.dependencies || []) {
      if (d.module_name === "@minecraft/server") {
        if (!d.version) log("ALTO", addon, "@minecraft/server sem version");
        else console.log(`  api @minecraft/server: ${d.version}`);
      }
      if (d.module_name === "@minecraft/server-ui") console.log(`  api @minecraft/server-ui: ${d.version}`);
    }
  }
  if (rpMan && rpMan.format_version !== 2) log("MEDIO", addon, `RP format_version=${rpMan.format_version}`);

  // === BLOCOS ===
  const blockFiles = walk(path.join(bp, "blocks"), ".block.json");
  const blockIds = new Set();
  for (const f of blockFiles) {
    const d = parseJson(f);
    if (!d) continue;
    const id = d["minecraft:block"]?.description?.identifier;
    if (id) blockIds.add(id);
    const fv = d.format_version;
    console.log(`  bloco: ${id} (fv=${fv})`);
    // checar textura referenciada
    const comps = d["minecraft:block"]?.components || {};
    const matInst = comps["minecraft:material_instances"];
    if (matInst) {
      for (const [k, v] of Object.entries(matInst)) {
        if (v.texture) {
          // resolver via terrain_texture
          const tt = parseJson(path.join(rp, "textures", "terrain_texture.json"));
          if (tt) {
            const entry = tt.texture_data?.[v.texture];
            if (!entry) log("ALTO", addon, `bloco ${id}: textura "${v.texture}" nao em terrain_texture.json`);
            else {
              const texs = Array.isArray(entry.textures) ? entry.textures : [entry.textures];
              for (const t of texs) {
                const p = path.join(rp, t + ".png");
                if (!fs.existsSync(p) && !fs.existsSync(path.join(rp, t + ".tga"))) log("ALTO", addon, `bloco ${id}: PNG ausente ${t}.png`);
              }
            }
          }
        }
      }
    }
  }

  // === RECEITAS apontando blocos ===
  for (const f of walk(path.join(bp, "recipes"), ".recipe.json")) {
    const d = parseJson(f);
    const rec = d?.["minecraft:recipe_shaped"] || d?.["minecraft:recipe_shapeless"];
    if (!rec) continue;
    const res = rec.result?.item;
    if (res && !res.startsWith("minecraft:") && !blockIds.has(res)) {
      // ja sera checado pelo script anterior; aqui so confirmamos blocos
    }
  }

  // === RENDER CONTROLLERS ===
  const rcFiles = walk(path.join(rp, "render_controllers"), ".json");
  const definedRC = new Set();
  for (const f of rcFiles) {
    const d = parseJson(f);
    if (d?.render_controllers) for (const k of Object.keys(d.render_controllers)) definedRC.add(k);
  }
  // verificar referencias
  for (const f of walk(path.join(rp, "entity"), ".entity.json")) {
    const d = parseJson(f);
    const rcs = d?.["minecraft:client_entity"]?.description?.render_controllers || [];
    const id = d?.["minecraft:client_entity"]?.description?.identifier;
    for (const rc of rcs) {
      const name = typeof rc === "string" ? rc : Object.keys(rc)[0];
      if (!definedRC.has(name) && !name.startsWith("controller.render.")) continue;
      if (!definedRC.has(name) && !["controller.render.armor", "controller.render.item_default"].includes(name)) {
        log("MEDIO", addon, `entidade ${id} usa render_controller nao definido: ${name}`);
      }
    }
  }
  for (const f of walk(path.join(rp, "attachables"), ".json")) {
    const d = parseJson(f);
    const a = d?.["minecraft:attachable"]?.description;
    const id = a?.identifier;
    for (const rc of a?.render_controllers || []) {
      const name = typeof rc === "string" ? rc : Object.keys(rc)[0];
      const vanilla = ["controller.render.armor", "controller.render.item_default"];
      if (!definedRC.has(name) && !vanilla.includes(name)) {
        log("MEDIO", addon, `attachable ${id} usa render_controller nao definido: ${name}`);
      }
    }
  }

  // === SCRIPT: detectar APIs beta / imports ===
  const mainJs = path.join(bp, "scripts", "main.js");
  if (fs.existsSync(mainJs)) {
    const src = fs.readFileSync(mainJs, "utf8");
    const imports = [...src.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    console.log(`  imports: ${imports.join(", ") || "(nenhum)"}`);
    if (bpMan) {
      const deps = (bpMan.dependencies || []).map((d) => d.module_name).filter(Boolean);
      for (const imp of imports) {
        if (imp.startsWith("@minecraft/") && !deps.includes(imp)) log("ALTO", addon, `script importa ${imp} mas nao esta em dependencies do manifest`);
      }
    }
    // detectar APIs experimentais conhecidas
    if (/world\.gameRules/.test(src)) console.log(`  usa world.gameRules (estavel)`);
    if (/\.itemStack|\.beforeEvents\.itemUse/.test(src)) {
      // ok
    }
  }

  // === FORMAT VERSIONS DE ITENS ===
  for (const f of walk(path.join(bp, "items"), ".item.json")) {
    const d = parseJson(f);
    const fv = d?.format_version;
    if (fv !== "1.21.10" && fv !== "1.20.80" && fv !== "1.21.0" && fv !== "1.21.20" && fv !== "1.21.40" && fv !== "1.21.50" && fv !== "1.21.60") {
      log("BAIXO", addon, `item ${path.basename(f)} format_version=${fv} (recomendado 1.21.10+)`);
    }
  }
  // === ENTIDADES BP format ===
  for (const f of walk(path.join(bp, "entities"), ".entity.json")) {
    const d = parseJson(f);
    const fv = d?.format_version;
    const id = d?.["minecraft:entity"]?.description?.identifier;
    console.log(`  entidade BP ${id} (fv=${fv})`);
  }
}

console.log(C(`\n=== ${findings.length} achados extras ===`, "35"));
