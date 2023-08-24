-- Author - Niclas Ryge
-- DON'T USE THIS CODE WITHOUT EXCPLICIT PERMISSION

local M = {}

-- Local variables
local timer
local timerTrunk
local limit = 10
local multiplier = 23

local function reset()
    timer = 0
    timerTrunk = 0
end


-- Init
local function init(jbeamData)
    reset()
end

local function determineLighting(dt, determinant, target, funcTimer, funcLimit, funcMultiplier)

    if (determinant > 0) then
        if funcTimer >= funcLimit then
            funcTimer = funcLimit
        else 
            funcTimer = funcTimer + dt * funcMultiplier
        end
    else
        if funcTimer <= 0 then
            funcTimer = 0
        else 
            funcTimer = funcTimer - dt * funcMultiplier
        end
    end
    if funcTimer == 0 or funcTimer == funcLimit then
        return funcTimer
    end
    for i = 1, funcLimit, 1 do
        electrics.values[target..tostring(i)] = ((funcTimer - i > 0 and funcTimer-i < 1) or 0)
    end
    return funcTimer
end


-- Runs every GFX tick.
local function updateGFX(dt)
    
    --local trunk = electrics.values.tailgateCoupler_notAttached
    local FL, FR, RL, RR = electrics.values.doorFLCoupler_notAttached, electrics.values.doorFRCoupler_notAttached, electrics.values.doorRLCoupler_notAttached, electrics.values.doorRRCoupler_notAttached
    
    timer = determineLighting(dt, FL+FR+RL+RR, "open", timer, limit, multiplier)
    --timerTrunk = determineLighting(dt, trunk, "trunkOpen", timerTrunk, limit, 15)
end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M