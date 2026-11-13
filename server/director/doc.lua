-- Every scenario document the Director reads comes through DirectorDoc.load, which answers a copy or nil and why:
--   1. its format must be DirectorDoc.FORMAT
--   2. its lists must be lists and its settings a table
--   3. renamed cards get their current names (DirectorNodes.applyRenames)
--   4. older card versions are brought up by the card's own `upgrade(props, fromVersion)` (nodes.lua)
-- Shape (see graph.lua): { format, name, description, settings, vars, world, nodes, links, comments, variants }.

DirectorDoc = {}

--- The document format this Director reads and writes (same as FORMAT in html/js/director/doc.js).
DirectorDoc.FORMAT = 2

local LISTS = { 'nodes', 'links', 'vars', 'world', 'comments', 'variants' }

--- Each card of a node list brought up to date: renamed types read as now, older versions upgraded by their card.
local function upgradeNodes(nodes, problems)
    for _, n in ipairs(nodes) do
        if type(n) == 'table' then
            local def = DirectorNodes.get(n.type)
            local saved = math.tointeger(n.v) or 1
            if def and type(def.upgrade) == 'function' and math.type(def.v) == 'integer' and saved < def.v then
                local ok, props = pcall(def.upgrade, type(n.props) == 'table' and n.props or {}, saved)
                if ok and type(props) == 'table' then
                    n.props, n.v = props, def.v
                else
                    problems[#problems + 1] = ('card %s (%s) could not be brought up to version %d: %s')
                        :format(tostring(n.id), tostring(n.type), def.v, tostring(props))
                end
            end
        end
    end
end

-- Documents load() made: [doc] = true, or the cards it could not upgrade.
local made = setmetatable({}, { __mode = 'k' })

local copyOf

--- A document as the Director reads it (a copy), or nil and why. `raw` is never changed.
---@return table|nil doc
---@return string|nil why
---@return string[]|nil problems  cards that could not be brought up to date (the document is still read)
function DirectorDoc.load(raw)
    local doc, why, problems = copyOf(raw)
    if doc then made[doc] = problems or true end
    return doc, why, problems
end

--- A document only to read: one load() already made is returned as is (with its problems), anything else is loaded.
--- The result must not be changed: a build loads its own copy.
function DirectorDoc.read(raw)
    local m = type(raw) == 'table' and made[raw] or nil
    if m then return raw, nil, m ~= true and m or nil end
    return DirectorDoc.load(raw)
end

copyOf = function(raw)
    if type(raw) ~= 'table' then return nil, 'the scenario is not readable' end
    if raw.format ~= DirectorDoc.FORMAT then
        if raw.format == 1 then
            return nil, 'this scenario was made before the Director was rebuilt (format 1): it cannot be opened'
        end
        return nil, ('this scenario is format %s; this Director reads format %d'):format(tostring(raw.format), DirectorDoc.FORMAT)
    end
    for _, k in ipairs(LISTS) do
        if raw[k] ~= nil and type(raw[k]) ~= 'table' then return nil, ('the scenario\'s %s are not a list'):format(k) end
    end
    if raw.settings ~= nil and type(raw.settings) ~= 'table' then return nil, 'the scenario\'s settings are not readable' end
    local doc = DirectorKit.plain(raw, { depth = 32 })
    doc = DirectorNodes.applyRenames(doc)
    local problems = {}
    upgradeNodes(doc.nodes or {}, problems)
    for i, v in ipairs(doc.variants or {}) do
        if type(v) == 'table' and type(v.nodes) == 'table' then
            v = DirectorNodes.applyRenames(v)
            doc.variants[i] = v
            upgradeNodes(v.nodes, problems)
        end
    end
    return doc, nil, #problems > 0 and problems or nil
end
