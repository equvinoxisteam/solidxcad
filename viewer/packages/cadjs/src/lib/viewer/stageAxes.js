/** World XYZ axes at the grid origin — length scales with the loaded model. */

export function updateAxesHelper(
  runtime,
  radius = 50,
  floorZ = 0,
  { disposeSceneObject = () => {} } = {},
) {
  if (!runtime?.THREE || !runtime?.scene) {
    return;
  }

  const length = Math.max(Number(radius) * 0.75, 25);
  const current = runtime.axesConfig;
  if (
    runtime.axesHelper
    && current
    && current.length === length
    && current.floorZ === floorZ
  ) {
    return;
  }

  disposeSceneObject(runtime.axesHelper);
  runtime.axesHelper = new runtime.THREE.AxesHelper(length);
  runtime.axesHelper.position.set(0, 0, floorZ);
  runtime.scene.add(runtime.axesHelper);
  runtime.axesConfig = { length, floorZ };
}
