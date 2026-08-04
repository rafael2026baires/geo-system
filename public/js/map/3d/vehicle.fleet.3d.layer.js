import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveZoomScaleFactor } from './map.3d.scale.js';
import { MAIN_MAP_VEHICLE_SCALE_PROFILE } from './map.3d.scale.config.js';

const LAYER_ID = 'vehicle-fleet-3d-layer';
//const MODEL_URL = './assets/models/3d/isuzu_elf_2024_optimized_light_v2.glb';
const MODEL_URL = './assets/models/3d/isuzu_elf_2024_map_textured_refined_wheels_v2.glb';

const ENABLE_MAIN_MAP_VEHICLE_HEMISPHERE_LIGHT_TEST = false;
const VEHICLE_FOCUS_EMISSIVE_COLOR = '#f59e0b';
const VEHICLE_FOCUS_EMISSIVE_INTENSITY = 0.18;

const VEHICLE_MODEL_LENGTH_METERS = 12;
const VEHICLE_MODEL_ALTITUDE_METERS = 0;
const VEHICLE_MODEL_ROTATION_X = Math.PI / 2;
const VEHICLE_MODEL_ROTATION_Y = Math.PI / 2;
const VEHICLE_MODEL_ROTATION_Z = 0;
const VEHICLE_MODEL_BEARING_OFFSET_DEG = 0;
const MAP_BEARING_ALIGNMENT_DEG = -90;

const states = new WeakMap();
let vehicleTemplatePromise = null;

function createBoxCornerPoints(box) {
  const { min, max } = box;

  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, max.z)
  ];
}

function normalizeUnitId(unitId) {
  return String(unitId);
}

function normalizePosition(position) {
  const lat = Number(position?.lat);
  const lng = Number(position?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new TypeError('position requiere valores lat y lng válidos.');
  }

  return { lat, lng };
}

function normalizeBearing(bearingDeg) {
  const bearing = Number(bearingDeg);

  if (!Number.isFinite(bearing)) {
    throw new TypeError('bearingDeg debe ser un número válido.');
  }

  return bearing;
}

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
      console.error('[VehicleFleet3D] Error al cargar el modelo GLB.', error);
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
  const scaledBox = new THREE.Box3().setFromObject(vehicle);
  const scaledRotatedBox = scaledBox.clone()
    .applyMatrix4(getBaseRotationMatrix());

  return {
    boundsPoints: createBoxCornerPoints(scaledBox),
    vehicle,
    groundOffsetMeters:
      VEHICLE_MODEL_ALTITUDE_METERS - scaledRotatedBox.min.z
  };
}

function createInstanceOwnedMaterials(vehicle) {
  const clonesBySourceMaterial = new Map();
  const focusMaterialStates = [];

  vehicle.traverse(object => {
    if (!object.isMesh || !object.material) return;

    const sourceMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    const instanceMaterials = sourceMaterials.map(sourceMaterial => {
      if (!clonesBySourceMaterial.has(sourceMaterial)) {
        const material = sourceMaterial.clone();
        clonesBySourceMaterial.set(sourceMaterial, material);

        if (
          material.emissive?.isColor &&
          Number.isFinite(material.emissiveIntensity)
        ) {
          focusMaterialStates.push({
            material,
            emissive: material.emissive.clone(),
            emissiveIntensity: material.emissiveIntensity
          });
        }
      }

      return clonesBySourceMaterial.get(sourceMaterial);
    });

    object.material = Array.isArray(object.material)
      ? instanceMaterials
      : instanceMaterials[0];
  });

  return {
    materials: [...clonesBySourceMaterial.values()],
    focusMaterialStates
  };
}

function setInstanceFocusVisual(instance, focused) {
  instance.focusMaterialStates.forEach(materialState => {
    if (focused) {
      materialState.material.emissive.set(VEHICLE_FOCUS_EMISSIVE_COLOR);
      materialState.material.emissiveIntensity =
        VEHICLE_FOCUS_EMISSIVE_INTENSITY;
      return;
    }

    materialState.material.emissive.copy(materialState.emissive);
    materialState.material.emissiveIntensity =
      materialState.emissiveIntensity;
  });
}

