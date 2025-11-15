/* ==========================
   GLOBAL STATE
========================== */
let currentMode = "fast";
let selectedLang = "eng";
let videoStream = null;

let draftItems = [];
let todoItems = [];

const modeFastBtn = document.getElementById("modeFast");
const modeAccurateBtn = document.getElementById("modeAccurate");
const langSelect = document.getElementById("langSelect");

const cameraStatusEl = document.getElementById("cameraStatus");
const statusEl = document.getElementById("status");
const rawTextEl = document.getElementById("rawText");
const jsonOutputEl = document.getElementById("jsonOutput");
const previewImg = document.getElementById("preview");

const draftContainer = document.getElementById("draftContainer");
const todoListEl = document.getElementById("todoList");

const pageCapture = document.getElementById("pageCapture");
const pageTodo = document.getElementById("pageTodo");

/* ==========================
   MODE & LANGUAGE SWITCH
========================== */
modeFastBtn.addEventListener("click", () => {
  currentMode = "fast";
  modeFastBtn.classList.add("active");
  modeAccurateBtn.classList.remove("active");
});

modeAccurateBtn.addEventListener("click", () => {
  currentMode = "accurate";
  modeAccurateBtn.classList.add("active");
  modeFastBtn.classList.remove("active");
});

langSelect.addEventListener("change", (e) => {
  selectedLang = e.target.value;
});

/* ==========================
   PAGE NAVIGATION
========================== */
document.getElementById("btnGoToTodo").addEventListener("click", () => {
  pageCapture.style.display = "none";
  pageTodo.style.display = "block";
});

document.getElementById("btnBackToCapture").addEventListener("click", () => {
  pageCapture.style.display = "block";
  pageTodo.style.display = "none";
});

/* ==========================
   CAMERA FUNCTIONS
========================== */
async function startCamera() {
  try {
    if (videoStream) return;

    cameraStatusEl.textContent = "Requesting camera...";

    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment", width: { ideal: 720 } },
      audio: false
    });

    document.getElementById("video").srcObject = videoStream;
    cameraStatusEl.textContent = "Camera ready.";
  } catch (err) {
    cameraStatusEl.textContent = "Camera error.";
    console.error(err);
  }
}

async function captureFromCamera() {
  const video = document.getElementById("video");

  if (!videoStream || !video.videoWidth) {
    cameraStatusEl.textContent = "Camera not ready.";
    return;
  }

  cameraStatusEl.textContent = "Capturing frame...";

  const scale = currentMode === "fast" ? 0.9 : 1.0;
  const width = video.videoWidth * scale;
  const height = video.videoHeight * scale;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, width, height);

  const dataURL = canvas.toDataURL("image/png");
  previewImg.src = dataURL;
  previewImg.style.display = "block";

  await performOCR(dataURL);
}

document.getElementById("btnStartCamera").addEventListener("click", startCamera);
document.getElementById("btnCaptureOCR").addEventListener("click", captureFromCamera);

