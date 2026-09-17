(() => {
  const root = document.querySelector('[data-driver-page]');
  if (!root) return;

  const view = root.dataset.driverPage;
  const permissions = JSON.parse(root.dataset.permissions || '{}');
  const feedback = document.getElementById('driverFeedback');
  const statuses = {
    NO_ACTIVATION: 'Sin activación',
    PENDING_SEND: 'Código generado · pendiente de envío',
    SENT_PENDING_ACTIVATION: 'Código enviado · pendiente de activación',
    ACTIVATED: 'Activado',
    EXPIRED: 'Código vencido'
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
    feedback.textContent = message;
    feedback.className = `driver-feedback ${error ? 'is-error' : 'is-success'}`;
    feedback.hidden = false;
  }

  function clearMessage() {
    feedback.hidden = true;
    feedback.textContent = '';
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

  async function runAction(action, successText, after) {
    if (busy) return;
    clearMessage();
    setBusy(true);
    try {
      const result = await action();
      if (after) await after(result);
      showMessage(successText);
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

  function statusText(value) { return statuses[value] || 'Estado no disponible'; }

  function badge(text, tone) { return el('span', `driver-status ${tone}`, text); }

  function datum(label, value, node) {
    const box = el('div', 'driver-datum');
    box.append(el('span', 'driver-datum-label', label));
    box.append(node || el('strong', '', value == null || value === '' ? '—' : String(value)));
    return box;
  }

  async function copyCode(code) {
    try {
      await navigator.clipboard.writeText(code);
      showMessage('Código copiado.');
    } catch {
      showMessage('No se pudo copiar el código. Seleccionalo y copialo manualmente.', true);
    }
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

  function vehicleText(id) {
    return vehicles.find(vehicle => vehicle.id === Number(id))?.label || `Vehículo #${id}`;
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
    channel.querySelector('[value="email"]').disabled = !contact.mail;
    if (channel.value === 'whatsapp' && !contact.whatsapp || channel.value === 'email' && !contact.mail) channel.value = '';
    if (!channel.value && contact.whatsapp !== contact.mail) channel.value = contact.whatsapp ? 'whatsapp' : 'email';
    hint.textContent = select.value && !contact.whatsapp && !contact.mail
      ? 'Este destinatario no tiene teléfono ni email válido. Actualizá su ficha antes de generar.'
      : 'Los datos de contacto se toman de la ficha del destinatario y no se editan aquí.';
  }

  function validatePrepared(vehicle, recipient, channel) {
    if (!Number.isSafeInteger(Number(vehicle.value)) || Number(vehicle.value) <= 0) return 'Seleccioná un vehículo.';
    const driver = selectedDriver(recipient);
    if (!driver) return 'Seleccioná un destinatario.';
    const contact = contactState(driver);
    if (!contact.whatsapp && !contact.mail) return 'El destinatario no tiene un canal válido. Actualizá su ficha.';
    if (!['whatsapp', 'email', 'ambos'].includes(channel.value)) return 'Seleccioná un canal disponible.';
    if (channel.value === 'whatsapp' && !contact.whatsapp || channel.value === 'email' && !contact.mail
        || channel.value === 'ambos' && !(contact.whatsapp && contact.mail)) return 'El canal elegido no está disponible.';
    return '';
  }

  function updateIndividualContact(select, phone, email, channel, hint) {
    const contact = contactState(selectedDriver(select));
    phone.textContent = contact.whatsapp ? contact.phone : 'Sin teléfono disponible';
    email.textContent = contact.mail ? contact.email : 'Sin email disponible';
    channel.querySelector('[value="whatsapp"]').disabled = !contact.whatsapp;
    channel.querySelector('[value="email"]').disabled = !contact.mail;
    channel.querySelector('[value="ambos"]').disabled = !(contact.whatsapp && contact.mail);
    if (channel.selectedOptions[0]?.disabled) channel.value = '';
    if (!channel.value && contact.whatsapp !== contact.mail) channel.value = contact.whatsapp ? 'whatsapp' : 'email';
    hint.textContent = select.value && !contact.whatsapp && !contact.mail
      ? 'Este destinatario no tiene teléfono ni email válido. Actualizá su ficha antes de generar.'
      : 'Los datos de contacto se toman de la ficha del destinatario y no se editan aquí.';
  }

  function validateRecipientChannel(recipient, channel, allowBoth = false) {
    const driver = selectedDriver(recipient);
    if (!driver) return 'Seleccioná un destinatario.';
    const contact = contactState(driver);
    if (!contact.whatsapp && !contact.mail) return 'El destinatario no tiene un canal válido. Actualizá su ficha.';
    if (allowBoth && channel.value === 'ambos' && contact.whatsapp && contact.mail) return '';
    if (channel.value === 'whatsapp' && contact.whatsapp || channel.value === 'email' && contact.mail) return '';
    return 'Seleccioná un canal disponible.';
  }

  function fillDriverSelect(select) {
    drivers.forEach(driver => {
      const option = el('option', '', driver.name);
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

  function shortUuid(value) {
    const uuid = String(value || '');
    return uuid.length > 16 ? `${uuid.slice(0, 9)}…${uuid.slice(-5)}` : uuid;
  }

  async function initList() {
    const rows = document.getElementById('deviceRows');
    const cards = document.getElementById('deviceCards');
    const search = document.getElementById('deviceSearch');
    const activation = document.getElementById('activationFilter');
    const enabled = document.getElementById('enabledFilter');
    let devices;
    try { devices = await request('/api/driver/devices/list_devices.php'); }
    catch (error) {
      rows.replaceChildren();
      showMessage(error.message, true);
      return;
    }

    function render() {
      const query = search.value.trim().toLocaleLowerCase();
      const filtered = devices.filter(device => {
        const haystack = `${device.device_id} ${device.device_uuid} ${device.brand || ''} ${device.model || ''}`.toLocaleLowerCase();
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
        const nameCell = el('td');
        nameCell.append(el('strong', 'driver-device-id', `#${device.device_id}`), el('small', 'driver-subtext', shortUuid(device.device_uuid)));
        tr.append(nameCell);
        const enabledCell = el('td');
        enabledCell.append(badge(device.enabled ? 'Habilitado' : 'Deshabilitado', device.enabled ? 'is-good' : 'is-muted'));
        tr.append(enabledCell);
        const statusCell = el('td');
        statusCell.append(badge(statusText(device.administrative_status), device.administrative_status === 'ACTIVATED' ? 'is-good' : 'is-neutral'));
        tr.append(statusCell);
        const vehicleCell = el('td');
        vehicleCell.append(el('strong', 'driver-device-id', device.effective_vehicle_id ? `Efectivo #${device.effective_vehicle_id}` : device.target_vehicle_id ? `Objetivo #${device.target_vehicle_id}` : 'Sin vehículo'));
        if (device.effective_vehicle_patent) vehicleCell.append(el('small', 'driver-subtext', device.effective_vehicle_patent));
        tr.append(vehicleCell);
        tr.append(el('td', '', [device.brand, device.model].filter(Boolean).join(' / ') || '—'));
        tr.append(el('td', '', device.app_version || '—'));
        tr.append(el('td', '', device.expires_at ? `${dateText(device.used_at || device.activation_created_at)} / ${dateText(device.expires_at)}` : '—'));
        const actionCell = el('td');
        if (permissions.detail) {
          const link = el('a', 'driver-text-link', 'Ver / gestionar ↗');
          link.href = detailUrl(device.device_id);
          actionCell.append(link);
        }
        tr.append(actionCell);
        rows.append(tr);

        const card = el('article', 'driver-device-card');
        card.append(el('strong', '', `Device #${device.device_id}`), el('small', '', shortUuid(device.device_uuid)));
        card.append(badge(device.enabled ? 'Habilitado' : 'Deshabilitado', device.enabled ? 'is-good' : 'is-muted'));
        card.append(badge(statusText(device.administrative_status), 'is-neutral'));
        card.append(el('span', '', device.effective_vehicle_id ? `Vehículo efectivo #${device.effective_vehicle_id}${device.effective_vehicle_patent ? ` · ${device.effective_vehicle_patent}` : ''}` : device.target_vehicle_id ? `Vehículo objetivo #${device.target_vehicle_id}` : 'Sin vehículo'));
        card.append(el('span', '', [device.brand, device.model].filter(Boolean).join(' / ') || 'Sin datos técnicos'));
        card.append(el('span', '', `App: ${device.app_version || '—'}`));
        card.append(el('span', '', `Vence: ${dateText(device.expires_at)}`));
        if (permissions.detail) {
          const link = el('a', 'driver-text-link', 'Ver / gestionar ↗');
          link.href = detailUrl(device.device_id);
          card.append(link);
        }
        cards.append(card);
      });
    }
    [search, activation, enabled].forEach(input => input.addEventListener(input === search ? 'input' : 'change', render));
    render();
  }

  async function initCreate() {
    try {
      await Promise.all([loadVehicles(), loadDrivers()]);
    } catch (error) {
      showMessage(error.message, true);
      document.getElementById('createActivation').disabled = true;
      return;
    }
    const vehicle = document.getElementById('individualVehicle');
    const recipient = document.getElementById('individualRecipient');
    const phone = document.getElementById('individualPhone');
    const email = document.getElementById('individualEmail');
    const channel = document.getElementById('individualChannel');
    const hint = document.getElementById('individualContactHint');
    fillVehicleSelect(vehicle);
    fillDriverSelect(recipient);
    updateIndividualContact(recipient, phone, email, channel, hint);
    recipient.addEventListener('change', () => updateIndividualContact(recipient, phone, email, channel, hint));

    document.getElementById('createActivation').addEventListener('click', () => {
      const error = validatePrepared(vehicle, recipient, channel);
      if (error) { showMessage(error, true); return; }
      const prepared = { vehicleId: Number(vehicle.value), driverId: recipient.value, channel: channel.value };
      runAction(
        () => post('/api/driver/activation/create_activation.php', { vehicle_id: prepared.vehicleId }),
        'Código generado correctamente.',
        async result => {
          document.getElementById('individualPanel').hidden = true;
          await showCreatedItem(result, prepared);
        }
      );
    });
  }

  async function showCreatedItem(result, prepared) {
    const list = document.getElementById('createdItems');
    list.replaceChildren();
    document.getElementById('createResult').hidden = false;
    saveContact(result.device_id, prepared);
    const card = el('article', 'driver-result-item');
    card.append(el('h3', '', vehicleText(prepared.vehicleId)));
    const data = el('div', 'driver-data-grid');
    data.append(
      datum('Vehículo', vehicleText(prepared.vehicleId)),
      datum('Device ID', result.device_id),
      datum('Device UUID', result.device_uuid),
      datum('Activation ID', result.activation_id),
      datum('Código', result.activation_code),
      datum('Estado', statusText(result.administrative_status)),
      datum('Vencimiento', dateText(result.expires_at))
    );
    card.append(data);
    const actions = el('div', 'driver-actions');
    actions.append(actionButton('Copiar código', '', () => copyCode(result.activation_code)));
    if (permissions.detail) {
      const link = el('a', 'driver-button driver-button-primary', 'Ir a Detalle / gestión');
      link.href = detailUrl(result.device_id);
      actions.append(link);
    }
    card.append(actions);
    const delivery = el('div', 'driver-result-delivery');
    const content = el('div');
    if (permissions.send) {
      delivery.append(el('h3', '', 'Enviar código'), content);
      card.append(delivery);
    }
    list.append(card);
    try {
      const status = await request(`/api/driver/activation/get_activation_status.php?device_id=${result.device_id}`);
      data.querySelectorAll('.driver-datum')[5].lastChild.textContent = statusText(status.administrative_status);
      if (permissions.send) renderDelivery(status, content, async () => {
        const updated = await request(`/api/driver/activation/get_activation_status.php?device_id=${result.device_id}`);
        renderDelivery(updated, content, undefined, true);
      }, true);
    } catch {
      throw new Error('El código se generó, pero no se pudo actualizar su estado. Consultá el detalle antes de enviarlo.');
    }
  }

  function actionButton(label, className, action) {
    const button = el('button', `driver-button ${className}`, label);
    button.type = 'button';
    button.addEventListener('click', action);
    return button;
  }

  function renderDelivery(device, area = document.getElementById('codeContent'), onSent = () => refreshDetail(device.device_id), allowBoth = false) {
    area.replaceChildren();
    const activation = device.activation;
    const status = device.administrative_status;
    if (!activation || !['PENDING_SEND', 'SENT_PENDING_ACTIVATION'].includes(status)) {
      area.append(el('p', 'driver-hint', status === 'NO_ACTIVATION' ? 'Este device aún no tiene activación.' : 'No hay un código pendiente de entrega.'));
      return;
    }
    const code = el('code', 'driver-code', activation.activation_code);
    area.append(code);
    area.append(actionButton('Copiar código', '', () => copyCode(activation.activation_code)));
    const intro = el('p', 'driver-hint', 'Elegí el destinatario del código. Sus datos se toman de la ficha y no crean asociaciones.');
    area.append(intro);
    const fields = el('div', 'driver-form-grid');
    const selectLabel = el('label');
    selectLabel.append(el('span', '', 'Destinatario *'));
    const select = el('select');
    select.append(el('option', '', 'Seleccionar destinatario'));
    select.firstChild.value = '';
    fillDriverSelect(select);
    selectLabel.append(select);
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
    const channels = [['', 'Seleccionar canal'], ['whatsapp', 'WhatsApp'], ['email', 'Email']];
    if (allowBoth) channels.push(['ambos', 'Ambos']);
    channels.forEach(([value, title]) => {
      const option = el('option', '', title);
      option.value = value;
      channel.append(option);
    });
    channelLabel.append(channel);
    fields.append(selectLabel, phoneLabel, emailLabel, channelLabel);
    area.append(fields);
    const saved = contactFor(device.device_id);
    select.value = saved.driverId || '';
    const hint = el('p', 'driver-hint', 'El destinatario debe tener teléfono o email válido.');
    area.append(hint);
    updateContact(select, phone, email, channel, hint);
    if (allowBoth) channel.querySelector('[value="ambos"]').disabled = !(validPhone(phone.value) && validEmail(email.value));
    channel.value = saved.channel || channel.value;
    if (channel.selectedOptions[0]?.disabled) channel.value = '';
    if (allowBoth) {
      select.addEventListener('change', () => {
        updateContact(select, phone, email, channel, hint);
        channel.querySelector('[value="ambos"]').disabled = !(validPhone(phone.value) && validEmail(email.value));
        if (channel.value === 'ambos' && channel.querySelector('[value="ambos"]').disabled) channel.value = '';
      });
    } else {
      wireRecipient(select, phone, email, channel, hint);
    }
    [select, channel].forEach(input => input.addEventListener('change', () => saveContact(device.device_id, { driverId: select.value, channel: channel.value })));

    const actions = el('div', 'driver-actions');
    const message = `Tu código de activación TwyVox Driver es ${activation.activation_code}. Vence el ${dateText(activation.expires_at)}.`;
    const sendLink = el('a', 'driver-button', 'Abrir canal de envío ↗');
    sendLink.href = '#';
    const emailLink = allowBoth ? el('a', 'driver-button', 'Abrir email ↗') : null;
    if (emailLink) emailLink.href = '#';
    const updateSendLabel = () => {
      sendLink.textContent = channel.value === 'whatsapp' || channel.value === 'ambos' ? 'Abrir WhatsApp ↗' : channel.value === 'email' ? 'Abrir email ↗' : 'Elegir canal de envío';
      if (emailLink) emailLink.hidden = channel.value !== 'ambos';
    };
    channel.addEventListener('change', updateSendLabel);
    select.addEventListener('change', updateSendLabel);
    updateSendLabel();
    sendLink.addEventListener('click', event => {
      const error = validateRecipientChannel(select, channel, allowBoth);
      if (error) { event.preventDefault(); showMessage(error, true); return; }
      if (channel.value === 'whatsapp' || channel.value === 'ambos') {
        sendLink.href = `https://wa.me/${phone.value.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        sendLink.target = '_blank';
        sendLink.rel = 'noopener noreferrer';
      } else {
        sendLink.href = `mailto:${encodeURIComponent(email.value.trim())}?subject=${encodeURIComponent('Código de activación TwyVox Driver')}&body=${encodeURIComponent(message)}`;
        sendLink.removeAttribute('target');
      }
    });
    actions.append(sendLink);
    if (emailLink) {
      emailLink.addEventListener('click', event => {
        const error = validateRecipientChannel(select, channel, allowBoth);
        if (error) { event.preventDefault(); showMessage(error, true); return; }
        emailLink.href = `mailto:${encodeURIComponent(email.value.trim())}?subject=${encodeURIComponent('Código de activación TwyVox Driver')}&body=${encodeURIComponent(message)}`;
      });
      actions.append(emailLink);
    }
    area.append(actions);
    area.append(el('p', 'driver-hint', 'La apertura de WhatsApp o email no confirma la entrega. Registrala solo después de enviarlo o comunicarlo.'));
    if (status === 'PENDING_SEND' && permissions.send) {
      const label = el('label', 'driver-confirm-line');
      const check = el('input');
      check.type = 'checkbox';
      label.append(check, el('span', '', 'Confirmo que el código fue entregado al destinatario.'));
      area.append(label);
      area.append(actionButton('Registrar código enviado', 'driver-button-primary', () => {
        const error = validateRecipientChannel(select, channel, allowBoth);
        if (error) { showMessage(error, true); return; }
        if (!check.checked) { showMessage('Confirmá primero que el código fue entregado.', true); return; }
        runAction(() => post('/api/driver/activation/mark_activation_sent.php', { activation_id: activation.activation_id }), 'Envío registrado.', onSent);
      }));
    }
  }

  function renderDetail(device) {
    document.getElementById('detailContent').hidden = false;
    const identity = document.getElementById('identityData');
    identity.replaceChildren(
      datum('Device ID', device.device_id),
      datum('Device UUID', device.device_uuid),
      datum('Estado técnico', '', badge(device.enabled ? 'Habilitado' : 'Deshabilitado', device.enabled ? 'is-good' : 'is-muted')),
      datum('Marca', device.brand), datum('Modelo', device.model), datum('Versión de app', device.app_version)
    );
    const activation = device.activation;
    document.getElementById('activationData').replaceChildren(
      datum('Estado', '', badge(statusText(device.administrative_status), device.administrative_status === 'ACTIVATED' ? 'is-good' : 'is-neutral')),
      datum('Activation ID', activation?.activation_id),
      datum('Creada', dateText(activation?.created_at)),
      datum('Vence', dateText(activation?.expires_at)),
      datum('Enviada', dateText(activation?.sent_at)),
      datum('Activada / usada', dateText(activation?.used_at))
    );
    const target = device.target_vehicle;
    const effective = device.effective_vehicle;
    document.getElementById('vehicleData').replaceChildren(
      datum('Vehículo objetivo', target ? `${target.patent || `#${target.id}`} · ${[target.brand, target.model].filter(Boolean).join(' ')}` : device.activation?.vehicle_id ? `#${device.activation.vehicle_id}` : 'Sin vehículo objetivo'),
      datum('Vehículo efectivo', effective ? effective.patent || `#${effective.id}` : 'Aún no vinculado')
    );
    renderDelivery(device);
    const actions = document.getElementById('specialButtons');
    actions.replaceChildren();
    if (device.enabled && device.activation && permissions.regenerate) {
      actions.append(actionButton('Regenerar activación', '', () => {
        if (!window.confirm('El código anterior dejará de ser válido y se generará uno nuevo. ¿Continuar?')) return;
        runAction(() => post('/api/driver/activation/regenerate_activation.php', { device_id: device.device_id, confirm: true }), 'Nueva activación generada.', () => refreshDetail(device.device_id));
      }));
    }
    if (device.enabled && permissions.disable) {
      actions.append(actionButton('Deshabilitar device', 'driver-button-danger', () => {
        if (!window.confirm('¿Deshabilitar este device? La activación y las asociaciones se conservarán.')) return;
        runAction(() => post('/api/driver/devices/set_device_enabled.php', { device_id: device.device_id, enabled: false, confirm: true }), 'Device deshabilitado.', () => refreshDetail(device.device_id));
      }));
    } else if (!device.enabled && permissions.enable) {
      actions.append(actionButton('Habilitar device', '', () => {
        if (!window.confirm('¿Habilitar este device?')) return;
        runAction(() => post('/api/driver/devices/set_device_enabled.php', { device_id: device.device_id, enabled: true, confirm: true }), 'Device habilitado.', () => refreshDetail(device.device_id));
      }));
    }
    document.getElementById('specialActions').hidden = actions.children.length === 0;
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
      showMessage('Abrí un device desde el listado para ver su detalle.', true);
      return;
    }
    try { await refreshDetail(Number(initial)); }
    catch (error) { showMessage(error.message, true); }
  }

  if (view === 'devices') initList();
  if (view === 'nueva_activacion') initCreate();
  if (view === 'gestion_activacion') initDetail();
})();
