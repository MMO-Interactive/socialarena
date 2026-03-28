(() => {
  const templatesEl = document.getElementById('gpu-templates');
  const deployEl = document.getElementById('gpu-deploy-grid');
  const searchInput = document.getElementById('gpu-search');
  const vramInput = document.getElementById('gpu-vram');
  const vramValue = document.getElementById('gpu-vram-value');
  const filterButtons = document.getElementById('gpu-filters');
  const refreshCatalogBtn = document.getElementById('refresh-catalog');
  const selectedTemplateLabel = document.getElementById('selected-template-label');
  const changeTemplateBtn = document.getElementById('change-template');
  const createTemplateBtn = document.getElementById('create-template');
  const templatePicker = document.getElementById('template-picker-modal');
  const templatePickerClose = document.getElementById('template-picker-close');
  const templateSearch = document.getElementById('template-search');
  const templateList = document.getElementById('template-list');
  const templateFilters = document.getElementById('template-filters');
  const podNameInput = document.getElementById('pod-name');
  const gpuCountButtons = document.getElementById('gpu-count');
  const cloudTypeSelect = document.getElementById('cloud-type');
  const pricingGrid = document.getElementById('pricing-grid');
  const modal = document.getElementById('template-modal');
  const modalClose = document.getElementById('template-close');
  const modalCancel = document.getElementById('template-cancel');
  const modalSave = document.getElementById('template-save');
  const modalName = document.getElementById('template-name');
  const modalTemplateId = document.getElementById('template-id');
  const modalRate = document.getElementById('template-rate');
  const livePodsEl = document.getElementById('gpu-live-pods');
  const refreshLiveBtn = document.getElementById('refresh-live-pods');
  if (!templatesEl) return;

  const fetchJson = async (url, options) => {
    const res = await fetch(url, options);
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || 'Request failed');
    }
    return data;
  };

  const renderTemplates = (templates) => {
    templatesEl.innerHTML = '';
    templates.forEach((tpl) => {
      const card = document.createElement('div');
      card.className = 'gpu-card';
      card.innerHTML = `
        <div class="gpu-card-header">
          <strong>${tpl.name}</strong>
          <span>${tpl.runpod_template_id || 'Template'}</span>
        </div>
        <div class="gpu-card-meta">
          <span>${tpl.gpu_type || 'Any GPU'}</span>
          <span>Saved</span>
        </div>
        <div class="gpu-card-actions">
          <button class="btn secondary-btn" data-template="${tpl.runpod_template_id}">Use Template</button>
        </div>
      `;
      card.querySelector('button').addEventListener('click', async () => {
        selectedTemplateId = tpl.runpod_template_id;
        selectedTemplateName = tpl.name;
        applySelectedTemplate();
        applyFilters();
      });
      templatesEl.appendChild(card);
    });
  };

  const renderLivePods = (pods, error) => {
    if (!livePodsEl) return;
    livePodsEl.innerHTML = '';
    if (error) {
      livePodsEl.innerHTML = `<div class="gpu-empty">${error}</div>`;
      return;
    }
    if (!pods.length) {
      livePodsEl.innerHTML = '<div class="gpu-empty">No live pods found.</div>';
      return;
    }
    const header = document.createElement('div');
    header.className = 'gpu-live-header';
    header.innerHTML = `
      <span>Name</span>
      <span>Utilization</span>
      <span>Memory</span>
      <span>Disk</span>
      <span>Compute type</span>
      <span>Cost</span>
    `;
    livePodsEl.appendChild(header);
    pods.forEach((pod) => {
      const card = document.createElement('div');
      card.className = 'gpu-live-row';
      const gpuUtil = pod.utilization?.gpu ?? '—';
      const cpuUtil = pod.utilization?.cpu ?? '—';
      const memPercent = pod.memory?.percent ?? '—';
      const diskPercent = pod.disk?.percent ?? '—';
      const computeType = pod.gpuTypeId ? `${pod.gpuTypeId} x${pod.gpuCount || 1}` : '—';
      const cost = pod.costPerHr ? `$${Number(pod.costPerHr).toFixed(2)}/hr` : '—';
      card.innerHTML = `
        <div class="gpu-live-cell">
          <div class="gpu-live-name">
            <strong>${pod.name || pod.id}</strong>
            <span class="status-pill ${pod.status}">${pod.status}</span>
          </div>
          <div class="gpu-live-meta">Pod ID: ${pod.id}</div>
          <div class="gpu-live-meta">Machine: ${pod.machineId || 'N/A'}</div>
          ${pod.publicIp ? `<div class="gpu-live-meta">Public: ${pod.publicIp}${pod.publicPort ? `:${pod.publicPort}` : ''}</div>` : ''}
        </div>
        <div class="gpu-live-cell">
          <div class="gpu-live-metric">GPU: ${gpuUtil !== '—' ? gpuUtil + '%' : '—'}</div>
          <div class="gpu-live-metric">CPU: ${cpuUtil !== '—' ? cpuUtil + '%' : '—'}</div>
        </div>
        <div class="gpu-live-cell">
          <div class="gpu-live-metric">${memPercent !== '—' ? memPercent + '%' : '—'}</div>
        </div>
        <div class="gpu-live-cell">
          <div class="gpu-live-metric">${diskPercent !== '—' ? diskPercent + '%' : '—'}</div>
        </div>
        <div class="gpu-live-cell">
          <div class="gpu-live-metric">${computeType}</div>
        </div>
        <div class="gpu-live-cell gpu-live-actions">
          <div class="gpu-live-metric">${cost}</div>
          <button class="btn danger-btn" data-stop="${pod.id}">Stop Pod</button>
        </div>
      `;
      card.querySelector('[data-stop]').addEventListener('click', async () => {
        if (!confirm('Stop this pod?')) return;
        try {
          await fetchJson('includes/gpu_rentals_handlers.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop_live_pod', pod_id: pod.id })
          });
          await loadLivePods();
        } catch (err) {
          alert(err.message);
        }
      });
      livePodsEl.appendChild(card);
    });
  };

  let templatesCache = [];
  let gpusCache = [];
  let activeFilter = 'all';
  let selectedGpuForTemplate = null;
  let selectedTemplateId = null;
  let selectedTemplateName = null;
  let gpuCount = 1;
  let pricingType = 'on_demand';
  let cloudType = 'secure';
  let templateFilter = 'all';

  const classifyGpu = (gpu) => {
    const name = `${gpu.displayName || ''} ${gpu.id || ''}`.toLowerCase();
    if (name.includes('amd') || name.includes('mi')) return 'amd';
    if (name.includes('rtx 50') || name.includes('rtx 40') || name.includes('h100') || name.includes('h200') || name.includes('b200') || name.includes('b300') || name.includes('ada') || name.includes('rtx pro') || name.includes('l40') || name.includes('l4')) return 'nvidia-latest';
    if (name.includes('rtx 30') || name.includes('a100') || name.includes('a40') || name.includes('a30') || name.includes('a6000') || name.includes('a5000') || name.includes('a4500') || name.includes('a4000') || name.includes('v100') || name.includes('tesla')) return 'nvidia-prev';
    return 'other';
  };

  const matchTemplate = (gpu) => {
    const id = (gpu.id || '').toLowerCase();
    const name = (gpu.displayName || '').toLowerCase();
    return templatesCache.find((tpl) => {
      const key = (tpl.gpu_type || '').toLowerCase();
      return key && (key === id || key === name);
    });
  };

  const applySelectedTemplate = () => {
    if (selectedTemplateLabel) {
      selectedTemplateLabel.textContent = selectedTemplateName || 'No template selected';
    }
  };

  const openTemplatePicker = () => {
    if (!templatePicker) return;
    templatePicker.classList.add('open');
    renderTemplatePicker();
    templateSearch?.focus();
  };

  const closeTemplatePicker = () => {
    templatePicker?.classList.remove('open');
  };

  const renderTemplatePicker = () => {
    if (!templateList) return;
    const term = (templateSearch?.value || '').toLowerCase().trim();
    templateList.innerHTML = '';
    const filtered = templatesCache.filter((tpl) => {
      if (!term) return true;
      return `${tpl.name || ''} ${tpl.imageName || ''} ${tpl.category || ''}`.toLowerCase().includes(term);
    });
    const withFilter = filtered.filter((tpl) => {
      if (templateFilter === 'all') return true;
      if (templateFilter === 'saved') return !!tpl.isSaved;
      const cat = (tpl.category || '').toLowerCase();
      if (templateFilter === 'community') return cat.includes('community');
      if (templateFilter === 'official') return tpl.isRunpod === true;
      if (templateFilter === 'verified') return cat.includes('verified');
      return true;
    });
    if (!withFilter.length) {
      templateList.innerHTML = '<div class="gpu-empty">No templates found.</div>';
      return;
    }
    withFilter.forEach((tpl) => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.innerHTML = `
        <h4>${tpl.name}</h4>
        <div class="template-meta">${tpl.category || (tpl.isRunpod ? 'Official' : 'Community')} • ${tpl.isSaved ? 'Saved' : (tpl.isRunpod ? 'RunPod' : 'Community')}</div>
        <div class="template-meta">${tpl.imageName || ''}</div>
        <button class="btn secondary-btn" data-select>Use Template</button>
      `;
      card.querySelector('[data-select]').addEventListener('click', () => {
        selectedTemplateId = tpl.id;
        selectedTemplateName = tpl.name;
        applySelectedTemplate();
        closeTemplatePicker();
        applyFilters();
      });
      templateList.appendChild(card);
    });
  };

  const openTemplateModal = (gpu) => {
    selectedGpuForTemplate = gpu || null;
    modalName.value = gpu?.displayName || gpu?.id || '';
    modalTemplateId.value = '';
    modalRate.value = '0';
    modal.classList.add('open');
    modalTemplateId.focus();
  };

  const closeTemplateModal = () => {
    modal.classList.remove('open');
    selectedGpuForTemplate = null;
  };

  const renderDeploy = (gpus, error) => {
    if (!deployEl) return;
    deployEl.innerHTML = '';
    if (error) {
      deployEl.innerHTML = `<div class="gpu-empty">${error}</div>`;
      return;
    }
    if (!gpus.length) {
      deployEl.innerHTML = '<div class="gpu-empty">No GPUs returned from RunPod.</div>';
      return;
    }
    gpus.forEach((gpu) => {
      const card = document.createElement('div');
      card.className = 'gpu-card';
      const tpl = selectedTemplateId
        ? templatesCache.find((t) => t.id === selectedTemplateId)
        : null;
      const onDemandPrice = cloudType === 'secure' ? gpu.securePrice : gpu.communityPrice;
      const spotPrice = cloudType === 'secure' ? gpu.secureSpotPrice : gpu.communitySpotPrice;
      card.innerHTML = `
        <div class="gpu-card-header">
          <strong>${gpu.displayName || gpu.id || 'GPU'}</strong>
          <span>${gpu.id || ''}</span>
        </div>
        <div class="gpu-card-meta">
          <span>${gpu.memoryInGb ? gpu.memoryInGb + 'GB VRAM' : 'VRAM N/A'}</span>
          <span>${pricingType === 'spot' ? 'Spot' : 'On-demand'}</span>
        </div>
        <div class="gpu-card-actions">
          ${tpl ? `
            <div class="template-meta">Template: ${tpl.name}</div>
            <label>
              Minutes
              <input type="number" min="10" max="360" value="60" class="gpu-minutes">
            </label>
            <button class="btn" data-template="${tpl.id}">Start Session</button>
          ` : `
            <button class="btn secondary-btn" data-select-template>Select Template</button>
          `}
        </div>
      `;
      if (tpl) {
        card.querySelector('button').addEventListener('click', async () => {
          const minutes = parseInt(card.querySelector('.gpu-minutes').value, 10) || 60;
          try {
            card.querySelector('button').disabled = true;
            await fetchJson('includes/gpu_rentals_handlers.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'start_session',
                pod_template_id: selectedTemplateId,
                pod_template_name: selectedTemplateName,
                gpu_type_id: gpu.id,
                gpu_count: gpuCount,
                pricing_type: pricingType,
                cloud_type: cloudType,
                pod_name: podNameInput?.value || '',
                requested_minutes: minutes
              })
            });
            await loadSessions();
          } catch (err) {
            alert(err.message);
          } finally {
            card.querySelector('button').disabled = false;
          }
        });
      } else {
        card.querySelector('[data-select-template]').addEventListener('click', openTemplatePicker);
      }
      if (tpl && selectedTemplateId && onDemandPrice) {
        card.querySelector('.gpu-card-meta span:last-child').textContent =
          `$${Number(pricingType === 'spot' ? (spotPrice || onDemandPrice) : onDemandPrice).toFixed(2)}/hr`;
      }
      deployEl.appendChild(card);
    });
  };

  const applyFilters = () => {
    let filtered = [...gpusCache];
    const term = (searchInput?.value || '').toLowerCase().trim();
    const minVram = parseInt(vramInput?.value || '0', 10) || 0;
    if (minVram > 8) {
      filtered = filtered.filter((g) => (g.memoryInGb || 0) >= minVram);
    }
    if (term) {
      filtered = filtered.filter((g) => (`${g.displayName || ''} ${g.id || ''}`.toLowerCase().includes(term)));
    }
    if (activeFilter !== 'all') {
      filtered = filtered.filter((g) => classifyGpu(g) === activeFilter);
    }
    if (pricingGrid) {
      const gpu = filtered[0];
      const onDemand = gpu ? (cloudType === 'secure' ? gpu.securePrice : gpu.communityPrice) : null;
      const spot = gpu ? (cloudType === 'secure' ? gpu.secureSpotPrice : gpu.communitySpotPrice) : null;
      pricingGrid.querySelectorAll('.pricing-card').forEach((card) => {
        const rateEl = card.querySelector('[data-role="rate"]');
        if (!rateEl) return;
        const type = card.dataset.pricing;
        const rate = type === 'spot' ? spot : onDemand;
        rateEl.textContent = rate ? `$${Number(rate).toFixed(2)}/hr` : '--';
      });
    }
    renderDeploy(filtered);
  };

  const loadTemplates = async () => {
    const data = await fetchJson('includes/gpu_rentals_handlers.php?action=list_templates');
    renderTemplates(data.items || []);
  };

  const loadPodTemplates = async () => {
    const data = await fetchJson('includes/gpu_rentals_handlers.php?action=list_pod_templates');
    templatesCache = data.items || [];
    templatesCache = templatesCache.map((tpl) => ({
      ...tpl,
      isSaved: tpl.isSaved || false
    }));
    if (!selectedTemplateId && templatesCache.length) {
      selectedTemplateId = templatesCache[0].id;
      selectedTemplateName = templatesCache[0].name;
      applySelectedTemplate();
    }
    renderTemplatePicker();
    applyFilters();
  };

  const loadAvailable = async () => {
    try {
      const data = await fetchJson('includes/gpu_rentals_handlers.php?action=list_gpus');
      gpusCache = data.items || [];
      applyFilters();
    } catch (err) {
      renderDeploy([], err.message);
    }
  };

  const saveTemplate = async () => {
    if (!selectedGpuForTemplate) return;
    const name = modalName.value.trim();
    const templateId = modalTemplateId.value.trim();
    const rate = parseFloat(modalRate.value || '0');
    if (!name || !templateId) {
      alert('Template name and RunPod template ID are required.');
      return;
    }
    try {
      modalSave.disabled = true;
      await fetchJson('includes/gpu_rentals_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_template',
          name,
          runpod_template_id: templateId,
          gpu_type: null,
          vram_gb: null,
          hourly_rate: isNaN(rate) ? 0 : rate
        })
      });
      await loadTemplates();
      applyFilters();
      closeTemplateModal();
    } catch (err) {
      alert(err.message);
    } finally {
      modalSave.disabled = false;
    }
  };

  const loadLivePods = async () => {
    try {
      const data = await fetchJson('includes/gpu_rentals_handlers.php?action=list_live_pods');
      renderLivePods(data.items || []);
    } catch (err) {
      renderLivePods([], err.message);
    }
  };

  refreshLiveBtn?.addEventListener('click', loadLivePods);
  refreshCatalogBtn?.addEventListener('click', loadAvailable);
  changeTemplateBtn?.addEventListener('click', openTemplatePicker);
  createTemplateBtn?.addEventListener('click', () => {
    openTemplateModal({ displayName: '' });
  });
  templatePickerClose?.addEventListener('click', closeTemplatePicker);
  templatePicker?.addEventListener('click', (event) => {
    if (event.target === templatePicker) closeTemplatePicker();
  });
  templateSearch?.addEventListener('input', renderTemplatePicker);
  templateFilters?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-filter]');
    if (!btn) return;
    templateFilter = btn.dataset.filter;
    templateFilters.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    renderTemplatePicker();
  });
  gpuCountButtons?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-count]');
    if (!btn) return;
    gpuCount = parseInt(btn.dataset.count, 10) || 1;
    gpuCountButtons.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
  });
  pricingGrid?.addEventListener('click', (event) => {
    const card = event.target.closest('.pricing-card');
    if (!card || card.classList.contains('disabled')) return;
    pricingType = card.dataset.pricing;
    pricingGrid.querySelectorAll('.pricing-card').forEach((c) => c.classList.toggle('active', c === card));
    applyFilters();
  });
  cloudTypeSelect?.addEventListener('change', () => {
    cloudType = cloudTypeSelect.value;
    applyFilters();
  });
  searchInput?.addEventListener('input', applyFilters);
  vramInput?.addEventListener('input', () => {
    const value = parseInt(vramInput.value, 10);
    vramValue.textContent = value <= 8 ? 'Any' : value + 'GB+';
    applyFilters();
  });
  filterButtons?.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-filter]');
    if (!btn) return;
    activeFilter = btn.dataset.filter;
    filterButtons.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === btn));
    applyFilters();
  });
  modalClose?.addEventListener('click', closeTemplateModal);
  modalCancel?.addEventListener('click', closeTemplateModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeTemplateModal();
  });
  modalSave?.addEventListener('click', saveTemplate);

  if (podNameInput && !podNameInput.value) {
    const seed = Math.random().toString(36).slice(2, 8);
    podNameInput.value = `socialarena-${seed}`;
  }

  loadTemplates();
  loadAvailable();
  loadPodTemplates();
  loadLivePods();
})();
