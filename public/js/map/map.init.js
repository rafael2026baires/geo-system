export function initMap(containerId, defaultLat, defaultLng, baseRadiusM) {    
    
    //const map = L.map('map').setView([defaultLat, defaultLng], 12);
    const map = L.map(containerId).setView([defaultLat, defaultLng], 12);
       
    map.createPane('circlePane');
    map.getPane('circlePane').style.zIndex = 650;    

    map.options.zoomSnap = 0.5;
    map.options.zoomDelta = 0.5;
    

    /* ===============================
       MAP STYLES — elegir UNO
       =============================== */
    // ------------------------------------------------------------------------------------------------------- 
    // -------------------------------------------------------------------------------------------------------    
    /* A) OSM estándar (actual) */
    /*
    const baseLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
       attribution: '© OpenStreetMap'
    });
    */
    // -------------------------------------------------------------------------------------------------------
    // -------------------------------------------------------------------------------------------------------    
    /* B) Gris / desaturado (CARTO — sin API key) */
    /*
    const baseLayer = L.tileLayer(
       'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
       { attribution: '© OpenStreetMap © CARTO' }
    );
    */
    // -------------------------------------------------------------------------------------------------------
    // -------------------------------------------------------------------------------------------------------    
    /* C) Oscuro / night mode (CARTO — sin API key) */
    
    const baseLayer = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution: '© OpenStreetMap © CARTO',
        updateWhenZooming: false,
        updateWhenIdle: true,
        keepBuffer: 2
      }
    );
    
    /* ------------------------------------------------------------------------------------------------------- 
    /* C) Oscuro PRO — fondo + labels separados */
    /*
    // Fondo oscuro sin etiquetas
    const darkBase = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap © CARTO' }
    );
    
    // Etiquetas en gris claro
    const darkLabels = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
      { attribution: '' }
    );
    darkBase.addTo(map);
    darkLabels.addTo(map);
    */
    // -------------------------------------------------------------------------------------------------------
    // -------------------------------------------------------------------------------------------------------   
    baseLayer.addTo(map);
    
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
    
    L.circle([defaultLat, defaultLng], { 
      pane: 'circlePane',    
      radius: baseRadiusM,
      color: 'blue',
      fillColor: '#232ED9',
      fillOpacity: 0.7
    }).addTo(map);    
  
    const replayLayer = L.layerGroup().addTo(map);
    const realtimeLayer = L.layerGroup().addTo(map);
    
    const followEl = document.createElement('div');
    followEl.id = 'follow-indicator';
    followEl.className = 'follow-indicator hidden';
    
    const mapContainer = map.getContainer();
    mapContainer.appendChild(followEl);    
    
    return { map, replayLayer, realtimeLayer };
}