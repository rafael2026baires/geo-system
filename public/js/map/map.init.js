import {
  createLeafletMap,
  createTileLayer,
  createLayerGroup,
  createMapPane,
  createBaseCircle
} from './map.adapter.js';

export function initMap(containerId, defaultLat, defaultLng, baseRadiusM) {    
    
    //const map = L.map('map').setView([defaultLat, defaultLng], 12);
    const map = createLeafletMap(containerId, defaultLat, defaultLng);
       
    createMapPane(map, 'circlePane', 650);  

    map.options.zoomSnap = 0.5;
    map.options.zoomDelta = 0.5;    

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
    createBaseCircle(map, defaultLat, defaultLng, baseRadiusM); 
  
    const replayLayer = createLayerGroup(map);
    const realtimeLayer = createLayerGroup(map);
    
    const followEl = document.createElement('div');
    followEl.id = 'follow-indicator';
    followEl.className = 'follow-indicator hidden';
    
    const mapContainer = map.getContainer();
    mapContainer.appendChild(followEl);    
    
    return { map, replayLayer, realtimeLayer };
}