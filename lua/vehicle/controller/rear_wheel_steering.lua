-- Authored by NickRyge
-- Independent release for Spons_ETK800_Facelift

local M = {}
local debug = false


-- Local variables
local reverseSteeringThreshold
local jbeamName
local isIndependent
local maxSteeringLowSpeed
local maxSteeringHighSpeed

--function pointer
local setSteeringValue


--Local math clamp function for ease of use.
local function clamp(low, n, high) return math.min(math.max(n, low), high) end


--Called whenever the vehicle resets
local function reset()
    --Do something
end

--Function for doing independent steering based on an input
local function setSteeringValueIndependent(input)
    local inputR = input
    local inputL = input
    
    --TODO: Do something to take ackerman steering into consideration?
    
    electrics.values[jbeamName.."_R"] = inputR
    electrics.values[jbeamName.."_L"] = inputL
end

--Function for doing fixed steering based on an input
local function setSteeringValueFixed(input)
    electrics.values[jbeamName] = input
end


-- Init
local function init(jbeamData)

    --Load jbeam data into variables
    reverseSteeringThreshold = jbeamData.reverseThreshold or 15.2778 --roughly 55km/h
    jbeamName = jbeamData.jbeamName or "rearWheelSteering"
    isIndependent = jbeamData.isIndependent or true
    maxSteeringLowSpeed = jbeamData.maxSteeringInputLowSpeed or 1
    maxSteeringHighSpeed = jbeamData.maxSteeringInputHighSpeed or 0.5
    maxSteeringHighSpeed = maxSteeringHighSpeed * -1

    --Determine if the steering is fixed or indenpendent.
    --By this I mean whether the wheels can be steered independently or not. For the ETK800, they can.
    --Let setSteeringValue point to the correct function
    if isIndependent then
        setSteeringValue = setSteeringValueIndependent
    else 
        setSteeringValue = setSteeringValueFixed
    end

    --Lets all electrics values on the car, for debugging
    if debug then
        for key,value in pairs(electrics.values) do 
            print(key)
        end
        print("- - - - -")
    end
end

-- Runs every GFX tick.
local function updateGFX(dt)
    --interesting values
    --electrics.values.wheelspeed
    --electrics.values.steering_input
    
    local mulitplier = clamp(maxSteeringHighSpeed, ((reverseSteeringThreshold-electrics.values.wheelspeed)/reverseSteeringThreshold), maxSteeringLowSpeed)

    local steeringInputRear = electrics.values.steering_input * mulitplier
    if debug then print(steeringInputRear) end 
    
    --Experimenting with toe-in on braking - It does not seem to do the ETK800 any favors, so I dropped it.
    --local brake = electrics.values.brake*0.15

    setSteeringValue(steeringInputRear)

end

M.init = init
M.updateGFX = updateGFX
M.reset = reset()

return M