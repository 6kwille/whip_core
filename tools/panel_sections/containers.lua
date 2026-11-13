-- ============================================
-- /whip SECTION — Containers (client wiring)
-- ============================================
--
-- Replaces tools/containers.lua. The mutation callbacks (cmCreateContainer,
-- cmUpdateContainer, cmDeleteContainer, cmTeleport, cmGetPlayerPos) stay in
-- client/containers.lua with the container runtime they belong to — this file owns
-- only the section lifecycle, the data forward, the inventory handoff, and the set-up
-- wizard's two calls: the props with pictures, and placing one in the world.

PanelSections['containers'] = {
    enter = function()
        TriggerServerEvent('whip_core:server:cmGetAll')
    end,
    leave = function()
        -- No viewer session and no closed event existed for this tool — nothing to say.
    end,
}

RegisterNetEvent('whip_core:client:cmAllData', function(containers)
    local ped = PlayerPedId()
    local c = GetEntityCoords(ped)
    WhipPanelData('containers', 'all', {
        containers = containers,
        pos = { x = c.x, y = c.y, z = c.z, h = GetEntityHeading(ped) },
    })
end)

-- Open a container's inventory from the panel (admin override). Inventory handoff v1:
-- the shell CLOSES rather than suspends — resuming on inventory close needs a clean
-- inventory-closed hook that hasn't been verified; today's UX is preserved exactly.
RegisterNUICallback('cmOpenContainer', function(data, cb)
    WhipPanelClose()
    TriggerServerEvent('whip_core:server:cmOpenContainer', data.containerId)
    cb('ok')
end)

-- ---- The wizard's Model step: the props, with their pictures ----
--
-- The furnisher's catalog as it shows it (Furnisher.catalog, client/property_furnish.lua): the props
-- this game can spawn, each with its name, category and whether a media pack has its picture. The
-- same list the furnisher and the world builder place from, so a container looks like what it is.
RegisterNUICallback('cmPropCatalog', function(_, cb)
    local cat = Furnisher and Furnisher.catalog and Furnisher.catalog() or nil
    cb(type(cat) == 'table' and cat or { props = {}, categories = {} })
end)

-- ---- The wizard's Where step: put it in the world ----
--
-- A see-through copy of the container's prop, where you aim; ←/→ turn it, E puts it there. It is
-- placed the way the real one will be (client/containers.lua SpawnContainerProp: at the spot, turned,
-- then settled on the ground), so where it stands now is where it will stand. Only this game sees it.

local PLACE_REACH = 10.0   -- metres: as far as you can aim it
local PLACE_TURN = 90.0    -- degrees a second on ←/→ (Shift: a quarter of that)
local KEY_LEFT, KEY_RIGHT, KEY_HERE, KEY_FINE = 174, 175, 38, 21

RegisterNUICallback('cmPlace', function(data, cb)
    data = type(data) == 'table' and data or {}
    local prop = type(data.prop) == 'string' and data.prop ~= '' and data.prop or Config.ContainerDefaultProp
    local name = type(data.name) == 'string' and data.name ~= '' and data.name or 'New container'
    local heading = tonumber(data.heading) or ((GetEntityHeading(PlayerPedId()) + 180.0) % 360.0)
    local placed = data.placed == true

    local model = LoadModel(prop)
    if not model then
        cb({ ok = false, why = ('%s is not a model this game can spawn'):format(prop) })
        return
    end

    local ghost = nil
    local spot = nil
    local nextHud = 0

    local started = PropertyEditor.start({
        name = 'Container spot',
        hud = {
            title = 'Where the container goes',
            sub = name,
            rows = {
                { label = 'Aim', value = 'at the ground where it goes' },
                { label = 'Model', value = prop },
            },
            hints = {
                { key = 'E', text = 'Here' },
                { key = '← →', text = 'Turn' },
                { key = 'Esc', text = 'Back' },
            },
        },
        onFrame = function()
            -- The map only: the ghost itself must never be what the ray lands on.
            local hit, coords = Interactions.aimRay(PLACE_REACH, 1)
            if not hit then
                local ped = PlayerPedId()
                local p = GetEntityCoords(ped)
                local h = math.rad(GetEntityHeading(ped))
                coords = vector3(p.x - math.sin(h) * 1.5, p.y + math.cos(h) * 1.5, p.z - 0.95)
            end

            local rate = IsControlPressed(0, KEY_FINE) and PLACE_TURN * 0.25 or PLACE_TURN
            if IsControlPressed(0, KEY_LEFT) then heading = (heading + rate * GetFrameTime()) % 360.0 end
            if IsControlPressed(0, KEY_RIGHT) then heading = (heading - rate * GetFrameTime()) % 360.0 end

            if not ghost or not DoesEntityExist(ghost) then
                ghost = CreateObject(model, coords.x, coords.y, coords.z, false, false, false)
                SetEntityAlpha(ghost, 170, false)
                SetEntityCollision(ghost, false, false)
                FreezeEntityPosition(ghost, true)
            end
            -- Stood as the real one will stand (client/containers.lua): a placed one exactly at its
            -- spot, every other one snapped to the ground.
            if placed then
                SetEntityCoordsNoOffset(ghost, coords.x, coords.y, coords.z, false, false, false)
                SetEntityHeading(ghost, heading)
            else
                SetEntityCoords(ghost, coords.x, coords.y, coords.z, false, false, false, false)
                SetEntityHeading(ghost, heading)
                PlaceObjectOnGroundProperly(ghost)
            end
            spot = coords

            local now = GetGameTimer()
            if now >= nextHud then
                nextHud = now + 250
                EditorHud.update({ rows = {
                    { label = 'Here', value = ('%.1f, %.1f, %.1f'):format(coords.x, coords.y, coords.z) },
                    { label = 'Facing', value = ('%.0f°'):format(heading) },
                } })
            end

            if IsControlJustPressed(0, KEY_HERE) and spot then
                WhipPanelData('containers', 'spot', { x = spot.x, y = spot.y, z = spot.z, heading = heading })
                return 'exit'
            end
        end,
        onExit = function()
            if ghost and DoesEntityExist(ghost) then DeleteEntity(ghost) end
            ghost = nil
            SetModelAsNoLongerNeeded(model)
        end,
    })
    if started ~= true then SetModelAsNoLongerNeeded(model) end
    cb({ ok = started == true, why = started ~= true and 'Something else is using the world editor' or nil })
end)
