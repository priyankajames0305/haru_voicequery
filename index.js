/* ═══════════════════════════════════════════════════════════════
   VOICE SUPPORT — script.js   FINAL WORKING VERSION
═══════════════════════════════════════════════════════════════ */

const PABBLY_WEBHOOK_URL = "https://connect.pabbly.com/webhook-listener/webhook/IjU3NjIwNTY0MDYzMzA0MzY1MjZjNTUzMyI_3D_pc/IjU3NjcwNTZlMDYzMzA0MzY1MjY0NTUzNTUxMzEi_pc";

/* ─── STATE ─── */
let recog = null;
let isRecording = false;
let isStarting = false;
let shouldKeepListening = false;
let finalText = "";
let sessionFinalCount = 0;
let timerInterval = null;
let seconds = 0;

/* ─── GET ELEMENTS ─── */
const micBtn = document.getElementById("micBtn");
const micIcon = micBtn.querySelector(".mic-icon");
const stopIcon = micBtn.querySelector(".stop-icon");
const micStage = micBtn.closest(".mic-stage");

const timerBlock = document.getElementById("timerBlock");
const timerLabel = document.getElementById("timerLabel");
const timerBar = document.getElementById("timerBar");

const statusChip = document.getElementById("statusChip");
const statusText = document.getElementById("statusText");

const btnReview = document.getElementById("btnReview");

const queryBox = document.getElementById("queryTextarea");
const queryBoxOriginal = document.getElementById("queryTextareaOriginal");

const procOverlay = document.getElementById("processingOverlay");

const langSelect = document.getElementById("langSelect");
const langSelectTrigger = document.getElementById("langSelectTrigger");
const langSelectLabel = document.getElementById("langSelectLabel");
const langSelectMenu = document.getElementById("langSelectMenu");

const codeSelect = document.getElementById("countryCode");
const phoneInput = document.getElementById("phoneInput");
const phoneError = document.getElementById("phoneError");

const btnSend = document.getElementById("btnSend");
const sendOverlay = document.getElementById("sendingOverlay");
const chromeBanner = document.getElementById("chromeBanner");

const dots = document.querySelectorAll(".dot");
const isMobile = /Mobi|Android/i.test(navigator.userAgent);
const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

/* ──────────────────────────────────────────────────────────────
   DOTS
────────────────────────────────────────────────────────────── */
function updateDots(n) {
  dots.forEach((d, i) => {
    d.classList.remove("active", "done");

    if (i + 1 < n) d.classList.add("done");
    if (i + 1 === n) d.classList.add("active");
  });
}

function populateLangSelectMenu() {
  langSelectMenu.innerHTML = "";

  Array.from(langSelect.options).forEach((option, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "custom-select-item";
    item.setAttribute("role", "option");
    item.setAttribute("aria-selected", option.selected ? "true" : "false");
    item.dataset.value = option.value;
    item.textContent = option.textContent;

    item.addEventListener("click", () => {
      langSelect.value = option.value;
      langSelectLabel.textContent = option.textContent;
      toggleLangSelectMenu(false);
      populateLangSelectMenu();
    });

    langSelectMenu.appendChild(item);
  });
}

function toggleLangSelectMenu(show) {
  const isOpen = !langSelectMenu.classList.contains("hidden");
  const shouldOpen = typeof show === "boolean" ? show : !isOpen;

  if (shouldOpen) {
    langSelectMenu.classList.remove("hidden");
    langSelectTrigger.setAttribute("aria-expanded", "true");
  } else {
    langSelectMenu.classList.add("hidden");
    langSelectTrigger.setAttribute("aria-expanded", "false");
  }
}

function closeLangSelectMenu(event) {
  if (
    langSelectMenu.classList.contains("hidden") ||
    langSelectTrigger.contains(event.target) ||
    langSelectMenu.contains(event.target)
  ) {
    return;
  }

  toggleLangSelectMenu(false);
}

