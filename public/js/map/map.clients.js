let clientsLayer = null;

let lastMap = null;
let lastData = null;

function hasValidClientPosition(client) {
  return client.lat != null && client.lng != null;
}

function getClientIconSizeByZoom(zoom) {
  return zoom < 13 ? 30 : 40;
}

function getClientIconUrl(status, size) {
  const isSmall = size === 30;

  if (status === 40) {
    return isSmall
      ? '/assets/images/locations/fin-borde-location-30.png'
      : '/assets/images/locations/fin-borde-location-40.png';
  }

  return isSmall
    ? '/assets/images/locations/pte-borde-location-30.png'
    : '/assets/images/locations/pte-borde-location-40.png';
}

function createClientIcon({ status, size }) {
  return L.icon({
    iconUrl: getClientIconUrl(status, size),
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    shadowUrl: null
  });
}

function addClientCircle({ layer, lat, lng }) {
  const color = '#2270A8';

  L.circle([lat, lng], {
    radius: 70,
    color: color,
    fillColor: color,
    fillOpacity: 0.2,
    weight: 0.5,
    opacity: 0.4
  }).addTo(layer);
}

/*
function addClientMarker({ layer, lat, lng, status, zoom }) {
  const size = getClientIconSizeByZoom(zoom);

  const icon = createClientIcon({
    status,
    size
  });

  const marker = L.marker([lat, lng], { icon }).addTo(layer);
  marker.setOpacity(0.15);
}
*/  

function addClientMarker({ layer, lat, lng, status }) {
  const color = status === 40 ? '#195AB0' : '#FF2EF5';

  L.circleMarker([lat, lng], {
    radius: 2,
    color: color,
    fillColor: color,
    fillOpacity: 0.4,
    opacity: 0.4,
    weight: 1
  }).addTo(layer);
}

export function renderClients(map, data) {
    
    lastMap = map;
    lastData = data;

    if (!clientsLayer) {
      clientsLayer = L.layerGroup().addTo(map);
        map.on('zoom', () => {
          if (lastMap && lastData) {
            renderClients(lastMap, lastData);
          }
        });      
    }
    clientsLayer.clearLayers();
    
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
              zoom: map.getZoom()
            });   
        
        });
    
    });
}