-- ============================================
-- Item: camera
-- A tool, never used up: used, the player's game takes it out and up to the eye (client/items/camera.lua);
-- used again, it goes away.
-- ============================================
--
-- The camera in the hand is a held prop (server/held_props.lua), so everyone sees it, made here when the
-- player's game says the camera is coming out and only while they carry one. Anything else that takes the
-- hand (an emote, a bar, give mode) takes the camera away with it, and the player's game is told to put
-- the viewfinder away.

local CAMERA_PROPS = {
    -- On the right hand as the paparazzi clips hold it (shared/emote_list.lua's Camera 2).
    { model = 'prop_pap_camera_01', bone = 28422, offset = { 0.0, 0.0, 0.0 }, rot = { 0.0, 0.0, 0.0 } },
}

-- false: done, and not used up (as the jerry can's equip).
Inventory.registerUseHandler('camera', function(source)
    TriggerClientEvent('whip_core:client:cameraUse', source)
    return false
end, GetCurrentResourceName())

--- The player's game took the camera out (true) or put it away (false).
SecureEvent('whip_core:server:cameraHold', {
    rateLimit = 250,
    burst     = 4,
    whileDead = true,   -- dying puts it away; its prop must still go
    params    = { {'on', 'bool'} },
}, function(source, player, on)
    if not on then
        HeldProps.drop(source, 'camera')
        return
    end
    if Inventory.getItemCountAcrossContainers(player.inventory, 'camera') < 1 then
        return false, 'You have no camera'
    end
    return HeldProps.give(source, CAMERA_PROPS, 'camera')
end)

AddEventHandler('whip_core:heldProps:lost', function(e)
    if type(e) == 'table' and e.tag == 'camera' and e.source then
        TriggerClientEvent('whip_core:client:cameraAway', e.source)
    end
end)
