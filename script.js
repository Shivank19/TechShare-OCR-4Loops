/* ==============================
   GLOBAL STATE
============================== */
let currentMode = "fast";
let selectedLang = "eng";
let videoStream = null;
let usingCamera = false;

let draftItems = [];
let todoItems = [];

/* Element refs */
const modeFastBtn = document.getElementById("modeFast");
const modeAccurateBtn = document.getElementById("modeAccurate");
const langSelect = document.getElementById("langSelect");

const videoEl = document.getElementById("video");
const previewImg = document.getElementById("preview");

const rawTextEl = document.getElementById("rawText");
const jsonOutputEl = document.getElementById("jsonOutput");

const draftContainer = document.getElementById("draftContainer");
const todoListEl = document.getElementById("todoList");

const pageCapture = document.getElementById("pageCapture");
const pageTodo = document.getElementById("pageTodo");

const toast = document.getElementById("toast");

/* ==============================
   TOAST FEEDBACK
============================== */
function showToast() {
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

/* ==============================
   MODE & LANGUAGE SWITCH
============================== */
modeFastBtn.onclick = () => {
  currentMode = "fast";
  modeFastBtn.classList.add("active");
  modeAccurateBtn.classList.remove("active");
  document.getElementById("modeStatus").textContent = "⚡ Fast mode enabled";
  document.getElementById("modeStatus").style.background = "#fef3c7";
  document.getElementById("modeStatus").style.color = "#92400e";
};


modeAccurateBtn.onclick = () => {
  currentMode = "accurate";
  modeAccurateBtn.classList.add("active");
  modeFastBtn.classList.remove("active");
  document.getElementById("modeStatus").textContent = "🎯 Accurate mode enabled";
  document.getElementById("modeStatus").style.background = "#dbeafe";
  document.getElementById("modeStatus").style.color = "#1e3a8a";
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
   CAMERA START/STOP
============================== */
async function startCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
    videoEl.srcObject = videoStream;
    usingCamera = true;
    btnStartStopCamera.textContent = "Stop Camera";
  } catch (err) {
    console.error("Camera error", err);
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
  }
  videoStream = null;
  videoEl.srcObject = null;
  usingCamera = false;
  btnStartStopCamera.textContent = "Start Camera";
}

document.getElementById("btnStartStopCamera").onclick = () => {
  if (usingCamera) stopCamera();
  else startCamera();
};

/* ==============================
   CAPTURE IMAGE
============================== */
document.getElementById("btnCaptureOCR").onclick = () => {
  if (!videoStream || !videoEl.videoWidth) {
    alert("Start the camera first");
    return;
  }

  const scale = currentMode === "fast" ? 0.9 : 1.0;
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

/* ==============================
   IMAGE UPLOAD — preview immediately
============================== */
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

/* ==============================
   OCR PROCESSING
============================== */
async function performOCR(dataURL) {
  document.getElementById("ocrStatus").textContent = "⏳ Running OCR...";
  document.getElementById("ocrStatus").style.background = "#fef3c7";
  document.getElementById("ocrStatus").style.color = "#92400e";
  const result = await Tesseract.recognize(dataURL, selectedLang);
  const text = result.data.text;

  rawTextEl.value = text;

  const parsed = parseTodoText(text);
  jsonOutputEl.value = JSON.stringify(parsed, null, 2);

  document.getElementById("ocrStatus").textContent = "✅ OCR complete";
  document.getElementById("ocrStatus").style.background = "#d1fae5";
  document.getElementById("ocrStatus").style.color = "#065f46";

  draftItems = parsed.items.map((item, index) => ({
    id: index,
    text: item.text,
    editing: false,
    accepted: false
  }));

  renderDraftCards();
}

/* ==============================
   PARSER
============================== */
function parseTodoText(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l);
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

    if (item.accepted) {
      card.classList.add("accepted");
    }

    /* Header */
    const header = document.createElement("div");
    header.className = "todo-header";
    header.innerHTML = `<h4>${item.text}</h4>`;
    card.appendChild(header);

    /* Body */
    const body = document.createElement("div");
    body.style.display = item.editing ? "none" : "block";
    body.textContent = item.text;
    card.appendChild(body);

    /* Edit Mode */
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

    /* Actions */
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
   TODO LIST
============================== */
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

/* ==============================
   JSON SYNC
============================== */
function syncJSON() {
  jsonOutputEl.value = JSON.stringify({
    items: draftItems.map(item => ({ text: item.text }))
  }, null, 2);
}

/* ==============================
   CLEAR
============================== */
document.getElementById("btnClearDrafts").onclick = () => {
  draftItems = [];
  rawTextEl.value = "";
  jsonOutputEl.value = "";
  renderDraftCards();
};
/* RESET UPLOAD FIELD ON PAGE LOAD ----------------------- */
window.onload = () => {
  const uploadInput = document.getElementById("imageUpload");
  if (uploadInput) uploadInput.value = "";
};
window.onload = () => {
  const uploadInput = document.getElementById("imageUpload");
  if (uploadInput) uploadInput.value = "";
};
window.onload = () => {
  const uploadInput = document.getElementById("rawText");
  if (uploadInput) uploadInput.value = "";
};
window.onload = () => {
  const uploadInput = document.getElementById("jsonOutput");
  if (uploadInput) uploadInput.value = "";
};