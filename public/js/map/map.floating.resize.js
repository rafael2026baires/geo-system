export function enableFloatingResizeBehavior({ getElement, onSave, onResize }) {  

  const el = getElement();
  if (!el) return;

  const corner = el.querySelector('.floating-resize');
  const left = el.querySelector('.resize-left');
  const right = el.querySelector('.resize-right');
  const bottom = el.querySelector('.resize-bottom');

  let isResizing = false;
  let mode = null;

  function startResize(e, resizeMode) {
    if (!el.classList.contains('floating-detached')) return;

    mode = resizeMode;
    isResizing = true;
    e.stopPropagation();
    e.preventDefault();
  }

  corner?.addEventListener('mousedown', (e) => startResize(e, 'corner'));
  left?.addEventListener('mousedown', (e) => startResize(e, 'left'));
  right?.addEventListener('mousedown', (e) => startResize(e, 'right'));
  bottom?.addEventListener('mousedown', (e) => startResize(e, 'bottom'));

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const rect = el.getBoundingClientRect();

    if (mode === 'corner') {
      const w = e.clientX - rect.left;
      const h = e.clientY - rect.top;

      if (w > 150) el.style.setProperty('width', `${w}px`, 'important');
      if (h > 100) el.style.setProperty('height', `${h}px`, 'important');
    }

    if (mode === 'left') {
      const dx = rect.left - e.clientX;
      const newWidth = rect.width + dx;

      if (newWidth > 150) {
        el.style.setProperty('width', `${newWidth}px`, 'important');
        el.style.setProperty('left', `${rect.left - dx}px`, 'important');
        el.style.setProperty('right', 'auto', 'important');
      }
    }

    if (mode === 'right') {
      const w = e.clientX - rect.left;
      if (w > 150) el.style.setProperty('width', `${w}px`, 'important');
    }

    if (mode === 'bottom') {
      const h = e.clientY - rect.top;
      if (h > 100) el.style.setProperty('height', `${h}px`, 'important');
    }

    if (typeof onResize === 'function') {
      onResize();
    }    

  });

  document.addEventListener('mouseup', () => {
    if (isResizing && typeof onSave === 'function') {
      onSave(el);
      if (typeof onResize === 'function') {
        onResize();
      }
    }

    isResizing = false;
    mode = null;
  });

}