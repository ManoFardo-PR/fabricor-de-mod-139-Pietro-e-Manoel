import { world, system } from "@minecraft/server";

// ================================================================
// Multiplicador x10
// 1 item na mao + 10 diamantes no inventario = 10 copias do item
// ================================================================

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.block.typeId !== "multiplicador:multiplicador_x10") return;

    const player = event.player;
    const inventory = player.getComponent("minecraft:inventory");
    if (!inventory) return;
    const container = inventory.container;
    if (!container) return;

    const slot = player.selectedSlotIndex;
    const held = container.getItem(slot);

    // Precisa segurar um item
    if (!held) {
        player.sendMessage("§e[Multiplicador x10] §cSegure um item na mao para multiplicar!");
        return;
    }

    // Nao multiplicar diamantes (evita loop infinito)
    if (held.typeId === "minecraft:diamond") {
        player.sendMessage("§e[Multiplicador x10] §cNao e possivel multiplicar diamantes!");
        return;
    }

    // Contar diamantes no inventario
    let diamondCount = 0;
    const diamondSlots = [];
    for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && item.typeId === "minecraft:diamond") {
            diamondCount += item.amount;
            diamondSlots.push(i);
        }
    }

    if (diamondCount < 10) {
        player.sendMessage(`§e[Multiplicador x10] §cPrecisa de 10 diamantes! (voce tem ${diamondCount})`);
        return;
    }

    // --- Tudo OK, processar multiplicacao ---

    // Guardar clone do item (1 unidade)
    const itemClone = held.clone();
    itemClone.amount = 1;

    // Consumir 1 item da mao
    if (held.amount > 1) {
        held.amount -= 1;
        container.setItem(slot, held);
    } else {
        container.setItem(slot, undefined);
    }

    // Consumir 10 diamantes
    let toConsume = 10;
    for (const i of diamondSlots) {
        if (toConsume <= 0) break;
        const item = container.getItem(i);
        if (!item) continue;
        if (item.amount <= toConsume) {
            toConsume -= item.amount;
            container.setItem(i, undefined);
        } else {
            item.amount -= toConsume;
            container.setItem(i, item);
            toConsume = 0;
        }
    }

    // Dar 10 copias do item
    const output = itemClone.clone();
    output.amount = 10;
    try {
        container.addItem(output);
    } catch (e) {
        // Inventario cheio: spawna no chao
        try {
            player.dimension.spawnItem(output, player.location);
        } catch (e2) {}
    }

    // Efeitos visuais + sonoros
    const loc = event.block.location;
    try {
        player.dimension.playSound("random.levelup", {
            x: loc.x + 0.5, y: loc.y + 0.5, z: loc.z + 0.5
        });
        for (let i = 0; i < 10; i++) {
            player.dimension.spawnParticle("minecraft:villager_happy", {
                x: loc.x + 0.5 + (Math.random() - 0.5) * 0.8,
                y: loc.y + 1.0 + Math.random() * 0.5,
                z: loc.z + 0.5 + (Math.random() - 0.5) * 0.8
            });
        }
    } catch (e) {}

    player.sendMessage(`§e[Multiplicador x10] §a${itemClone.typeId.replace("minecraft:", "")} multiplicado x10!`);
});
