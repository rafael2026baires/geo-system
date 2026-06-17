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

  const hasSavedPosition = Boolean(state.left && state.top);

  if (hasSavedPosition) {
    el.style.setProperty('left', state.left, 'important');
    el.style.setProperty('top', state.top, 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
  } else {
    el.style.removeProperty('left');
    el.style.removeProperty('top');
    el.style.removeProperty('right');
    el.style.removeProperty('bottom');
  }

  if (state.width) el.style.setProperty('width', state.width, 'important');
  if (state.height) el.style.setProperty('height', state.height, 'important');
}