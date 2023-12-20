-- Authored by NickRyge
-- Guide for usage available at https://docs.google.com/document/d/1X1E5cKDAUxGUC_hapuBVAPWeanesChuSFBmn7mjaHTU/edit?usp=sharing 

local M = {}

-- Local variables
-- Amount of sections the blinkers have
local sectionSize
local timer = 0
local previous = 0
local timerStart
local timerStop
local timerSpeed



-- Reset runction to turn lights off
local function reset()
    for i = 1, sectionSize, 1 do
        electrics.values["signalL"..i] = 0
        electrics.values["signalR"..i] = 0
    end
    -- Does not include a timer reset, allowing manipulation elsewhere.
end


-- Runs when the vehicle spawns
local function init(jbeamData)
    -- jbeamData is defined in the jbeam as the controller config. Defaults to 10.
    timer = 0
    sectionSize = jbeamData.sectionSize or 9
    timerStart = jbeamData.timerStart or 0.25
    timerStop = jbeamData.timerStop or 0.45
    timerSpeed = jbeamData.timerSpeed or 0.025
    reset()
end

-- Run every graphics tick
local function updateGFX(dt)
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
        electrics.values["signalL"..i] = (left > 0 and (timerSpeed * i < timer)) or 0
        electrics.values["signalR"..i] = (right > 0 and (timerSpeed * i < timer)) or 0
    end

    if timer > timerStop then reset() end
    if timer > timerStop+timerStart then timer = 0 end

end


M.updateGFX = updateGFX
M.init = init
M.reset = reset

return M