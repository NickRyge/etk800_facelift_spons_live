-- Author - Niclas Ryge
-- DON'T USE THIS CODE WITHOUT EXCPLICIT PERMISSION

local M = {}

-- Local variables
local function reset()

end


-- Init
local function init(jbeamData)
    reset()
    
end


-- Runs every GFX tick.
local function updateGFX(dt)
    --print(electrics.values.gear_M)

    for x, y in pairs(electrics.values) do
    print(x .. " - " .. tostring(y))
    end
    electrics.values.gearModeIndex = 5
    electrics.values["gear_A"] = 2
    electrics.values.gear = "D"
    --print(electrics.values.boostMax)
end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M