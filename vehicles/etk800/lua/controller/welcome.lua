-- Author - Niclas Ryge
-- Don't reupload this code without permission and claim it as your own.
-- You can however use it for your own projects without permission.

local M = {}

-- Local variables
local ignition
local pastignition
local wiggle = false
local level = 0
local lowhighbeam
local highbeam
local nameString = ""
local speedModifier
local sectionAmount = 0
local timer = 0
local override = false
local finalValue = 0.5

-- DEBUG - The controller name
local name

-- Car specifics (applies only to Spons facelift mod)
local yellowlights
local yellow

local function setAll(val)
    for i = 1,sectionAmount,1 do
        electrics.values[nameString..i] = val
    end
end

-- This function resetss the lights and either leave them at 0 or at 0.5 depending on if they are on or not.
local function reset()
    if electrics.values.ignitionLevel > 0 then
        setAll(finalValue)
    else
        setAll(0)
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
    override = jbeamData.override or false
    finalValue = jbeamData.finalValue or 0.5

    --DEBUG
    name = jbeamData.name

    -- If car spawns started, turn all lights on.
    reset()
    
    yellowlights = electrics.values.yellowlights or 0
    lowhighbeam = electrics.values.lowhighbeam
    highbeam = electrics.values.highbeam
end


local function welcomeLights(dt)

    -- Used for the edgecase that a user turns on lights while the car is off. 
    -- The reason this is needed and that the lights cant be handled in this function is
    -- that the lights will turn on before this function has the chance to turn them off, leaving them flashing.
    -- That looks particularly stupid. 
    --NOTE: Only runs on the first pass, because there can be multiple controllers fucking with this.
    if timer == 0 and (lowhighbeam+highbeam ~= 0 or yellowlights ~= 0) then
        wiggle = false
        reset()
    end

    -- If override then turn off brakelights
    if override then electrics.values["brakelights"] = 0 end

    -- Timer increment and val calculation
    timer = timer + dt
    local trueValue = math.ceil(timer*speedModifier)

    -- Start going op
    if trueValue <= math.ceil(sectionAmount) then
        electrics.values[nameString..trueValue] = 1
        electrics.values[nameString..trueValue-1] = -1
    else
        -- Then go the other way
        electrics.values[nameString.. sectionAmount*2-trueValue] = 1

        --Do this if override brakelights true
        -- We do it because we assume that if we override brakelights, this must be the rear lights
        -- in that case, we turn on the welcome lights if they were on before the car came on.
        if override and level > 0 then
            electrics.values[nameString.. sectionAmount*2-trueValue+1] = finalValue+0.2
        else
            electrics.values[nameString.. sectionAmount*2-trueValue+1] = finalValue
        end
    end
    
    -- If we reached the end
    if math.ceil(trueValue) == (sectionAmount*2) then
        timer = 0
        trueValue = 0
        wiggle = false
        electrics.values.yellowlights = yellow
        --Turn lights back on
        electrics.setLightsState(level)

        -- Turn the overwritten lights back off
        if override and level > 0 then setAll(finalValue) end
    end
end


-- Runs every GFX tick.
local function updateGFX(dt)
    --If welcome activated then do the welcome lights
    if wiggle then welcomeLights(dt) end

    -- Update variables
    lowhighbeam = electrics.values.lowhighbeam
    highbeam = electrics.values.highbeam
    yellowlights = electrics.values.yellowlights
    ignition = electrics.values.ignitionLevel

    -- Checks if the car has been turned off.
    if (pastignition%2) > ignition then

        --Reset everything
        setAll(0)
        wiggle = false
        timer = 0
        
        --Saves the state of the lights before setting them to 0
        level = lowhighbeam+highbeam
        yellow = yellowlights

        electrics.values.yellowlights = 0
        electrics.setLightsState(0)
    end

    -- If ignition is on, but only turned on once, then
    if ignition > pastignition and pastignition < 1 then
        -- Do the welcome dance
        wiggle = true
        --Overwrite brakelights here so prevent them turning on before we have the chance to turn them off
        --Only really applies to electric cars.
        if override then electrics.values["brakelights"] = 0 end
    end
    -- Saves ignition state
    pastignition = ignition
end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M