import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { resolveZoomScaleFactor } from './map.3d.scale.js';

const DEFAULT_LAYER_ID = 'client-markers-3d';
//const MODEL_URL = './assets/models/3d/marker.glb';
const MODEL_URL = './assets/models/3d/location_pin.glb';
const MODEL_ROTATION_X = Math.PI / 2;
const MODEL_ROTATION_Y = -Math.PI / 2;
const MODEL_ROTATION_Z = 0;
//const MODEL_CAMERA_OFFSET_Y = THREE.MathUtils.degToRad(110);
const MODEL_HEIGHT_METERS = 40;
const MODEL_ALTITUDE_METERS = 0;

// Calibración A/B inicial: se limita a la layer del mapa principal.
const MAIN_MAP_LAYER_ID = 'map-3d-lab-client-marker';
const ENABLE_MAIN_MAP_HEMISPHERE_LIGHT_TEST = true;
const HEMISPHERE_SKY_COLOR = 0xffffff;
const HEMISPHERE_GROUND_COLOR = 0x334155;
const HEMISPHERE_LIGHT_INTENSITY = 1.1;
const TEST_DIRECTIONAL_LIGHT_INTENSITY = 2.0;

let markerTemplatePromise = null;

function loadMarkerTemplate() {
  if (!markerTemplatePromise) {
    markerTemplatePromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        MODEL_URL,
        gltf => resolve(gltf.scene),
        undefined,
        reject
      );
    }).catch(error => {
      console.error('[Map3DMarker] Error al cargar el modelo GLB.', error);
      throw error;
    });
  }

  return markerTemplatePromise;
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

function getClientStatusColor(status) {
  switch (Number(status)) {
    case 20:
      return '#725959';
    case 30:
      return '#5891d1';
    case 40:
      return '#3cca70';
    default:
      return '#725959';
  }
}

