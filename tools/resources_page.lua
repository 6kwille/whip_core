-- ============================================
-- /w → Resources: what each resource holds, and what went wrong, in one place
-- ============================================
--
-- Per resource: what it registered with whip on the server and on this game (a count per registry:
-- GetRegistrations), its latest errors on each side (the error log, filed under the resource they came from), and
-- the registrations whip refused it. The server's half is asked when the page opens (developer mode only).
-- A row starts /whipcost for this game. The console's whiperrors and whipsupport print the server's side as text.

local PAGE = 'resources'
local server = nil     -- the server's half: { regs, errors, refused }, or nil until it answers
local level = nil      -- nil: the list of resources; a name: that resource's page
local asking = false

local function ask()
    if asking then return end
    asking = true
    CreateThread(function()
        local ok, data = pcall(Callback, 'whip_core:devtools:resources')
        asking = false
        if ok and type(data) == 'table' then server = data end
        DevPages.refresh(PAGE)
    end)
end

--- This game's half, the same shape as the server's.
local function local_()
    local regs, errors, refused = {}, {}, {}
    for _, r in ipairs(Registry.list()) do
        local owner = tostring(r.owner)
        regs[owner] = regs[owner] or {}
        regs[owner][r.registry] = (regs[owner][r.registry] or 0) + 1
    end
    for _, e in ipairs((ErrorTap.read({ max = 200 }) or {}).entries or {}) do
        local owner = tostring(e.resource or '?')
        local list = errors[owner] or {}
        errors[owner] = list
        list[#list + 1] = { text = (tostring(e.text):gsub('\n.*', '')):sub(1, 200), count = e.count or 1 }
        if #list > 5 then table.remove(list, 1) end
    end
    for _, r in ipairs(Registry.refusals()) do
        local list = refused[r.owner] or {}
        refused[r.owner] = list
        if #list < 10 then list[#list + 1] = r.why:sub(1, 200) end
    end
    return { regs = regs, errors = errors, refused = refused }
end

local function count(t)
    local n = 0
    for _, v in pairs(t or {}) do n = n + (type(v) == 'number' and v or 1) end
    return n
end

local function rows()
    local here, there = local_(), server or { regs = {}, errors = {}, refused = {} }
    if level then
        local out = {}
        local function registered(side, regs)
            out[#out + 1] = { sep = 'Registered, ' .. side }
            local names = {}
            for reg in pairs(regs or {}) do names[#names + 1] = reg end
            table.sort(names)
            if #names == 0 then out[#out + 1] = { label = 'nothing', kind = 'note' } end
            for _, reg in ipairs(names) do
                out[#out + 1] = { label = ('%s: %d'):format(reg, regs[reg]), kind = 'note' }
            end
        end
        registered('on the server', there.regs[level])
        registered('on this game', here.regs[level])
        local function said(title, list, text)
            out[#out + 1] = { sep = title }
            if not list or #list == 0 then out[#out + 1] = { label = 'none', kind = 'note' } return end
            for _, e in ipairs(list) do out[#out + 1] = { label = text(e), kind = 'note' } end
        end
        local function err(e) return e.text .. ((e.count or 1) > 1 and (' (x%d)'):format(e.count) or '') end
        said('Errors on the server', there.errors[level], err)
        said('Errors on this game', here.errors[level], err)
        local refusals = {}
        for _, w in ipairs(there.refused[level] or {}) do refusals[#refusals + 1] = 'server: ' .. w end
        for _, w in ipairs(here.refused[level] or {}) do refusals[#refusals + 1] = 'this game: ' .. w end
        said('Refused', refusals, function(w) return w end)
        out[#out + 1] = { sep = 'Cost' }
        out[#out + 1] = { id = 'cost', label = 'Time this game (/whipcost)', close = true,
                          desc = 'Every timed section and each resource\'s memory, for 20 seconds, in F8. The server\'s: whipcost in its console.' }
        return { title = level, back = 'Resources', rows = out }
    end

    -- The list: every resource either side knows anything about, those with errors first.
    local names, seen = {}, {}
    local function add(t) for name in pairs(t or {}) do if not seen[name] then seen[name] = true; names[#names + 1] = name end end end
    add(here.regs); add(there.regs); add(here.errors); add(there.errors); add(here.refused); add(there.refused)
    local function errs(name) return #(here.errors[name] or {}) + #(there.errors[name] or {}) end
    table.sort(names, function(a, b)
        if errs(a) ~= errs(b) then return errs(a) > errs(b) end
        return a < b
    end)
    local out = { { label = server and 'Every resource, those with errors first' or 'Asking the server...', kind = 'note' } }
    for _, name in ipairs(names) do
        local regsN = count(here.regs[name]) + count(there.regs[name])
        local refN = #(here.refused[name] or {}) + #(there.refused[name] or {})
        out[#out + 1] = {
            id = 'res:' .. name, label = name, kind = 'open',
            desc = ('%d registered, %d error%s, %d refused'):format(regsN, errs(name), errs(name) == 1 and '' or 's', refN),
        }
    end
    return { rows = out }
end

DevPages.register(PAGE, {
    label = 'Resources',
    desc  = 'Each resource: what it registered, its latest errors and its refusals, on the server and this game.',
    rows  = rows,
    onOpen = function() level = nil; ask() end,
    onBack = function() level = nil; DevPages.refresh(PAGE) end,
    onSelect = function(id)
        if type(id) == 'string' and id:sub(1, 4) == 'res:' then
            level = id:sub(5)
            ask()
        elseif id == 'cost' then
            ExecuteCommand('whipcost')
        end
    end,
})
