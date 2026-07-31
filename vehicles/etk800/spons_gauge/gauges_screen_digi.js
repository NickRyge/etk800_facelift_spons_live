// Data plumbing between BeamNG and the BMW-style cluster (bmw-cluster.js).
// BeamNG calls two globals: setup(setupData) once and updateData(data) per frame.
// Lua can additionally call gauges.configure({fuelType, maxRpm, vmaxKmh}) to make
// the dial scales match the actual vehicle (see SponsNavigator.lua).
//
// The Angular module only exists to host the <fake-gps> navigator directive.

angular.module('gaugesScreen', [])
.controller('GaugesScreenController', function() {});

(function () {
  "use strict";

  var units = {
    uiUnitConsumptionRate: "metric",
    uiUnitDate: "ger",
    uiUnitEnergy: "metric",
    uiUnitLength: "metric",
    uiUnitPower: "hp",
    uiUnitPressure: "bar",
    uiUnitTemperature: "c",
    uiUnitTorque: "metric",
    uiUnitVolume: "l",
    uiUnitWeight: "kg"
  };

  // vehicle config pushed from Lua (gauges.configure); sensible fallbacks until then
  var vehCfg = { vmaxKmh: 0, fuelType: null, maxRpm: 0 };
  var lastMaxRpm = -1;

  // BMW-style nonlinear speedo scales: dense low end, compressed top
  var METRIC_TOPS = [
    [160, [0, 20, 40, 60, 80, 100, 130, 160]],
    [200, [0, 20, 40, 60, 80, 120, 160, 200]],
    [240, [0, 20, 40, 60, 100, 140, 200, 240]],
    [260, [0, 20, 40, 60, 100, 140, 200, 260]],
    [300, [0, 20, 40, 60, 100, 140, 220, 300]],
    [340, [0, 20, 40, 60, 100, 160, 240, 340]]
  ];
  var IMPERIAL_TOPS = [
    [100, [0, 10, 20, 30, 40, 60, 80, 100]],
    [120, [0, 10, 20, 30, 40, 60, 90, 120]],
    [140, [0, 10, 20, 30, 50, 80, 110, 140]],
    [160, [0, 10, 20, 30, 50, 80, 120, 160]],
    [200, [0, 20, 40, 60, 80, 120, 160, 200]]
  ];

  function isImperial() {
    return units.uiUnitLength !== "metric";
  }

  // telltales are consumed as-is: numerics arrive 0/1, some flags as Lua bools
  function on(v) { return v === true || (typeof v === "number" && v > 0.5); }
  // gate a light on an "equipped" flag only when the flag is actually streamed
  function equipped(v) { return v == null || on(v); }

  function rebuildSpeedDial() {
    if (!window.bmwCluster) return;
    var vmax = vehCfg.vmaxKmh > 0 ? vehCfg.vmaxKmh : 260;
    if (isImperial()) vmax *= 0.621371;
    var tops = isImperial() ? IMPERIAL_TOPS : METRIC_TOPS;
    var chosen = tops[tops.length - 1][1];
    for (var i = 0; i < tops.length; i++) {
      if (tops[i][0] >= vmax * 0.98) { chosen = tops[i][1]; break; }
    }
    window.bmwCluster.configureSpeed(chosen, isImperial() ? "mph" : "km/h");
  }

  function rebuildRpmDial(maxRpm) {
    if (!window.bmwCluster) return;
    var redlineK = maxRpm / 1000;                    // limiter = start of the red zone
    // extend the scale ~1k past the limiter so the redline sits before the end
    // of the dial instead of the needle pinning at the very top
    var topK = Math.max(2, Math.ceil(redlineK) + 1);
    var step = 1;
    if (topK > 9) { // bikes etc: label every 2k
      step = 2;
      if (topK % 2 === 1) topK++;
    }
    var labels = [];
    for (var v = 0; v <= topK; v += step) labels.push(v);
    window.bmwCluster.configureRpm(labels, redlineK);
  }

  // called by Lua: htmlTexture.call(mat, "gauges.configure", {...})
  window.gauges = {
    configure: function (data) {
      if (!data) return;
      if (data.vmaxKmh) vehCfg.vmaxKmh = data.vmaxKmh;
      if (data.fuelType) vehCfg.fuelType = data.fuelType;
      if (data.maxRpm) vehCfg.maxRpm = data.maxRpm;
      rebuildSpeedDial();
      if (vehCfg.maxRpm > 500) {
        lastMaxRpm = vehCfg.maxRpm;
        rebuildRpmDial(vehCfg.maxRpm);
      }
    }
  };

  window.setup = function (setupData) {
    for (var dk in setupData) {
      if (typeof dk === "string" && dk.startsWith("uiUnit")) {
        units[dk] = setupData[dk];
      }
    }
    if (typeof vueEventBus !== "undefined") {
      vueEventBus.emit('SettingsChanged', { values: units });
    }
    rebuildSpeedDial();
  };

  window.updateData = function (data) {
    if (!window.bmwCluster || !data || !data.electrics) return;
    var e = data.electrics;
    var cm = data.customModules || {};
    var imperial = isImperial();

    // dynamic tach: electrics.maxrpm comes from the stock vehicleController
    var mr = e.maxrpm || 0;
    if (mr > 500 && Math.abs(mr - lastMaxRpm) > 100) {
      lastMaxRpm = mr;
      rebuildRpmDial(mr);
    }

    // gear: automatics report strings ("P","R","N","D"...), manuals numbers
    var gear = e.gear, gearStr;
    if (typeof gear === "string") gearStr = gear;
    else if (gear === -1) gearStr = "R";
    else if (gear === 0) gearStr = "N";
    else gearStr = "" + gear;

    // outside temperature
    var tempStr = "---";
    if (cm.environmentData && typeof UiUnits !== "undefined") {
      var t = UiUnits.temperature(cm.environmentData.temperatureEnv);
      if (t && isFinite(t.val) && Math.abs(t.val) < 99.9) {
        tempStr = t.val.toFixed(1) + " " + t.unit;
      }
    }

    // remaining fuel range (km from the stock module; 0 when unknown)
    var rangeStr = "---";
    if (cm.combustionEngineData && cm.combustionEngineData.remainingRange > 0) {
      var rng = cm.combustionEngineData.remainingRange;
      if (imperial) rng *= 0.621371;
      rangeStr = Math.round(rng) + (imperial ? " mi" : " km");
    }

    // odometer
    var odoStr = "";
    if (e.odometer) {
      var odo = e.odometer * (imperial ? 0.0006214 : 0.001);
      odoStr = Math.min(999999, odo).toFixed(0) + (imperial ? " mi" : " km");
    }

    var speedVal = 0;
    if (typeof UiUnits !== "undefined") {
      speedVal = UiUnits.speed(e.wheelspeed).val;
    } else {
      speedVal = (e.wheelspeed || 0) * 3.6;
    }

    // indicator / telltale lights (drawn by bmw-cluster.js)
    var escOn = on(e.tcs) || on(e.esc) || on(e.tcsActive) || on(e.escActive);
    var escEquipped = (e.hasESC == null && e.hasTCS == null) || on(e.hasESC) || on(e.hasTCS);
    var tell = {
      turnL: on(e.signal_L),
      turnR: on(e.signal_R),
      high: on(e.highbeam),
      low: on(e.lowbeam),
      fog: on(e.fog),
      park: on(e.parkingbrake),
      tpms: on(e.lowpressure),
      abs: on(e.abs) && equipped(e.hasABS),
      esc: escOn && escEquipped,
      cel: on(e.checkengine),
      lowfuel: on(e.lowfuel)
    };

    window.bmwCluster.update({
      speed: speedVal,
      rpmK: (e.rpmTacho || 0) / 1000,
      gear: gearStr,
      time: (cm.environmentData && cm.environmentData.time) || "",
      temp: tempStr,
      odo: odoStr,
      range: rangeStr,
      fuelFrac: e.fuel || 0,
      // water temp mapped to the mini gauge: 40C = cold end, 130C = red
      waterFrac: e.watertemp ? Math.max(0, Math.min(1, (e.watertemp - 40) / 90)) : 0,
      tell: tell
    });
  };
})();
