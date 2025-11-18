# 📝 OCR Todo List – Browser-Based OCR Using Tesseract.js

This project demonstrates how to build a **client-side OCR-powered Todo List** using **Tesseract.js**, HTML, CSS, and JavaScript — no backend required.  
Users can upload an image or capture one through their camera, extract text using OCR, and convert it into editable tasks.

---

# 📘 About Tesseract.js

[Tesseract.js](https://github.com/naptha/tesseract.js) is a pure JavaScript port of Google’s Tesseract OCR engine. It runs **entirely in the browser using WebAssembly**, making it:

- 💡 Lightweight  
- 🔒 Privacy-friendly (images never leave the device)  
- 🌐 Multi-language capable  
- ⚙️ Easy to integrate with plain JS or frameworks  
- 🧵 Worker-enabled to keep the UI responsive  

Tesseract.js supports **100+ languages**, provides confidence scores, bounding boxes, and can run OCR in parallel using schedulers.

---

# 🚀 Getting Started

This project uses a simple **HTML + CSS + JavaScript** structure with the **Tesseract.js CDN**.

### **1. Clone the repository**
```bash
git clone [https://github.com/<your-username>/<repo-name>.git](https://github.com/Shivank19/TechShare-OCR-4Loops.git)
cd TechShare-OCR-4Loops
```
### **2. Run a local dev server (REQUIRED, especially for Web Workers)**

Tesseract.js workers do not run through the file:// protocol.
Use any simple local server:

VS Code Live Server
```bash
Right-click → Open with Live Server
```

Node
```bash
npx live-server
```

Python
```bash
python -m http.server
```

# 🧠 Using Tesseract.js (Basic Setup)

### **You can load Tesseract.js directly via CDN:**
```bash
<script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>
```

### **Or you can use npm or yarn**
```bash
npm install tesseract
```

```bash
yarn add tesseract
```

### Using Workers in Tesseract
```bash
async function initWorker(lang = "eng") {
  const worker = await Tesseract.createWorker({
    workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
    corePath:   "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract-core.wasm.js",
    langPath:   "https://tessdata.projectnaptha.com/4.0.0/"
  });

  await worker.loadLanguage(lang);
  await worker.initialize(lang);

  return worker;
}

async function runOCR(image) {
  const worker = await initWorker('eng');
  const { data } = await worker.recognize(image);
  recognized_text = data.text;
  await worker.terminate();
}

```
**An example for using workers is available in [Examples](https://github.com/Shivank19/TechShare-OCR-4Loops/tree/main/examples)**


# 📚 Additional Resources
### [**🔗 Tesseract.js Documentation**](https://tesseract.projectnaptha.com/)
### [**🔗 Tesseract.js API Documentation**](https://github.com/naptha/tesseract.js/blob/master/docs/api.md )
### [**🔗 Tesseract Trained Data Files**](https://tesseract-ocr.github.io/tessdoc/Data-Files)
### [**🔗 OpenCV.js Documentation**](https://docs.opencv.org/4.12.0/d2/df0/tutorial_js_table_of_contents_imgproc.html )



