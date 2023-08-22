-- Author - Niclas Ryge
-- DON'T USE THIS CODE WITHOUT EXCPLICIT PERMISSION

local M = {}

-- Local variables
-- Amount of sections the blinkers have
local sectionSize
local timer = 0
local previous = 0
local timerStart
local timerStop
local timerSpeed


--brain stuff
local stuff
local trueIndex


-- Reset runction to turn lights off
local function reset()
    for i = 1, sectionSize, 1 do
        electrics.values["testl"..i] = 0
        electrics.values["testr"..i] = 0
    end
    -- Does not include a timer reset, allowing manipulation elsewhere.
end


-- Runs when the vehicle spawns
local function init(jbeamData)
    -- jbeamData is defined in the jbeam as the controller config. Defaults to 10.
    timer = 0
    sectionSize = jbeamData.sectionSize or 5
    timerStart = jbeamData.timerStart or 0
    timerStop = jbeamData.timerStop or 0.35
    timerSpeed = jbeamData.timerSpeed or 0.05
    reset()


    -- BIG BRAIN TESTING AREA

    print("----------")
    for index, innerTable in pairs(v.data.props) do
        print(index)
        --print(innerTable)
        for x, y in pairs(innerTable) do

            --print(x)
           -- print(y)

            if y == "WALLAH" then
                stuff = innerTable
                print(index)
                trueIndex = index
            end
    
    
        end
    end

    for name, value in pairs(stuff) do
        print(name)
        
    end
    print(v.data.props[trueIndex].lightRange)



end


-- yoinked from the props lua
local function updateProp(prop)
    local val = prop.dataValue
    if val == nil or not prop.pid then return end
    --convert any possible bools to 0/1
    val = type(val) ~= "boolean" and val or (val and 1 or 0)
    local pt = prop.translation
    local pr = prop.rotation
    if prop.pid == 11 then
      print(pr.x)
      pt.z = 0.01
    end
    obj:propUpdate(prop.pid, pt.x, pt.y, pt.z, pr.x, pr.y, pr.z, not prop.hidden, val, min(max(val * prop.multiplier, prop.min), prop.max) + prop.offset)
  end



-- Run every graphics tick
local function updateGFX(dt)

    --print(stuff.name)
    

    -- Set local left and right for ease of use
    local left = electrics.values.signal_left_input
    local right = electrics.values.signal_right_input

    -- save resources if neither lights are on and return immediately
    if left == 0 and right == 0 then reset() timer = 0 return end

    -- This mess fixes the edgecase of a player suddenly changing from left to right blinkers or opposite.
    -- If the lights are on but have changed since the last time they were used, then reset the lights.
    if previous ~= left-right then reset() timer = 0 end
    previous = left - right

    timer = timer + dt

    for i = 1, sectionSize, 1 do
        if (left > 0 and (timerSpeed * i < timer)) then 
            electrics.values["testl"..i] = true
            electrics.values["testl"..i-1] = false
        else
            electrics.values["testl"..i] = false
        end

        if (right > 0 and (timerSpeed * i < timer)) then
            electrics.values["testr"..i] = true
            electrics.values["testr"..i-1] = false
        else
            electrics.values["testr"..i] = false
        end

        print("testr"..i)
        electrics.values["tester"] = timer
    end



    --if timer > timerStop then reset() end

    if timer > timerStop+timerStart then timer = 0 end

end


M.updateGFX = updateGFX
M.init = init
M.reset = reset

return M