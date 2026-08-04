import {
  createLeafletMap,
  createTileLayer,
  createLayerGroup,
  createMapPane,
  createBaseCircle
} from './map.adapter.js';
import {
  FLOATING_MAP_LOGISTICS_BASE_SCALE_PROFILE,
  MAIN_MAP_LOGISTICS_BASE_SCALE_PROFILE
} from './3d/map.3d.scale.config.js';
import { initLogisticsBase3DLayer } from './3d/logistics.base.3d.layer.js';

export function initMap(containerId, defaultLat, defaultLng, baseRadiusM) {    
    
    //const map = L.map('map').setView([defaultLat, defaultLng], 12);
    const map = createLeafletMap(containerId, defaultLat, defaultLng);
       
    createMapPane(map, 'circlePane', 650);     

    createTileLayer(map);    
    // ----- visualización de zoon para prueba -------------------------------
    /*
    const zoomDebug = L.control({ position: 'topright' });
    zoomDebug.onAdd = function () {
      const div = L.DomUtil.create('div', 'zoom-debug');
      div.innerHTML = `Zoom: ${map.getZoom()}`;
      return div;
    };
    zoomDebug.addTo(map);

    map.on('zoomend', () => {
      document.querySelector('.zoom-debug').innerHTML = `Zoom: ${map.getZoom()}`;
    });
    // en styles.css .zoom-debug {.....
    */
    // -----------------------------------------------------------------------    
    const logisticsBaseScaleProfile = containerId === 'map'
      ? MAIN_MAP_LOGISTICS_BASE_SCALE_PROFILE
      : containerId === 'floating-map'
        ? FLOATING_MAP_LOGISTICS_BASE_SCALE_PROFILE
        : null;
    const logisticsBaseLayerId = containerId === 'map'
      ? 'map-logistics-base-3d'
      : containerId === 'floating-map'
        ? 'floating-map-logistics-base-3d'
        : null;

    if (logisticsBaseScaleProfile && logisticsBaseLayerId) {
      initLogisticsBase3DLayer(map, {
        id: logisticsBaseLayerId,
        position: {
          lat: defaultLat,
          lng: defaultLng
        },
        zoomScaleProfile: logisticsBaseScaleProfile
      });
    }

    createBaseCircle(map, defaultLat, defaultLng, baseRadiusM, {
      beforeLayerId: logisticsBaseLayerId
    });
  
    const replayLayer = createLayerGroup(map);
    const realtimeLayer = createLayerGroup(map);
    
    const followEl = document.createElement('div');
    followEl.id = 'follow-indicator';
    followEl.className = 'follow-indicator hidden';
    
    const mapContainer = map.getContainer();
    mapContainer.appendChild(followEl);    
    
    return { map, replayLayer, realtimeLayer };
}
