# Super Picareta - Addon para Minecraft Bedrock Edition

## O que e este mod?

O **Super Picareta** e um addon (mod) para Minecraft Bedrock Edition que adiciona 5 itens personalizados ao jogo, todos sob o namespace `escavadora:`. O mod combina ferramentas de mineracao, explosivos taticos, uma arma sinalizadora com efeitos visuais avancados e uma espada de fogo.

### Os 5 itens

| Item | Identificador | Descricao curta |
|------|---------------|-----------------|
| Super Picareta | `escavadora:super_picareta` | Picareta que escava tuneis inteiros automaticamente |
| TNT Arremessavel | `escavadora:tnt_arremessavel` | Granada explosiva que pode ser arremessada |
| Bomba Submarina | `escavadora:bomba_submarina` | Bomba otimizada para destruicao subaquatica |
| Pistola Sinalizadora | `escavadora:pistola_sinalizadora` | Arma que dispara sinalizadores luminosos que quicam e iluminam areas |
| Espada de Fogo | `escavadora:espada_de_fogo` | Espada que ilumina, incendeia mobs e arvores, com particulas de fogo |

---

## Requisitos tecnicos

| Requisito | Valor |
|-----------|-------|
| Plataforma | Minecraft Bedrock Edition (Windows, Mobile, Console) |
| Versao minima do engine | **1.21.0** |
| Script API | `@minecraft/server` versao **1.12.0** |
| Beta APIs | **Obrigatorio** — deve estar habilitado nas configuracoes do mundo |
| Tipo de pack | Behavior Pack (scripts + dados) + Resource Pack (texturas + modelos) |

### Como habilitar Beta APIs

1. Criar ou editar um mundo no Minecraft
2. Ir em **Configuracoes do Mundo > Experimentos**
3. Ativar **Beta APIs**
4. Salvar e entrar no mundo

---

## Instalacao

### Metodo automatico (Windows)

Execute o arquivo `instalar.bat` na raiz do projeto. Ele copia automaticamente os packs para a pasta de desenvolvimento do Minecraft.

### Metodo manual

1. Copie a pasta `Super Picareta BP` para:
   ```
   %LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_behavior_packs\
   ```

2. Copie a pasta `Super Picareta RP` para:
   ```
   %LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\LocalState\games\com.mojang\development_resource_packs\
   ```

3. No Minecraft, ao criar/editar um mundo:
   - Va em **Behavior Packs** e ative "Super Picareta - Behavior"
   - Va em **Resource Packs** e ative "Super Picareta - Resources"
   - Va em **Experimentos** e ative **Beta APIs**

### Obtendo os itens no jogo

Os itens nao possuem receitas de crafting. Para obte-los, use comandos:

```
/give @s escavadora:super_picareta
/give @s escavadora:tnt_arremessavel 16
/give @s escavadora:bomba_submarina 16
/give @s escavadora:pistola_sinalizadora 16
/give @s escavadora:espada_de_fogo
```

---

## Estrutura de arquivos do projeto

