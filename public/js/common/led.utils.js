// ÚNICO lugar donde se mapea estado técnico → LED visual

const STATE_TO_CLASS = {
  MOVING: 'led-green',
  STOPPED: 'led-yellow',
  STOPPED_MEDIUM: 'led-orange',
  STOPPED_LONG: 'led-red',
  STALE: 'led-blue',   
  NO_DATA: 'led-violet',
  OFFLINE: 'led-gray-dark'
};

const LED_CLASSES = Object.values(STATE_TO_CLASS);
const VALID_STATES = Object.keys(STATE_TO_CLASS);

export function getLedClass(state) {
  if (!state) return '';

  if (!VALID_STATES.includes(state)) {
    console.warn('Estado LED desconocido:', state);
    return 'led-violet';
  }

  return STATE_TO_CLASS[state];
}