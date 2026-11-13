-- ============================================
-- Settings — the client half
-- ============================================
--
-- This game read settings.json at load (shared/settings.lua), as the file stood when whip_core
-- started. Two things can be newer: a change an admin makes while we play, and anything changed
-- before we joined (or put in force at whip_core's start from the database). Both arrive as
-- whip_core:client:settingsChanged and go through Settings.apply, which sets the value in place
-- and runs the hooks the owning files registered (Settings.onChange).

RegisterNetEvent('whip_core:client:settingsChanged', function(list)
    if type(list) ~= 'table' then return end
    for _, c in ipairs(list) do
        if type(c) == 'table' and type(c.path) == 'string' then
            local owner = type(c.owner) == 'string' and c.owner or Settings.CORE
            Settings.apply(owner, c.path, Settings.decode(c.value))
        end
    end
end)

-- Ask what is newer than our file: now, as this game starts, and again when whip_core says it is
-- ready. The server answers only once it is ready (server/settings.lua), so during a restart the
-- first hello goes unanswered and the second one brings the values the boot put in force.
TriggerServerEvent('whip_core:server:settingsHello')
RegisterNetEvent('whip_core:client:coreReady', function()
    TriggerServerEvent('whip_core:server:settingsHello')
end)
