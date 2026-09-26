(function () {
  const root = typeof bunny !== "undefined" ? bunny : globalThis.bunny;
  const api = root?.api;
  const metro = api?.metro || root?.metro;
  const ui = api?.ui || root?.ui;
  const logger = root?.logger || console;
  let patches = [];

  function findStore(props) {
    try { return metro?.findByProps?.(...props); } catch (_) { return null; }
  }

  function getHidden() {
    const channelStore = findStore(["getChannel"]);
    const guildStore = findStore(["getGuilds"]);
    const permissionStore = findStore(["can"]);
    const guilds = guildStore?.getGuilds?.() || {};
    const result = [];

    for (const guild of Object.values(guilds)) {
      if (!guild?.id) continue;
      let channels = [];
      try {
        const raw = findStore(["getChannels"])?.getChannels?.(guild.id);
        if (raw && typeof raw === "object") {
          const walk = (x) => {
            if (!x) return;
            if (Array.isArray(x)) return x.forEach(walk);
            if (typeof x === "object") {
              if (x.id && typeof x.name === "string" && x.guild_id) channels.push(x);
              else Object.values(x).forEach(walk);
            }
          };
          walk(raw);
        }
      } catch (_) {}

      const seen = new Set();
      for (const c of channels) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        let hidden = false;
        try { hidden = permissionStore?.can ? !permissionStore.can(1024, c) : false; } catch (_) {}
        if (hidden) result.push(`${guild.name || guild.id}  /  #${c.name}`);
      }
    }
    return result;
  }

  function show() {
    const names = getHidden();
    const text = names.length
      ? names.join("\n")
      : "No cached hidden channel names found.\nIf Discord did not send the channel metadata, a plugin cannot recover the real name.";
    try {
      const Alert = metro?.common?.ReactNative?.Alert || globalThis.ReactNative?.Alert;
      if (Alert?.alert) Alert.alert("Show Hidden Channels", text);
      else logger.log(text);
    } catch (_) { logger.log(text); }
  }

  function start() {
    logger.log("[ShowHiddenChannels Kettu] loaded");
    // Expose a callable helper. Kettu builds differ in their Settings registration API,
    // so this avoids crashing the plugin when a particular Kettu build lacks that API.
    globalThis.__showHiddenChannelsKettu = show;
  }

  function stop() {
    delete globalThis.__showHiddenChannelsKettu;
    for (const unpatch of patches) { try { unpatch?.(); } catch (_) {} }
    patches = [];
  }

  return { start, stop };
})()
