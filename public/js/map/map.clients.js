let clientsLayer = null;

let lastMap = null;
let lastData = null;

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
        
            const lat = c.lat;
            const lng = c.lng;
            const status = c.status;
            
            if (lat == null || lng == null) return;
            const isDelivered = (status === 40);
            
            // 🎯 COLOR según estado
            const color = '#2270A8';
            
            // 🔵 CÍRCULO
            L.circle([lat, lng], {
              radius: 80, // radio cliente (ajustable después)
              color: color,
              fillColor: color,
              fillOpacity: 0.4,
              weight: 0.5,
              opacity: 0.3
            }).addTo(clientsLayer);
            
            // 📍 ICONO (simple marker)
            //L.marker([lat, lng]).addTo(clientsLayer);
            const z = map.getZoom();
            
            // tamaños según zoom
            const isSmall = (z < 13);
            const size = isSmall ? 30 : 40;
            
            // elegir icono según estado + zoom
            let iconUrl;
            
            if (status === 40) {
              iconUrl = isSmall
                ? '/assets/images/locations/fin-borde-location-30.png'
                : '/assets/images/locations/fin-borde-location-40.png';
            } else {
              iconUrl = isSmall
                ? '/assets/images/locations/pte-borde-location-30.png'
                : '/assets/images/locations/pte-borde-location-40.png';
            }
            const icon = L.icon({
              iconUrl: iconUrl,
              iconSize: [size, size],
              iconAnchor: [size / 2, size],
              shadowUrl: null
            });
            L.marker([lat, lng], { icon }).addTo(clientsLayer);        
        
        });
    
    });
}