-- This Source Code Form is subject to the terms of the bCDDL, v. 1.1.
-- If a copy of the bCDDL was not distributed with this
-- file, You can obtain one at http://beamng.com/bCDDL-1.1.txt

-- Drives the dashboard navigator (bngNavigator) running inside the gauge screen page.
--
-- Unlike the stock beamNavigator controller, this does NOT create its own htmlTexture:
-- the `gauge` block in etk800_digitalGauges_spons.jbeam already owns the screen material
-- and loads gauges_screen_digi.html. We simply request the road-network/terrain map for
-- that same material and stream the vehicle position to window.map.updateData each frame.
--
-- IMPORTANT: screenMaterialName must match the gauge block's materialName, otherwise the
-- map data is sent to a material that isn't shown on the dash and nothing renders.

local M = {}
M.type = "auxiliary"

local htmlTexture = require("htmlTexture")

local screenMaterialName = nil
local updateTimer = 0
local invFPS = 1 / 30 -- navigator refresh rate
local gpsData = {x = 0, y = 0, rotation = 0, speed = 0, zoom = 1, ignitionLevel = 0}

local timeSinceInit = 0
local configSendTimes = {0.5, 3} -- resend: the page may not be loaded on the first try
local gaugeConfig = nil

-- Gather what the dial scales need: engine/fuel type, RPM limit and a
-- theoretical top speed (maxRPM through the tallest gear at wheel radius).
local function buildGaugeConfig()
  local cfg = {fuelType = "none", maxRpm = 0, vmaxKmh = 0}

  local engine = powertrain.getDevice("mainEngine")
  if engine then
    cfg.maxRpm = engine.maxRPM or 0
    cfg.fuelType = engine.requiredEnergyType or "gasoline"
  else
    local motors = powertrain.getDevicesByType("electricMotor")
    if motors and #motors > 0 then
      cfg.fuelType = "electricEnergy"
    end
  end
  if cfg.maxRpm <= 0 then
    cfg.maxRpm = electrics.values.maxrpm or 0
  end

  local ok, vmax = pcall(function()
    local topGearRatio = 1
    local gearbox = powertrain.getDevice("gearbox")
    if gearbox and gearbox.gearRatios then
      local best = math.huge
      for _, r in pairs(gearbox.gearRatios) do
        if type(r) == "number" and r > 0.05 then
          best = math.min(best, r)
        end
      end
      if best < math.huge then topGearRatio = best end
    end

    local finalRatio = 1
    for _, device in pairs(powertrain.getDevices()) do
      if device.type == "differential" and device.gearRatio and device.gearRatio > finalRatio then
        finalRatio = device.gearRatio
      end
    end

    local radiusSum, radiusCount = 0, 0
    for i = 0, wheels.wheelCount - 1 do
      local w = wheels.wheels[i]
      if w and w.radius then
        radiusSum = radiusSum + w.radius
        radiusCount = radiusCount + 1
      end
    end
    local radius = radiusCount > 0 and (radiusSum / radiusCount) or 0.33

    local maxAV = cfg.maxRpm * math.pi / 30
    return maxAV / math.max(topGearRatio * finalRatio, 0.1) * radius * 3.6
  end)
  if ok and type(vmax) == "number" and vmax > 40 and vmax < 700 then
    cfg.vmaxKmh = vmax
  end

  return cfg
end

local function updateGFX(dt)
  updateTimer = updateTimer + dt
  timeSinceInit = timeSinceInit + dt

  -- push the dial configuration to the page (resent once in case the page
  -- was not done loading the first time)
  if configSendTimes[1] and timeSinceInit >= configSendTimes[1] then
    table.remove(configSendTimes, 1)
    gaugeConfig = gaugeConfig or buildGaugeConfig()
    htmlTexture.call(screenMaterialName, "gauges.configure", gaugeConfig)
  end

  if updateTimer >= invFPS and playerInfo.anyPlayerSeated then
    updateTimer = 0

    local pos = obj:getPosition()
    gpsData.x = pos.x
    gpsData.y = pos.y
    gpsData.rotation = math.deg(obj:getDirection()) + 180
    gpsData.speed = electrics.values.airspeed * 3.6
    gpsData.zoom = math.min(150 + gpsData.speed * 1.5, 250) -- unused in dash navigation
    gpsData.ignitionLevel = electrics.values.ignitionLevel

    htmlTexture.call(screenMaterialName, "map.updateData", gpsData)
  end
end

local function init(jbeamData)
  -- Target the material the gauge block created; do not create our own texture.
  screenMaterialName = jbeamData.screenMaterialName or "@etk800_gauges_screen_digi"

  -- Ask the engine to render this map's road network / terrain tiles into the page's
  -- window.map (bngNavigator) instance.
  obj:queueGameEngineLua(string.format(
    "extensions.ui_uinavi.requestVehicleDashboardMap(%q, nil, %d)",
    screenMaterialName,
    obj:getID()
  ))
end

M.init = init
M.reset = nop -- this is needed so that we do not call init when resetting
M.updateGFX = updateGFX

return M
