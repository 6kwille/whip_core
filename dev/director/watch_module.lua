-- Fail Condition watches (runtime.lua: a look at the run on its own clock), ctx:broken once a run and once a player,
-- ctx:emit (an outcome while the card waits on), and a call answering no pin. Against the real Director:
--   MEMCAP_MB=512 lua54 guard.lua harness.lua watch_module.lua

local function n(id, t, props) return { id = id, type = t, v = 1, x = 0, y = 0, props = props or {} } end
local function l(id, a, ap, b, bp) return { id = id, from = { node = a, pin = ap }, to = { node = b, pin = bp or 'in' } } end
local function doc(nodes, links, vars)
    return { format = 2, name = 'Watch', description = '', vars = vars or {}, comments = {}, world = {}, nodes = nodes, links = links,
             settings = { start = { mode = 'admin' }, maxConcurrentRuns = 1, teamSize = 4, maxRunSec = 900 } }
end
local function tick(k) for _ = 1, k or 10 do HarnessTick(50) end end
local function start(key, d)
    local okA, probs = Director.activate(key, d, { rev = 1 })
    if not okA then
        local t = {}
        for _, p in ipairs(type(probs) == 'table' and probs or { { message = tostring(probs) } }) do
            if p.severity ~= 'warning' then t[#t + 1] = tostring(p.message) end
        end
        error({ msg = 'not switched on: ' .. table.concat(t, ' | ') })
    end
    local run, why = Director.startRun(Director.active[key], 1, nil, nil)
    if not run then error({ msg = 'no run: ' .. tostring(why) }) end
    return run
end
local function count(run, node, kind, pin)
    local c = 0
    for i = 1, run.trace.n do
        local e = run.trace[i]
        if e and e.node == node and e.kind == kind and (pin == nil or e.pin == pin) then c = c + 1 end
    end
    return c
end
local function holdDoc(extra, links)
    local nodes = { n('s', 'scenario.started'), n('hold', 'flow.wait', { seconds = 600 }), n('win', 'scenario.succeed') }
    for _, x in ipairs(extra) do nodes[#nodes + 1] = x end
    local ls = { l('a', 's', 'out', 'hold'), l('b', 'hold', 'done', 'win') }
    for _, x in ipairs(links or {}) do ls[#ls + 1] = x end
    return nodes, ls
end

-- Card types only this file uses.
assert(DirectorNodes.define({ type = 'zz.badwatch', v = 1, category = 'fail', title = 'Bad Watch', condition = true,
    inputs = {}, outputs = {}, watch = function() error('boom') end }))
assert(DirectorNodes.define({ type = 'zz.emitter', v = 1, category = 'flow', title = 'Emitter', latent = true,
    outputs = { 'tick', 'done' }, once = false,
    run = function(ctx)
        local k = 0
        ctx:poll(250, function()
            k = k + 1
            if k < 3 then ctx:emit('tick') return nil end
            return 'done'
        end)
        return nil
    end }))
assert(DirectorNodes.define({ type = 'zz.callpoll', v = 1, category = 'flow', title = 'Call Then Poll', latent = true,
    outputs = { 'started', 'done' }, once = false,
    run = function(ctx)
        ctx:call(function()
            Wait(300)
            local k = 0
            ctx:poll(250, function() k = k + 1 if k >= 2 then return 'done' end return nil end)
            ctx:emit('started')
            return nil
        end)
        return nil
    end }))
assert(DirectorNodes.define({ type = 'zz.nilcall', v = 1, category = 'flow', title = 'Nil Call', latent = true,
    outputs = { 'done' }, once = false,
    run = function(ctx) ctx:call(function() return nil end) return nil end }))
local okBad = DirectorNodes.define({ type = 'zz.watchnotcond', v = 1, category = 'flow', title = 'X', inputs = {}, outputs = {},
    watch = function() end })

RegisterTestModule({
    category = 'Watches and emit', order = 1,
    tests = {
        { name = 'only a fail condition watches', fn = function()
            assertFalse(okBad, 'refused')
        end },
        { name = 'Fail If a Player Goes Down, everyone: the run fails with its Why, the rule broken once', fn = function()
            Players[1].isDead = false
            local nodes, links = holdDoc({ n('rule', 'fail.playerDown', { ends = 'everyone', reason = 'down!' }) })
            local run = start('w_a', doc(nodes, links))
            tick(30)
            assertEqual(run.status, 'running', 'going while nobody is down')
            Players[1].isDead = true
            tick(30)
            Players[1].isDead = false
            assertEqual(run.status, 'failed', 'failed')
            assertEqual(run.reason, 'down!', 'with its Why')
            assertEqual(count(run, 'rule', 'broken'), 1, 'one broken step, on the card')
            Director.deactivate('w_a', 'switched off')
        end },
        { name = 'Take only that player out: they leave, the run (no one left) ends; broken once though still down', fn = function()
            Players[1].isDead = false
            local nodes, links = holdDoc({ n('rule', 'fail.playerDown', { ends = 'them', reason = 'you are out' }) })
            local run = start('w_b', doc(nodes, links))
            tick(10)
            Players[1].isDead = true
            tick(60)
            Players[1].isDead = false
            assertEqual(run.status, 'aborted', 'aborted: the last player left (' .. tostring(run.reason) .. ')')
            assertEqual(count(run, 'rule', 'broken'), 1, 'one broken step')
            Director.deactivate('w_b', 'switched off')
        end },
        { name = 'Fail If a Variable after a Wait: After Failure plays', fn = function()
            local nodes, links = holdDoc({ n('w', 'flow.wait', { seconds = 1 }), n('add', 'var.add', { var = 'x', amount = 3 }),
                                           n('rule', 'fail.variable', { var = 'x', op = 'at least', value = '3', reason = 'x hit 3' }),
                                           n('af', 'run.afterFail'), n('mark', 'var.set', { var = 'after', value = 'yes' }) },
                { l('c', 's', 'out', 'w'), l('d', 'w', 'done', 'add'), l('e', 'af', 'out', 'mark') })
            local run = start('w_c', doc(nodes, links, { { id = 'x', label = 'x', type = 'number', default = 0 },
                                                         { id = 'after', label = 'after', type = 'text', default = '' } }))
            tick(80)
            assertEqual(run.status, 'failed', 'failed (' .. tostring(run.reason) .. ')')
            assertEqual(run.reason, 'x hit 3', 'its Why')
            assertEqual(run.vars.after, 'yes', 'After Failure played')
            Director.deactivate('w_c', 'switched off')
        end },
        { name = 'a watch that errors faults the run', fn = function()
            local nodes, links = holdDoc({ n('rule', 'zz.badwatch') })
            local run = start('w_d', doc(nodes, links))
            tick(30)
            assertEqual(run.status, 'faulted', 'faulted')
            assertTrue(tostring(run.reason):find('its watch failed', 1, true) ~= nil, 'saying so: ' .. tostring(run.reason))
            Director.deactivate('w_d', 'switched off')
        end },
        { name = 'ctx:emit from a poll: two Ticks while it waits, then Done', fn = function()
            local nodes = { n('s', 'scenario.started'), n('em', 'zz.emitter'), n('add', 'var.add', { var = 'k', amount = 1 }),
                            n('win', 'scenario.succeed') }
            local links = { l('a', 's', 'out', 'em'), l('b', 'em', 'tick', 'add'), l('c', 'em', 'done', 'win') }
            local run = start('w_e', doc(nodes, links, { { id = 'k', label = 'k', type = 'number', default = 0 } }))
            tick(40)
            assertEqual(run.status, 'succeeded', 'succeeded (' .. tostring(run.reason) .. ')')
            assertEqual(run.vars.k, 2, 'Tick twice')
            assertEqual(count(run, 'em', 'out', 'tick'), 2, 'two tick steps')
            Director.deactivate('w_e', 'switched off')
        end },
        { name = 'a call answering no pin with a poll set: its part done, the card goes on (Started, then Done)', fn = function()
            local nodes = { n('s', 'scenario.started'), n('cp', 'zz.callpoll'), n('add', 'var.add', { var = 'k', amount = 1 }),
                            n('win', 'scenario.succeed') }
            local links = { l('a', 's', 'out', 'cp'), l('b', 'cp', 'started', 'add'), l('c', 'cp', 'done', 'win') }
            local run = start('w_f', doc(nodes, links, { { id = 'k', label = 'k', type = 'number', default = 0 } }))
            tick(40)
            assertEqual(run.status, 'succeeded', 'succeeded (' .. tostring(run.reason) .. ')')
            assertEqual(run.vars.k, 1, 'Started once')
            Director.deactivate('w_f', 'switched off')
        end },
        { name = 'a call answering no pin with nothing else: a fault, as before', fn = function()
            local nodes = { n('s', 'scenario.started'), n('nc', 'zz.nilcall'), n('win', 'scenario.succeed') }
            local links = { l('a', 's', 'out', 'nc'), l('c', 'nc', 'done', 'win') }
            local run = start('w_g', doc(nodes, links))
            tick(20)
            assertEqual(run.status, 'faulted', 'faulted (' .. tostring(run.reason) .. ')')
            Director.deactivate('w_g', 'switched off')
        end },
    },
})
