-- ============================================
-- The containers every character has (both sides)
-- ============================================
--
-- A character's own containers: their inventory ('player') and the accessory strip ('accessory'), in the order the
-- inventory screen draws them.
--
-- Not a setting: the database stores only these two (inventory.lua's ENUM) and the screen draws only them. There is
-- no "backpack" container: bags are ordinary items (duffle_bag).
--
-- With Config.AccessoryStrip = false it is the inventory alone. Every path that takes a container checks this list,
-- so the strip is closed everywhere at once; its contents move into the inventory at login (Inventory.load).
--
-- After shared/settings.lua: AccessoryStrip as saved in /whip → Settings, not only as config.lua says.

PlayerContainers = Config.AccessoryStrip == false and { 'player' } or { 'player', 'accessory' }

-- The accessory strip's slots: what each one is called and what it takes.
--
-- Registerable, like stats. These five seed the registry (server/inventory.lua); a resource can add or replace a
-- slot at runtime with exports.whip_core:RegisterAccessorySlot{ slot = 4, accepts = 'badge', label = 'Badge' } and
-- the strip changes on every client with no NUI edit. `accepts = nil` takes anything; `icon` names one of the
-- NUI's built-in placeholder icons ('accessory', 'plus', 'phone', 'vehicle_key', 'cash'), and a registration may
-- instead carry `iconSvg` with its own inline SVG. With neither, the slot shows what it does: the icon for what it
-- accepts, or that item's own picture greyed, and a slot that takes anything the pouch ('accessory'). The accepts
-- rule is enforced on the server (the player store kind's allowsAt and beforeMove); the NUI's copy only makes
-- refusals instant.
--
-- whip's own five are all the same: the pouch, and any item (Josh, 5 Nov 2026). There is no Phone, Cash or Key slot. A
-- car key in ANY strip slot goes into the ignition by itself (server/events_vehicles.lua); whip_phone looks in slot 1
-- first, then everywhere, and while it runs it gives slot 1 the phone icon (still any item). The strip can never be
-- set smaller than the highest slot here (/whip → Settings, Accessory Inventory Size).
AccessoryStripSlots = {
    { slot = 1, label = 'Accessory' },
    { slot = 2, label = 'Accessory' },
    { slot = 3, label = 'Accessory' },
    { slot = 4, label = 'Accessory' },
    { slot = 5, label = 'Accessory' },
}
