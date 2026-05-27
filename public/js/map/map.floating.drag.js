export function enableFloatingDragBehavior({ getElement, onSave }) {
    
  const el = getElement();
  if (!el) return;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener('mousedown', (e) => {
    if (!el.classList.contains('floating-detached')) return;

    if (
      e.target.closest('button') ||
      e.target.closest('.floating-resize') ||
      e.target.closest('.resize-left') ||
      e.target.closest('.resize-right') ||
      e.target.closest('.resize-bottom')
    ) {
      return;
    }

    const rect = el.getBoundingClientRect();

    isDragging = true;
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    el.style.setProperty('left', `${e.clientX - offsetX}px`, 'important');
    el.style.setProperty('top', `${e.clientY - offsetY}px`, 'important');
    el.style.setProperty('right', 'auto', 'important');
    el.style.setProperty('bottom', 'auto', 'important');
  });

  document.addEventListener('mouseup', () => {
    if (isDragging && typeof onSave === 'function') {
      onSave(el);
    }

    isDragging = false;
  });
}