/* ──────────────────────────────────────────────────────────────
   SCREEN CONTROL
────────────────────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.remove("active");
  });

  document.getElementById(id).classList.add("active");
}

function updateSupportBanner() {
  if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
    chromeBanner.textContent =
      "⚠ Your browser does not support voice recording. Open this page in mobile Chrome for best results.";
    chromeBanner.classList.remove("hidden");
    return;
  }

  if (isMobile && !isChrome) {
    chromeBanner.textContent =
      "⚠ For best mobile performance, use Google Chrome and allow microphone access.";
    chromeBanner.classList.remove("hidden");
    return;
  }

  chromeBanner.classList.add("hidden");
}

function goToReview() {
  if (!finalText.trim()) {
    alert("Nothing recorded yet!");
    return;
  }

  showScreen("screenReview");
  updateDots(2);

  queryBoxOriginal.value = finalText.trim();
  queryBox.value = "";

  procOverlay.classList.remove("hidden");

  translateInBackground(finalText.trim(), langSelect.value);

  validateForm();
}

function goBack() {
  showScreen("screenRecord");
  updateDots(1);
}

function resetApp() {
  if (recog && isRecording) {
    recog.stop();
  }

  recog = null;
  isRecording = false;
  finalText = "";
  seconds = 0;

  clearInterval(timerInterval);

  micIcon.classList.remove("hidden");
  stopIcon.classList.add("hidden");

  micBtn.classList.remove("recording");
  micStage.classList.remove("recording");

  timerBlock.classList.remove("visible");

  timerLabel.textContent = "00:00";
  timerBar.style.width = "0%";

  btnReview.classList.add("hidden");

  queryBox.value = "";
  queryBoxOriginal.value = "";

  phoneInput.value = "";

  btnSend.disabled = true;

  setStatus("ready", "Ready to record");

  showScreen("screenRecord");
  updateDots(1);
}

/* ──────────────────────────────────────────────────────────────
   STATUS
────────────────────────────────────────────────────────────── */
function setStatus(state, msg) {
  statusChip.className = "status-chip " + state;
  statusText.textContent = msg;
}

/* ──────────────────────────────────────────────────────────────
   MIC BUTTON
────────────────────────────────────────────────────────────── */
micBtn.addEventListener("click", function () {
  if (isRecording) {
    stopRec();
  } else {
    startRec();
  }
});

langSelectTrigger.addEventListener("click", function () {
  toggleLangSelectMenu();
});

langSelectTrigger.addEventListener("keydown", function (event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    toggleLangSelectMenu();
  }
});

window.addEventListener("click", closeLangSelectMenu);
window.addEventListener("touchstart", closeLangSelectMenu);
window.addEventListener("resize", function () {
  toggleLangSelectMenu(false);
});

function startRec() {
  if (isRecording || isStarting) return;

  const SR =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SR) {
    alert("Use Google Chrome browser.");
    return;
  }

  isStarting = true;
  micBtn.disabled = true;

  recog = new SR();

  recog.continuous = true;
  recog.interimResults = true;
  recog.maxAlternatives = 1;
  recog.lang = langSelect.value || navigator.language || "en-US";

  finalText = "";

  recog.onstart = function () {
    isRecording = true;
    isStarting = false;
    micBtn.disabled = false;
    shouldKeepListening = true;
    isRecording = true;
    shouldKeepListening = true;

    micIcon.classList.add("hidden");
    stopIcon.classList.remove("hidden");

    micBtn.classList.add("recording");
    micStage.classList.add("recording");

    timerBlock.classList.add("visible");

    btnReview.classList.add("hidden");

    setStatus("recording", "Recording...");

    seconds = 0;

    timerInterval = setInterval(function () {
      seconds++;

      const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
      const ss = String(seconds % 60).padStart(2, "0");

      timerLabel.textContent = mm + ":" + ss;

      timerBar.style.width = (seconds / 60) * 100 + "%";

      if (seconds >= 60) {
        stopRec();
      }
    }, 1000);
  };

  recog.onresult = function (e) {
    const results = Array.from(e.results);

    finalText = results
      .filter((result) => result.isFinal)
      .map((result) => result[0].transcript.trim())
      .filter(Boolean)
      .join(" ");

    const interim = results
      .filter((result) => !result.isFinal)
      .map((result) => result[0].transcript.trim())
      .filter(Boolean)
      .join(" ");

    const display = (finalText + " " + interim).replace(/\s+/g, " ").trim();

    setStatus(
      "recording",
      display
        ? "Hearing: " + display.substring(0, 40)
        : "Recording..."
    );
  };

  recog.onspeechstart = function () {
    setStatus("recording", "Voice detected — keep speaking...");
  };

  recog.onnomatch = function () {
    setStatus("recording", "Could not recognize that. Please speak clearly.");
  };

  recog.onaudiostart = function () {
    setStatus("recording", "Listening...");
  };

  recog.onend = function () {
    clearInterval(timerInterval);
    isRecording = false;
    micBtn.disabled = false;

    micIcon.classList.remove("hidden");
    stopIcon.classList.add("hidden");

    micBtn.classList.remove("recording");
    micStage.classList.remove("recording");

    if (finalText.trim()) {
      setStatus("done", "Done! Review & Send");

      btnReview.classList.remove("hidden");
    } else {
      setStatus("ready", "Nothing heard");
    }
  };

  recog.onerror = function (e) {
    clearInterval(timerInterval);

    isRecording = false;
    isStarting = false;
    micBtn.disabled = false;

    micIcon.classList.remove("hidden");
    stopIcon.classList.add("hidden");

    micBtn.classList.remove("recording");
    micStage.classList.remove("recording");

    if (e.error === "not-allowed") {
      alert(
        "Microphone blocked.\n\nAllow microphone permission in Chrome."
      );
    }

    setStatus("ready", "Error: " + e.error);
  };

  recog.start();
}

