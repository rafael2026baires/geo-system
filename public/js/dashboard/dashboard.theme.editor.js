(function () {

    let THEME_GROUPS = [];
    let THEME_KEYS = [];
    let LABELS = {};

    function prepareThemeEditorMetadata(settings) {
    const list = Array.isArray(settings) ? settings : [];

    THEME_GROUPS = [];
    THEME_KEYS = [];
    LABELS = {};

    const groupsMap = new Map();

    list.forEach(item => {
        const key = item.setting_key;
        if (!key) return;

        const groupName = item.grupo || 'General';

        if (!groupsMap.has(groupName)) {
        groupsMap.set(groupName, {
            title: groupName,
            keys: []
        });
        }

        groupsMap.get(groupName).keys.push(key);
        LABELS[key] = item.descrip || key;
        THEME_KEYS.push(key);
    });

    THEME_GROUPS = Array.from(groupsMap.values());
    }

  function keyToCssVar(key) {
    return `--${key.replaceAll('_', '-')}`;
  }


  function createThemeEditor(data) {

    const theme = data?.theme || {};
    const settings = data?.settings || window.UiThemeSettings || [];

    prepareThemeEditorMetadata(settings);

    if (!THEME_KEYS.length) {
        THEME_KEYS = Object.keys(theme);
        THEME_GROUPS = [{ title: 'General', keys: THEME_KEYS }];
        THEME_KEYS.forEach(key => {
        LABELS[key] = key;
        });
    }

    
    if (document.getElementById('themeEditorPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'themeEditorPanel';

    panel.style.position = 'fixed';
    panel.style.top = '70px';
    panel.style.right = '15px';
    panel.style.zIndex = '99999';
    panel.style.width = '280px';
    panel.style.maxHeight = 'calc(100vh - 100px)';
    panel.style.overflowY = 'auto';
    panel.style.background = '#202020';
    panel.style.color = '#FFFFFF';
    panel.style.border = '1px solid #666666';
    panel.style.borderRadius = '8px';
    panel.style.padding = '10px';
    panel.style.fontFamily = 'Arial, sans-serif';
    panel.style.fontSize = '12px';
    panel.style.boxShadow = '0 4px 12px #000000';

    panel.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <strong>Editor de colores</strong>
        <button id="themeEditorClose" style="cursor:pointer;">✕</button>
      </div>

      <div id="themeEditorRows"></div>

      <div style="margin-top:10px; display:flex; gap:6px;">
        <button id="themeEditorReset" style="flex:1; cursor:pointer;">Reset</button>
        <button id="themeEditorSave" style="flex:1; cursor:pointer;">Guardar</button>
      </div>
    `;

    document.body.appendChild(panel);

    const rows = document.getElementById('themeEditorRows');

    THEME_GROUPS.forEach(group => {
        const groupTitle = document.createElement('div');
        groupTitle.textContent = group.title;

        groupTitle.style.margin = '12px 0 6px 0';
        groupTitle.style.paddingTop = '6px';
        groupTitle.style.borderTop = '1px solid #555555';
        groupTitle.style.fontWeight = 'bold';
        groupTitle.style.color = '#DADADA';
        groupTitle.style.fontSize = '12px';

        rows.appendChild(groupTitle);

        group.keys.forEach(key => {
            const value = theme[key] || '#000000';

            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 42px 72px';
            row.style.alignItems = 'center';
            row.style.gap = '6px';
            row.style.marginBottom = '6px';

            row.innerHTML = `
            <span>${LABELS[key] || key}</span>
            <input type="color" value="${value}" data-theme-key="${key}">
            <input type="text" value="${value}" data-theme-text="${key}" style="width:70px;">
            `;

            rows.appendChild(row);
        });
    });

    panel.addEventListener('input', (e) => {
      const colorInputKey = e.target.dataset.themeKey;
      const textInputKey = e.target.dataset.themeText;

      if (colorInputKey) {
        const value = e.target.value;
        document.documentElement.style.setProperty(keyToCssVar(colorInputKey), value);

        const textInput = panel.querySelector(`[data-theme-text="${colorInputKey}"]`);
        if (textInput) textInput.value = value;
      }

      if (textInputKey) {
        const value = e.target.value;
        if (!/^#[0-9A-Fa-f]{6}$/.test(value)) return;

        document.documentElement.style.setProperty(keyToCssVar(textInputKey), value);

        const colorInput = panel.querySelector(`[data-theme-key="${textInputKey}"]`);
        if (colorInput) colorInput.value = value;
      }
    });

    document.getElementById('themeEditorClose').addEventListener('click', () => {
      panel.remove();
    });

    document.getElementById('themeEditorReset').addEventListener('click', () => {
      THEME_KEYS.forEach(key => {
        const value = theme[key] || '#000000';
        document.documentElement.style.setProperty(keyToCssVar(key), value);

        const colorInput = panel.querySelector(`[data-theme-key="${key}"]`);
        const textInput = panel.querySelector(`[data-theme-text="${key}"]`);

        if (colorInput) colorInput.value = value;
        if (textInput) textInput.value = value;
      });
    });

    document.getElementById('themeEditorSave').addEventListener('click', async () => {
    const payload = {};

    THEME_KEYS.forEach(key => {
        const input = panel.querySelector(`[data-theme-text="${key}"]`);
        if (input && /^#[0-9A-Fa-f]{6}$/.test(input.value)) {
        payload[key] = input.value;
        }
    });

    try {
        const res = await fetch('/api/dashboard/save_ui_theme.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
        });

        const json = await res.json();

        if (!json.ok) {
        alert('No se pudo guardar el tema visual');
        return;
        }

        window.UiThemeCurrent = payload;
        alert('Tema visual guardado correctamente');

    } catch (error) {
        console.error('Error guardando tema visual:', error);
        alert('Error al guardar el tema visual');
    }
    });
  }

  window.addEventListener('ui-theme-loaded', (e) => {
    createThemeEditor(e.detail || {});
  });
})();