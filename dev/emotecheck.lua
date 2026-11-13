--- emotecheck — is every name in shared/emote_list.lua a real part of the game?
---
--- An emote list is a few hundred names — animation dictionaries and clips, scenarios, walk
--- clipsets, facial moods and prop models — and every one of them is easy to get almost right. The
--- first prop catalog was written from memory and four names in ten did not exist. This checks the
--- list against the game's own name dumps before it ships, and checks the list's shape (the fields
--- client/emotes.lua reads) at the same time.
---
--- The dumps are DurtyFree's (github.com/DurtyFree/gta-v-data-dumps). Download these into one folder:
---   animDictsCompact.json  movementClipsetsCompact.json  movementClipsetsWalkingCompact.json
---   scenariosCompact.json  ObjectList.ini
---
--- Usage:  lua emotecheck.lua <dumps folder> [list file] [videos folder]
---   The list defaults to ..\shared\emote_list.lua. Exits 1 if anything is wrong. Not loaded by
---   fxmanifest.lua.
---
--- Every `video` (an emote's or walk's preview) is checked against video\emotes\ in the media packs' folders
--- beside whip_core (any of them: the menu asks which, shared/assets.lua) — or against [videos folder], to check a
--- new list before it moves in.

local HERE = (arg[0]:match('^(.*)[/\\]') or '.')
local DUMPS = arg[1]
local LIST = arg[2] or (HERE .. '\\..\\shared\\emote_list.lua')
local VIDEOS = {}   -- the folders a video may be in
if arg[3] then
    VIDEOS[1] = arg[3]:gsub('[/\\]$', '') .. '\\'
