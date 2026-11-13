-- A small JSON reader for the offline harness (the game's own json is not here): objects, arrays, strings with the
-- usual escapes, numbers, true, false and null (nil). Enough for scenario documents.
--   local decode = dofile('json_read.lua'); local t = decode(text)

local function decode(s)
    local i = 1
    local function ws() i = s:find('[^ \t\r\n]', i) or #s + 1 end
    local function err(what) error(('json: %s at %d'):format(what, i), 0) end
    local value
    local function str()
        local out, j = {}, i + 1
        while true do
            local c = s:sub(j, j)
            if c == '' then err('unfinished string') end
            if c == '"' then i = j + 1 return table.concat(out) end
            if c == '\\' then
                local e = s:sub(j + 1, j + 1)
                local map = { b = '\b', f = '\f', n = '\n', r = '\r', t = '\t', ['"'] = '"', ['\\'] = '\\', ['/'] = '/' }
                if e == 'u' then
                    local cp = tonumber(s:sub(j + 2, j + 5), 16) or 63
                    if cp >= 0xD800 and cp <= 0xDBFF and s:sub(j + 6, j + 7) == '\\u' then
                        local lo = tonumber(s:sub(j + 8, j + 11), 16) or 0xDC00
                        cp = 0x10000 + (cp - 0xD800) * 0x400 + (lo - 0xDC00)
                        j = j + 6
                    end
                    out[#out + 1] = utf8.char(cp)
                    j = j + 6
                else
                    out[#out + 1] = map[e] or e
                    j = j + 2
                end
            else
                local k = s:find('["\\]', j) or #s + 1
                out[#out + 1] = s:sub(j, k - 1)
                j = k
            end
        end
    end
    function value()
        ws()
        local c = s:sub(i, i)
        if c == '{' then
            i = i + 1
            local t = {}
            ws()
            if s:sub(i, i) == '}' then i = i + 1 return t end
            while true do
                ws()
                if s:sub(i, i) ~= '"' then err('a key') end
                local k = str()
                ws()
                if s:sub(i, i) ~= ':' then err('a colon') end
                i = i + 1
                t[k] = value()
                ws()
                local d = s:sub(i, i)
                i = i + 1
                if d == '}' then return t end
                if d ~= ',' then err('a comma') end
            end
        elseif c == '[' then
            i = i + 1
            local t, n = {}, 0
            ws()
            if s:sub(i, i) == ']' then i = i + 1 return t end
            while true do
                n = n + 1
                t[n] = value()
                ws()
                local d = s:sub(i, i)
                i = i + 1
                if d == ']' then return t end
                if d ~= ',' then err('a comma') end
            end
        elseif c == '"' then
            return str()
        elseif s:sub(i, i + 3) == 'true' then i = i + 4 return true
        elseif s:sub(i, i + 4) == 'false' then i = i + 5 return false
        elseif s:sub(i, i + 3) == 'null' then i = i + 4 return nil
        else
            local num = s:match('^-?%d+%.?%d*[eE]?[-+]?%d*', i)
            if not num or num == '' then err('a value') end
            i = i + #num
            return math.tointeger(tonumber(num)) or tonumber(num)
        end
    end
    local v = value()
    return v
end

return decode
