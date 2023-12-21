-- Authored by NickRyge

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

-- Sets all lights to the specified value
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

    -- specifies the name that the electrics values will have, extended by a number.
    nameString = jbeamData.nameString or "DRL"

    -- Specifies the amount of sections to account for
    sectionAmount = jbeamData.sections or 4
    -- Specifies the speedmodifier
    speedModifier = jbeamData.speedMod or 10
    -- Overrides the brakelights - This is necessary in an electric vehicle because the brake lights are always on when stationary. 
    override = jbeamData.override or false
    -- Specifies the value that the lights should finish at. Can be 0 for off, 0.5 for on, or 1 for on_intense.
    finalValue = jbeamData.finalValue or 0.5

    --DEBUG
    name = jbeamData.name

    -- If car spawns started, turn all lights on.
    reset()
    
    yellowlights = electrics.values.yellowlights or 0
    lowhighbeam = electrics.values.lowhighbeam
    highbeam = electrics.values.highbeam
end

local previous = 1
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

    -- Check for whether the counter is slower than the speed of the light
    -- This was discovered by CAT.
    -- With very low FPS, the timer is actually slower than the speed of the light
    -- So ever so often, a skip in the counter occurs.
    -- This checks for if we jumped more than a single number. If we did, go back one number.
    if math.ceil((timer)*speedModifier) > (previous + 1) then
        timer = (previous+1)/speedModifier
        -- debug print
        --print("number " .. tostring(previous+1) .. " triggered the override in " .. nameString)
    end

    local trueValue = math.ceil(timer*speedModifier)
    previous = trueValue

    
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