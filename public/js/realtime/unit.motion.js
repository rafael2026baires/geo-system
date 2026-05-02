import { distanceMeters } from '../common/helpers.js';

export class UnitMotion {
  constructor(marker) {
    this.marker = marker;
    this.virtualPos = null;      // { lat, lng }
    this.heading = null;         // { dLat, dLng } normalizado
    this.speed = 0;              // grados/segundo (aprox, suficiente para visual)
    this.lastFrameTs = null;
    this.running = false;
    this.pointsCount = 0;
    this.visualUnlocked = false;
  }

  // Arranque limpio con el primer punto real
  setInitialPoint(point) {
    this.virtualPos = { lat: point.lat, lng: point.lng };
    this.marker.setLatLng([point.lat, point.lng]);
  }

    // Aplicar nuevo punto del backend (NO frena la animaci贸n)
    applyServerPoint(point) {
        
    this.pointsCount++;
    
    // 🔓 Regla VISUAL: segundo punto (independiente del estado)
    // DEBE ejecutarse SIEMPRE que entra un punto
    if (!this.visualUnlocked && this.pointsCount >= 2) {
      this.visualUnlocked = true;
      this.marker.__visualUnlocked = true; // flag leído desde realtime.multi
    }
        
    const MAX_JUMP_M = 150;   
    
    // primer punto o salto grande → posicionar sin animar
    if (!this.virtualPos || distanceMeters(this.virtualPos, point) > MAX_JUMP_M) {
      this.virtualPos = { lat: point.lat, lng: point.lng };
      this.heading = null;
      this.speed = 0;
      this.marker.setLatLng([point.lat, point.lng]);

      return;
    }    
    
      const dLat = point.lat - this.virtualPos.lat;
      const dLng = point.lng - this.virtualPos.lng;
    
      const dist = Math.hypot(dLat, dLng);
      if (dist === 0) return;
    
      this.heading = {
        dLat: dLat / dist,
        dLng: dLng / dist
      };
    
      // velocidad visual constante (mantiene tu look actual)
      this.speed = dist / 10;
    }

  
  // Avance sin RAF (para multi con RAF global)
  tick(dt) {
    if (!this.virtualPos) return;

    if (this.heading) {
      this.virtualPos.lat += this.heading.dLat * this.speed * dt;
      this.virtualPos.lng += this.heading.dLng * this.speed * dt;

      this.marker.setLatLng([
        this.virtualPos.lat,
        this.virtualPos.lng
      ]);
    }
  }
}