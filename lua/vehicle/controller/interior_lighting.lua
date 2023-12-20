-- Authored by NickRyge

local M = {}

-- Local variables
-- The timer
local timer
-- The limit or rather count of how many interior lights you have. 10 is the sweet spot.
local limit = 10
-- A speed multiplier
local multiplier = 23

-- Resets the timer to 0
local function reset()
    timer = 0
end


-- Init
local function init(jbeamData)
    limit = jbeamData.limit or 10
    multiplier = jbeamData.multiplier or 23
    reset()
end

-- Function to determine which lights must go on when. 
local function determineLighting(dt, determinant, target, funcTimer, funcLimit, funcMultiplier)

    -- Determines if the lights must be on or not.
    if (determinant > 0) then

        -- Sets the functimer to the limit if it is there or above.
        if funcTimer >= funcLimit then
            funcTimer = funcLimit

            -- Otherwise count up.
        else 
            funcTimer = funcTimer + dt * funcMultiplier
        end
    else
        -- Does the same, but backwards.
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
    
    -- Determator variables for whether a given door is open or not.
    local FL, FR, RL, RR = electrics.values.doorFLCoupler_notAttached, electrics.values.doorFRCoupler_notAttached, electrics.values.doorRLCoupler_notAttached, electrics.values.doorRRCoupler_notAttached
    
    -- Return value of the function to the timer.
    timer = determineLighting(dt, FL+FR+RL+RR, "open", timer, limit, multiplier)
end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M