function disposeInstanceMaterials(instance) {
  instance.materials.forEach(material => material.dispose());
  instance.materials = [];
  instance.focusMaterialStates = [];
}

function updateMercatorPosition(instance) {
  if (!instance.position) {
    instance.mercatorCoordinate = null;
    return;
  }

  instance.mercatorCoordinate =
    globalThis.maplibregl.MercatorCoordinate.fromLngLat(
      [instance.position.lng, instance.position.lat],
      0
    );
}

function createInstanceState(unitId) {
  return {
    unitId,
    position: null,
    mercatorCoordinate: null,
    bearingDeg: 0,
    visible: true,
    vehicle: null,
    materials: [],
    focusMaterialStates: [],
    boundsPoints: [],
    screenBounds: {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    },
    groundOffsetMeters: VEHICLE_MODEL_ALTITUDE_METERS
  };
}

function createInstanceVehicle(state, instance) {
  if (!state.template || instance.vehicle || !state.scene) return;

  const prepared = prepareVehicleModel(state.template);
  instance.vehicle = prepared.vehicle;
  const instanceMaterials = createInstanceOwnedMaterials(instance.vehicle);
  instance.materials = instanceMaterials.materials;
  instance.focusMaterialStates = instanceMaterials.focusMaterialStates;
  instance.boundsPoints = prepared.boundsPoints;
  instance.groundOffsetMeters = prepared.groundOffsetMeters;
  setInstanceFocusVisual(
    instance,
    state.focusedUnitId === instance.unitId
  );
  instance.vehicle.visible = false;
  state.scene.add(instance.vehicle);
}

function projectInstanceScreenBounds(
  state,
  instance,
  canvasWidth,
  canvasHeight
) {
  if (instance.boundsPoints.length === 0) return false;

  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;

  for (const point of instance.boundsPoints) {
    state.projectedPoint
      .set(point.x, point.y, point.z, 1)
      .applyMatrix4(state.camera.projectionMatrix);

    const w = state.projectedPoint.w;
    if (!Number.isFinite(w) || w <= 0) return false;

    const ndcX = state.projectedPoint.x / w;
    const ndcY = state.projectedPoint.y / w;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return false;

    const screenX = (ndcX * 0.5 + 0.5) * canvasWidth;
    const screenY = (0.5 - ndcY * 0.5) * canvasHeight;

    left = Math.min(left, screenX);
    right = Math.max(right, screenX);
    top = Math.min(top, screenY);
    bottom = Math.max(bottom, screenY);
  }

  if (
    right < 0 ||
    left > canvasWidth ||
    bottom < 0 ||
    top > canvasHeight
  ) {
    return false;
  }

  instance.screenBounds.left = left;
  instance.screenBounds.right = right;
  instance.screenBounds.top = top;
  instance.screenBounds.bottom = bottom;
  return true;
}

function emitScreenBounds(state) {
  state.onScreenBounds?.(state.screenBounds);
}

