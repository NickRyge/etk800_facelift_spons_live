# ETK800 digital gauge screen (spons) — BMW Live Cockpit style

A custom digital instrument cluster for the ETK800, styled after BMW's G-series
Live Cockpit: two curved "blade" gauges hugging the outer edges (speed left,
tach right), a live navigator map in the centre, gear readout, and a bottom
info strip (fuel range / time / odometer / outside temp) plus corner mini
gauges (fuel, water temp).

BeamNG renders `gauges_screen_digi.html` to a 1280x512 texture and maps it onto
the dashboard screen mesh.

## How it hangs together

1. `etk800_digitalGauges_spons.jbeam` defines the gauge part. It:
   - lays the `etk800_gauges_screen_digi` mesh over the stock dash and lights it
     via the `glowMap` once ignition passes 0.5. **This part overwrites the
     stock ETK800 gauges** — remove it and the car reverts to the default cluster.
   - the `gauge` block creates the screen material `@etk800_gauges_screen_digi`
     (1280x512), loads the page, and streams the sim signals listed under
     `displayData` (speed, rpmTacho, maxrpm, gear, fuel, watertemp, odometer,
     env temp/time, remaining fuel range).
   - attaches the `SponsNavigator` controller (map + dial configuration).

2. The page: AngularJS exists only to host the `<fake-gps>` navigator directive;
   the cluster itself is plain JS. Vue/vueService are loaded for BeamNG's
   `UiUnits` conversions. BeamNG calls `setup()` once and `updateData()` per frame.

## Files

- `gauges_screen_digi.html` — page markup and includes.
- `gauges_screen_digi.js` — data plumbing: maps BeamNG's `updateData` stream onto
  the cluster, picks dial scales (nonlinear BMW speedo presets, metric/imperial),
  rebuilds the tach when `electrics.maxrpm` changes, receives `gauges.configure`
  from Lua.
- `bmw-cluster.js` — the renderer. Builds both blade gauges parametrically from
  `{labels, redFrom}` (band, ticks, labels, red zone, chrome rim, value fill,
  needle), plus readouts, mini gauges and the bottom strip. Fully rebuildable at
  runtime — this is what makes the scales dynamic.
- `dashboard-components.css` — page styling: background, map band with fading
  edge masks, navigator internals, svg text roles.
- `fake-gps.js` — `<fake-gps>` directive; instantiates BeamNG's `bngNavigator`
  (`window.map`) with a BMW night-map palette and a static orange vehicle marker.

## Dynamic dial scales

- **Tach**: `electrics.values.maxrpm` (set by the stock vehicleController for
  combustion *and* electric drivetrains) drives the scale; redline starts at the
  limiter. Rebuilds live if the value changes.
- **Speedo**: `SponsNavigator.lua` estimates a theoretical top speed at init
  (maxRPM through the tallest gear ratio × final drive × wheel radius), then the
  page snaps it to a tidy preset (160/200/240/260/300/340 km/h or the mph
  equivalents). Fallback is 260 km/h if the estimate fails.
- Engine/fuel type (`gasoline`/`diesel`/`electricEnergy`) is sent along for
  future use (e.g. EV power gauge).

## The navigator

- `../lua/controller/SponsNavigator.lua` — requests the road-network map for the
  gauge material, streams vehicle position to `window.map.updateData` each frame,
  and pushes the dial configuration via `htmlTexture.call(mat, "gauges.configure", cfg)`
  (sent twice, at ~0.5s and ~3s, in case the page loads late).
- It does **not** create its own htmlTexture — the `gauge` block owns the screen
  material, so `screenMaterialName` must match the gauge block's `materialName`.

## Design iteration

The look was iterated in a standalone preview (Claude artifact
`bmw-cluster-preview.html`, in the session scratchpad) with drag-to-shape gauge
contours and live sliders. The blade geometry constants at the top of
`bmw-cluster.js` (`OUTER_L`, `HUB_L`, band width profile) came from there.
