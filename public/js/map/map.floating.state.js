const STORAGE_KEY = 'floating_state';

export function getFloatingState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};

  try {
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

export function saveFloatingStatePatch(patch) {
  const state = getFloatingState();

  Object.assign(state, patch);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function saveFloatingBoxState(el) {
  if (!el) return;

  saveFloatingStatePatch({
    left: el.style.left,
    top: el.style.top,
    width: el.style.width,
    height: el.style.height
  });
}

export function loadFloatingBoxState(el) {
  if (!el) return;

  const state = getFloatingState();

  if (state.left) el.style.setProperty('left', state.left, 'important');
  if (state.top) el.style.setProperty('top', state.top, 'important');
  if (state.width) el.style.setProperty('width', state.width, 'important');
  if (state.height) el.style.setProperty('height', state.height, 'important');

  el.style.setProperty('right', 'auto', 'important');
  el.style.setProperty('bottom', 'auto', 'important');
}