function getOrCreateInstance(state, unitId) {
  const normalizedUnitId = normalizeUnitId(unitId);

  if (!state.instances.has(normalizedUnitId)) {
    state.instances.set(
      normalizedUnitId,
      createInstanceState(normalizedUnitId)
    );
  }

  const instance = state.instances.get(normalizedUnitId);
  createInstanceVehicle(state, instance);
  return instance;
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

      const baseLight = ENABLE_MAIN_MAP_VEHICLE_HEMISPHERE_LIGHT_TEST
        ? new THREE.HemisphereLight(0xf4f6f8, 0x2b3138, 0.9)
        : new THREE.AmbientLight(0xffffff, 1.5);
      state.scene.add(baseLight);

      const directionalLight = new THREE.DirectionalLight(
        0xffffff,
        ENABLE_MAIN_MAP_VEHICLE_HEMISPHERE_LIGHT_TEST ? 2.1 : 2.5
      );
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

          state.template = template;
          state.instances.forEach(instance => {
            createInstanceVehicle(state, instance);
          });
          map.triggerRepaint();
        })
        .catch(() => {});
    },

    render(gl, args) {
      if (!state.renderer || !state.camera || !state.scene) return;

      state.screenBounds.clear();

      const currentZoom = state.map.getZoom();
      const canvas = state.map.getCanvas();
      const canvasWidth = canvas.clientWidth;
      const canvasHeight = canvas.clientHeight;
      const vehicleZoomScaleFactor =
        MAIN_MAP_VEHICLE_SCALE_PROFILE.enabled === true
          ? resolveZoomScaleFactor(
              currentZoom,
              MAIN_MAP_VEHICLE_SCALE_PROFILE.points,
              MAIN_MAP_VEHICLE_SCALE_PROFILE.edgePolicy
            )
          : 1;

      state.instances.forEach(instance => {
        if (instance.vehicle) instance.vehicle.visible = false;
      });

      state.instances.forEach(instance => {
        if (
          !instance.visible ||
          !instance.mercatorCoordinate ||
          !instance.vehicle
        ) {
          return;
        }

        const mercatorScale =
          instance.mercatorCoordinate.meterInMercatorCoordinateUnits();
        const effectiveMercatorScale =
          mercatorScale * vehicleZoomScaleFactor;
        const bearingRadians = THREE.MathUtils.degToRad(
          instance.bearingDeg +
          MAP_BEARING_ALIGNMENT_DEG +
          VEHICLE_MODEL_BEARING_OFFSET_DEG
        );
        const bearingRotation = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          -bearingRadians
        );
        const rotationX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          VEHICLE_MODEL_ROTATION_X
        );
        const rotationY = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 1, 0),
          VEHICLE_MODEL_ROTATION_Y
        );
        const rotationZ = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          VEHICLE_MODEL_ROTATION_Z
        );
        const mapMatrix = new THREE.Matrix4()
          .fromArray(args.defaultProjectionData.mainMatrix);
        const modelMatrix = new THREE.Matrix4()
          .makeTranslation(
            instance.mercatorCoordinate.x,
            instance.mercatorCoordinate.y,
            instance.mercatorCoordinate.z +
              instance.groundOffsetMeters * effectiveMercatorScale
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

        instance.vehicle.visible = true;
        state.camera.projectionMatrix = mapMatrix.multiply(modelMatrix);
        state.renderer.resetState();
        state.renderer.render(state.scene, state.camera);

        if (
          canvasWidth > 0 &&
          canvasHeight > 0 &&
          projectInstanceScreenBounds(
            state,
            instance,
            canvasWidth,
            canvasHeight
          )
        ) {
          state.screenBounds.set(instance.unitId, instance.screenBounds);
        }

        instance.vehicle.visible = false;
      });

      emitScreenBounds(state);
    },

    onRemove() {
      state.lifecycleVersion += 1;
      state.screenBounds.clear();
      emitScreenBounds(state);
      state.scene?.clear();
      state.renderer?.dispose();
      state.camera = null;
      state.scene = null;
      state.renderer = null;
      state.instances.forEach(instance => {
        disposeInstanceMaterials(instance);
        instance.vehicle = null;
        instance.boundsPoints = [];
        instance.groundOffsetMeters = VEHICLE_MODEL_ALTITUDE_METERS;
      });
    }
  };
}

