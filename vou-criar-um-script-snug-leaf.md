# Plano: Script de Fix Automatizado dos Bugs

## Contexto

A auditoria recente identificou 4 bugs concretos e mecanicamente corrigiveis em 5 addons distintos do projeto. Aplicar todos a mao envolveria copiar 6 arquivos, criar 2 novos, editar 1 JSON e ajustar 4 numeros em 2 lugares simetricos de scripts — tedioso e sujeito a erro humano. Tambem nao seria a primeira vez: sempre que o pack unificado "Mods Pietro e Manoel" recebe um asset novo, o mesmo trabalho de sincronizacao reaparece.

O objetivo deste plano e criar um unico script Node.js (`corrigir-bugs.js`) na raiz do projeto que:

1. Aplica os 4 fixes ja diagnosticados de forma idempotente
2. Pode rodar em modo `--dry-run` antes de tocar em qualquer arquivo
3. Cria backup `.bak` por padrao (desativavel com `--no-backup`)
4. Reporta passo a passo o que fez ou pulou
5. Termina chamando o validador existente (auditoria de JSONs) para confirmar que nada quebrou

Beneficio direto: o fluxo "abriu o jogo, achou bug, ja sabia que era do relatorio" vira `node corrigir-bugs.js` em vez de uma sessao de copy-paste.

## Escopo: 4 Fixes

### Fix 1 — Sincronizar Armadura de Slime no pack unificado
**Problema:** O pack `Mods Pietro e Manoel` declara os 4 items da armadura no BP e tem o `item_texture.json` correto, mas o RP nao tem nem os attachables nem as texturas de modelo. Resultado: vesti-la mostra o ícone no slot mas o jogador fica nu (sem modelo no corpo).

**Acoes:**
- Copiar 4 arquivos de [Armadura de Slime/Armadura de Slime RP/attachables/](Armadura%20de%20Slime/Armadura%20de%20Slime%20RP/attachables/) (`capacete_slime.json`, `peitoral_slime.json`, `calcas_slime.json`, `botas_slime.json`) para [Mods Pietro e Manoel/Mods Pietro e Manoel RP/attachables/](Mods%20Pietro%20e%20Manoel/Mods%20Pietro%20e%20Manoel%20RP/attachables/)
- Criar pasta `Mods Pietro e Manoel/Mods Pietro e Manoel RP/textures/models/armor/` e copiar `slime_armor_1.png` e `slime_armor_2.png` da pasta correspondente do pack standalone

**Idempotencia:** comparar hash dos arquivos de origem e destino; pular se ja identicos.

### Fix 2 — Criar `loot_tables/empty.json` (Multiplicador)
**Problema:** O bloco `multiplicador:multiplicador_x10` referencia `loot_tables/empty.json` mas o arquivo nao existe em nenhum dos dois BPs (standalone e unificado). Content Log loga erro ao quebrar e pode dropar item indesejado por fallback.

**Acoes:** Criar nos dois caminhos:
- [Multiplicador/Multiplicador BP/loot_tables/empty.json](Multiplicador/Multiplicador%20BP/loot_tables/)
- [Mods Pietro e Manoel/Mods Pietro e Manoel BP/loot_tables/empty.json](Mods%20Pietro%20e%20Manoel/Mods%20Pietro%20e%20Manoel%20BP/loot_tables/)

Conteudo:
```json
{ "pools": [] }
```

**Idempotencia:** se o arquivo ja existe e ja contem `{"pools":[]}`, pular.