export function createClientMarkers3DLayer({
  id = DEFAULT_LAYER_ID,
  zoomScaleProfile = null
}) {
  if (!id || typeof id !== 'string') {
    throw new TypeError('La capa 3D requiere un id válido.');
  }

  let map = null;
  let camera = null;
  let scene = null;
  let renderer = null;
  let markerTemplate = null;
  let storedClients = [];
  let instances = [];
  let lifecycleVersion = 0;

  function clearInstances() {
    instances.forEach(instance => scene?.remove(instance.marker));
    instances = [];
  }

  function rebuildInstances() {
    if (!scene || !markerTemplate) return;

    clearInstances();

    instances = storedClients.map(client => {
      const marker = markerTemplate.clone(true);
      removeEmbeddedCamerasAndLights(marker);

      const statusColor = getClientStatusColor(client.status);

      marker.traverse(object => {
        if (!object.isMesh) return;

        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        const clonedMaterials = materials.map(material => {
          const clonedMaterial = material.clone();
          clonedMaterial.color?.set(statusColor);
          clonedMaterial.needsUpdate = true;
          return clonedMaterial;
        });

        object.material = Array.isArray(object.material)
          ? clonedMaterials
          : clonedMaterials[0];
      });

      marker.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(marker);
      const size = new THREE.Vector3();
      box.getSize(size);
      const maxDimension = Math.max(size.x, size.y, size.z);

      if (maxDimension > 0) {
        marker.scale.setScalar(MODEL_HEIGHT_METERS / maxDimension);
      }

      marker.updateMatrixWorld(true);

      const rotationMatrix = new THREE.Matrix4()
        .makeRotationX(MODEL_ROTATION_X)
        .multiply(new THREE.Matrix4().makeRotationY(MODEL_ROTATION_Y))
        .multiply(new THREE.Matrix4().makeRotationZ(MODEL_ROTATION_Z));
      const rotatedBox = new THREE.Box3()
        .setFromObject(marker)
        .applyMatrix4(rotationMatrix);
      const verticalOffsetMeters = MODEL_ALTITUDE_METERS - rotatedBox.min.z;

      const mercatorCoordinate = globalThis.maplibregl.MercatorCoordinate.fromLngLat(
        [client.lng, client.lat],
        0
      );
      const mercatorScale = mercatorCoordinate.meterInMercatorCoordinateUnits();
      const modelTransform = {
        translateX: mercatorCoordinate.x,
        translateY: mercatorCoordinate.y,
        translateZ: mercatorCoordinate.z,
        rotateX: MODEL_ROTATION_X,
        rotateY: MODEL_ROTATION_Y,
        rotateZ: MODEL_ROTATION_Z,
        scale: mercatorScale
      };

      scene.add(marker);
      return {
        marker,
        modelTransform,
        mercatorCoordinate,
        mercatorScale,
        verticalOffsetMeters
      };
    });
  }

  const layer = {
    id,
    type: 'custom',
    renderingMode: '3d',

    setClients(clients) {
      if (!Array.isArray(clients)) {
        throw new TypeError('setClients requiere un array.');
      }

      clearInstances();
      storedClients = [...clients];
      rebuildInstances();
      map?.triggerRepaint();
    },

    onAdd(mapInstance, gl) {
      const version = ++lifecycleVersion;
      map = mapInstance;
      camera = new THREE.Camera();
      scene = new THREE.Scene();

      const useHemisphereLightTest =
        ENABLE_MAIN_MAP_HEMISPHERE_LIGHT_TEST &&
        id === MAIN_MAP_LAYER_ID;

      if (useHemisphereLightTest) {
        scene.add(new THREE.HemisphereLight(
          HEMISPHERE_SKY_COLOR,
          HEMISPHERE_GROUND_COLOR,
          HEMISPHERE_LIGHT_INTENSITY
        ));
      } else {
        scene.add(new THREE.AmbientLight(0xffffff, 1.5));
      }

      const directionalLight = new THREE.DirectionalLight(
        0xffffff,
        useHemisphereLightTest
          ? TEST_DIRECTIONAL_LIGHT_INTENSITY
          : 2.5
      );
      directionalLight.position.set(50, -50, 100);
      scene.add(directionalLight);

      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;

      loadMarkerTemplate()
        .then(template => {
          if (version !== lifecycleVersion || !scene) return;
          markerTemplate = template;
          rebuildInstances();
          map?.triggerRepaint();
        })
        .catch(() => {});
    },

    render(gl, args) {
      if (!renderer || !camera || !scene || instances.length === 0) return;

      const currentZoom = map.getZoom();
      const locationZoomScaleFactor =
        zoomScaleProfile?.enabled === true
          ? resolveZoomScaleFactor(
              currentZoom,
              zoomScaleProfile.points,
              zoomScaleProfile.edgePolicy
            )
          : 1;

      instances.forEach(instance => {
        instance.marker.visible = false;
      });

      renderer.resetState();

      instances.forEach(instance => {
        const {
          marker,
          modelTransform,
          mercatorCoordinate,
          mercatorScale,
          verticalOffsetMeters
        } = instance;
        const effectiveMercatorScale =
          mercatorScale * locationZoomScaleFactor;
        const translateZ =
          mercatorCoordinate.z +
          verticalOffsetMeters * effectiveMercatorScale;
        const rotationX = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(1, 0, 0),
          modelTransform.rotateX
        );
        //const mapBearingRadians = THREE.MathUtils.degToRad(map.getBearing());

        const rotationY = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 1, 0),
          //modelTransform.rotateY - mapBearingRadians + MODEL_CAMERA_OFFSET_Y   
          //modelTransform.rotateY - (mapBearingRadians * 0.65) + MODEL_CAMERA_OFFSET_Y  
          modelTransform.rotateY     
        );
        const rotationZ = new THREE.Matrix4().makeRotationAxis(
          new THREE.Vector3(0, 0, 1),
          modelTransform.rotateZ
        );
        const mapMatrix = new THREE.Matrix4()
          .fromArray(args.defaultProjectionData.mainMatrix);
        const modelMatrix = new THREE.Matrix4()
          .makeTranslation(
            modelTransform.translateX,
            modelTransform.translateY,
            translateZ
          )
          .scale(new THREE.Vector3(
            effectiveMercatorScale,
            -effectiveMercatorScale,
            effectiveMercatorScale
          ))
          .multiply(rotationX)
          .multiply(rotationY)
          .multiply(rotationZ);

        camera.projectionMatrix = mapMatrix.multiply(modelMatrix);
        marker.visible = true;
        renderer.render(scene, camera);
        marker.visible = false;
      });
    },

    onRemove() {
      lifecycleVersion += 1;
      clearInstances();
      storedClients = [];
      scene?.clear();
      renderer?.dispose();
      map = null;
      camera = null;
      scene = null;
      renderer = null;
    }
  };

  return layer;
}
