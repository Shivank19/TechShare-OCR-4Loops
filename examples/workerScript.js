/* ============================================================
   GLOBAL STATE
============================================================ */

let currentMode = "fast";
let selectedLang = "eng";

let videoStream = null;
let usingCamera = false;

let ocrWorker = null;
let currentWorkerLang = "eng";

let draftItems = [];
let todoItems = [];

/* DOM ELEMENTS */

const videoEl = document.getElementById("video");
const previewImg = document.getElementById("preview");

const rawTextEl = document.getElementById("rawText");
const jsonOutputEl = document.getElementById("jsonOutput");

const draftContainer = document.getElementById("draftContainer");
const todoListEl = document.getElementById("todoList");

const toast = document.getElementById("toast");

const pageCapture = document.getElementById("pageCapture");
const pageTodo = document.getElementById("pageTodo");

/* ============================================================
   INITIALIZE WORKER 
============================================================ */

async function initWorker(lang = "eng") {
  try {
    console.log("Initializing Worker for:", lang);

    ocrWorker = await Tesseract.createWorker({
      workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
      corePath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract-core.wasm.js",
      langPath: "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz"
    });

    await ocrWorker.loadLanguage(lang);
    await ocrWorker.initialize(lang);

    await ocrWorker.setParameters({
      tessedit_ocr_engine_mode: 1,  // LSTM ONLY
      preserve_interword_spaces: 1,
      tessedit_char_whitelist: '0123456789',

    });

    currentWorkerLang = lang;
    console.log("Worker ready:", lang);

  } catch (err) {
    console.error("Tesseract Worker failed:", err);
    rawTextEl.value = "Worker failed to initialize. Check console.";
  }
}

/* Load worker on page load */
window.addEventListener("load", async () => {
  document.getElementById("imageUpload").value = "";
  await initWorker("eng");
});

/* ============================================================
   LANGUAGE SWITCHING
============================================================ */

document.getElementById("langSelect").addEventListener("change", async (e) => {
  selectedLang = e.target.value;

  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
  }

  await initWorker(selectedLang);
});

/* ============================================================
   OCR WITH PROTECTION + PREPROCESSING
============================================================ */

async function performOCR(dataURL) {
  if (!ocrWorker) {
    await initWorker(selectedLang);
  }

  rawTextEl.value = "Running OCR...";

  try {
    const { data } = await ocrWorker.recognize(dataURL);

    let text = data.text;
    if (typeof text !== "string") text = "";

    rawTextEl.value = text;

    // PARSE
    const parsed = parseTodoText(text);
    jsonOutputEl.value = JSON.stringify(parsed, null, 2);

    // BUILD CARDS
    draftItems = parsed.items.map((item, index) => ({
      id: index,
      text: item.text,
      editing: false,
      accepted: false
    }));

    ocrWorker.terminate();
    renderDraftCards();

  } catch (err) {
    console.error("OCR error:", err);
    rawTextEl.value = "OCR failed. Check console.";
  }
}

/* ============================================================
   PARSE OCR TEXT
============================================================ */

function parseTodoText(text) {
  if (typeof text !== "string") return { items: [] };

  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (!Array.isArray(lines)) return { items: [] };

  return { items: lines.map(l => ({ text: l })) };
}

/* ============================================================
   CAMERA
============================================================ */

async function startCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });

    videoEl.srcObject = videoStream;
    usingCamera = true;

    document.getElementById("btnStartStopCamera").textContent = "Stop Camera";

  } catch (err) {
    console.error("Camera error:", err);
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
  }
  videoEl.srcObject = null;
  usingCamera = false;

  document.getElementById("btnStartStopCamera").textContent = "Start Camera";
}

document.getElementById("btnStartStopCamera").onclick = () => {
  usingCamera ? stopCamera() : startCamera();
};

/* ============================================================
   CAPTURE FROM CAMERA
============================================================ */

document.getElementById("btnCaptureOCR").onclick = () => {
  if (!usingCamera) {
    alert("Start camera first.");
    return;
  }

  const scale = currentMode === "fast" ? 0.85 : 1.0;

  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth * scale;
  canvas.height = videoEl.videoHeight * scale;

  canvas.getContext("2d").drawImage(videoEl, 0, 0, canvas.width, canvas.height);

  const dataURL = canvas.toDataURL("image/png");

  previewImg.src = dataURL;
  previewImg.style.display = "block";
};

