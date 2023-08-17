-- Author - Niclas Ryge
-- DON'T USE THIS CODE WITHOUT EXCPLICIT PERMISSION

local M = {}

-- Local variables
local ignition
local pastignition
local wiggle = false
local old = 0
local level = 0
local lowhighbeam
local highbeam 

-- Car specifics (applies only to Spons facelift mod)
local yellowlights
local yellow

-- This function resetss the lights and either leave them at 0 or at 0.5 depending on if they are on or not.
local function reset()
    if electrics.values.ignitionLevel > 0 then
        for i = 1,8,1 do
            electrics.values["DRL"..i] = 0.5
        end
    end
    pastignition = electrics.values.ignitionLevel
    level = 0
end


-- Init
local function init(jbeamData)
    -- If car spawns started, turn all lights on.
    reset()
    yellowlights = electrics.values.yellowlights
    lowhighbeam = electrics.values.lowhighbeam
    highbeam = electrics.values.highbeam
end


-- Terribly optimized welcomelights.
local function welcomeLightsStep(dt, currentValue)
    -- use dt as counter to count up through lights
    local step = (20 - currentValue) * dt * 0.85 
    local newValue = currentValue+step
    local light = math.ceil(newValue)

    -- Save resources.
    if light == math.ceil(currentValue) then
        return newValue
    
    -- Used for the edgecase that a user turns on lights while the car is off. 
    -- The reason this is needed and that the lights cant be handled in this function is
    -- that the lights will turn on before this function has the chance to turn them off, leaving them flashing.
    -- That looks particularly stupid.
    elseif lowhighbeam+highbeam ~= 0 or yellowlights ~= 0 then
        wiggle = false
        reset()
        return newValue
    end
    
    if light < 5 then
        electrics.values["DRL"..light] = 1
        electrics.values["DRL"..light-1] = 0
    else
        -- Otherwise go the other way
        electrics.values["DRL".. 8-light] = 1
        electrics.values["DRL".. 8-light+1] = 0.5
    end

    if math.ceil(currentValue) == 9 then
        wiggle = false
        electrics.values.yellowlights = yellow
        for i = 1,level,1 do
            electrics.toggle_lights()
        end

    end
    return newValue
end


-- Runs every GFX tick.
local function updateGFX(dt)
    -- Assign variables
    lowhighbeam = electrics.values.lowhighbeam
    highbeam = electrics.values.highbeam
    yellowlights = electrics.values.yellowlights

    -- Do the welcome wiggle
    if wiggle then old = welcomeLightsStep(dt, old) end
    
    ignition = electrics.values.ignitionLevel

    if (pastignition%2) > ignition then

        for i = 1,8,1 do
            electrics.values["DRL"..i] = 0
        end
        wiggle = false
        
        -- This introduces the edgecase that the lights are turned on while the car is off, then this doesn't catch.
        level = lowhighbeam+highbeam
        yellow = yellowlights

        -- My brain is so smooth
        -- This toggles the lights the amount of times that would be required to restore them to 0 and back again.
        -- The reason this applies is because there is no function to turn it on or off, only to "toggle" them
        electrics.values.yellowlights = 0
        for i = 1,(1+lowhighbeam-highbeam)*lowhighbeam,1 do
            electrics.toggle_lights()
        end
    end

    -- Mathematically proven to be stupid
    if (ignition%2) > pastignition then
        -- Do the jiggle
        wiggle = true

        old = 0
    end
    pastignition = ignition
end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M