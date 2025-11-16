/* ==============================
   GLOBAL STATE
============================== */
let currentMode = "fast";
let selectedLang = "eng";
let videoStream = null;
let usingCamera = false;

let draftItems = [];
let todoItems = [];

/* ==============================
   ELEMENT REFERENCES
============================== */
const modeFastBtn = document.getElementById("modeFast");
const modeAccurateBtn = document.getElementById("modeAccurate");
const langSelect = document.getElementById("langSelect");

const btnEnhance = document.getElementById("btnEnhance");

const videoEl = document.getElementById("video");
const previewImg = document.getElementById("preview");

const btnExtract = document.getElementById("btnExtractCamera");

const rawTextEl = document.getElementById("rawText");
const jsonOutputEl = document.getElementById("jsonOutput");

const draftContainer = document.getElementById("draftContainer");
const todoListEl = document.getElementById("todoList");

const pageCapture = document.getElementById("pageCapture");
const pageTodo = document.getElementById("pageTodo");

const toast = document.getElementById("toast");

/* ==============================
   INITIAL DISABLES
============================== */
btnExtract.disabled = true;
btnEnhance.disabled = true;

btnExtract.classList.add("disabled-btn");
btnEnhance.classList.add("disabled-btn");

/* ==============================
   TOAST FEEDBACK
============================== */
function showToast() {
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

/* ==============================
   MODE SWITCHING
============================== */
modeFastBtn.onclick = () => {
  currentMode = "fast";
  modeFastBtn.classList.add("active");
  modeAccurateBtn.classList.remove("active");
  document.getElementById("modeStatus").textContent = "⚡ Fast mode enabled";
};

modeAccurateBtn.onclick = () => {
  currentMode = "accurate";
  modeAccurateBtn.classList.add("active");
  modeFastBtn.classList.remove("active");
  document.getElementById("modeStatus").textContent = "🎯 Accurate mode enabled";
};

langSelect.onchange = (e) => {
  selectedLang = e.target.value;
};

/* ==============================
   PAGE NAVIGATION
============================== */
document.getElementById("btnGoToTodo").onclick = () => {
  pageCapture.style.display = "none";
  pageTodo.style.display = "block";
};

document.getElementById("btnBackToCapture").onclick = () => {
  pageTodo.style.display = "none";
  pageCapture.style.display = "block";
};

/* ==============================
   CAMERA START / STOP
============================== */
async function startCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }, audio: false
    });
    videoEl.srcObject = videoStream;
    usingCamera = true;
    btnStartStopCamera.textContent = "Stop Camera";
    videoEl.style.display = "block";
  } catch (err) {
    console.error("Camera error:", err);
  }
}

function stopCamera() {
  if (videoStream)
    videoStream.getTracks().forEach(t => t.stop());
  
  videoStream = null;
  usingCamera = false;
  videoEl.srcObject = null;
  btnStartStopCamera.textContent = "Start Camera";
}

document.getElementById("btnStartStopCamera").onclick = () => {
  usingCamera ? stopCamera() : startCamera();
};

/* ==============================
   CAPTURE IMAGE
============================== */
document.getElementById("btnCaptureOCR").onclick = function captureOnce() {
  if (!videoStream || !videoEl.videoWidth) {
    alert("Start the camera first.");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = videoEl.videoWidth;
  canvas.height = videoEl.videoHeight;
  canvas.getContext("2d").drawImage(videoEl, 0, 0);

  const dataURL = canvas.toDataURL("image/png");

  previewImg.src = dataURL;
  previewImg.style.display = "block";

  videoEl.style.display = "none";

  btnExtract.disabled = false;
  btnExtract.classList.remove("disabled-btn");

  btnEnhance.disabled = false;
  btnEnhance.classList.remove("disabled-btn");

  const btnCapture = document.getElementById("btnCaptureOCR");
  btnCapture.textContent = "Capture Again";

  btnCapture.onclick = () => {
    previewImg.src = "";
    previewImg.style.display = "none";

    videoEl.style.display = "block";

    btnExtract.disabled = true;
    btnExtract.classList.add("disabled-btn");

    btnEnhance.disabled = true;
    btnEnhance.classList.add("disabled-btn");

    btnCapture.textContent = "Capture";
    btnCapture.onclick = captureOnce;
  };
};

/* ==============================
   UPLOAD IMAGE
============================== */
document.getElementById("imageUpload").onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);

  previewImg.src = url;
  previewImg.style.display = "block";

  videoEl.style.display = "none";

  btnExtract.disabled = false;
  btnExtract.classList.remove("disabled-btn");

  btnEnhance.disabled = false;
  btnEnhance.classList.remove("disabled-btn");
};

document.getElementById("btnUploadOCR").onclick = () => {
  if (!previewImg.src) {
    alert("Upload an image first.");
    return;
  }

  btnExtract.click(); // auto-enhance + OCR
};