export function initVehicleFleet3DLayer(map, { onScreenBounds = null } = {}) {
  if (!map) return;

  const existingState = states.get(map);
  if (existingState) {
    existingState.onScreenBounds =
      typeof onScreenBounds === 'function' ? onScreenBounds : null;
    return;
  }

  const state = {
    map,
    instances: new Map(),
    focusedUnitId: null,
    template: null,
    camera: null,
    scene: null,
    renderer: null,
    lifecycleVersion: 0,
    layer: null,
    addLayerWhenReady: null,
    onScreenBounds:
      typeof onScreenBounds === 'function' ? onScreenBounds : null,
    screenBounds: new Map(),
    projectedPoint: new THREE.Vector4()
  };
  state.layer = createLayer(state);
  states.set(map, state);

  state.addLayerWhenReady = function addLayerWhenReady() {
    if (states.get(map) !== state || map.getLayer(LAYER_ID)) return;

    const styleIsReady =
      (typeof map.loaded === 'function' && map.loaded()) ||
      (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded());
    if (!styleIsReady) return;

    map.addLayer(state.layer);
  };

  map.on('load', state.addLayerWhenReady);
  map.on('style.load', state.addLayerWhenReady);
  state.addLayerWhenReady();
}

export function upsertVehicleFleet3DInstance(map, unitId, {
  position,
  bearingDeg = 0,
  visible = true
}) {
  const state = states.get(map);
  if (!state) return;

  const instance = getOrCreateInstance(state, unitId);
  instance.position = normalizePosition(position);
  instance.bearingDeg = normalizeBearing(bearingDeg);
  instance.visible = Boolean(visible);
  updateMercatorPosition(instance);
  map.triggerRepaint();
}

export function setVehicleFleet3DPosition(map, unitId, position) {
  const state = states.get(map);
  if (!state) return;

  const instance = getOrCreateInstance(state, unitId);
  instance.position = normalizePosition(position);
  updateMercatorPosition(instance);
  map.triggerRepaint();
}

export function setVehicleFleet3DBearing(map, unitId, bearingDeg) {
  const state = states.get(map);
  if (!state) return;

  const instance = getOrCreateInstance(state, unitId);
  instance.bearingDeg = normalizeBearing(bearingDeg);
  map.triggerRepaint();
}

export function setVehicleFleet3DVisible(map, unitId, visible) {
  const state = states.get(map);
  if (!state) return;

  const instance = getOrCreateInstance(state, unitId);
  instance.visible = Boolean(visible);
  map.triggerRepaint();
}

export function setVehicleFleet3DFocused(map, unitId) {
  const state = states.get(map);
  if (!state) return;

  const focusedUnitId = unitId === null || unitId === undefined
    ? null
    : normalizeUnitId(unitId);
  const previousInstance = state.instances.get(state.focusedUnitId);

  if (previousInstance) {
    setInstanceFocusVisual(previousInstance, false);
  }

  state.focusedUnitId = focusedUnitId;

  const focusedInstance = state.instances.get(focusedUnitId);
  if (focusedInstance) {
    setInstanceFocusVisual(focusedInstance, true);
  }

  map.triggerRepaint();
}

export function removeVehicleFleet3DInstance(map, unitId) {
  const state = states.get(map);
  if (!state) return;

  const normalizedUnitId = normalizeUnitId(unitId);
  const instance = state.instances.get(normalizedUnitId);
  if (!instance) return;

  instance.vehicle?.removeFromParent();
  disposeInstanceMaterials(instance);
  instance.vehicle = null;
  instance.boundsPoints = [];
  state.instances.delete(normalizedUnitId);
  map.triggerRepaint();
}

export function clearVehicleFleet3DLayer(map) {
  const state = states.get(map);
  if (!state) return;

  state.instances.forEach(instance => {
    instance.vehicle?.removeFromParent();
    disposeInstanceMaterials(instance);
    instance.vehicle = null;
    instance.boundsPoints = [];
  });
  state.instances.clear();
  map.triggerRepaint();
}

export function destroyVehicleFleet3DLayer(map) {
  const state = states.get(map);
  if (!state) return;

  map.off('load', state.addLayerWhenReady);
  map.off('style.load', state.addLayerWhenReady);
  clearVehicleFleet3DLayer(map);

  if (map.getLayer(LAYER_ID)) {
    map.removeLayer(LAYER_ID);
  } else {
    state.lifecycleVersion += 1;
    state.scene?.clear();
    state.renderer?.dispose();
    state.camera = null;
    state.scene = null;
    state.renderer = null;
  }

  state.template = null;
  states.delete(map);
}
