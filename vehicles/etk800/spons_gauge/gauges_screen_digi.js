

angular.module('gaugesScreen', [])
.controller('GaugesScreenController', function($scope, $window) {
  var units = {uiUnitConsumptionRate: "metric",
  uiUnitDate: "ger",
  uiUnitEnergy: "metric",
  uiUnitLength: "metric",
  uiUnitPower: "hp",
  uiUnitPressure: "bar",
  uiUnitTemperature: "c",
  uiUnitTorque: "metric",
  uiUnitVolume: "l",
  uiUnitWeight: "kg"};

  $scope.data = {}
  // overwriting plain javascript function so we can access from within the controller
  $window.setup = (setupData) => {
    for(let dk in setupData){
      if(typeof dk == "string" && dk.startsWith("uiUnit")){
        units[dk] = setupData[dk];
      }
    }
    vueEventBus.emit('SettingsChanged', {values:units})

    $scope.data.speedUnit = units.uiUnitLength=="metric"?"km/h":"mph";

    if(units.uiUnitConsumptionRate == "metric"){
      $scope.data.consumptionUnit = "l/100km"
    }else{
      $scope.data.consumptionUnit = "mpg"
      document.getElementById('markOne').textContent = "30";
      document.getElementById('markTwo').textContent = "20";
      document.getElementById('markThree').textContent = "10";
      document.getElementById('markFour').textContent = "0";
    }
  }

  $window.updateData = (data) => {
    $scope.$evalAsync(function() {
  
      // Removed all references to the SVG efficiency bar
  
      // Update gear information
      if (data.electrics.gear === -1) {
        $scope.data.gear = "R"; // Reverse gear
      }
      else if (data.electrics.gear === 0) {
        $scope.data.gear = "N"; // Neutral gear
      }
      else {
        $scope.data.gear = data.electrics.gear; // Forward gears (1, 2, 3, etc.)
      }
  
      // Update the time display from the environment data
      $scope.data.time = data.customModules.environmentData.time;
  
      // Update the speed display, formatted as a whole number
      $scope.data.speedVal = UiUnits.speed(data.electrics.wheelspeed).val.toFixed(0);
  
      // Update the temperature display
      let tempEnv = UiUnits.temperature(data.customModules.environmentData.temperatureEnv);
      if (tempEnv.val.toFixed(1) > 99.9 || tempEnv.val.toFixed(1) < -99.9) {
        $scope.data.temp = "---°C"; // Display "---" if temperature is out of range
      } else {
        $scope.data.temp = tempEnv.val.toFixed(1) + tempEnv.unit; // Otherwise, display the valid temperature
      }
  
      // Update fuel consumption
      let conso = UiUnits.consumptionRate(data.customModules.combustionEngineData.averageFuelConsumption * 1e-5);
      if (conso.val === "n/a")
        $scope.data.consumptionVal = "---"; // Display "---" if no data
      else
        $scope.data.consumptionVal = conso.val.toFixed(1); // Otherwise, display fuel consumption
  
      // Update the odometer
      if (data.electrics.odometer) {
        let val = data.electrics.odometer;
        // Convert odometer to kilometers or miles depending on the unit system
        val *= (units.uiUnitLength == "metric") ? 0.001 : 0.0006215;
        val = Math.min(999999, val); // Cap the odometer value at 999999
        $scope.data.odo = val.toFixed(0) + ((units.uiUnitLength == "metric") ? "km" : "mi");
      } else {
        $scope.data.odo = ""; // Empty if no odometer data
      }
    })
  }
  
});