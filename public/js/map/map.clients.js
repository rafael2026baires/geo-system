import {
  createLayerGroup,
  createMapCircle,
  createMapCircleMarker,
  clearLayerGroup,
  onMapZoom,
  getMapZoom
} from './map.adapter.js';

let clientsLayer = null;

let lastMap = null;
let lastData = null;

function hasValidClientPosition(client) {
  return client.lat != null && client.lng != null;
}

function addClientCircle({ layer, lat, lng }) {
  
  const color = getComputedStyle(document.documentElement)
    .getPropertyValue('--map-client-circle-color')
    .trim();


  createMapCircle(layer, { lat, lng }, {
    radius: 70,
    color: color,
    fillColor: color,
    fillOpacity: 0.2,
    weight: 0.5,
    opacity: 0.4
  });
}

function addClientMarker({ layer, lat, lng, status }) {

  const rootStyles = getComputedStyle(document.documentElement);
  const color = status === 40
    ? rootStyles.getPropertyValue('--map-client-done-color').trim()
    : rootStyles.getPropertyValue('--map-client-pending-color').trim();  

    createMapCircleMarker(layer, { lat, lng }, {
      radius: 2,
      color: color,
      fillColor: color,
      fillOpacity: 0.4,
      opacity: 0.4,
      weight: 1
    });
}

export function renderClients(map, data) {
    
    lastMap = map;
    lastData = data;

    if (!clientsLayer) {
      clientsLayer = createLayerGroup(map);
        onMapZoom(map, () => {
          if (lastMap && lastData) {
            renderClients(lastMap, lastData);
          }
        });      
    }
    clearLayerGroup(clientsLayer);
    
    data.units.forEach(u => {
        
        if (u.active !== 1) return;
    
        if (!u.clients || u.clients.length === 0) return;
        
        u.clients.forEach(c => {

            if (!hasValidClientPosition(c)) return;
        
            const lat = c.lat;
            const lng = c.lng;
            const status = c.status;         
                        
            addClientCircle({
              layer: clientsLayer,
              lat,
              lng
            });
            
            addClientMarker({
              layer: clientsLayer,
              lat,
              lng,
              status,
              zoom: getMapZoom(map)
            });   
        
        });
    
    });
}