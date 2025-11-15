// --- GLOBAL STATE ---
  let currentMode = 'fast'; // 'fast' | 'accurate'
  let videoStream = null;
  let medications = [];

  const modeFastBtn = document.getElementById('modeFast');
  const modeAccurateBtn = document.getElementById('modeAccurate');
  const statusEl = document.getElementById('status');
  const cameraStatusEl = document.getElementById('cameraStatus');
  const rawTextEl = document.getElementById('rawText');
  const jsonOutputEl = document.getElementById('jsonOutput');
  const medContainer = document.getElementById('medContainer');
  const previewImg = document.getElementById('preview');
  const videoEl = document.getElementById('video');

  // --- MODE SWITCHING: FAST vs ACCURATE ---
  modeFastBtn.addEventListener('click', () => {
    currentMode = 'fast';
    modeFastBtn.classList.add('active');
    modeAccurateBtn.classList.remove('active');
  });

  modeAccurateBtn.addEventListener('click', () => {
    currentMode = 'accurate';
    modeAccurateBtn.classList.add('active');
    modeFastBtn.classList.remove('active');
  });

  // --- CAMERA HANDLING ---
  async function startCamera() {
    try {
      if (videoStream) return; // already started
      cameraStatusEl.textContent = 'Requesting camera access...';
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
        audio: false
      });
      videoEl.srcObject = videoStream;
      cameraStatusEl.textContent = 'Camera ready. Hold your prescription steady and tap "Capture & Extract".';
    } catch (err) {
      console.error(err);
      cameraStatusEl.textContent = 'Unable to access camera. Please allow camera permission or use upload instead.';
    }
  }

  async function captureFromCamera() {
    if (!videoStream || !videoEl.videoWidth) {
      cameraStatusEl.textContent = 'Camera not ready yet. Start the camera first.';
      return;
    }

    cameraStatusEl.textContent = `Capturing frame in ${currentMode} mode...`;

    const originalWidth = videoEl.videoWidth;
    const originalHeight = videoEl.videoHeight;

    // Fast mode: very light downscale now (to keep OCR usable)
    const scale = currentMode === 'fast' ? 0.9 : 1.0;
    const width = Math.floor(originalWidth * scale);
    const height = Math.floor(originalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(videoEl, 0, 0, width, height);

    const dataURL = canvas.toDataURL('image/png');
    previewImg.src = dataURL;
    previewImg.style.display = 'block';

    await performOCR(dataURL);
  }

  document.getElementById('btnStartCamera').addEventListener('click', startCamera);
  document.getElementById('btnCaptureOCR').addEventListener('click', captureFromCamera);

  // --- IMAGE UPLOAD HANDLING ---
  document.getElementById('btnUploadOCR').addEventListener('click', async () => {
    const fileInput = document.getElementById('imageInput');
    const file = fileInput.files[0];
    if (!file) {
      alert('Please upload an image first.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      // Fast: mild scaling to ~1200px max; Accurate: full image.
      const maxDimFast = 1200;
      let width = img.width;
      let height = img.height;

      if (currentMode === 'fast') {
        const scale = Math.min(maxDimFast / width, maxDimFast / height, 1);
        width = Math.floor(width * scale);
        height = Math.floor(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const dataURL = canvas.toDataURL('image/png');
      previewImg.src = dataURL;
      previewImg.style.display = 'block';

      URL.revokeObjectURL(objectUrl);
      await performOCR(dataURL);
    };
    img.onerror = () => {
      statusEl.textContent = 'Could not load image. Try another file.';
    };
    img.src = objectUrl;
  });

  document.getElementById('btnClearAll').addEventListener('click', () => {
    rawTextEl.value = '';
    jsonOutputEl.value = '';
    previewImg.style.display = 'none';
    previewImg.src = '';
    statusEl.textContent = '';
    medications = [];
    renderMedicationCards();
  });

  // --- MAIN OCR PIPELINE ---
  async function performOCR(dataURL) {
    try {
      const modeLabel = currentMode === 'fast' ? 'Fast' : 'Accurate';
      statusEl.textContent = `Running OCR (${modeLabel} mode)...`;
      rawTextEl.value = '';
      // Don't clear JSON here so you can compare old vs new if needed

      const result = await Tesseract.recognize(dataURL, 'eng');
      const text = result.data.text || '';

      rawTextEl.value = text;
      statusEl.textContent = 'OCR complete. Parsing into structured medications...';

      // First attempt: structured parser
      let parsed = parseUniversalPrescription(text);

      // If nothing was recognized as a medication and we're in FAST mode,
      // use a more lenient fallback: treat non-noise lines as meds.
      if (parsed.medications.length === 0 && currentMode === 'fast') {
        parsed = fallbackParseLinesToMeds(text);
      }

      jsonOutputEl.value = JSON.stringify(parsed, null, 2);

      medications = parsed.medications.map((m, idx) => ({
        id: idx,
        name: m.name || '',
        dosage: m.dosage || '',
        schedule: m.schedule || '',
        accepted: false,
        editing: false
      }));

      renderMedicationCards();

      statusEl.textContent = 'Done. Review cards below and accept/edit as needed.';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Error during OCR. Please try again or use a clearer image.';
    }
  }

  // --- UNIVERSAL PRESCRIPTION PARSER (strict / structured) ---
  function parseUniversalPrescription(text) {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const medications = [];

    const dosageRegex =
      /\b(\d+\s?mg|\d+\s?g|\d+\s?mcg|\d+\s?iu|\d+\s?ml|[1-3]\s?(tablet|tablets|capsule|capsules|cap|caps))\b/i;

    const scheduleRegex =
      /\b(every\s?\d+\s?(hours|hrs|hr)|once (a )?day|twice (a )?day|thrice (a )?day|daily|at bedtime|morning|night)\b/i;

    for (let line of lines) {
      const lowered = line.toLowerCase();

      // Skip common non-medication lines
      if (lowered.includes('patient')) continue;
      if (lowered.includes('doctor')) continue;
      if (lowered.includes('physician')) continue;
      if (lowered.includes('address')) continue;
      if (lowered.includes('phone')) continue;
      if (lowered.includes('email')) continue;
      if (lowered.includes('date')) continue;
      if (lowered.includes('signature')) continue;
      if (lowered.startsWith('rx')) continue;

      const dosageMatch = line.match(dosageRegex);
      const scheduleMatch = line.match(scheduleRegex);

      if (dosageMatch && scheduleMatch) {
        const dosage = dosageMatch[1];
        const schedule = scheduleMatch[1];

        // Medication name is text BEFORE dosage
        const namePart = line.split(dosageMatch[0])[0].trim();
        const name = namePart.replace(/[\d:,|-]/g, '').trim();

        medications.push({
          name,
          dosage,
          schedule
        });
      }
    }

    return { medications };
  }

  // --- FALLBACK PARSER FOR FAST MODE ---
  // If strict parser finds nothing, at least treat lines as "raw meds"
  function fallbackParseLinesToMeds(text) {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const meds = [];

    for (let line of lines) {
      const lowered = line.toLowerCase();

      // Skip obvious noise
      if (lowered.includes('patient')) continue;
      if (lowered.includes('doctor')) continue;
      if (lowered.includes('physician')) continue;
      if (lowered.includes('address')) continue;
      if (lowered.includes('phone')) continue;
      if (lowered.includes('email')) continue;
      if (lowered.includes('date')) continue;
      if (lowered.includes('signature')) continue;
      if (lowered.startsWith('rx')) continue;

      // Treat entire line as name; user can edit dosage/schedule
      meds.push({
        name: line,
        dosage: '',
        schedule: ''
      });
    }

    return { medications: meds };
  }

  // --- RENDER MEDICATION CARDS FROM STATE ---
  function renderMedicationCards() {
    medContainer.innerHTML = '';

    if (!medications.length) {
      const empty = document.createElement('p');
      empty.className = 'status-text';
      empty.textContent = 'No medications detected yet. Run OCR above to populate this list.';
      medContainer.appendChild(empty);
      return;
    }

    medications.forEach((med, index) => {
      const card = document.createElement('div');
      card.className = 'med-card';

      // Header
      const header = document.createElement('div');
      header.className = 'med-header';

      const title = document.createElement('h4');
      title.textContent = med.name || `Medication ${index + 1}`;
      header.appendChild(title);

      const badgeWrap = document.createElement('div');
      if (med.accepted) {
        const badge = document.createElement('span');
        badge.className = 'badge badge-accepted';
        badge.textContent = 'Accepted';
        badgeWrap.appendChild(badge);
      }
      header.appendChild(badgeWrap);
      card.appendChild(header);

      // View mode fields
      const viewDiv = document.createElement('div');
      viewDiv.className = 'med-view';
      viewDiv.style.display = med.editing ? 'none' : 'block';

      const field1 = document.createElement('div');
      field1.className = 'med-field';
      field1.innerHTML = `<span class="label">Name:</span> ${med.name || '<em>Not set</em>'}`;
      const field2 = document.createElement('div');
      field2.className = 'med-field';
      field2.innerHTML = `<span class="label">Dosage:</span> ${med.dosage || '<em>Not set</em>'}`;
      const field3 = document.createElement('div');
      field3.className = 'med-field';
      field3.innerHTML = `<span class="label">Schedule:</span> ${med.schedule || '<em>Not set</em>'}`;

      viewDiv.appendChild(field1);
      viewDiv.appendChild(field2);
      viewDiv.appendChild(field3);

      card.appendChild(viewDiv);

      // Edit mode fields
      const editDiv = document.createElement('div');
      editDiv.className = 'med-edit';
      editDiv.style.display = med.editing ? 'block' : 'none';

      const editGrid = document.createElement('div');
      editGrid.className = 'med-edit-grid';

      const nameGroup = document.createElement('div');
      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Name';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = med.name || '';
      nameInput.dataset.field = 'name';
      nameGroup.appendChild(nameLabel);
      nameGroup.appendChild(nameInput);

      const dosageGroup = document.createElement('div');
      const dosageLabel = document.createElement('label');
      dosageLabel.textContent = 'Dosage';
      const dosageInput = document.createElement('input');
      dosageInput.type = 'text';
      dosageInput.value = med.dosage || '';
      dosageInput.dataset.field = 'dosage';
      dosageGroup.appendChild(dosageLabel);
      dosageGroup.appendChild(dosageInput);

      const scheduleGroup = document.createElement('div');
      const scheduleLabel = document.createElement('label');
      scheduleLabel.textContent = 'Schedule';
      const scheduleInput = document.createElement('input');
      scheduleInput.type = 'text';
      scheduleInput.value = med.schedule || '';
      scheduleInput.dataset.field = 'schedule';
      scheduleGroup.appendChild(scheduleLabel);
      scheduleGroup.appendChild(scheduleInput);

      editGrid.appendChild(nameGroup);
      editGrid.appendChild(dosageGroup);
      editGrid.appendChild(scheduleGroup);

      editDiv.appendChild(editGrid);

      const editActions = document.createElement('div');
      editActions.className = 'med-actions';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-primary';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => {
        medications[index].name = nameInput.value.trim();
        medications[index].dosage = dosageInput.value.trim();
        medications[index].schedule = scheduleInput.value.trim();
        medications[index].editing = false;
        renderMedicationCards();
        syncJsonFromMedications();
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.textContent = 'Cancel';
      cancelBtn.addEventListener('click', () => {
        medications[index].editing = false;
        renderMedicationCards();
      });

      editActions.appendChild(saveBtn);
      editActions.appendChild(cancelBtn);
      editDiv.appendChild(editActions);

      card.appendChild(editDiv);

      // Action buttons (view mode)
      const actions = document.createElement('div');
      actions.className = 'med-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn btn-outline';
      editBtn.textContent = med.editing ? 'Editing...' : 'Edit';
      editBtn.disabled = med.editing;
      editBtn.addEventListener('click', () => {
        medications[index].editing = true;
        renderMedicationCards();
      });

      const acceptBtn = document.createElement('button');
      acceptBtn.type = 'button';
      acceptBtn.className = 'btn btn-accept';
      acceptBtn.textContent = med.accepted ? 'Accepted' : 'Accept';
      if (med.accepted) acceptBtn.disabled = true;
      acceptBtn.addEventListener('click', () => {
        medications[index].accepted = true;
        renderMedicationCards();
        syncJsonFromMedications();
      });

      actions.appendChild(editBtn);
      actions.appendChild(acceptBtn);
      card.appendChild(actions);

      medContainer.appendChild(card);
    });
  }

  // Keep JSON textarea in sync if user edits cards then accepts/saves
  function syncJsonFromMedications() {
    const obj = {
      medications: medications.map(m => ({
        name: m.name,
        dosage: m.dosage,
        schedule: m.schedule
      }))
    };
    jsonOutputEl.value = JSON.stringify(obj, null, 2);
  }

  // Rebuild cards if user manually edits JSON and clicks "Rebuild"
  document.getElementById('btnReparseJson').addEventListener('click', () => {
    try {
      const data = JSON.parse(jsonOutputEl.value || '{}');
      if (!Array.isArray(data.medications)) {
        alert('JSON must have a "medications" array.');
        return;
      }
      medications = data.medications.map((m, idx) => ({
        id: idx,
        name: (m && m.name) || '',
        dosage: (m && m.dosage) || '',
        schedule: (m && m.schedule) || '',
        accepted: false,
        editing: false
      }));
      renderMedicationCards();
    } catch (err) {
      alert('Invalid JSON. Please fix errors and try again.');
    }
  });

  // Initial state
  renderMedicationCards();