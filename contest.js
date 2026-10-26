// 사진 공모전 화면 공통: API 호출 · 본인 확인 · 사진 축소
const API = "https://script.google.com/macros/s/AKfycbzyutzVn-DOAiLSCu-HCLTPK896NtdJvj74GlkOLojGBbI0Zn_k-ImG5G2n1IK3fpTCjQ/exec";
const ME_KEY = "contest_me";
// 서버(knox_)와 같은 규칙: 영숫자로 시작, 영숫자 . _ @ - 만, 40자 이하
const KNOX_RE = /^[a-z0-9][a-z0-9._@-]*$/;
const KNOX_HELP = "Knox ID는 영문·숫자·. _ - @ 만 입력할 수 있어요 (첫 글자는 영문·숫자).";

function knoxOk(knox) { return knox.length <= 40 && KNOX_RE.test(knox); }

// 본인 정보는 메모리에 먼저 두고 localStorage는 가능할 때만 쓴다
// (사생활 보호 모드 등으로 저장이 막혀도 현재 탭에서는 계속 진행)
let memMe; // undefined: 아직 안 읽음, null: 없음

// 규칙에 맞지 않는 예전 기록은 무시하고 다시 입력받는다
function getMe() {
  if (memMe !== undefined) return memMe;
  try {
    const me = JSON.parse(localStorage.getItem(ME_KEY));
    memMe = me && me.name && knoxOk(String(me.knox || "")) ? me : null;
  } catch (e) { memMe = null; }
  return memMe;
}
function setMe(me) {
  memMe = me;
  try { localStorage.setItem(ME_KEY, JSON.stringify(me)); } catch (e) {}
}
function clearMe() {
  memMe = null;
  try { localStorage.removeItem(ME_KEY); } catch (e) {}
}

// GET + 쿠키 미전송: 구글 계정 로그인 상태와 무관하게 동작
async function apiGet(params) {
  const res = await fetch(API + "?" + new URLSearchParams(params), { credentials: "omit" });
  return res.json();
}

// text/plain 이라 CORS 사전 요청 없이 Apps Script로 전송됨
async function apiPost(body) {
  const res = await fetch(API, {
    method: "POST", credentials: "omit",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function toast(text) {
  let t = document.getElementById("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
  t.textContent = text;
  t.classList.add("on");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("on"), 2600);
}

// 이름·Knox ID 입력 폼을 el에 그리고, 입력이 끝나면 기기에 기억한다
function askMe(el, { emoji, title, desc }) {
  return new Promise(resolve => {
    el.innerHTML = `
      <div class="emoji">${emoji}</div>
      <h1>${title}</h1>
      <p>${desc}</p>
      <form id="me">
        <label for="name">이름</label>
        <input id="name" autocomplete="name" maxlength="30" required>
        <label for="knox">Knox ID</label>
        <input id="knox" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="40" required>
        <button>시작하기</button>
        <div class="msg" id="msg"></div>
      </form>`;
    el.querySelector("#me").addEventListener("submit", e => {
      e.preventDefault();
      const name = el.querySelector("#name").value.trim();
      const knox = el.querySelector("#knox").value.trim().toLowerCase();
      if (!name || !knox) { el.querySelector("#msg").textContent = "이름과 Knox ID를 모두 입력해 주세요."; return; }
      if (!knoxOk(knox)) { el.querySelector("#msg").textContent = KNOX_HELP; return; }
      setMe({ name, knox });
      resolve({ name, knox });
    });
  });
}

// 긴 변 max px JPEG로 줄인다 (공원 LTE에서도 빠르게 올라가도록)
async function shrinkImage(file, max = 1600, quality = 0.85) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
