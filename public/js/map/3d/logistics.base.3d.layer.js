import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveZoomScaleFactor } from './map.3d.scale.js';

const MODEL_URL = './assets/models/3d/warehouse.glb';
const MODEL_ROTATION_X = Math.PI / 2;
const MODEL_ROTATION_Y = THREE.MathUtils.degToRad(58);
const states = new WeakMap();

let modelTemplatePromise = null;

function loadModelTemplate() {
  if (!modelTemplatePromise) {
    modelTemplatePromise = new GLTFLoader()
      .loadAsync(MODEL_URL)
      .then(gltf => gltf.scene)
      .catch(error => {
        modelTemplatePromise = null;
        throw error;
      });
  }

  return modelTemplatePromise;
}

function normalizePosition(position) {
  const lat = Number(position?.lat);
  const lng = Number(position?.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new TypeError(
      'position requiere valores lat y lng validos para la base logistica.'
    );
  }

  return { lat, lng };
}

function updateMercatorPosition(state) {
  state.mercatorCoordinate =
    globalThis.maplibregl.MercatorCoordinate.fromLngLat(
      [state.position.lng, state.position.lat],
      0
    );
  state.meterScale =
    state.mercatorCoordinate.meterInMercatorCoordinateUnits();
}

function findFirstSymbolLayerId(map) {
  return map.getStyle()?.layers?.find(layer => layer.type === 'symbol')?.id;
}

function releaseRuntimeResources(state) {
  state.lifecycleVersion += 1;
  state.baseModel?.removeFromParent();
  state.scene?.clear();
  state.renderer?.dispose();
  state.baseModel = null;
  state.camera = null;
  state.scene = null;
  state.renderer = null;
}

function createCustomLayer(state) {
  return {
    id: state.id,
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

      loadModelTemplate()
        .then(template => {
          if (
            state.destroyed ||
            state.lifecycleVersion !== version ||
            !state.scene
          ) {
            return;
          }

          state.baseModel = template.clone(true);
          state.scene.add(state.baseModel);
          state.map.triggerRepaint();
        })
        .catch(error => {
          if (!state.destroyed && state.lifecycleVersion === version) {
            console.error(
              '[LogisticsBase3D] Error al cargar warehouse.glb.',
              error
            );
          }
        });
    },

    render(gl, args) {
      if (!state.renderer || !state.camera || !state.baseModel) return;

      const zoomScaleFactor = state.zoomScaleProfile.enabled === true
        ? resolveZoomScaleFactor(
            state.map.getZoom(),
            state.zoomScaleProfile.points,
            state.zoomScaleProfile.edgePolicy
          )
        : 1;
      const effectiveScale = state.meterScale * zoomScaleFactor;
      const mapMatrix = new THREE.Matrix4()
        .fromArray(args.defaultProjectionData.mainMatrix);
      const modelMatrix = new THREE.Matrix4()
        .makeTranslation(
          state.mercatorCoordinate.x,
          state.mercatorCoordinate.y,
          state.mercatorCoordinate.z
        )
        .scale(new THREE.Vector3(
          effectiveScale,
          -effectiveScale,
          effectiveScale * 1.6
        ))
        .multiply(new THREE.Matrix4().makeRotationX(MODEL_ROTATION_X))
        .multiply(new THREE.Matrix4().makeRotationY(MODEL_ROTATION_Y));        

      state.camera.projectionMatrix = mapMatrix.multiply(modelMatrix);
      state.renderer.resetState();
      state.renderer.render(state.scene, state.camera);
    },

    onRemove() {
      releaseRuntimeResources(state);
    }
  };
}

function addLayerWhenReady(state) {
  const styleIsReady =
    (typeof state.map.loaded === 'function' && state.map.loaded()) ||
    (
      typeof state.map.isStyleLoaded === 'function' &&
      state.map.isStyleLoaded()
    );

  if (
    state.destroyed ||
    states.get(state.map) !== state ||
    state.map.getLayer(state.id) ||
    !styleIsReady
  ) {
    return;
  }

  state.map.addLayer(
    state.layer,
    findFirstSymbolLayerId(state.map)
  );
}

export function initLogisticsBase3DLayer(
  map,
  { id, position, zoomScaleProfile }
) {
  if (!map || typeof map.addLayer !== 'function') {
    throw new TypeError('Se requiere una instancia valida de MapLibre.');
  }

  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError('Se requiere un id de layer no vacio.');
  }

  const normalizedPosition = normalizePosition(position);
  const existingState = states.get(map);

  if (existingState) {
    existingState.position = normalizedPosition;
    existingState.zoomScaleProfile = zoomScaleProfile;
    updateMercatorPosition(existingState);
    addLayerWhenReady(existingState);
    map.triggerRepaint();
    return existingState.layer;
  }

  const state = {
    map,
    id,
    position: normalizedPosition,
    zoomScaleProfile,
    mercatorCoordinate: null,
    meterScale: 0,
    layer: null,
    camera: null,
    scene: null,
    renderer: null,
    baseModel: null,
    lifecycleVersion: 0,
    destroyed: false,
    addLayerWhenReady: null
  };

  updateMercatorPosition(state);
  state.layer = createCustomLayer(state);
  state.addLayerWhenReady = () => addLayerWhenReady(state);
  states.set(map, state);

  map.on('load', state.addLayerWhenReady);
  map.on('style.load', state.addLayerWhenReady);
  state.addLayerWhenReady();

  return state.layer;
}

export function destroyLogisticsBase3DLayer(map) {
  const state = states.get(map);
  if (!state) return;

  state.destroyed = true;
  map.off('load', state.addLayerWhenReady);
  map.off('style.load', state.addLayerWhenReady);

  if (map.getLayer(state.id)) {
    map.removeLayer(state.id);
  } else {
    releaseRuntimeResources(state);
  }

  states.delete(map);
}
