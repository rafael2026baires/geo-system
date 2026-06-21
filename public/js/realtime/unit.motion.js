import { distanceMeters } from '../common/helpers.js';
import { setVehicleMarkerPosition } from '../map/markers/vehicle.marker.js';

export class UnitMotion {
  constructor(marker) {
    this.marker = marker;
    this.virtualPos = null;      // { lat, lng }
    this.heading = null;         // { dLat, dLng } normalizado
    this.speed = 0;              // grados/segundo (aprox, suficiente para visual)
    this.targetPos = null;
    this.lastFrameTs = null;
    this.running = false;
    this.pointsCount = 0;
    this.visualUnlocked = false;
  }

  // Arranque limpio con el primer punto real
  setInitialPoint(point) {
    this.virtualPos = { lat: point.lat, lng: point.lng };
    setVehicleMarkerPosition(this.marker, point);
  }

  snapTo(point) {
    this.virtualPos = { lat: point.lat, lng: point.lng };
    this.heading = null;
    this.speed = 0;
    this.targetPos = null;
    setVehicleMarkerPosition(this.marker, point);
  }


    // Aplicar nuevo punto del backend (NO frena la animación)
    applyServerPoint(point) {
        
      this.pointsCount++;
      
      // �9�9 Regla VISUAL: segundo punto (independiente del estado)
      // DEBE ejecutarse SIEMPRE que entra un punto
      if (!this.visualUnlocked && this.pointsCount >= 2) {
        this.visualUnlocked = true;
        this.marker.__visualUnlocked = true; // flag le��do desde realtime.multi
      }
          
      const MAX_JUMP_M = 150;   
      
      // primer punto o salto grande �� posicionar sin animar
      if (!this.virtualPos || distanceMeters(this.virtualPos, point) > MAX_JUMP_M) {
        this.virtualPos = { lat: point.lat, lng: point.lng };
        this.heading = null;
        this.speed = 0;
        setVehicleMarkerPosition(this.marker, point);

        return;
      }    
    
      const dLat = point.lat - this.virtualPos.lat;
      const dLng = point.lng - this.virtualPos.lng;
    
      const dist = Math.hypot(dLat, dLng);

      // if (dist === 0) return;
      if (dist === 0) {
        this.heading = null;
        this.speed = 0;
        setVehicleMarkerPosition(this.marker, point);
        return;
      }

      this.targetPos = { lat: point.lat, lng: point.lng };
    
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
    if (!this.heading || !this.targetPos) return;

    const nextLat = this.virtualPos.lat + this.heading.dLat * this.speed * dt;
    const nextLng = this.virtualPos.lng + this.heading.dLng * this.speed * dt;

    const remainingBefore = Math.hypot(
      this.targetPos.lat - this.virtualPos.lat,
      this.targetPos.lng - this.virtualPos.lng
    );

    const remainingAfter = Math.hypot(
      this.targetPos.lat - nextLat,
      this.targetPos.lng - nextLng
    );

    if (remainingAfter >= remainingBefore) {
      this.virtualPos = { lat: this.targetPos.lat, lng: this.targetPos.lng };
      this.heading = null;
      this.speed = 0;
      this.targetPos = null;

      setVehicleMarkerPosition(this.marker, this.virtualPos);

      return;
    }

    this.virtualPos.lat = nextLat;
    this.virtualPos.lng = nextLng;

    setVehicleMarkerPosition(this.marker, this.virtualPos);
  }
}