// public/js/map/map.style.missing-icons.js
// Evita warnings de sprites faltantes en estilos MapLibre.
// No modifica markers, clientes, base ni seguimiento.

export function installMissingIconHandler(map) {
  if (!map || typeof map.on !== 'function') return;

  map.on('styleimagemissing', (e) => {
    const id = e.id;

    if (!id || map.hasImage(id)) return;

    const size = 1;
    const data = new Uint8Array(size * size * 4);

    map.addImage(id, {
      width: size,
      height: size,
      data
    });
  });
}