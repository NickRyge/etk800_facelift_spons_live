-- Author - Niclas Ryge
-- DON'T USE THIS CODE WITHOUT EXCPLICIT PERMISSION

local M = {}

-- Local variables

local motors
local constants = {rpmToAV = 0.104719755, avToRPM = 9.549296596425384}


local engine 
local gearbox
local torqueConverter


M.maxRPM = 0
local function reset()



end


-- Init
local function init(jbeamData)
    reset()
    electrics.values.gear_M = 0
    motors = {}
    local motorNames = jbeamData.motorNames or {"frontMotor"}
    for _, v in ipairs(motorNames) do
      local motor = powertrain.getDevice(v)
      if motor then
        print(motor.maxAV* constants.avToRPM)
        M.maxRPM = math.max(M.maxRPM, motor.maxAV * constants.avToRPM)
        table.insert(motors, motor)
      end
    end

    electrics.values.tester = false
    engine = powertrain.getDevice("mainEngine")
    gearbox = powertrain.getDevice("gearbox")
    torqueConverter = powertrain.getDevice("torqueConverter")
    
end


-- Runs every GFX tick.
local function updateGFX(dt)

    --print(electrics.values.gear_M)

    --for x, y in pairs(electrics.values) do
    --print(x .. " - " .. tostring(y))
    --end
    --electrics.values.gearModeIndex = 5
    --electrics.values["gear_A"] = 2
    --electrics.values.gear = "D"

    if electrics.values.tester == 1 then
      gearbox:setMode("neutral")
      print("ok")
    end
    for _, v in ipairs(motors) do
        --v.motorDirection = electrics.values.gear_M or 0
        --if electrics.values.gear_M > 0 then
        --    v.motorDirection = electrics.values.gear_M
        --else
--
        --end
        
        --AS IT TURNS OUT;
        --v.motorDirection gets more torque and less hp the higher this value is. 
        --True value is ofc 1, torque can be increased by increasing this value to 2.
        --A drift mode could be ideal somewhere between 1 and 3
        v.motorDirection =  math.min(1, electrics.values.gear_M)
        print(electrics.values.tester)
        --print(tostring(v.outputRPM) .. " and " .. tostring(electrics.values.gear_M))

        --gearbox:setGearIndex(0)
        

        

        for x, q in pairs(v) do
            --print (x .. " - " .. tostring(q))
        end
      end

    --print(electrics.values.boostMax)
end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M