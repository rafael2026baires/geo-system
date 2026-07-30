import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveZoomScaleFactor } from './map.3d.scale.js';
import {
  FLOATING_MAP_VEHICLE_SCALE_PROFILE
} from './map.3d.scale.config.js';

const LAYER_ID = 'floating-vehicle-marker-3d-layer';
const MODEL_URL = './assets/models/3d/low_poly_truck_smooth_box_v1.glb';
const PRIMARY_BEFORE_LAYER_ID = 'geo-vehicle-symbol-halo-layer';
const SECONDARY_BEFORE_LAYER_ID = 'geo-vehicle-symbol-layer';

const VEHICLE_MODEL_LENGTH_METERS = 12;
const VEHICLE_MODEL_ALTITUDE_METERS = 0;
const VEHICLE_MODEL_ROTATION_X = Math.PI / 2;
const VEHICLE_MODEL_ROTATION_Y = 0;
const VEHICLE_MODEL_ROTATION_Z = 0;
const VEHICLE_MODEL_BEARING_OFFSET_DEG = 0;
const MAP_BEARING_ALIGNMENT_DEG = -90;

const states = new WeakMap();
let vehicleTemplatePromise = null;

function removeEmbeddedCamerasAndLights(root) {
  const embeddedObjects = [];

  root.traverse(object => {
    if (object.isCamera || object.isLight) {
      embeddedObjects.push(object);
    }
  });

  embeddedObjects.forEach(object => object.parent?.remove(object));
}

function loadVehicleTemplate() {
  if (!vehicleTemplatePromise) {
    vehicleTemplatePromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        MODEL_URL,
        gltf => {
          removeEmbeddedCamerasAndLights(gltf.scene);
          resolve(gltf.scene);
        },
        undefined,
        reject
      );
    }).catch(error => {
      console.error('[FloatingVehicle3D] Error al cargar el modelo GLB.', error);
      throw error;
    });
  }

  return vehicleTemplatePromise;
}

function getBaseRotationMatrix() {
  return new THREE.Matrix4()
    .makeRotationX(VEHICLE_MODEL_ROTATION_X)
    .multiply(new THREE.Matrix4().makeRotationY(VEHICLE_MODEL_ROTATION_Y))
    .multiply(new THREE.Matrix4().makeRotationZ(VEHICLE_MODEL_ROTATION_Z));
}

function prepareVehicleModel(template) {
  const vehicle = template.clone(true);
  removeEmbeddedCamerasAndLights(vehicle);
  vehicle.updateMatrixWorld(true);

  const rotatedBox = new THREE.Box3()
    .setFromObject(vehicle)
    .applyMatrix4(getBaseRotationMatrix());
  const rotatedSize = new THREE.Vector3();
  rotatedBox.getSize(rotatedSize);
  const horizontalDimension = Math.max(rotatedSize.x, rotatedSize.y);

  if (horizontalDimension > 0) {
    vehicle.scale.setScalar(
      VEHICLE_MODEL_LENGTH_METERS / horizontalDimension
    );
  }

  vehicle.updateMatrixWorld(true);
  const scaledRotatedBox = new THREE.Box3()
    .setFromObject(vehicle)
    .applyMatrix4(getBaseRotationMatrix());

  return {
    vehicle,
    groundOffsetMeters:
      VEHICLE_MODEL_ALTITUDE_METERS - scaledRotatedBox.min.z
  };
}

function updateMercatorPosition(state) {
  if (!state.position) {
    state.mercatorCoordinate = null;
    return;
  }

  state.mercatorCoordinate = globalThis.maplibregl.MercatorCoordinate.fromLngLat(
    [state.position.lng, state.position.lat],
    0
  );
}