else
    -- whip_media_previews holds the videos: beside whip_core, or with the other media packs in [whip]\[assets]
    -- or [whip]\[assets]\[media]
    for _, pack in ipairs({
        'whip_media_previews', '[assets]\\whip_media_previews', '[assets]\\[media]\\whip_media_previews',
    }) do
        VIDEOS[#VIDEOS + 1] = ('%s\\..\\..\\%s\\video\\emotes\\'):format(HERE, pack)
    end
end
if not DUMPS then
    print('usage: lua emotecheck.lua <dumps folder> [list file]')
    os.exit(2)
end

local function readAll(path)
    local f = io.open(path, 'rb')
    if not f then error('cannot read ' .. path) end
    local s = f:read('a')
    f:close()
    return s
end

-- ---- the game's names ----
--
-- LOWERCASE, BECAUSE THE GAME IS. A dictionary, clip or clipset name is hashed without regard to
-- case, so 'Female_arm_side' and 'female_arm_side' are the same animation in game.

local clips = {}        -- [dict] = { [clip] = true }
for dict, list in readAll(DUMPS .. '\\animDictsCompact.json')
        :gmatch('"DictionaryName"%s*:%s*"(.-)"%s*,%s*"Animations"%s*:%s*%[(.-)%]') do
    local set = {}
    for clip in list:gmatch('"(.-)"') do set[clip:lower()] = true end
    clips[dict:lower()] = set
end

local clipsets = {}
for _, file in ipairs({ 'movementClipsetsCompact.json', 'movementClipsetsWalkingCompact.json' }) do
    for name in readAll(DUMPS .. '\\' .. file):gmatch('"Name"%s*:%s*"(.-)"') do clipsets[name:lower()] = true end
end

-- WALK SETS THE DUMP DOES NOT LIST. Walk sets are defined in a game file the dumps do not cover, so
-- some real ones are missing from them. Each of these was confirmed in game: the
-- emote video recorder filmed it walking (or, for the last four, found the set and its clips).
for _, name in ipairs({
    'anim_group_move_ballistic', 'move_casey', 'move_chubby', 'move_characters@dave_n', 'move_dreyfuss',
    'move_f@fat@a_no_add', 'move_characters@floyd', 'move_gangster', 'move_m@gangster@var_a',
    'move_m@gangster@var_b', 'move_m@gangster@var_c', 'move_m@gangster@var_d', 'move_m@gangster@var_e',
    'move_m@gangster@var_f', 'move_m@gangster@var_g', 'move_m@gangster@var_h', 'move_m@gangster@var_i',
    'move_m@gangster@var_j', 'move_m@gangster@var_k', 'anim@move_f@grooving@', 'anim@move_m@grooving@',
    'move_m@prison_gaurd', 'move_m@prisoner_cuffed', 'move_characters@jimmy', 'move_characters@lamar',
    'anim_group_move_lemar_alley', 'move_heist_lester', 'move_lester_caneup', 'move_ped_bucket',
    'move_paramedic', 'move_characters@patricia', 'move_characters@ron', 'move_f@scared',
    'move_f@stripper@a', 'move_characters@tracey', 'clipset@move@trash_fast_turn',
    'missfbi4prepp1_garbageman', 'move_m@bag', 'clipset@anim@ingame@move_m@zombie@core',
    -- found by the recorder, not filmed: no clip called "walk" to film (runners run; the janitor
    -- set layers onto the normal walk)
    'move_p_m_zero_janitor', 'female_fast_runner',
}) do clipsets[name] = true end

local scenarios = {}
for name in readAll(DUMPS .. '\\scenariosCompact.json'):gmatch('"(.-)"') do scenarios[name] = true end

local objects = {}
for line in readAll(DUMPS .. '\\ObjectList.ini'):gmatch('[^\r\n]+') do objects[line:lower()] = true end

if next(clips) == nil or next(clipsets) == nil or next(scenarios) == nil or next(objects) == nil then
    print('a dump did not parse — check the folder holds the five files')
    os.exit(2)
end

-- ---- the list ----

local env = {}
local chunk = assert(loadfile(LIST, 't', env))
chunk()
local L = env.EmoteList
if type(L) ~= 'table' then
    print('the list file does not set EmoteList')
    os.exit(1)
end

local problems = {}
local function bad(where, what) problems[#problems + 1] = where .. ': ' .. what end

local function known(t, fields, where)
    for k in pairs(t) do
        if not fields[k] then bad(where, 'unknown field "' .. tostring(k) .. '"') end
    end
end

local function vec3(v)
    return type(v) == 'table' and #v == 3 and type(v[1]) == 'number' and type(v[2]) == 'number'
        and type(v[3]) == 'number'
end

local RESERVED = { c = true, place = true }
local CMD = '^[a-z0-9_]+$'

--- A preview video: a relative .webm path that is on disk where the menu will look for it.
local function checkVideo(v, where)
    if v == nil then return end
    if type(v) ~= 'string' or not v:match('^[%w_%-/%.]+%.webm$') or v:find('%.%.') then
        bad(where, 'video must be a path like "Emotes/wave.webm"')
        return
    end
    local file = v:gsub('/', '\\')
    for _, dir in ipairs(VIDEOS) do
        local f = io.open(dir .. file, 'rb')
        if f then f:close() return end
    end
    bad(where, 'no video file video/emotes/' .. v .. ' in any media pack')
end

-- categories
local cats = {}
for i, c in ipairs(L.categories or {}) do
    local where = ('categories[%d]'):format(i)
    known(c, { key = true, label = true }, where)
    if type(c.key) ~= 'string' or not c.key:match(CMD) then bad(where, 'key must be lowercase letters, digits, _')
    elseif cats[c.key] then bad(where, 'key "' .. c.key .. '" twice')
    else cats[c.key] = true end
    if type(c.label) ~= 'string' or c.label == '' then bad(where, 'no label') end
end
if next(cats) == nil then bad('categories', 'none') end

-- emotes
local EMOTE_FIELDS = { cmd = true, label = true, category = true, dict = true, anim = true, scenario = true,
                       loop = true, move = true, freeze = true, props = true, video = true }
local PROP_FIELDS = { model = true, bone = true, offset = true, rot = true }
local seen = {}
local n = 0
for i, e in ipairs(L.emotes or {}) do
    n = n + 1
    local where = ('emotes[%d] %s'):format(i, tostring(e.cmd))
    known(e, EMOTE_FIELDS, where)
    if type(e.cmd) ~= 'string' or not e.cmd:match(CMD) then bad(where, 'cmd must be lowercase letters, digits, _')
    elseif RESERVED[e.cmd] then bad(where, '"' .. e.cmd .. '" is reserved')
    elseif seen[e.cmd] then bad(where, 'cmd used twice')
    else seen[e.cmd] = true end
    if type(e.label) ~= 'string' or e.label == '' or #e.label > 40 then bad(where, 'label missing or over 40 characters') end
    if not cats[e.category] then bad(where, 'category "' .. tostring(e.category) .. '" is not in categories') end

    -- Three kinds: an animation (dict + anim), a scenario, or PROP ONLY (props and nothing to play —
    -- a backpack worn, a briefcase carried, while the player moves as normal).
    local isAnim = e.dict ~= nil or e.anim ~= nil
    if isAnim and e.scenario ~= nil then
        bad(where, 'dict + anim, or scenario — not both')
    elseif isAnim then
        if type(e.dict) ~= 'string' or type(e.anim) ~= 'string' then bad(where, 'needs both dict and anim')
        elseif not clips[e.dict:lower()] then bad(where, 'no animation dictionary "' .. e.dict .. '"')
        elseif not clips[e.dict:lower()][e.anim:lower()] then bad(where, 'no clip "' .. e.anim .. '" in ' .. e.dict) end
    elseif e.scenario ~= nil then
        if not scenarios[e.scenario] then bad(where, 'no scenario "' .. tostring(e.scenario) .. '"') end
    elseif e.props == nil then
        bad(where, 'needs dict + anim, a scenario, or props (a prop-only emote)')
    end
    for _, f in ipairs({ 'loop', 'move', 'freeze' }) do
        if e[f] ~= nil and type(e[f]) ~= 'boolean' then bad(where, f .. ' must be true or false') end
    end
    if e.scenario and (e.loop ~= nil or e.move ~= nil or e.freeze ~= nil or e.props ~= nil) then
        bad(where, 'a scenario takes no loop/move/freeze/props — it brings its own')
    end
    if not isAnim and not e.scenario and (e.loop ~= nil or e.move ~= nil or e.freeze ~= nil) then
        bad(where, 'a prop-only emote plays nothing, so it takes no loop/move/freeze')
    end
    checkVideo(e.video, where)

    if e.props ~= nil then
        if type(e.props) ~= 'table' or #e.props > 2 then bad(where, 'props must be a list of at most 2') end
        for j, p in ipairs(type(e.props) == 'table' and e.props or {}) do
            local pw = where .. (' props[%d]'):format(j)
            known(p, PROP_FIELDS, pw)
            if type(p.model) ~= 'string' or not objects[p.model:lower()] then
                bad(pw, 'no prop model "' .. tostring(p.model) .. '"')
            end
            if math.type(p.bone) ~= 'integer' then bad(pw, 'bone must be a whole number (a bone id)') end
            if p.offset ~= nil and not vec3(p.offset) then bad(pw, 'offset must be { x, y, z }') end
            if p.rot ~= nil and not vec3(p.rot) then bad(pw, 'rot must be { x, y, z }') end
        end
    end
end

-- walks and moods
local function list(name, fields, check)
    local s = {}
    for i, w in ipairs(L[name] or {}) do
        local where = ('%s[%d] %s'):format(name, i, tostring(w.cmd))
        known(w, fields, where)
        if type(w.cmd) ~= 'string' or not w.cmd:match(CMD) then bad(where, 'cmd must be lowercase letters, digits, _')
        elseif w.cmd == 'c' then bad(where, '"c" is reserved')
        elseif s[w.cmd] then bad(where, 'cmd used twice')
        else s[w.cmd] = true end
        if type(w.label) ~= 'string' or w.label == '' then bad(where, 'no label') end
        check(w, where)
    end
    return s
end

local walks = list('walks', { cmd = true, label = true, clipset = true, video = true }, function(w, where)
    if type(w.clipset) ~= 'string' or not clipsets[w.clipset:lower()] then
        bad(where, 'no movement clipset "' .. tostring(w.clipset) .. '"')
    end
    checkVideo(w.video, where)
end)

local FACE_M, FACE_F = clips['facials@gen_male@base'] or {}, clips['facials@gen_female@base'] or {}
local moods = list('moods', { cmd = true, label = true, anim = true }, function(m, where)
    local anim = type(m.anim) == 'string' and m.anim:lower() or ''
    if not FACE_M[anim] then bad(where, 'no facial clip "' .. tostring(m.anim) .. '" for male peds') end
    if not FACE_F[anim] then bad(where, 'no facial clip "' .. tostring(m.anim) .. '" for female peds') end
end)

local function count(t) local c = 0 for _ in pairs(t) do c = c + 1 end return c end
print(('emotecheck: %d emote(s), %d walk(s), %d mood(s), %d categor(ies)'):format(
    n, count(walks), count(moods), count(cats)))
if #problems == 0 then
    print('all good')
    os.exit(0)
end
for _, p in ipairs(problems) do print('  ' .. p) end
print(('%d problem(s)'):format(#problems))
os.exit(1)
