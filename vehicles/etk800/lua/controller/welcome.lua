-- Author - Niclas Ryge
-- DON'T USE THIS CODE WITHOUT EXCPLICIT PERMISSION

-- This code needs to change. Notably, the dt counting function is flawed, 
-- and I plan to use the much simpler adaptive blinkers implementation.

local M = {}

-- Local variables
local ignition
local pastignition
local wiggle = false
local old = 0
local level = 0
local lowhighbeam
local highbeam
local nameString = ""
local speedModifier
local sectionAmount = 0
local timer = 0

-- Car specifics (applies only to Spons facelift mod)
local yellowlights
local yellow

-- This function resetss the lights and either leave them at 0 or at 0.5 depending on if they are on or not.
local function reset()
    if electrics.values.ignitionLevel > 0 then
        for i = 1,sectionAmount,1 do
            electrics.values[nameString..i] = 0.5
        end
    end
    pastignition = electrics.values.ignitionLevel
    level = 0
    timer = 0
end


-- Init
local function init(jbeamData)
    -- load jbeam data
    nameString = jbeamData.nameString or "DRL"
    speedModifier = jbeamData.timerSpeed or 0.025
    sectionAmount = jbeamData.sections or 4
    speedModifier = jbeamData.speedMod or 10
    
    -- If car spawns started, turn all lights on.
    reset()

    yellowlights = electrics.values.yellowlights
    lowhighbeam = electrics.values.lowhighbeam
    highbeam = electrics.values.highbeam
end


local function welcomeLights(dt)
    electrics.values["brakelights"] = 0
    timer = timer + dt
    local trueValue = math.ceil(timer*speedModifier)

    if trueValue <= math.ceil(sectionAmount) then
        electrics.values[nameString..trueValue] = 1
        electrics.values[nameString..trueValue-1] = 0
    else
        -- Otherwise go the other way
        electrics.values[nameString.. sectionAmount*2-trueValue] = 1
        electrics.values[nameString.. sectionAmount*2-trueValue+1] = 0.5
    end
    

    if math.ceil(trueValue) == (sectionAmount*2) then
        print("DONE")
        timer = 0
        trueValue = 0
        wiggle = false
        electrics.values.yellowlights = yellow
        for i = 1,level,1 do
            electrics.toggle_lights()
        end
    end
end


-- Runs every GFX tick.
local function updateGFX(dt)

   if wiggle then welcomeLights(dt) end

    -- Assign variables
    lowhighbeam = electrics.values.lowhighbeam
    highbeam = electrics.values.highbeam
    yellowlights = electrics.values.yellowlights

    -- Do the welcome wiggle
    -- if wiggle then old = welcomeLightsStep(dt, old) end
    
    ignition = electrics.values.ignitionLevel

    if (pastignition%2) > ignition then

        for i = 1,sectionAmount,1 do
            electrics.values[nameString..i] = 0
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
    if (ignition) > pastignition and pastignition < 1 then
        -- Do the jiggle
        wiggle = true
        electrics.values["brakelights"] = 0
        old = 0
    end
    pastignition = ignition
end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M