function createLayer(state) {
  return {
    id: LAYER_ID,
    type: 'custom',
    renderingMode: '3d',

    onAdd(map, gl) {
      const version = ++state.lifecycleVersion;
      state.camera = new THREE.Camera();
      state.scene = new THREE.Scene();

      state.scene.add(new THREE.AmbientLight(0xffffff, 1.5));

      const directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);
      directionalLight.position.set(50, -50, 100);
      state.scene.add(directionalLight);

      state.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });
      state.renderer.autoClear = false;
      state.renderer.outputColorSpace = THREE.SRGBColorSpace;
      state.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      state.renderer.toneMappingExposure = 1;

      loadVehicleTemplate()
        .then(template => {
          if (version !== state.lifecycleVersion || !state.scene) return;

          const prepared = prepareVehicleModel(template);
          state.vehicle = prepared.vehicle;
          state.groundOffsetMeters = prepared.groundOffsetMeters;
          state.scene.add(state.vehicle);
          map.triggerRepaint();
        })
        .catch(() => {});
    },

    render(gl, args) {
      if (
        !state.visible ||
        !state.mercatorCoordinate ||
        !state.vehicle ||
        !state.renderer ||
        !state.camera ||
        !state.scene
      ) {
        return;
      }

      const currentZoom = state.map.getZoom();
      const floatingVehicleZoomScaleFactor =
        FLOATING_MAP_VEHICLE_SCALE_PROFILE.enabled
          ? resolveZoomScaleFactor(
              currentZoom,
              FLOATING_MAP_VEHICLE_SCALE_PROFILE.points,
              FLOATING_MAP_VEHICLE_SCALE_PROFILE.edgePolicy
            )
          : FLOATING_MAP_VEHICLE_SCALE_PROFILE.edgePolicy.fallbackFactor;

      const mercatorScale =
        state.mercatorCoordinate.meterInMercatorCoordinateUnits();
      const effectiveMercatorScale =
        mercatorScale * floatingVehicleZoomScaleFactor;
      const bearingRadians = THREE.MathUtils.degToRad(
        state.bearingDeg +
        MAP_BEARING_ALIGNMENT_DEG +
        state.calibration.bearingOffsetDeg
      );
      const bearingRotation = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(0, 0, 1),
        -bearingRadians
      );
      const rotationX = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(1, 0, 0),
        state.calibration.rotationX
      );
      const rotationY = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(0, 1, 0),
        state.calibration.rotationY
      );
      const rotationZ = new THREE.Matrix4().makeRotationAxis(
        new THREE.Vector3(0, 0, 1),
        state.calibration.rotationZ
      );
      const mapMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix);
      const modelMatrix = new THREE.Matrix4()
        .makeTranslation(
          state.mercatorCoordinate.x,
          state.mercatorCoordinate.y,
          state.mercatorCoordinate.z +
            state.groundOffsetMeters * effectiveMercatorScale
        )
        .scale(new THREE.Vector3(
          effectiveMercatorScale,
          -effectiveMercatorScale,
          effectiveMercatorScale
        ))
        .multiply(bearingRotation)
        .multiply(rotationX)
        .multiply(rotationY)
        .multiply(rotationZ);

      state.camera.projectionMatrix = mapMatrix.multiply(modelMatrix);
      state.renderer.resetState();
      state.renderer.render(state.scene, state.camera);
    },

    onRemove() {
      state.lifecycleVersion += 1;
      state.scene?.clear();
      state.renderer?.dispose();
      state.camera = null;
      state.scene = null;
      state.renderer = null;
      state.vehicle = null;
    }
  };
}

export function initFloatingVehicle3D(map) {
  if (states.has(map)) return;

  const state = {
    map,
    position: null,
    bearingDeg: 0,
    calibration: {
      rotationX: VEHICLE_MODEL_ROTATION_X,
      rotationY: VEHICLE_MODEL_ROTATION_Y,
      rotationZ: VEHICLE_MODEL_ROTATION_Z,
      bearingOffsetDeg: VEHICLE_MODEL_BEARING_OFFSET_DEG
    },
    visible: true,
    mercatorCoordinate: null,
    groundOffsetMeters: VEHICLE_MODEL_ALTITUDE_METERS,
    camera: null,
    scene: null,
    renderer: null,
    vehicle: null,
    lifecycleVersion: 0,
    layer: null,
    addLayerWhenReady: null
  };
  state.layer = createLayer(state);
  states.set(map, state);

  state.addLayerWhenReady = function addLayerWhenReady() {
    if (states.get(map) !== state || map.getLayer(LAYER_ID)) return;

    const styleIsReady =
      (typeof map.loaded === 'function' && map.loaded()) ||
      (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded());
    if (!styleIsReady) return;

    const beforeId = map.getLayer(PRIMARY_BEFORE_LAYER_ID)
      ? PRIMARY_BEFORE_LAYER_ID
      : map.getLayer(SECONDARY_BEFORE_LAYER_ID)
        ? SECONDARY_BEFORE_LAYER_ID
        : undefined;

    map.addLayer(state.layer, beforeId);
  };

  map.on('load', state.addLayerWhenReady);
  map.on('style.load', state.addLayerWhenReady);
  state.addLayerWhenReady();
}

export function setFloatingVehicle3DPosition(map, position) {
  const state = states.get(map);
  if (!state) return;

  const lat = Number(position?.lat);
  const lng = Number(position?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new TypeError('position requiere valores lat y lng válidos.');
  }

  state.position = { lat, lng };
  updateMercatorPosition(state);
  map.triggerRepaint();
}

export function setFloatingVehicle3DBearing(map, bearingDeg) {
  const state = states.get(map);
  if (!state) return;

  const bearing = Number(bearingDeg);
  if (!Number.isFinite(bearing)) {
    throw new TypeError('bearingDeg debe ser un número válido.');
  }

  state.bearingDeg = bearing;
  map.triggerRepaint();
}

export function setFloatingVehicle3DCalibration(map, {
  rotationX,
  rotationY,
  rotationZ,
  bearingOffsetDeg
}) {
  const state = states.get(map);
  if (!state) return;

  const values = { rotationX, rotationY, rotationZ, bearingOffsetDeg };
  Object.entries(values).forEach(([name, value]) => {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${name} debe ser un número válido.`);
    }
  });

  state.calibration = { ...values };
  map.triggerRepaint();
}

export function setFloatingVehicle3DVisible(map, visible) {
  const state = states.get(map);
  if (!state) return;

  state.visible = Boolean(visible);
  map.triggerRepaint();
}

export function destroyFloatingVehicle3D(map) {
  const state = states.get(map);
  if (!state) return;

  map.off('load', state.addLayerWhenReady);
  map.off('style.load', state.addLayerWhenReady);

  if (map.getLayer(LAYER_ID)) {
    map.removeLayer(LAYER_ID);
  }

  states.delete(map);
}
