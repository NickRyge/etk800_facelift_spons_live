-- Author - Niclas Ryge
-- DON'T USE THIS CODE WITHOUT EXCPLICIT PERMISSION

local M = {}

-- Local variables
local timer
local numberOfLights = 6
local realtimer
local electricsName = ""

local function reset()
    timer = 0
    realtimer = 0

    for var=0,numberOfLights do
        electrics.values[electricsName.."_"..tostring(var)] = 0
    end
end


-- Init
local function init(jbeamData)
    electricsName = jbeamData.electricsName or "christmas"
    numberOfLights = jbeamData.numberOfLights or 6
end

local function determineLighting(target, offset, timer)
    electrics.values[target] = ((timer + offset)%3)*0.49
end


-- Runs every GFX tick.
local function updateGFX(dt)
    if electrics.values.ignitionLevel == 0 then
        reset()
        return
    end


    local past_timer = realtimer 
    timer = timer + dt * 1.0
    timer = timer%18
    realtimer = math.floor(timer)
    --print(realtimer)

    if past_timer == timer then
        return
    end

    for var=0,numberOfLights do
        determineLighting(electricsName.."_"..tostring(var), var, realtimer)
    end

end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M