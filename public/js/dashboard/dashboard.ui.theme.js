async function loadUiTheme() {

  try {
    const res = await fetch('/api/dashboard/get_ui_theme.php');
    const json = await res.json();

    if (!json.ok || !json.theme) return;

    const root = document.documentElement;

    Object.entries(json.theme).forEach(([key, value]) => {
      root.style.setProperty(`--${key.replaceAll('_', '-')}`, value);
    });

    window.UiThemeCurrent = json.theme;
    window.UiThemeSettings = json.settings || [];

    window.dispatchEvent(new CustomEvent('ui-theme-loaded', {
      detail: {
        theme: json.theme,
        settings: json.settings || []
      }
    }));   

    document.body.classList.remove('theme-loading');

  } catch (error) {
    console.error('Error cargando tema visual:', error);
  }

}