### Fix 3 — Render controller do Rifle Sniper
**Problema:** [Pistola Laser/Pistola Laser RP/attachables/rifle_sniper.json:17](Pistola%20Laser/Pistola%20Laser%20RP/attachables/rifle_sniper.json#L17) referencia `controller.render.default` que nao existe na vanilla. O modelo 3D nao aparece quando empunhado.

**Acao:** Editar o JSON trocando:
```json
"render_controllers": [ "controller.render.default" ]
```
por:
```json
"render_controllers": [ "controller.render.item_default" ]
```

`controller.render.item_default` e o render controller vanilla padrao para itens segurados (held items / attachables simples). E o mesmo usado por todos os items vanilla do jogo. Decidi por ele em vez de criar um custom (`controller.render.rifle_sniper`) porque o attachable e simples (sem variantes de material/textura condicionais) — o vanilla cobre 100% das necessidades sem adicionar 1 arquivo novo.

**Idempotencia:** ler o JSON, conferir o valor, pular se ja corrigido.

### Fix 4 — Calmar o bounce do Sinalizador
**Problema:** [Super Picareta/Super Picareta BP/scripts/main.js:454](Super%20Picareta/Super%20Picareta%20BP/scripts/main.js#L454) tem valores que fazem o flare ricochetear varias vezes e sempre com forca vertical garantida (minVertical 0.1 forca o bounce a subir mesmo com pouca energia residual).

**Acao:** Editar **2 arquivos** (precisam ficar em paralelo):
- Super Picareta/Super Picareta BP/scripts/main.js (linha 452-454)
- Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js (linhas 431-433, valores identicos)

Mudanca no objeto `bounce`:
```diff
- maxBounces: 2,
- default: { velocityLoss: 0.3, minVertical: 0.1, maxVertical: -0.1 },
+ maxBounces: 1,
+ default: { velocityLoss: 0.2, minVertical: 0.05, maxVertical: -0.05 },
```

Racional (com base no que o codigo realmente faz, ja conferido):
- `velocityLoss` e o **multiplicador** que sobra apos o bounce (0.3 = retem 30%). Baixar para 0.2 = retem 20%.
- `maxBounces: 1` = no maximo 1 ricochete antes de pousar (em vez de 2).
- `minVertical: 0.05` = piso de "bounce minimo para cima" cai pela metade — em superficies horizontais o flare quica menos energeticamente. Nao zerar para nao perder o "tiquinho de quique" que da personalidade.

**Idempotencia:** o script usa regex precisa para casar o trecho atual; se ja estiver com valores novos, nao toca.

## Como funciona o script

Estrutura proposta — arquivo unico em [corrigir-bugs.js](corrigir-bugs.js) na raiz do projeto, executado com `node corrigir-bugs.js [opcoes]`:

```
Opcoes:
  --dry-run         Mostra o que faria mas nao escreve nada
  --no-backup       Nao cria arquivo .bak
  --apenas <fixN>   Roda apenas um dos fixes (ex: --apenas fix3)
  --pular <fixN>    Pula um fix especifico
```

Para cada fix, o script segue um padrao:
1. Verifica pre-condicao (arquivo existe? estado atual e o esperado?)
2. Loga `[FIX N] DESCRICAO` em verde
3. Se ja foi aplicado: `→ JA OK, pulando`
4. Se vai aplicar: cria `.bak`, escreve, verifica resultado
5. Se erro: registra mas continua os outros fixes (`--strict` faz parar no primeiro erro)

Ao final, imprime resumo `[X aplicados / Y pulados / Z erros]` e (a menos que `--no-validate`) tenta executar o validador JSON existente para confirmar que nada quebrou.

Dependencias: **zero** alem do Node.js nativo (`fs`, `path`, `crypto` para hash). Sem npm install.

## Arquivos a serem criados/modificados

| Caminho | Acao |
|---------|------|
| `corrigir-bugs.js` (raiz) | **Criar** — o script em si |
| `Mods Pietro e Manoel/.../attachables/{capacete,peitoral,calcas,botas}_slime.json` | Criar (copia) |
| `Mods Pietro e Manoel/.../textures/models/armor/slime_armor_{1,2}.png` | Criar (copia binaria) |
| `Multiplicador/.../loot_tables/empty.json` | Criar |
| `Mods Pietro e Manoel/.../loot_tables/empty.json` | Criar |
| `Pistola Laser/Pistola Laser RP/attachables/rifle_sniper.json` | Editar (render_controllers) |
| `Super Picareta/Super Picareta BP/scripts/main.js` | Editar (FLARE_CONFIG.bounce, 3 valores) |
| `Mods Pietro e Manoel/Mods Pietro e Manoel BP/scripts/main.js` | Editar (FLARE_CONFIG.bounce, 3 valores) |

## Fora de escopo (explicitamente nao tratados)

Bugs reais mas que pedem decisao de design ou trabalho arquitetural — sem fix automatizado seguro:

- **Pistola Laser nao integrada ao pack unificado** — copiar items/entities/textures/scripts e merge no `main.js` consolidado e uma operacao de "merge de addons" que merece um passo proprio
- **Cactus Zumbi nao integrado ao pack unificado** — mesma situacao
- **Persistencia das luzes do flare apos /reload** — fix arquitetural (mover state pra `world.setDynamicProperty`, varredura no `worldLoad`)
- **Sniper FOV 15 + pan rapido** — limitacao de plataforma Bedrock, nao tem solucao tecnica perfeita
- **Beta APIs precisam estar ligadas** — instrucao para o usuario, nao algo que script muda

## Verificacao end-to-end

Apos `node corrigir-bugs.js`:

1. **Validacao estatica automatizada (o proprio script faz se nao passar `--no-validate`):**
   - Re-parsear todos os JSONs alterados
   - `node --check` nos 2 main.js editados
   - Confirmar que paths copiados existem com tamanho > 0

2. **Validacao manual no Minecraft (responsabilidade do usuario):**
   - Rodar `instalar.bat` (ja existente) para empurrar packs pra `com.mojang/development_*_packs/`
   - Abrir um mundo de teste **com Beta APIs ligado**
   - **Fix 1:** ativar SO o pack unificado `Mods Pietro e Manoel`; vestir a armadura completa → confirmar que aparece o modelo verde no corpo
   - **Fix 2:** colocar um bloco multiplicador e quebra-lo → conferir Content Log: nao deve ter erro de loot table, nao deve dropar item
   - **Fix 3:** ativar pack Pistola Laser; segurar o rifle sniper → modelo 3D do rifle aparece na mao
   - **Fix 4:** atirar varios sinalizadores em um piso plano → cada um deve quicar no maximo 1 vez antes de pousar, com bounce notavelmente mais discreto