document.getElementById("btnExtractCamera").onclick = () => {
  if (!previewImg.src) {
    alert("Capture an image first.");
    return;
  }
  performOCR(previewImg.src);
};

/* ============================================================
   IMAGE UPLOAD
============================================================ */

document.getElementById("imageUpload").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.style.display = "block";
};

document.getElementById("btnUploadOCR").onclick = () => {
  if (!previewImg.src) {
    alert("Upload an image first.");
    return;
  }
  performOCR(previewImg.src);
};

/* ============================================================
   RENDER TASK CARDS
============================================================ */

function renderDraftCards() {
  draftContainer.innerHTML = "";

  draftItems.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "todo-card";
    if (item.accepted) card.classList.add("accepted");

    // TITLE
    const header = document.createElement("div");
    header.className = "todo-header";
    header.innerHTML = `<h4>${item.text}</h4>`;
    card.appendChild(header);

    // NORMAL MODE
    const body = document.createElement("div");
    body.style.display = item.editing ? "none" : "block";
    body.textContent = item.text;
    card.appendChild(body);

    // EDIT MODE
    const editDiv = document.createElement("div");
    editDiv.style.display = item.editing ? "block" : "none";

    const input = document.createElement("input");
    input.value = item.text;
    editDiv.appendChild(input);

    const save = document.createElement("button");
    save.className = "btn btn-primary";
    save.textContent = "Save";
    save.onclick = () => {
      draftItems[index].text = input.value.trim();
      draftItems[index].editing = false;
      renderDraftCards();
      syncJSON();
    };

    const cancel = document.createElement("button");
    cancel.className = "btn btn-ghost";
    cancel.textContent = "Cancel";
    cancel.onclick = () => {
      draftItems[index].editing = false;
      renderDraftCards();
    };

    editDiv.appendChild(save);
    editDiv.appendChild(cancel);
    card.appendChild(editDiv);

    // ACTIONS
    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-outline";
    editBtn.textContent = "Edit";
    editBtn.onclick = () =>
      ((draftItems[index].editing = true), renderDraftCards());

    const accept = document.createElement("button");
    accept.className = "btn btn-accent";
    accept.textContent = item.accepted ? "Accepted" : "Accept";

    if (item.accepted) accept.disabled = true;

    accept.onclick = () => {
      item.accepted = true;
      todoItems.push({ text: item.text, completed: false });
      renderDraftCards();
      renderTodoList();
      showToast();
    };

    actions.appendChild(editBtn);
    actions.appendChild(accept);
    card.appendChild(actions);

    draftContainer.appendChild(card);
  });
}

/* ============================================================
   RENDER TODO LIST PAGE
============================================================ */

function renderTodoList() {
  todoListEl.innerHTML = "";

  todoItems.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "todo-list-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = item.completed;
    cb.onclick = () => {
      item.completed = cb.checked;
      renderTodoList();
    };

    const title = document.createElement("p");
    title.className = "todo-list-title";
    if (item.completed) title.classList.add("completed");
    title.textContent = item.text;

    row.appendChild(cb);
    row.appendChild(title);

    todoListEl.appendChild(row);
  });
}

/* ============================================================
   JSON SYNC
============================================================ */

function syncJSON() {
  jsonOutputEl.value = JSON.stringify(
    { items: draftItems.map(d => ({ text: d.text })) },
    null,
    2
  );
}

/* ============================================================
   CLEAR DRAFTS
============================================================ */

document.getElementById("btnClearDrafts").onclick = () => {
  draftItems = [];
  rawTextEl.value = "";
  jsonOutputEl.value = "";
  renderDraftCards();
};

/* ============================================================
   PAGE NAVIGATION
============================================================ */

document.getElementById("btnGoToTodo").onclick = () => {
  pageCapture.style.display = "none";
  pageTodo.style.display = "block";
};

document.getElementById("btnBackToCapture").onclick = () => {
  pageTodo.style.display = "none";
  pageCapture.style.display = "block";
};