function stopRec() {
  if (recog && isRecording) {
    micBtn.disabled = true;
    recog.stop();
  }
}

/* ──────────────────────────────────────────────────────────────
   TRANSLATION
────────────────────────────────────────────────────────────── */
function translateInBackground(text, langCode) {
  procOverlay.classList.remove("hidden");

  const sourceLang = langCode
    ? langCode.split("-")[0]
    : "";

  if (!sourceLang || sourceLang === "en") {
    queryBox.value = text;

    procOverlay.classList.add("hidden");

    validateForm();

    return;
  }

  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text) +
    "&langpair=" +
    sourceLang +
    "|en";

  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      procOverlay.classList.add("hidden");

      const out =
        data &&
        data.responseData &&
        data.responseData.translatedText;

      queryBox.value = out || text;

      validateForm();
    })
    .catch(() => {
      procOverlay.classList.add("hidden");

      queryBox.value = text;

      validateForm();
    });
}

/* ──────────────────────────────────────────────────────────────
   VALIDATION
────────────────────────────────────────────────────────────── */
phoneInput.addEventListener("input", function () {
  phoneInput.value = phoneInput.value.replace(/\D/g, "");

  validateForm();
});

queryBox.addEventListener("input", validateForm);

function validateForm() {
  const phone = phoneInput.value.trim();

  const query = queryBox.value.trim();

  const ok = /^\d{7,15}$/.test(phone);

  if (phone && !ok) {
    phoneInput.classList.add("error");

    phoneError.classList.remove("hidden");
  } else {
    phoneInput.classList.remove("error");

    phoneError.classList.add("hidden");
  }

  btnSend.disabled = !(ok && query.length > 0);
}

/* ──────────────────────────────────────────────────────────────
   SEND TO PABBLY
────────────────────────────────────────────────────────────── */
function sendQuery() {
  const code = codeSelect.value;

  const number = phoneInput.value.trim();

  const fullPhone = "'" + code + " " + number;

  const query = queryBox.value.trim();


  const now = new Date();

  const timestamp =
    now.toLocaleString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata"
    }) + " IST";

  const payload = {
  subject: "New Query from " + fullPhone,

  email_body:
    "Query (English): " + query +
    "\nMobile Number: " + fullPhone +
    "\nSubmitted at: " + timestamp,

  mobile_number: fullPhone,

  translated_query: query,

  submitted_at: timestamp
};

  sendOverlay.classList.remove("hidden");

  btnSend.disabled = true;

  console.log("Sending:", payload);

  fetch(PABBLY_WEBHOOK_URL, {
    method: "POST",
    mode: "no-cors",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(function () {
      sendOverlay.classList.add("hidden");

      showScreen("screenSuccess");

      updateDots(3);
    })
    .catch(function (err) {
      sendOverlay.classList.add("hidden");

      btnSend.disabled = false;

      alert("Failed to send\n" + err.message);
    });
}

populateLangSelectMenu();
updateSupportBanner();