```
fabricor de mod 139 Pietro e Manoel/
│
├── instalar.bat                          # Script de instalacao automatica
├── TNT arrem.jpeg                        # Imagem de referencia
│
├── imagens/                              # Imagens de referencia do design
│   ├── picareta.png
│   ├── Picareta2.jpeg
│   └── picareta3.png
│
├── Super Picareta BP/                    # === BEHAVIOR PACK ===
│   ├── manifest.json                     # Manifesto do BP
│   ├── pack_icon.png                     # Icone do pack
│   │
│   ├── scripts/
│   │   └── main.js                       # TODA a logica do mod (~970 linhas)
│   │
│   ├── items/                            # Definicoes dos itens
│   │   ├── super_picareta.item.json
│   │   ├── tnt_arremessavel.item.json
│   │   ├── bomba_submarina.item.json
│   │   ├── espada_de_fogo.item.json
│   │   └── pistola_sinalizadora.item.json
│   │
│   └── entities/                         # Definicoes das entidades projetil
│       ├── tnt_arremessavel.entity.json
│       ├── bomba_submarina.entity.json
│       └── sinalizador_projetil.entity.json
│
├── Super Picareta RP/                    # === RESOURCE PACK ===
│   ├── manifest.json                     # Manifesto do RP
│   ├── pack_icon.png                     # Icone do pack
│   │
│   ├── textures/
│   │   ├── item_texture.json             # Atlas de texturas dos itens
│   │   ├── items/                        # Texturas dos itens (inventario)
│   │   │   ├── super_picareta.png
│   │   │   ├── tnt_arremessavel.png
│   │   │   ├── bomba_submarina.png
│   │   │   ├── espada_de_fogo.png
│   │   │   └── pistola_sinalizadora.png
│   │   └── entity/                       # Texturas das entidades (3D no mundo)
│   │       ├── tnt_arremessavel.png
│   │       ├── bomba_submarina.png
│   │       ├── sinalizador_projetil.png
│   │       └── pistola_sinalizadora.png
│   │
│   ├── models/entity/                    # Modelos 3D das entidades
│   │   ├── tnt_arremessavel.geo.json
│   │   ├── sinalizador_projetil.geo.json
│   │   └── pistola_sinalizadora.geo.json
│   │
│   ├── animations/                       # Animacoes das entidades
│   │   ├── tnt_arremessavel.animation.json
│   │   └── sinalizador_projetil.animation.json
│   │
│   ├── render_controllers/               # Controladores de renderizacao
│   │   ├── tnt_arremessavel.render_controllers.json
│   │   ├── sinalizador_projetil.render_controllers.json
│   │   └── pistola_sinalizadora.render_controllers.json
│   │
│   ├── attachables/                      # Como os itens aparecem na mao
│   │   ├── tnt_arremessavel.json
│   │   ├── bomba_submarina.json
│   │   └── pistola_sinalizadora.json
│   │
│   ├── entity/                           # Definicoes visuais das entidades
│   │   ├── tnt_arremessavel.entity.json
│   │   ├── bomba_submarina.entity.json
│   │   └── sinalizador_projetil.entity.json
│   │
│   └── texts/                            # Traducoes
│       ├── en_US.lang
│       └── pt_BR.lang
│
└── documentacao/                         # Esta documentacao
    ├── 00_visao_geral.md
    ├── 01_super_picareta.md
    ├── 02_tnt_arremessavel.md
    ├── 03_bomba_submarina.md
    ├── 04_pistola_sinalizadora.md
    └── imagens/                          # Copias de todas as imagens
```

---

## Manifests (identificacao dos packs)

### Behavior Pack (manifest.json)

```json
{
    "format_version": 2,
    "header": {
        "name": "Super Picareta - Behavior",
        "description": "Picareta que escava tuneis automaticamente! 10x3x6 blocos.",
        "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "version": [1, 0, 0],
        "min_engine_version": [1, 21, 0]
    },
    "modules": [
        {
            "type": "script",
            "language": "javascript",
            "uuid": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
            "entry": "scripts/main.js",
            "version": [1, 0, 0]
        }
    ],
    "dependencies": [
        {
            "module_name": "@minecraft/server",
            "version": "1.12.0"
        },
        {
            "uuid": "c3d4e5f6-a7b8-9012-cdef-123456789012",
            "version": [1, 0, 0]
        }
    ]
}
```

### Resource Pack (manifest.json)

```json
{
    "format_version": 2,
    "header": {
        "name": "Super Picareta - Resources",
        "description": "Texturas e visuais da Super Picareta.",
        "uuid": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "version": [1, 0, 0],
        "min_engine_version": [1, 21, 0]
    },
    "modules": [
        {
            "type": "resources",
            "uuid": "d4e5f6a7-b8c9-0123-defa-234567890123",
            "version": [1, 0, 0]
        }
    ],
    "dependencies": [
        {
            "uuid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "version": [1, 0, 0]
        }
    ]
}
```

> **Nota:** O UUID do RP (`c3d4e5f6...`) aparece como dependencia do BP, e vice-versa. Isso garante que os dois packs sejam sempre ativados juntos.

---

## Traducoes (arquivos .lang)

