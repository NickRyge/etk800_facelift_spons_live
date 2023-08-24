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
    print(electrics.values.doorFRCoupler_notAttached)
    print(electrics.values.doorFLCoupler_notAttached)
end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M