/* ==============================
   AUTO-ENHANCE PIPELINE (OpenCV)
============================== */
async function enhanceHandwriting(dataURL) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = dataURL;

    img.onload = function () {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      const src = cv.imread(canvas);
      let gray = new cv.Mat();
      let blur = new cv.Mat();
      let thresh = new cv.Mat();

      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.medianBlur(gray, blur, 3);

      cv.adaptiveThreshold(
        blur, thresh,
        255,
        cv.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv.THRESH_BINARY,
        35, 10
      );

      cv.imshow(canvas, thresh);

      src.delete(); gray.delete(); blur.delete(); thresh.delete();

      resolve(canvas.toDataURL());
    };
  });
}

/* ==============================
   AUTO-ENHANCE BUTTON (ONLY ENHANCE)
============================== */
btnEnhance.onclick = async () => {
  if (!previewImg.src) {
    alert("Capture or upload an image first.");
    return;
  }

  btnEnhance.textContent = "Enhancing...";
  btnEnhance.disabled = true;

  const enhanced = await enhanceHandwriting(previewImg.src);

  previewImg.src = enhanced;

  btnEnhance.textContent = "✨ Auto-enhance handwriting";
  btnEnhance.disabled = false;
};

/* ==============================
   EXTRACT (AUTO-ENHANCE + OCR)
============================== */
/* ==============================
   EXTRACT (OCR ONLY — NO ENHANCE)
============================== */
btnExtract.onclick = async () => {
  if (!previewImg.src) {
    alert("Capture or upload an image first.");
    return;
  }

  const statusEl = document.getElementById("ocrStatus");

  // Status update
  statusEl.textContent = "⏳ Running OCR...";
  statusEl.style.background = "#fef3c7";
  statusEl.style.color = "#92400e";

  // OCR directly on preview image (raw or enhanced if user clicked button)
  const result = await Tesseract.recognize(previewImg.src, selectedLang);
  const text = result.data.text;

  rawTextEl.value = text;

  const parsed = parseTodoText(text);
  jsonOutputEl.value = JSON.stringify(parsed, null, 2);

  statusEl.textContent = "✅ OCR complete";
  statusEl.style.background = "#d1fae5";
  statusEl.style.color = "#065f46";

  draftItems = parsed.items.map((item, index) => ({
    id: index,
    text: item.text,
    editing: false,
    accepted: false
  }));

  renderDraftCards();
};

/* ==============================
   PARSE OCR → LINES
============================== */
function parseTodoText(text) {
  const lines = text.split("\n")
      .map(l => l.trim())
      .filter(l => l);

  return { items: lines.map(l => ({ text: l })) };
}

/* ==============================
   RENDER DRAFT CARDS
============================== */
function renderDraftCards() {
  draftContainer.innerHTML = "";

  draftItems.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "todo-card";
    if (item.accepted) card.classList.add("accepted");

    const header = document.createElement("div");
    header.className = "todo-header";
    header.innerHTML = `<h4>${item.text}</h4>`;
    card.appendChild(header);

    const body = document.createElement("div");
    body.style.display = item.editing ? "none" : "block";
    body.textContent = item.text;
    card.appendChild(body);

    const editDiv = document.createElement("div");
    editDiv.style.display = item.editing ? "block" : "none";

    const input = document.createElement("input");
    input.value = item.text;
    editDiv.appendChild(input);

    const save = document.createElement("button");
    save.className = "btn btn-primary";
    save.textContent = "Save";
    save.onclick = () => {
      draftItems[index].text = input.value;
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

    const actions = document.createElement("div");
    actions.className = "todo-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "btn btn-outline";
    editBtn.textContent = "Edit";
    editBtn.onclick = () => {
      draftItems[index].editing = true;
      renderDraftCards();
    };

    const accept = document.createElement("button");
    accept.className = "btn btn-accept";
    accept.textContent = item.accepted ? "Accepted" : "Accept";
    if (item.accepted) accept.disabled = true;

    accept.onclick = () => {
      item.accepted = true;
      todoItems.push({ text: item.text, completed: false });
      showToast();
      renderDraftCards();
      renderTodoList();
    };

    actions.appendChild(editBtn);
    actions.appendChild(accept);

    card.appendChild(actions);
    draftContainer.appendChild(card);
  });
}

/* ==============================
   TODO LIST RENDER
============================== */
function renderTodoList() {
  todoListEl.innerHTML = "";

  todoItems.forEach((item) => {
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

/* ==============================
   JSON SYNC
============================== */
function syncJSON() {
  jsonOutputEl.value = JSON.stringify({
    items: draftItems.map(item => ({ text: item.text }))
  }, null, 2);
}

/* ==============================
   CLEAR BUTTON
============================== */
document.getElementById("btnClearDrafts").onclick = () => {
  draftItems = [];
  rawTextEl.value = "";
  jsonOutputEl.value = "";
  renderDraftCards();
};

/* ==============================
   RESET INPUTS ON LOAD
============================== */
window.onload = () => {
  document.getElementById("imageUpload").value = "";
  rawTextEl.value = "";
  jsonOutputEl.value = "";
};