### Portugues (pt_BR.lang)

```
item.escavadora:super_picareta.name=Super Picareta
item.escavadora:tnt_arremessavel.name=TNT Arremessavel
entity.escavadora:tnt_arremessavel.name=TNT Arremessavel
item.escavadora:bomba_submarina.name=Bomba Submarina
entity.escavadora:bomba_submarina.name=Bomba Submarina
item.escavadora:pistola_sinalizadora.name=Pistola Sinalizadora
entity.escavadora:sinalizador_projetil.name=Sinalizador
item.escavadora:espada_de_fogo.name=Espada de Fogo
```

### Ingles (en_US.lang)

```
item.escavadora:super_picareta.name=Super Pickaxe
item.escavadora:tnt_arremessavel.name=Throwable TNT
entity.escavadora:tnt_arremessavel.name=Throwable TNT
item.escavadora:bomba_submarina.name=Submarine Bomb
entity.escavadora:bomba_submarina.name=Submarine Bomb
item.escavadora:pistola_sinalizadora.name=Flare Gun
entity.escavadora:sinalizador_projetil.name=Flare
item.escavadora:espada_de_fogo.name=Fire Sword
```

---

## Atlas de texturas de itens (item_texture.json)

Este arquivo mapeia os nomes internos das texturas para os caminhos dos arquivos de imagem:

```json
{
    "resource_pack_name": "Super Picareta",
    "texture_name": "atlas.items",
    "texture_data": {
        "super_picareta": {
            "textures": "textures/items/super_picareta"
        },
        "tnt_arremessavel": {
            "textures": "textures/items/tnt_arremessavel"
        },
        "bomba_submarina": {
            "textures": "textures/items/bomba_submarina"
        },
        "pistola_sinalizadora": {
            "textures": "textures/items/pistola_sinalizadora"
        },
        "espada_de_fogo": {
            "textures": "textures/items/espada_de_fogo"
        }
    }
}
```

---

## Indice da documentacao

- [01 - Super Picareta](01_super_picareta.md) — Ferramenta de mineracao automatica
- [02 - TNT Arremessavel](02_tnt_arremessavel.md) — Granada explosiva
- [03 - Bomba Submarina](03_bomba_submarina.md) — Explosivo subaquatico
- [04 - Pistola Sinalizadora](04_pistola_sinalizadora.md) — Arma sinalizadora com luz e fogo
- [05 - Espada de Fogo](05_espada_de_fogo.md) — Espada com iluminacao, fogo e particulas

---

## Imagens incluidas nesta documentacao

| Arquivo | Descricao |
|---------|-----------|
| `imagens/pack_icon_bp.png` | Icone do Behavior Pack |
| `imagens/pack_icon_rp.png` | Icone do Resource Pack |
| `imagens/textura_item_super_picareta.png` | Textura do item Super Picareta (inventario) |
| `imagens/textura_item_tnt_arremessavel.png` | Textura do item TNT Arremessavel (inventario) |
| `imagens/textura_item_bomba_submarina.png` | Textura do item Bomba Submarina (inventario) |
| `imagens/textura_item_pistola_sinalizadora.png` | Textura do item Pistola Sinalizadora (inventario) |
| `imagens/textura_entidade_tnt_arremessavel.png` | Textura da entidade TNT voando no mundo |
| `imagens/textura_entidade_bomba_submarina.png` | Textura da entidade Bomba voando no mundo |
| `imagens/textura_entidade_sinalizador_projetil.png` | Textura do projetil sinalizador voando |
| `imagens/textura_entidade_pistola_sinalizadora.png` | Textura 3D da pistola sinalizadora |
| `imagens/referencia_picareta.png` | Imagem de referencia do design original |
| `imagens/referencia_picareta2.jpeg` | Imagem de referencia do design (variante) |
| `imagens/referencia_picareta3.png` | Imagem de referencia do design (variante) |
| `imagens/textura_item_espada_de_fogo.png` | Textura do item Espada de Fogo (inventario) |
| `imagens/referencia_tnt_arrem.jpeg` | Imagem de referencia da TNT arremessavel |
