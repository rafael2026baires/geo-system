(() => {
  const root = document.querySelector('[data-driver-page]');
  if (!root) return;

  const view = root.dataset.driverPage;
  const permissions = JSON.parse(root.dataset.permissions || '{}');
  const feedback = document.getElementById('driverFeedback');
  const deliveryEmailEnabled = false;
  const statuses = {
    NO_ACTIVATION: 'Sin activación',
    PENDING_SEND: 'Pendiente de envío',
    DELIVERY_STARTED_PENDING_CONFIRMATION: 'Envío iniciado / pendiente de confirmación',
    SENT_PENDING_ACTIVATION: 'Pendiente de activación',
    ACTIVATED: 'Activado',
    EXPIRED: 'Vencido',
    CANCELLED: 'Cancelada'
  };
  let busy = false;
  let drivers = [];
  let vehicles = [];

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function showMessage(message, error = false) {
    const drawerFeedback = document.getElementById('deviceDrawerFeedback');
    const target = drawerFeedback && !document.getElementById('deviceDrawer').hidden ? drawerFeedback : feedback;
    target.textContent = message;
    target.className = `driver-feedback ${target === drawerFeedback ? 'admin-drawer-feedback ' : ''}${error ? 'is-error' : 'is-success'}`;
    target.hidden = false;
  }

  function clearMessage() {
    feedback.hidden = true;
    feedback.textContent = '';
    const drawerFeedback = document.getElementById('deviceDrawerFeedback');
    if (drawerFeedback) {
      drawerFeedback.hidden = true;
      drawerFeedback.textContent = '';
    }
  }

  async function request(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    let body;
    try { body = await response.json(); } catch { throw new Error('No se pudo leer la respuesta del servidor.'); }
    if (!response.ok || body.success !== true) {
      throw new Error(body.error?.message || body.error || 'No se pudo completar la operación.');
    }
    return body.data;
  }

  function post(path, body) {
    return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  function setBusy(value) {
    busy = value;
    root.querySelectorAll('button').forEach(button => { button.disabled = value; });
  }

  async function runAction(action, after) {
    if (busy) return;
    clearMessage();
    setBusy(true);
    try {
      const result = await action();
      if (after) await after(result);
      return result;
    } catch (error) {
      showMessage(error.message || 'No se pudo completar la operación.', true);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function dateText(value) {
    if (!value) return '—';
    const parsed = new Date(String(value).replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? String(value) : new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
  }

  function statusText(value, activation = null, compact = false) {
    if (value !== 'EXPIRED') return statuses[value] || 'Estado no disponible';
    if (activation?.sent_at != null) return 'Vencido — pendiente de activación';
    if (activation?.delivery_started_at != null) {
      return compact
        ? 'Vencido — envío iniciado'
        : 'Vencido — envío iniciado / pendiente de confirmación';
    }
    return 'Vencido — pendiente de envío';
  }

  function badge(text, tone) { return el('span', `driver-status ${tone}`, text); }

  function datum(label, value, node) {
    const box = el('div', 'driver-datum');
    box.append(el('span', 'driver-datum-label', label));
    box.append(node || el('strong', '', value == null || value === '' ? '—' : String(value)));
    return box;
  }

  async function copyCode(code, visibleCode, feedback = null) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(code);
        if (feedback) {
          feedback.icon.textContent = '✓';
          feedback.icon.className = 'driver-copy-status is-success';
          feedback.hint.hidden = true;
        }
        return;
      } catch { /* Continuar con el método alternativo. */ }
    }

    const temporary = document.createElement('textarea');
    temporary.value = code;
    temporary.readOnly = true;
    temporary.style.position = 'fixed';
    temporary.style.top = '-9999px';
    document.body.append(temporary);
    let copied = false;
    try {
      temporary.select();
      temporary.setSelectionRange(0, code.length);
      copied = document.execCommand?.('copy') === true;
    } catch { /* Preparar el código visible para copia manual. */ }
    temporary.remove();
    if (copied) {
      if (feedback) {
        feedback.icon.textContent = '✓';
        feedback.icon.className = 'driver-copy-status is-success';
        feedback.hint.hidden = true;
      }
      return;
    }

    const selection = window.getSelection();
    if (selection && visibleCode) {
      const range = document.createRange();
      range.selectNodeContents(visibleCode);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (feedback) {
      feedback.icon.textContent = '×';
      feedback.icon.className = 'driver-copy-status is-error';
      feedback.hint.hidden = false;
    } else showMessage('No se pudo copiar automáticamente. El código quedó seleccionado para copiarlo manualmente.', true);
  }

  async function loadDrivers() {
    try {
      drivers = await request('/api/catalogs/drivers/list_drivers.php');
    } catch {
      drivers = [];
      showMessage('No se pudo cargar la lista de destinatarios. Reintentá antes de generar la activación.', true);
    }
  }

  async function loadVehicles() {
    const catalog = await request('/api/driver/vehicles/list_activation_vehicles.php');
    vehicles = catalog.map(vehicle => ({
      id: Number(vehicle.id),
      label: [vehicle.patent, vehicle.guy, vehicle.brand, vehicle.model].filter(Boolean).join(' · ') || `Vehículo #${vehicle.id}`
    })).filter(vehicle => Number.isSafeInteger(vehicle.id) && vehicle.id > 0);
  }

  function fillVehicleSelect(select) {
    vehicles.forEach(vehicle => {
      const option = el('option', '', vehicle.label);
      option.value = vehicle.id;
      select.append(option);
    });
  }

  function selectedDriver(select) {
    return drivers.find(driver => String(driver.id) === select.value);
  }

  function validPhone(phone) { return String(phone || '').replace(/\D/g, '').length >= 8; }
  function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()); }

  function contactState(driver) {
    return { phone: driver?.phone || '', email: driver?.email || '', whatsapp: validPhone(driver?.phone), mail: validEmail(driver?.email) };
  }

  function updateContact(select, phone, email, channel, hint) {
    const contact = contactState(selectedDriver(select));
    phone.value = contact.phone;
    email.value = contact.email;
    channel.querySelector('[value="whatsapp"]').disabled = !contact.whatsapp;
    const emailOption = channel.querySelector('[value="email"]');
    if (emailOption) emailOption.disabled = !contact.mail;
    if (channel.value === 'whatsapp' && !contact.whatsapp || channel.value === 'email' && !contact.mail) channel.value = '';
    if (!channel.value && contact.whatsapp) channel.value = 'whatsapp';
    else if (!channel.value && deliveryEmailEnabled && contact.mail) channel.value = 'email';
    hint.textContent = select.value && !contact.whatsapp && (!deliveryEmailEnabled || !contact.mail)
      ? 'Este destinatario no tiene WhatsApp válido. Actualizá su ficha antes de generar.'
      : 'Los datos de contacto se toman de la ficha del destinatario y no se editan aquí.';
  }

  function validateRecipientChannel(recipient, channel, allowBoth = false) {
    const driver = selectedDriver(recipient);
    if (!driver) return 'Seleccioná un destinatario.';
    const contact = contactState(driver);
    if (!contact.whatsapp && (!deliveryEmailEnabled || !contact.mail)) return 'El destinatario no tiene un canal válido. Actualizá su ficha.';
    if (deliveryEmailEnabled && allowBoth && channel.value === 'ambos' && contact.whatsapp && contact.mail) return '';
    if (channel.value === 'whatsapp' && contact.whatsapp || deliveryEmailEnabled && channel.value === 'email' && contact.mail) return '';
    return 'Seleccioná un canal disponible.';
  }

  function fillDriverSelect(select) {
    drivers.forEach(driver => {
      const count = Number(driver.current_activation_count) || 0;
      const label = count > 0 ? `${driver.name} (${count} ${count === 1 ? 'activación' : 'activaciones'})` : driver.name;
      const option = el('option', '', label);
      option.value = driver.id;
      select.append(option);
    });
  }

  function wireRecipient(select, phone, email, channel, hint) {
    select.addEventListener('change', () => {
      updateContact(select, phone, email, channel, hint);
    });
  }

  function contactFor(deviceId) {
    try { return JSON.parse(sessionStorage.getItem(`driverContact:${deviceId}`) || '{}'); }
    catch { return {}; }
  }

  function saveContact(deviceId, contact) {
    sessionStorage.setItem(`driverContact:${deviceId}`, JSON.stringify({ driverId: contact.driverId, channel: contact.channel }));
  }

  function detailUrl(deviceId) {
    return `/admin/?section=driver&page=gestion_activacion&device_id=${encodeURIComponent(deviceId)}`;
  }

  async function initList() {
    const rows = document.getElementById('deviceRows');
    const cards = document.getElementById('deviceCards');
    const search = document.getElementById('deviceSearch');
    const activation = document.getElementById('activationFilter');
    const enabled = document.getElementById('enabledFilter');
    const refreshButton = document.getElementById('refreshDevices');
    const createButton = document.getElementById('openCreateActivation');
    let devices = [];
    let refreshingDevices = false;

    const deviceName = device => device.device_uuid;
    const vehiclePatent = device => device.effective_vehicle_patent || device.target_vehicle_patent || '—';
    const drawer = document.getElementById('deviceDrawer');
    const backdrop = document.getElementById('deviceDrawerBackdrop');
    const drawerBody = document.getElementById('deviceDrawerBody');
    const drawerTitle = document.getElementById('deviceDrawerTitle');
    const drawerSubtitle = document.getElementById('deviceDrawerSubtitle');
    const drawerClose = document.getElementById('deviceDrawerClose');
    let drawerOpener = null;
    let drawerRequest = 0;

    function drawerSection(title, fields) {
      const section = el('section', 'admin-drawer-section');
      section.append(el('h3', '', title));
      const list = el('dl', 'admin-drawer-data');
      fields.forEach(([label, value]) => {
        const row = el('div', 'admin-drawer-data-row');
        row.append(el('dt', '', label), el('dd', '', value == null || value === '' ? '—' : String(value)));
        list.append(row);
      });
      section.append(list);
      return section;
    }

    function closeDeviceDrawer() {
      if (drawer.hidden) return;
      drawerRequest++;
      drawer.hidden = true;
      backdrop.hidden = true;
      document.body.classList.remove('admin-drawer-open');
      drawerOpener?.focus();
      drawerOpener = null;
    }

    function openDrawer(opener, title, subtitle) {
      drawerOpener = opener;
      const requestId = ++drawerRequest;
      clearMessage();
      drawerTitle.textContent = title;
      drawerSubtitle.textContent = subtitle;
      drawerBody.replaceChildren(el('p', 'admin-drawer-message', 'Cargando detalle…'));
      backdrop.hidden = false;
      drawer.hidden = false;
      document.body.classList.add('admin-drawer-open');
      drawerClose.focus();
      return requestId;
    }

    async function openCreateActivationDrawer(opener) {
      const requestId = openDrawer(opener, 'Nueva activación', 'Generar una activación individual');
      const section = el('section', 'admin-drawer-section admin-drawer-create');
      const fields = el('div', 'driver-form-grid');
      const vehicleLabel = el('label');
      const vehicle = el('select');
      vehicle.append(el('option', '', 'Seleccionar vehículo'));
      vehicle.firstChild.value = '';
      vehicleLabel.append(el('span', '', 'Vehículo *'), vehicle);
      const recipientLabel = el('label');
      const recipient = el('select');
      recipient.append(el('option', '', 'Seleccionar destinatario'));
      recipient.firstChild.value = '';
      recipientLabel.append(el('span', '', 'Destinatario *'), recipient);
      fields.append(vehicleLabel, recipientLabel);
      const generate = actionButton('Generar activación', 'driver-button-primary', async () => {
        const vehicleId = Number(vehicle.value);
        const driver = selectedDriver(recipient);
        if (!Number.isSafeInteger(vehicleId) || vehicleId <= 0) {
          showMessage('Seleccioná un vehículo.', true);
          return;
        }
        if (!driver) {
          showMessage('Seleccioná un destinatario.', true);
          return;
        }
        if (busy) return;
        clearMessage();
        setBusy(true);
        try {
          await post('/api/driver/activation/create_activation.php', { vehicle_id: vehicleId, driver_id: Number(driver.id) });
          closeDeviceDrawer();
          const refreshed = await refreshDevices();
          if (!refreshed) showMessage('La activación se creó, pero no se pudo actualizar la grilla. Usá Actualizar.', true);
        } catch (error) {
          showMessage(error.message || 'No se pudo generar la activación.', true);
        } finally {
          setBusy(false);
        }
      });
      generate.disabled = true;
      section.append(fields, generate);
      drawerBody.replaceChildren(section);
      try {
        await Promise.all([loadVehicles(), loadDrivers()]);
        if (requestId !== drawerRequest) return;
        fillVehicleSelect(vehicle);
        fillDriverSelect(recipient);
        generate.disabled = false;
      } catch (error) {
        if (requestId === drawerRequest) showMessage(error.message || 'No se pudieron cargar los datos para crear la activación.', true);
      }
    }

    function renderManagedContent(detail, device, openDelivery = false) {
      const current = detail.activation;
      const vehicle = detail.effective_vehicle || detail.target_vehicle;
      const context = [
        ['Dispositivo', detail.device_uuid],
        ['Vehículo', vehicle?.patent || (current?.vehicle_id ? `#${current.vehicle_id}` : '—')],
        ['Destinatario', current?.recipient?.name || 'No registrado'],
        ['Activación', statusText(detail.administrative_status, current)]
      ];
      const expanded = [];
      if (detail.brand) expanded.push(['Marca', detail.brand]);
      if (detail.model) expanded.push(['Modelo', detail.model]);
      if (detail.app_version) expanded.push(['Versión de app', detail.app_version]);
      if (current?.created_at) expanded.push(['Creada', dateText(current.created_at)]);
      if (current?.sent_at) expanded.push(['Enviada', dateText(current.sent_at)]);
      if (current?.expires_at && detail.administrative_status !== 'ACTIVATED') expanded.push(['Vencimiento', dateText(current.expires_at)]);
      if (current?.used_at) expanded.push(['Activada', dateText(current.used_at)]);
      if (current?.cancelled_at) expanded.push(['Cancelada', dateText(current.cancelled_at)]);
      if (current?.recipient?.phone) expanded.push(['Teléfono / WhatsApp', current.recipient.phone]);
      if (current?.recipient?.email) expanded.push(['Email', current.recipient.email]);
      if (detail.administrative_status === 'SENT_PENDING_ACTIVATION' && current?.activation_code) {
        expanded.push(['Código de activación', current.activation_code]);
      }
      const action = el('section', 'admin-drawer-section admin-drawer-action');
      action.append(el('h3', '', 'Acción contextual'));
      const restartDeliveryManagement = async () => {
        if (busy) return;
        clearMessage();
        setBusy(true);
        try {
          await post('/api/driver/activation/restart_delivery_management.php', { activation_id: current.activation_id });
          const updated = await request(`/api/driver/activation/get_activation_status.php?device_id=${encodeURIComponent(device.device_id)}`);
          device.administrative_status = updated.administrative_status;
          device.delivery_started_at = updated.activation?.delivery_started_at ?? null;
          device.sent_at = updated.activation?.sent_at ?? null;
          renderManagedContent(updated, device);
        } catch (error) {
          showMessage(error.message || 'No se pudo reiniciar la gestión de envío.', true);
        } finally {
          setBusy(false);
        }
      };
      const restartDeliveryAction = () => {
        const group = el('div', 'admin-drawer-secondary-action');
        group.append(actionButton('Reiniciar gestión de envío', 'driver-inline-action', restartDeliveryManagement));
        return group;
      };
      const cancelActivationAction = () => {
        const group = el('div', 'admin-drawer-destructive-action');
        const showTrigger = () => {
          group.replaceChildren(actionButton('Cancelar activación', 'driver-inline-action driver-inline-danger', showConfirmation));
        };
        const showConfirmation = () => {
          const confirmation = el('div', 'admin-drawer-cancel-confirmation');
          confirmation.append(
            el('strong', '', '¿Cancelar esta activación?'),
            el('p', 'driver-hint', 'El código dejará de ser válido y esta activación quedará cerrada.')
          );
          const buttons = el('div', 'driver-actions');
          buttons.append(
            actionButton('Cancelar activación', 'driver-button-danger', async () => {
              if (busy) return;
              clearMessage();
              setBusy(true);
              try {
                await post('/api/driver/activation/cancel_activation.php', { activation_id: current.activation_id });
                const updated = await request(`/api/driver/activation/get_activation_status.php?device_id=${encodeURIComponent(device.device_id)}`);
                device.administrative_status = updated.administrative_status;
                device.delivery_started_at = updated.activation?.delivery_started_at ?? null;
                device.sent_at = updated.activation?.sent_at ?? null;
                renderManagedContent(updated, device);
                await refreshDevices();
              } catch (error) {
                showMessage(error.message || 'No se pudo cancelar la activación.', true);
              } finally {
                setBusy(false);
              }
            }),
            actionButton('Volver', '', showTrigger)
          );
          confirmation.append(buttons);
          group.replaceChildren(confirmation);
        };
        showTrigger();
        return group;
      };
      if (detail.administrative_status === 'PENDING_SEND' && permissions.send) {
        const content = el('div', 'admin-drawer-delivery');
        action.append(actionButton('Entregar código', 'driver-button-primary', () => {
          content.hidden = !content.hidden;
        }), content);
        content.hidden = !openDelivery;
        renderDelivery(detail, content, async () => {
          const updated = await request(`/api/driver/activation/get_activation_status.php?device_id=${encodeURIComponent(device.device_id)}`);
          device.administrative_status = updated.administrative_status;
          device.sent_at = updated.activation?.sent_at ?? null;
          closeDeviceDrawer();
          render();
        }, false, true, true, true, true, result => {
          detail.administrative_status = result.administrative_status;
          detail.activation.delivery_started_at = result.delivery_started_at;
          device.administrative_status = result.administrative_status;
          device.delivery_started_at = result.delivery_started_at;
          renderManagedContent(detail, device);
        });
      } else if (detail.administrative_status === 'DELIVERY_STARTED_PENDING_CONFIRMATION' && permissions.send) {
        action.append(el('p', 'driver-hint', '¿El código fue enviado?'));
        const refreshAfterDecision = async () => {
          const updated = await request(`/api/driver/activation/get_activation_status.php?device_id=${encodeURIComponent(device.device_id)}`);
          device.administrative_status = updated.administrative_status;
          device.sent_at = updated.activation?.sent_at ?? null;
          renderManagedContent(updated, device);
          await refreshDevices();
        };
        action.append(
          actionButton('Sí, el código fue enviado', 'driver-button-primary', () => confirmDelivery(detail.activation, refreshAfterDecision)),
          actionButton('No, el código no se envió', '', async () => {
            if (busy) return;
            clearMessage();
            setBusy(true);
            try {
              await post('/api/driver/activation/reset_delivery_started.php', { activation_id: detail.activation.activation_id });
              const updated = await request(`/api/driver/activation/get_activation_status.php?device_id=${encodeURIComponent(device.device_id)}`);
              device.administrative_status = updated.administrative_status;
              device.delivery_started_at = updated.activation?.delivery_started_at ?? null;
              renderManagedContent(updated, device);
              await refreshDevices();
            } catch (error) {
              showMessage(error.message || 'No se pudo revertir el inicio del envío.', true);
            } finally {
              setBusy(false);
            }
          }),
          restartDeliveryAction()
        );
      } else if (detail.administrative_status === 'SENT_PENDING_ACTIVATION') {
        action.append(restartDeliveryAction());
      } else if (detail.administrative_status === 'EXPIRED' && permissions.regenerate) {
        action.append(actionButton('Renovar activación', 'driver-button-primary', async () => {
          if (busy) return;
          clearMessage();
          setBusy(true);
          try {
            await post('/api/driver/activation/regenerate_activation.php', { device_id: device.device_id, confirm: true });
            const updated = await request(`/api/driver/activation/get_activation_status.php?device_id=${encodeURIComponent(device.device_id)}`);
            device.administrative_status = updated.administrative_status;
            device.delivery_started_at = updated.activation?.delivery_started_at ?? null;
            device.sent_at = updated.activation?.sent_at ?? null;
            renderManagedContent(updated, device, true);
            await refreshDevices();
          } catch (error) {
            showMessage(error.message || 'No se pudo renovar la activación.', true);
          } finally {
            setBusy(false);
          }
        }));
      } else if (detail.administrative_status === 'CANCELLED') {
        action.append(el('p', 'driver-hint', 'Esta activación fue cancelada.'));
      } else {
        action.append(el('p', 'driver-hint', 'Sin acción operativa disponible.'));
      }
      if (permissions.cancel && ['PENDING_SEND', 'DELIVERY_STARTED_PENDING_CONFIRMATION', 'SENT_PENDING_ACTIVATION'].includes(detail.administrative_status)) {
        action.append(cancelActivationAction());
      }
      drawerBody.replaceChildren(drawerSection('Contexto', context), drawerSection('Detalle', expanded), action);
    }

    async function openDeviceDrawer(device, opener) {
      const requestId = openDrawer(opener, 'Gestionar', deviceName(device));
      try {
        const detail = await request(`/api/driver/activation/get_activation_status.php?device_id=${encodeURIComponent(device.device_id)}`);
        if (requestId !== drawerRequest) return;
        renderManagedContent(detail, device);
      } catch (error) {
        if (requestId === drawerRequest) drawerBody.replaceChildren(el('p', 'admin-drawer-message is-error', error.message || 'No se pudo cargar el detalle.'));
      }
    }

    drawerClose.addEventListener('click', closeDeviceDrawer);
    backdrop.addEventListener('click', closeDeviceDrawer);
    document.addEventListener('keydown', event => {
      if (drawer.hidden) return;
      if (event.key === 'Escape') closeDeviceDrawer();
      if (event.key === 'Tab') {
        const focusable = [...drawer.querySelectorAll('a[href], button:not([disabled]), select:not([disabled]), input:not([disabled])')]
          .filter(node => !node.hidden && node.getClientRects().length);
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    function manageLink(device) {
      const link = el('a', 'driver-text-link', 'Gestionar');
      link.href = detailUrl(device.device_id);
      link.addEventListener('click', event => {
        event.preventDefault();
        openDeviceDrawer(device, link);
      });
      return link;
    }

    function render() {
      const query = search.value.trim().toLocaleLowerCase();
      const filtered = devices.filter(device => {
        const haystack = `${device.device_id} ${device.device_uuid} ${vehiclePatent(device)} ${device.recipient_name || ''} ${device.brand || ''} ${device.model || ''}`.toLocaleLowerCase();
        return (!query || haystack.includes(query))
          && (!activation.value || device.administrative_status === activation.value)
          && (!enabled.value || (device.enabled ? 'enabled' : 'disabled') === enabled.value);
      });
      rows.replaceChildren();
      cards.replaceChildren();
      document.getElementById('deviceCount').textContent = `${filtered.length} / ${devices.length}`;
      document.getElementById('deviceEmpty').hidden = filtered.length !== 0;
      filtered.forEach(device => {
        const tr = el('tr');
        const deviceCell = el('td');
        deviceCell.append(el('strong', 'driver-device-name', deviceName(device)));
        tr.append(deviceCell);
        const statusCell = el('td');
        statusCell.append(badge(statusText(device.administrative_status, device, true), device.administrative_status === 'ACTIVATED' ? 'is-good' : 'is-neutral'));
        tr.append(statusCell);
        const enabledCell = el('td', 'driver-enablement');
        enabledCell.append(badge(device.enabled ? 'Habilitado' : 'Deshabilitado', device.enabled ? 'is-good' : 'is-muted'));
        tr.append(enabledCell);
        tr.append(el('td', '', vehiclePatent(device)));
        tr.append(el('td', '', device.recipient_name || 'No registrado'));
        const manageCell = el('td');
        if (permissions.detail) manageCell.append(manageLink(device));
        tr.append(manageCell);
        rows.append(tr);

        const card = el('article', 'driver-device-card');
        card.append(el('strong', '', deviceName(device)));
        card.append(badge(statusText(device.administrative_status, device, true), 'is-neutral'));
        const cardEnablement = el('div', 'driver-enablement');
        cardEnablement.append(badge(device.enabled ? 'Habilitado' : 'Deshabilitado', device.enabled ? 'is-good' : 'is-muted'));
        card.append(cardEnablement);
        card.append(el('span', '', `Vehículo: ${vehiclePatent(device)}`), el('span', '', `Destinatario: ${device.recipient_name || 'No registrado'}`));
        if (permissions.detail) {
          card.append(manageLink(device));
        }
        cards.append(card);
      });
    }
    async function refreshDevices(initialLoad = false) {
      if (refreshingDevices) return false;
      refreshingDevices = true;
      refreshButton.disabled = true;
      refreshButton.textContent = 'Actualizando…';
      try {
        devices = await request('/api/driver/devices/list_devices.php');
        render();
        return true;
      } catch (error) {
        if (initialLoad) rows.replaceChildren();
        showMessage(error.message, true);
        return false;
      } finally {
        refreshingDevices = false;
        refreshButton.disabled = false;
        refreshButton.textContent = 'Actualizar';
      }
    }
    function changeEnabled(device) {
      const next = !device.enabled;
      if (!window.confirm(next ? '¿Habilitar este dispositivo?' : '¿Deshabilitar este dispositivo? La activación y las asociaciones se conservarán.')) return;
      runAction(
        () => post('/api/driver/devices/set_device_enabled.php', { device_id: device.device_id, enabled: next, confirm: true }),
        () => { device.enabled = next; render(); }
      );
    }
    [search, activation, enabled].forEach(input => input.addEventListener(input === search ? 'input' : 'change', render));
    refreshButton.addEventListener('click', () => refreshDevices());
    if (createButton) createButton.addEventListener('click', () => openCreateActivationDrawer(createButton));
    await refreshDevices(true);
  }

  function actionButton(label, className, action) {
    const button = el('button', `driver-button ${className}`, label);
    button.type = 'button';
    button.addEventListener('click', action);
    return button;
  }

  function confirmDelivery(activation, onSent) {
    runAction(() => post('/api/driver/activation/mark_activation_sent.php', { activation_id: activation.activation_id }), onSent);
  }

  async function openDeliveryChannel(url, activation, onStarted) {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    try {
      const result = await post('/api/driver/activation/mark_delivery_started.php', { activation_id: activation.activation_id });
      if (onStarted) onStarted(result);
      if (popup) popup.location.href = url;
      else window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      if (popup) popup.close();
      showMessage(error.message || 'No se pudo registrar el inicio del envío.', true);
    }
  }

  function renderDelivery(device, area = document.getElementById('codeContent'), onSent = () => refreshDetail(device.device_id), allowBoth = false, showExpiry = false, fixedRecipient = false, independentChannels = false, hideConfirmation = false, onStarted = null) {
    area.replaceChildren();
    const activation = device.activation;
    const status = device.administrative_status;
    if (!activation || !['PENDING_SEND', 'DELIVERY_STARTED_PENDING_CONFIRMATION', 'SENT_PENDING_ACTIVATION'].includes(status)) {
      area.append(el('p', 'driver-hint', status === 'NO_ACTIVATION' ? 'Este dispositivo aún no tiene activación.' : 'No hay un código pendiente de entrega.'));
      return;
    }
    const code = el('code', 'driver-code', activation.activation_code);
    area.append(code);
    if (!independentChannels) {
      area.append(actionButton('Copiar código', '', () => copyCode(activation.activation_code, code)));
    }
    if (showExpiry) area.append(el('p', 'driver-hint', `Vence: ${dateText(activation.expires_at)}`));
    if (independentChannels) {
      area.classList.add('driver-delivery-choices');
      const recipient = activation.recipient;
      const contact = contactState(recipient);
      const fields = el('div', 'driver-delivery-contact');
      const contactFields = [['Destinatario', recipient?.name || 'No registrado'], ['Teléfono / WhatsApp', contact.phone || 'No disponible']];
      if (deliveryEmailEnabled) contactFields.push(['Email', contact.email || 'No disponible']);
      contactFields.forEach(([label, value]) => {
        const row = el('div');
        row.append(el('span', '', label), el('strong', '', value));
        fields.append(row);
      });
      area.append(fields);
      const channelFlow = el('div', 'driver-delivery-channel-flow');
      const channels = el('div', 'driver-delivery-channels');
      const availableChannels = [['WhatsApp', contact.whatsapp]];
      if (deliveryEmailEnabled) availableChannels.push(['Email', contact.mail]);
      const choices = availableChannels.map(([label, available]) => {
        const choice = el('label');
        const input = el('input');
        input.type = 'checkbox';
        input.disabled = !available || !recipient;
        choice.append(input, el('span', '', label));
        channels.append(choice);
        return input;
      });
      channelFlow.append(channels);
      const message = activation.activation_code;
      const links = el('div', 'driver-actions');
      const whatsapp = el('a', 'driver-button', 'Abrir WhatsApp');
      whatsapp.href = `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      whatsapp.target = '_blank';
      whatsapp.rel = 'noopener noreferrer';
      const mail = deliveryEmailEnabled ? el('a', 'driver-button', 'Abrir email') : null;
      if (mail) mail.href = `mailto:${encodeURIComponent(contact.email.trim())}?subject=${encodeURIComponent('TwyVox Driver — Código de activación')}&body=${encodeURIComponent(message)}`;
      const openedChannels = choices.map(() => false);
      const continueAfterOpening = (index, result) => {
        openedChannels[index] = true;
        const allSelectedChannelsOpened = choices.every((choice, choiceIndex) => !choice.checked || openedChannels[choiceIndex]);
        if (allSelectedChannelsOpened && onStarted) onStarted(result);
      };
      whatsapp.addEventListener('click', event => {
        event.preventDefault();
        openDeliveryChannel(whatsapp.href, activation, result => continueAfterOpening(0, result));
      });
      if (mail) {
        mail.addEventListener('click', event => {
          event.preventDefault();
          openDeliveryChannel(mail.href, activation, result => continueAfterOpening(1, result));
        });
      }
      links.append(whatsapp);
      if (mail) links.append(mail);
      channelFlow.append(links);
      const instruction = el('p', 'driver-hint', 'Después de enviar el código, confirmá el envío en TwyVox.');
      channelFlow.append(instruction);
      area.append(channelFlow);
      const confirm = actionButton('Confirmar envío', 'driver-button-primary', () => {
        if (!recipient) { showMessage('Esta activación no tiene un destinatario registrado.', true); return; }
        if (!choices.some(choice => choice.checked)) { showMessage('Seleccioná WhatsApp para registrar el envío.', true); return; }
        confirmDelivery(activation, onSent);
      });
      if (!hideConfirmation) area.append(confirm);
      const updateChoices = () => {
        whatsapp.hidden = !choices[0].checked;
        if (mail) mail.hidden = !choices[1].checked;
        const selected = choices.some(choice => choice.checked);
        links.hidden = !selected;
        instruction.hidden = !selected;
        if (!hideConfirmation) confirm.hidden = !selected;
      };
      choices.forEach(choice => choice.addEventListener('change', updateChoices));
      updateChoices();
      return channelFlow;
    }
    const intro = el('p', 'driver-hint', fixedRecipient ? 'Enviá el código al destinatario indicado.' : status === 'SENT_PENDING_ACTIVATION'
      ? 'Podés reenviar el código al destinatario. Sus datos se toman de la ficha y no crean asociaciones.'
      : 'Elegí el destinatario del código. Sus datos se toman de la ficha y no crean asociaciones.');
    area.append(intro);
    const fields = el('div', 'driver-form-grid');
    const selectLabel = el('label');
    selectLabel.append(el('span', '', fixedRecipient ? 'Destinatario' : 'Destinatario *'));
    const saved = fixedRecipient ? {} : contactFor(device.device_id);
    const select = fixedRecipient ? el('input') : el('select');
    if (fixedRecipient) {
      select.value = String(activation.driver_id || '');
      const recipientName = el('input');
      recipientName.readOnly = true;
      recipientName.value = activation.recipient?.name || 'Destinatario no registrado';
      selectLabel.append(recipientName);
    } else {
      select.append(el('option', '', 'Seleccionar destinatario'));
      select.firstChild.value = '';
      fillDriverSelect(select);
      select.value = saved.driverId || '';
      selectLabel.append(select);
    }
    const phoneLabel = el('label');
    phoneLabel.append(el('span', '', 'Teléfono / WhatsApp'));
    const phone = el('input');
    phone.type = 'tel';
    phone.readOnly = true;
    phoneLabel.append(phone);
    const emailLabel = el('label');
    emailLabel.append(el('span', '', 'Email'));
    const email = el('input');
    email.type = 'email';
    email.readOnly = true;
    emailLabel.append(email);
    const channelLabel = el('label');
    channelLabel.append(el('span', '', 'Canal *'));
    const channel = el('select');
    const channels = [['', 'Seleccionar canal'], ['whatsapp', 'WhatsApp']];
    if (deliveryEmailEnabled) channels.push(['email', 'Email']);
    if (deliveryEmailEnabled && allowBoth) channels.push(['ambos', 'Ambos']);
    channels.forEach(([value, title]) => {
      const option = el('option', '', title);
      option.value = value;
      channel.append(option);
    });
    channelLabel.append(channel);
    fields.append(selectLabel, phoneLabel);
    if (deliveryEmailEnabled) fields.append(emailLabel);
    fields.append(channelLabel);
    area.append(fields);
    const hint = el('p', 'driver-hint', 'El destinatario debe tener WhatsApp válido.');
    area.append(hint);
    if (fixedRecipient) {
      const contact = contactState(activation.recipient);
      phone.value = contact.phone;
      email.value = contact.email;
      channel.querySelector('[value="whatsapp"]').disabled = !contact.whatsapp;
      const emailOption = channel.querySelector('[value="email"]');
      if (emailOption) emailOption.disabled = !contact.mail;
      hint.textContent = activation.recipient ? 'Los datos de contacto se toman de la ficha del destinatario y no se editan aquí.' : 'Esta activación no tiene un destinatario registrado.';
      if (contact.whatsapp) channel.value = 'whatsapp';
      else if (deliveryEmailEnabled && contact.mail) channel.value = 'email';
    } else {
      updateContact(select, phone, email, channel, hint);
    }
    if (deliveryEmailEnabled && allowBoth) channel.querySelector('[value="ambos"]').disabled = !(validPhone(phone.value) && validEmail(email.value));
    if (!fixedRecipient && [...channel.options].some(option => option.value === saved.channel)) channel.value = saved.channel;
    if (channel.selectedOptions[0]?.disabled) channel.value = '';
    if (!fixedRecipient && deliveryEmailEnabled && allowBoth) {
      select.addEventListener('change', () => {
        updateContact(select, phone, email, channel, hint);
        channel.querySelector('[value="ambos"]').disabled = !(validPhone(phone.value) && validEmail(email.value));
        if (channel.value === 'ambos' && channel.querySelector('[value="ambos"]').disabled) channel.value = '';
      });
    } else if (!fixedRecipient) {
      wireRecipient(select, phone, email, channel, hint);
    }
    if (!fixedRecipient) [select, channel].forEach(input => input.addEventListener('change', () => saveContact(device.device_id, { driverId: select.value, channel: channel.value })));

    const deliveryError = () => {
      if (!fixedRecipient) return validateRecipientChannel(select, channel, allowBoth);
      if (!activation.recipient) return 'Esta activación no tiene un destinatario registrado.';
      const contact = contactState(activation.recipient);
      if (channel.value === 'whatsapp' && contact.whatsapp || deliveryEmailEnabled && channel.value === 'email' && contact.mail) return '';
      return 'Seleccioná un canal disponible.';
    };

    const actions = el('div', 'driver-actions');
    const message = activation.activation_code;
    const sendLink = el('a', 'driver-button', 'Abrir canal de envío ↗');
    sendLink.href = '#';
    const emailLink = deliveryEmailEnabled && allowBoth ? el('a', 'driver-button', status === 'SENT_PENDING_ACTIVATION' ? 'Reenviar por email ↗' : 'Abrir email ↗') : null;
    if (emailLink) emailLink.href = '#';
    const updateSendLabel = () => {
      const prefix = status === 'SENT_PENDING_ACTIVATION' ? 'Reenviar por ' : 'Abrir ';
      sendLink.textContent = channel.value === 'whatsapp' || channel.value === 'ambos' ? `${prefix}WhatsApp ↗` : channel.value === 'email' ? `${prefix}email ↗` : 'Elegir canal de envío';
      if (emailLink) emailLink.hidden = channel.value !== 'ambos';
    };
    channel.addEventListener('change', updateSendLabel);
    select.addEventListener('change', updateSendLabel);
    updateSendLabel();
    sendLink.addEventListener('click', event => {
      const error = deliveryError();
      if (error) { event.preventDefault(); showMessage(error, true); return; }
      if (channel.value === 'whatsapp' || channel.value === 'ambos') {
        sendLink.href = `https://wa.me/${phone.value.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        sendLink.target = '_blank';
        sendLink.rel = 'noopener noreferrer';
      } else {
        sendLink.href = `mailto:${encodeURIComponent(email.value.trim())}?subject=${encodeURIComponent('TwyVox Driver — Código de activación')}&body=${encodeURIComponent(message)}`;
        sendLink.removeAttribute('target');
      }
    });
    actions.append(sendLink);
    if (emailLink) {
      emailLink.addEventListener('click', event => {
        const error = deliveryError();
        if (error) { event.preventDefault(); showMessage(error, true); return; }
        emailLink.href = `mailto:${encodeURIComponent(email.value.trim())}?subject=${encodeURIComponent('TwyVox Driver — Código de activación')}&body=${encodeURIComponent(message)}`;
      });
      actions.append(emailLink);
    }
    area.append(actions);
    area.append(el('p', 'driver-hint', 'La apertura de WhatsApp no confirma la entrega. Registrala solo después de enviarlo o comunicarlo.'));
    if (status === 'PENDING_SEND' && permissions.send) {
      let check;
      if (!fixedRecipient) {
        const label = el('label', 'driver-confirm-line');
        check = el('input');
        check.type = 'checkbox';
        label.append(check, el('span', '', 'Confirmo que el código fue entregado al destinatario.'));
        area.append(label);
      }
      area.append(actionButton('Registrar código enviado', 'driver-button-primary', () => {
        const error = deliveryError();
        if (error) { showMessage(error, true); return; }
        if (check && !check.checked) { showMessage('Confirmá primero que el código fue entregado.', true); return; }
        runAction(() => post('/api/driver/activation/mark_activation_sent.php', { activation_id: activation.activation_id }), onSent);
      }));
    }
  }

  function renderDetail(device) {
    document.getElementById('detailContent').hidden = false;
    const name = [device.brand, device.model].filter(Boolean).join(' ') || '—';
    document.getElementById('deviceHeading').textContent = name;
    const identity = document.getElementById('identityData');
    identity.replaceChildren(
      datum('UUID', device.device_uuid),
      datum('Marca', device.brand),
      datum('Modelo', device.model),
      datum('Versión de app', device.app_version),
      datum('Vehículo asociado', device.effective_vehicle?.patent || '—'),
      datum('Habilitación', '', badge(device.enabled ? 'Habilitado' : 'Deshabilitado', device.enabled ? 'is-good' : 'is-muted'))
    );
    const activation = device.activation;
    const activationData = [datum('Estado', '', badge(statusText(device.administrative_status), device.administrative_status === 'ACTIVATED' ? 'is-good' : 'is-neutral'))];
    if (activation?.created_at) activationData.push(datum('Generada', dateText(activation.created_at)));
    if (activation?.sent_at) activationData.push(datum('Enviada', dateText(activation.sent_at)));
    if (activation?.used_at) activationData.push(datum('Activada', dateText(activation.used_at)));
    if (activation?.expires_at && device.administrative_status !== 'ACTIVATED') activationData.push(datum('Vencimiento', dateText(activation.expires_at)));
    if (device.target_vehicle) activationData.push(datum('Vehículo previsto', [device.target_vehicle.patent, device.target_vehicle.brand, device.target_vehicle.model].filter(Boolean).join(' · ')));
    document.getElementById('activationData').replaceChildren(...activationData);
    const primary = document.getElementById('primaryAction');
    const delivery = document.getElementById('codeContent');
    primary.replaceChildren();
    delivery.replaceChildren();
    if (device.administrative_status === 'PENDING_SEND') {
      primary.append(el('p', 'driver-panel-intro', 'Entregá el código y registrá el envío cuando se haya realizado.'));
      renderDelivery(device);
    } else if (device.administrative_status === 'SENT_PENDING_ACTIVATION') {
      primary.append(el('p', 'driver-info', 'El código ya fue entregado. Se espera la activación del dispositivo.'));
      renderDelivery(device);
    } else if (device.administrative_status === 'ACTIVATED') {
      primary.append(el('p', 'driver-info', 'Dispositivo activado.'));
    } else if (device.administrative_status === 'EXPIRED' && device.enabled && permissions.regenerate) {
      primary.append(actionButton('Renovar activación', 'driver-button-primary', () => regenerate(device)));
    } else if (device.administrative_status === 'NO_ACTIVATION') {
      primary.append(el('p', 'driver-panel-intro', 'Este dispositivo todavía no tiene una activación.'));
    } else if (!device.enabled) {
      primary.append(el('p', 'driver-info', 'Habilitá el dispositivo para continuar con la activación.'));
    }
    const actions = document.getElementById('specialButtons');
    actions.replaceChildren();
    if (device.enabled && device.activation && permissions.regenerate && device.administrative_status !== 'EXPIRED') {
      actions.append(actionButton('Regenerar activación', '', () => regenerate(device)));
    }
    if (device.enabled && permissions.disable) {
      actions.append(actionButton('Deshabilitar dispositivo', 'driver-button-danger', () => {
        if (!window.confirm('¿Deshabilitar este dispositivo? La activación y las asociaciones se conservarán.')) return;
        runAction(() => post('/api/driver/devices/set_device_enabled.php', { device_id: device.device_id, enabled: false, confirm: true }), () => refreshDetail(device.device_id));
      }));
    } else if (!device.enabled && permissions.enable) {
      actions.append(actionButton('Habilitar dispositivo', '', () => {
        if (!window.confirm('¿Habilitar este dispositivo?')) return;
        runAction(() => post('/api/driver/devices/set_device_enabled.php', { device_id: device.device_id, enabled: true, confirm: true }), () => refreshDetail(device.device_id));
      }));
    }
    document.getElementById('specialActions').hidden = actions.children.length === 0;
  }

  function regenerate(device) {
    if (!window.confirm('El código anterior dejará de ser válido y se generará uno nuevo. ¿Continuar?')) return;
    runAction(() => post('/api/driver/activation/regenerate_activation.php', { device_id: device.device_id, confirm: true }), () => refreshDetail(device.device_id));
  }

  async function refreshDetail(deviceId) {
    const device = await request(`/api/driver/activation/get_activation_status.php?device_id=${encodeURIComponent(deviceId)}`);
    renderDetail(device);
  }

  async function initDetail() {
    await loadDrivers();
    const params = new URLSearchParams(window.location.search);
    const initial = params.get('device_id');
    if (initial === null || !/^\d+$/.test(initial) || !Number.isSafeInteger(Number(initial)) || Number(initial) <= 0) {
      showMessage('Abrí un dispositivo desde el listado para ver su detalle.', true);
      return;
    }
    try { await refreshDetail(Number(initial)); }
    catch (error) { showMessage(error.message, true); }
  }

  if (view === 'devices') initList();
  if (view === 'gestion_activacion') initDetail();
})();
