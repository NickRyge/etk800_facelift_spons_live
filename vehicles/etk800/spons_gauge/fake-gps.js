(function () {
  "use strict";

  angular.module("gaugesScreen").directive("fakeGps", function ($timeout, $window) {
    return {
      restrict: "E",
      replace: true,

      template:
        '<div class="fake-gps-root">' +
          '<div id="bootscreen"></div>' +
          '<div id="timeText"></div>' +

          '<div id="mapContainer">' +
            '<svg xmlns="http://www.w3.org/2000/svg" ' +
                 'xmlns:xlink="http://www.w3.org/1999/xlink"></svg>' +
          '</div>' +

          // Static vehicle marker: the map pans/rotates underneath it (BMW-style orange arrow).
          '<div class="fake-gps-vehicle-marker">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
              '<path d="M16 3 L27 29 L16 22.5 L5 29 Z" fill="#ff8a1e" stroke="#2a1503" stroke-width="1.5"/>' +
            '</svg>' +
          '</div>' +
        '</div>',

      link: function (scope, element) {
        $timeout(function () {
          if (!$window.bngNavigator) {
            console.error("fakeGps: bngNavigator does not exist yet.");
            return;
          }

          var root = element[0];
          var mapContainer = root.querySelector("#mapContainer");
          var bootscreen = root.querySelector("#bootscreen");
          var timeText = root.querySelector("#timeText");

          if (!mapContainer || !bootscreen || !timeText) {
            console.error("fakeGps: required DOM elements missing.");
            return;
          }

          if ($window.map) {
            console.warn("fakeGps: window.map already exists. Not creating another bngNavigator.");
            return;
          }

          // The navigator draws the vehicle at (offsetX, offsetY) px from the panel's
          // top-left corner. Stock screens set this to half the screen size so the vehicle
          // sits dead-centre, directly under the static marker (which is at 50%/50%).
          // Our panel isn't 256x128, so derive the centre from the actual rendered size
          // rather than hard-coding 128/64 (which left the marker floating off-position).
          var centerX = (root.clientWidth || 256) / 2;
          var centerY = (root.clientHeight || 128) / 2;

          $window.map = new $window.bngNavigator({
            container: "#mapContainer",
            bootscreen: "#bootscreen",
            clock: "#timeText",

            // BMW night-map look: near-black ground, desaturated blue roads.
            // Must match the page background (#04060b) so the edge fade is seamless.
            backgroundRgb: [4, 6, 11],
            roadColors: ["#46608AFF", "#33465FFF", "#26344CFF"],
            routeColor: "#4DA3FFFF",

            offsetX: centerX,
            offsetY: centerY,

            pitch: 65,
            speedPitch: 3
          });

          // BMW look: roads-on-dark. The navigator draws terrain tiles + a
          // bright grid into its terrain layer; kill that layer entirely.
          if ($window.map.layers && $window.map.layers.map) {
            $window.map.layers.map.terrainOpacity = 0;
          }

          console.log("fakeGps: window.map created", $window.map);

          scope.$on("$destroy", function () {
            if ($window.map) {
              $window.map = null;
            }
          });
        }, 0, false);
      }
    };
  });
})();