/* ==========================
   IMAGE UPLOAD
========================== */
document.getElementById("btnUploadOCR").addEventListener("click", async () => {
  const fileInput = document.getElementById("imageUpload");
  const file = fileInput.files[0];
  const uploadStatus = document.getElementById("uploadStatus");

  if (!file) {
    alert("Choose an image first.");
    return;
  }

  uploadStatus.textContent = "Processing image...";
  const url = URL.createObjectURL(file);

  const img = new Image();
  img.onload = async () => {
    let width = img.width;
    let height = img.height;

    if (currentMode === "fast") {
      const maxDim = 1200;
      const scale = Math.min(maxDim / width, maxDim / height, 1);
      width *= scale;
      height *= scale;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    const dataURL = canvas.toDataURL("image/png");

    previewImg.src = dataURL;
    previewImg.style.display = "block";

    uploadStatus.textContent = "Running OCR...";
    await performOCR(dataURL);
    uploadStatus.textContent = "Done.";
  };

  img.src = url;
});

/* ==========================
   OCR PROCESSING
========================== */
async function performOCR(dataURL) {
  try {
    rawTextEl.value = "";
    statusEl.textContent = "Running OCR...";

    const result = await Tesseract.recognize(dataURL, selectedLang);
    const text = result.data.text || "";

    rawTextEl.value = text;
    statusEl.textContent = "Parsing text...";

    const parsed = parseTodoText(text);
    jsonOutputEl.value = JSON.stringify(parsed, null, 2);

    draftItems = parsed.items.map((item, i) => ({
      id: i,
      text: item.text,
      editing: false,
      accepted: false
    }));

    renderDraftCards();
    statusEl.textContent = "Done.";
  } catch (err) {
    statusEl.textContent = "OCR error.";
  }
}

/* ==========================
   TEXT → JSON PARSER
========================== */
function parseTodoText(text) {
  const lines = text.split("\n")
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const items = [];

  for (let line of lines) {
    const l = line.toLowerCase();
    if (l === "todo" || l === "to do" || l === "tasks") continue;
    items.push({ text: line });
  }

  return { items };
}

/* ==========================
   DRAFT CARDS RENDERING
========================== */
function renderDraftCards() {
  draftContainer.innerHTML = "";

  if (!draftItems.length) {
    draftContainer.innerHTML = `<p class="status-text">No tasks yet.</p>`;
    return;
  }

  draftItems.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "todo-card";

    // Header
    const header = document.createElement("div");
    header.className = "todo-header";

    const title = document.createElement("h4");
    title.textContent = item.text;
    header.appendChild(title);

    if (item.accepted) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "Accepted";
      header.appendChild(badge);
    }

    card.appendChild(header);

    // Body (view)
    const body = document.createElement("div");
    body.style.display = item.editing ? "none" : "block";
    body.textContent = item.text;
    card.appendChild(body);

    // Editing
    const editDiv = document.createElement("div");
    editDiv.style.display = item.editing ? "block" : "none";

    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.value = item.text;

    editDiv.appendChild(editInput);

    const editActions = document.createElement("div");
    editActions.className = "todo-actions";

    const save = document.createElement("button");
    save.className = "btn btn-primary";
    save.textContent = "Save";
    save.onclick = () => {
      draftItems[index].text = editInput.value.trim();
      draftItems[index].editing = false;
      syncJSON();
      renderDraftCards();
    };

    const cancel = document.createElement("button");
    cancel.className = "btn btn-ghost";
    cancel.textContent = "Cancel";
    cancel.onclick = () => {
      draftItems[index].editing = false;
      renderDraftCards();
    };

    editActions.appendChild(save);
    editActions.appendChild(cancel);
    editDiv.appendChild(editActions);
    card.appendChild(editDiv);

    // Actions (view mode)
    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-outline";
    editBtn.textContent = "Edit";
    editBtn.onclick = () => {
      draftItems[index].editing = true;
      renderDraftCards();
    };

    const acceptBtn = document.createElement("button");
    acceptBtn.className = "btn btn-accept";
    acceptBtn.textContent = "Accept";
    acceptBtn.onclick = () => {
      draftItems[index].accepted = true;
      todoItems.push({
        id: Date.now(),
        text: draftItems[index].text,
        completed: false
      });
      renderTodoList();
      renderDraftCards();
      syncJSON();
    };

    actions.appendChild(editBtn);
    actions.appendChild(acceptBtn);
    card.appendChild(actions);

    draftContainer.appendChild(card);
  });
}

/* ==========================
   TODO LIST RENDERING
========================== */
function renderTodoList() {
  todoListEl.innerHTML = "";

  if (!todoItems.length) {
    todoListEl.innerHTML = `<p class="status-text">No tasks yet.</p>`;
    return;
  }

  todoItems.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "todo-list-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.completed;
    checkbox.onclick = () => {
      item.completed = checkbox.checked;
      renderTodoList();
    };

    const wrap = document.createElement("div");
    wrap.className = "todo-list-text";

    const title = document.createElement("p");
    title.className = "todo-list-title";
    if (item.completed) title.classList.add("completed");
    title.textContent = item.text;

    wrap.appendChild(title);
    row.appendChild(checkbox);
    row.appendChild(wrap);

    todoListEl.appendChild(row);
  });
}

/* ==========================
   JSON SYNC
========================== */
function syncJSON() {
  jsonOutputEl.value = JSON.stringify({
    items: draftItems.map(d => ({ text: d.text }))
  }, null, 2);
}

/* ==========================
   CLEAR BUTTON
========================== */
document.getElementById("btnClearDrafts").addEventListener("click", () => {
  draftItems = [];
  rawTextEl.value = "";
  jsonOutputEl.value = "";
  renderDraftCards();
});
