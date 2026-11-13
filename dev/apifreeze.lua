--- apifreeze — a public name never disappears without being deprecated first
---
--- docs.html → "Updates: what whip promises": nothing public goes without notice. This keeps that true in code.
--- public-api.txt lists every public name: each export stub in types/server.lua and types/client.lua
--- (`server:GetPlayer`, `client:AddAction`) and every whip_core:<area>:<happened> event in types/events.lua
--- (`event:whip_core:player:loaded`). A name in the list that the types no longer have is a failure, unless its
--- line says `deprecated`: a stub carries ---@deprecated for at least the promised window, a `baseline` run then
--- marks its line, and only after that may it go. New names are fine; `baseline` adds them.
--- Not loaded by fxmanifest.lua.
---
--- Usage (from anywhere):
---   lua apifreeze.lua            exit 1 when a listed name is gone without having been deprecated
---   lua apifreeze.lua baseline   write public-api.txt from the types as they are now

local here = debug.getinfo(1, 'S').source:sub(2):gsub('\\', '/'):match('^(.*)/[^/]*$') or '.'
local R = here .. '/../'
local LIST = here .. '/public-api.txt'
local mode = arg[1] or 'check'

local function read(path)
    local f = io.open(path, 'rb')
    if not f then return nil end
    local s = f:read('a')
    f:close()
    return s
end

--- Every public name now: [name] = true (deprecated) | false.
local function current()
    local names = {}
    for side, file in pairs({ server = 'types/server.lua', client = 'types/client.lua' }) do
        local src = (read(R .. file) or ''):gsub('\r\n', '\n')
        local block = {}
        for line in (src .. '\n'):gmatch('([^\n]*)\n') do
            local name = line:match('^function whip_core:([%w_]+)%(')
            if name then
                local deprecated = false
                for _, l in ipairs(block) do if l:match('^%-%-%-@deprecated') then deprecated = true end end
                names[side .. ':' .. name] = deprecated
                block = {}
            elseif line:match('^%-%-%-') then
                block[#block + 1] = line
            else
                block = {}
            end
        end
    end
    for ev in (read(R .. 'types/events.lua') or ''):gmatch('whip_core:[%a]+:[%a]+') do
        if not ev:match('^whip_core:client:') and not ev:match('^whip_core:server:') then names['event:' .. ev] = false end
    end
    return names
end

local now = current()

if mode == 'baseline' then
    local keys = {}
    for k in pairs(now) do keys[#keys + 1] = k end
    table.sort(keys)
    local f = assert(io.open(LIST, 'wb'))
    f:write('# whip_core\'s public names (dev/apifreeze.lua). A name may leave only after its line says deprecated.\n')
    for _, k in ipairs(keys) do f:write(k .. (now[k] and ' deprecated' or '') .. '\n') end
    f:close()
    print(('wrote %d public names to dev/public-api.txt'):format(#keys))
    return
end

local listed = read(LIST)
if not listed then print('dev/public-api.txt is missing: run `lua apifreeze.lua baseline` once') os.exit(1) end
local bad, gone, total = 0, 0, 0
for line in listed:gmatch('[^\r\n]+') do
    if not line:match('^#') then
        local name, flag = line:match('^(%S+)%s*(%S*)')
        total = total + 1
        if now[name] == nil then
            if flag == 'deprecated' then
                gone = gone + 1
            else
                bad = bad + 1
                print(('gone without being deprecated first: %s (mark its stub ---@deprecated for a release, run baseline, then remove it)'):format(name))
            end
        end
    end
end
if bad > 0 then
    print(('%d public name(s) gone'):format(bad))
    os.exit(1)
end
print(('OK — %d public names listed, none gone without deprecation%s'):format(total,
    gone > 0 and (' (%d gone after it)'):format(gone) or ''))
