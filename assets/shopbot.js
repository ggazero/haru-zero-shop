/* ===========================================================
   상품 안내 챗봇 — 첫 화면 오른쪽 아래 버튼 + 작은 대화 창
   질문 하나를 Callable 함수 askShopBot 에 보내고 답 하나를 받는다.
   API 키는 서버(Secret Manager)에만 있고 이 파일에는 없다.
   =========================================================== */
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import { auth, subscribeAuth } from "./auth.js";

const MAX_QUESTION = 200; // 서버 askShopBot 과 같은 제한
const LOGIN_NEEDED = "로그인한 뒤에 물어볼 수 있어요";

const askShopBot = httpsCallable(getFunctions(auth.app, "us-central1"), "askShopBot");

// --- 화면 만들기 ---
const toggle = document.createElement("button");
toggle.type = "button";
toggle.className = "bot-toggle";
toggle.setAttribute("aria-label", "상품 안내 챗봇 열기");
toggle.setAttribute("aria-expanded", "false");
toggle.setAttribute("aria-controls", "bot-panel");
toggle.textContent = "💬";

const panel = document.createElement("section");
panel.className = "bot-panel";
panel.id = "bot-panel";
panel.hidden = true;
panel.setAttribute("aria-label", "상품 안내 챗봇");
panel.innerHTML = `
  <div class="bot-head">
    <h2>상품 안내</h2>
    <button type="button" class="bot-close" aria-label="챗봇 닫기">×</button>
  </div>
  <div class="bot-log" role="log" aria-live="polite"></div>
  <form class="bot-form">
    <input type="text" name="q" maxlength="${MAX_QUESTION}" placeholder="상품 이름이나 가격을 물어보세요" aria-label="질문" autocomplete="off">
    <button type="submit" class="btn">보내기</button>
  </form>`;

document.body.append(toggle, panel);

const log = panel.querySelector(".bot-log");
const form = panel.querySelector(".bot-form");
const input = form.elements.q;
const sendBtn = form.querySelector("button[type=submit]");

let currentUser = null;
let busy = false;

function addMsg(text, kind) {
  const p = document.createElement("p");
  p.className = "bot-msg " + kind;
  p.textContent = text; // 답변은 글자로만 넣는다 (HTML 해석 안 함)
  log.append(p);
  log.scrollTop = log.scrollHeight;
  return p;
}

function setOpen(open) {
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "상품 안내 챗봇 닫기" : "상품 안내 챗봇 열기");
  if (open && currentUser) input.focus();
}

function syncLogin() {
  input.disabled = !currentUser || busy;
  sendBtn.disabled = !currentUser || busy;
  input.placeholder = currentUser ? "상품 이름이나 가격을 물어보세요" : LOGIN_NEEDED;
}

toggle.addEventListener("click", () => setOpen(panel.hidden));
panel.querySelector(".bot-close").addEventListener("click", () => { setOpen(false); toggle.focus(); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && !panel.hidden) { setOpen(false); toggle.focus(); }
});

addMsg("안녕하세요! 작은상점 상품의 이름과 가격을 물어보세요.", "bot-info");

subscribeAuth(user => {
  const wasLoggedIn = !!currentUser;
  currentUser = user;
  syncLogin();
  if (!user && (wasLoggedIn || !log.querySelector(".bot-login"))) {
    addMsg(LOGIN_NEEDED, "bot-info bot-login");
  }
});

form.addEventListener("submit", async e => {
  e.preventDefault();
  if (busy) return;
  if (!currentUser) { addMsg(LOGIN_NEEDED, "bot-info"); return; }
  const question = input.value.trim();
  if (!question) { addMsg("질문을 입력해 주세요", "bot-info"); return; }
  if (question.length > MAX_QUESTION) { addMsg(`질문은 ${MAX_QUESTION}자 이내로 적어 주세요`, "bot-info"); return; }

  addMsg(question, "bot-me");
  input.value = "";
  busy = true;
  syncLogin();
  const waiting = addMsg("생각하는 중…", "bot-ai");
  try {
    const result = await askShopBot({ question });
    waiting.textContent = result.data?.answer || "그건 제가 아직 모르는 내용이에요";
  } catch (error) {
    // 서버가 보낸 안내 문구만 보여 준다. 그 밖의 오류는 일반 문구로.
    const known = ["unauthenticated", "invalid-argument", "internal"];
    const code = String(error?.code || "").replace(/^functions\//, "");
    waiting.textContent = known.includes(code) && error.message
      ? error.message
      : "지금은 답하기 어려워요. 잠시 뒤에 다시 물어봐 주세요";
    waiting.className = "bot-msg bot-info";
    console.error("[챗봇] 실패", code);
  } finally {
    busy = false;
    syncLogin();
    if (!panel.hidden && currentUser) input.focus();
  }
});
