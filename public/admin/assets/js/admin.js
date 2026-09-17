(() => {
  const shell = document.getElementById('adminShell');
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('drawerBackdrop');
  const mobileMenu = document.getElementById('mobileMenu');
  const collapseButton = document.getElementById('sidebarCollapse');

  function closeDrawer() {
    shell.classList.remove('is-drawer-open');
    backdrop.hidden = true;
    mobileMenu.setAttribute('aria-expanded', 'false');
  }

  mobileMenu.addEventListener('click', () => {
    const open = shell.classList.toggle('is-drawer-open');
    backdrop.hidden = !open;
    mobileMenu.setAttribute('aria-expanded', String(open));
  });
  backdrop.addEventListener('click', closeDrawer);
  sidebar.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeDrawer();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDrawer();
  });
  collapseButton.addEventListener('click', () => {
    const collapsed = shell.classList.toggle('is-collapsed');
    collapseButton.setAttribute('aria-label', collapsed ? 'Expandir menú' : 'Plegar menú');
  });
})();
