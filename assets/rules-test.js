/* ===========================================================
   보안 규칙 점검 — orders/products 읽기·쓰기 테스트
   목적: 로그인한 계정으로 보안 규칙이 어디까지 허용하는지 확인한다.
     1) 신원 표시(로그인 상태 · 이메일 · UID)
     2) orders 전체 읽기 (읽기 전용) — 짝꿍이 쓰는 기능이라 그대로 유지
     3) 주문 금액 쓰기 테스트 (연습 문서에만)
     4) 상품 가격 0원 쓰기 테스트 (연습 문서에만)
   원칙(요청사항 그대로):
     - 보안 규칙·실제 주문/상품 데이터는 절대 변경하지 않는다.
     - 쓰기 테스트는 '확인'을 받은 뒤, 내가 만든 연습 문서에만 실행하고,
       끝나면 그 문서를 지워 원래 상태(존재하지 않음)로 되돌린다.
     - 실제 상품에 영향이 없도록 연습 상품은 isVisible:false 로 만든다(진열 제외).
     - 개인정보·주문 상세는 읽기 결과에 표시하지 않는다(건수와 존재 여부만).
   =========================================================== */
import {
  getFirestore, collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, GoogleAuthProvider, signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { auth, subscribeAuth } from "./auth.js";

const db = getFirestore(auth.app);

// --- DOM ---
const $ = id => document.getElementById(id);
const statusEl = $("rt-login-status");
const emailOut = $("rt-email");
const uidOut = $("rt-uid");
const loginForm = $("rt-login-form");
const emailIn = $("rt-email-input");
const pwIn = $("rt-password-input");
const signinBtn = $("rt-signin");
const signupBtn = $("rt-signup");
const googleBtn = $("rt-google");
const logoutBtn = $("rt-logout");
const authMsg = $("rt-auth-msg");

const readBtn = $("rt-read");
const readOut = $("rt-read-result");
const orderBtn = $("rt-write-order");
const orderOut = $("rt-write-order-result");
const productBtn = $("rt-write-product");
const productOut = $("rt-write-product-result");

let currentUser = null;

// ====== 신원 표시 + 로그인/로그아웃 ======
subscribeAuth(user => {
  currentUser = user;
  if (user) {
    statusEl.textContent = "로그인됨";
    emailOut.textContent = user.email || "(이메일 없음)";
    uidOut.textContent = user.uid;
    loginForm.hidden = true;
    logoutBtn.hidden = false;
    [readBtn, orderBtn, productBtn].forEach(b => b.disabled = false);
  } else {
    statusEl.textContent = "로그아웃 상태";
    emailOut.textContent = "-";
    uidOut.textContent = "-";
    loginForm.hidden = false;
    logoutBtn.hidden = true;
    [readBtn, orderBtn, productBtn].forEach(b => b.disabled = true);
  }
});

function authErr(error) {
  return error && (error.code || error.message) || String(error);
}

// 로그인/가입은 이 페이지 안에서 처리한다 → 끝나면 그대로 이 페이지에 머문다(복귀 불필요)
signinBtn.addEventListener("click", async () => {
  authMsg.textContent = "로그인 중…";
  try {
    await signInWithEmailAndPassword(auth, emailIn.value.trim(), pwIn.value);
    pwIn.value = "";
    authMsg.textContent = "로그인되었습니다.";
  } catch (error) { authMsg.textContent = `로그인 실패: ${authErr(error)}`; }
});

signupBtn.addEventListener("click", async () => {
  authMsg.textContent = "가입 중…";
  try {
    await createUserWithEmailAndPassword(auth, emailIn.value.trim(), pwIn.value);
    pwIn.value = "";
    authMsg.textContent = "가입 및 로그인되었습니다.";
  } catch (error) { authMsg.textContent = `가입 실패: ${authErr(error)}`; }
});

googleBtn.addEventListener("click", async () => {
  // 팝업은 클릭 직후 바로 연다(차단 방지)
  const popup = signInWithPopup(auth, new GoogleAuthProvider());
  authMsg.textContent = "Google 로그인 중…";
  try { await popup; authMsg.textContent = "로그인되었습니다."; }
  catch (error) { authMsg.textContent = `Google 로그인 실패: ${authErr(error)}`; }
});

logoutBtn.addEventListener("click", async () => {
  try { await signOut(auth); authMsg.textContent = "로그아웃되었습니다."; }
  catch (error) { authMsg.textContent = `로그아웃 실패: ${authErr(error)}`; }
});

// ====== 2) orders 전체 읽기 (읽기 전용) — 기존 기능 유지 ======
readBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  readBtn.disabled = true;
  readOut.textContent = "orders 컬렉션 전체 읽기를 시도하는 중입니다…";
  try {
    const snap = await getDocs(collection(db, "orders"));
    let mine = 0, others = 0;
    snap.forEach(d => { if (d.get("userId") === currentUser.uid) mine++; else others++; });
    const verdict = others > 0
      ? `⚠️ 취약: 내 것이 아닌 주문 ${others}건이 읽혔습니다. 규칙이 타인 주문 읽기를 허용합니다.`
      : "✅ 안전: 내 것이 아닌 주문은 읽히지 않았습니다.";
    readOut.textContent = `읽기 성공 — 전체 ${snap.size}건 (내 주문 ${mine}건, 타인 주문 ${others}건). ${verdict}`;
    console.log("[규칙 점검] 읽기", { total: snap.size, mine, others });
  } catch (error) {
    readOut.textContent = `읽기 실패 — 오류 코드: ${authErr(error)} (규칙이 전체 읽기를 막고 있을 수 있습니다.)`;
    console.error("[규칙 점검] 읽기 실패", error);
  } finally {
    readBtn.disabled = false;
  }
});

/* ====== 쓰기 테스트 공통 ======
   내가 만든 '연습 문서'에만 쓴다. 절차:
   1) 연습 문서 생성(setDoc) — 생성 자체가 쓰기 권한 테스트
   2) 대상 필드 수정(updateDoc) — '금액 고치기' / '가격 0원'
   3) 수정값 확인(getDoc)
   4) 연습 문서 삭제(deleteDoc) — 원래 상태(없음)로 복구
   성공하면 "쓰기 허용(취약)", permission-denied 등이면 "차단(안전)". */
async function runWriteTest({ coll, docId, baseline, field, newValue, label, out, confirmMsg }) {
  if (!currentUser) return;
  if (!window.confirm(confirmMsg)) { out.textContent = "사용자가 취소했습니다."; return; }
  const ref = doc(db, coll, docId);
  let created = false;
  const before = baseline[field];
  try {
    out.textContent = "연습 문서에 쓰기를 시도하는 중입니다…";
    await setDoc(ref, baseline);            // 생성(= 쓰기 허용 여부)
    created = true;
    await updateDoc(ref, { [field]: newValue }); // 대상 필드 수정
    const after = (await getDoc(ref)).get(field);
    const confirmed = after === newValue;
    out.textContent =
      `⚠️ 취약: ${coll} 쓰기가 허용되었습니다 — ${label} ${before} → ${after}` +
      `${confirmed ? " (수정 확인됨)" : ""}. 연습 문서에만 적용했습니다.`;
    console.log("[규칙 점검] 쓰기 허용", { coll, field, before, after });
  } catch (error) {
    out.textContent = `✅ 안전/차단: ${coll} 쓰기 실패 — 오류 코드 ${authErr(error)}.`;
    console.error("[규칙 점검] 쓰기 실패", error);
  } finally {
    // 원복: 내가 만든 연습 문서를 삭제한다(원래 없었으므로 삭제가 복구다)
    if (created) {
      try {
        await deleteDoc(ref);
        out.textContent += " 연습 문서 삭제로 원복 완료.";
      } catch (error) {
        // 삭제가 막히면 적어도 대상 필드를 기준값으로 되돌리고, 남은 사실을 알린다
        try { await updateDoc(ref, { [field]: before }); } catch (_) {}
        out.textContent += ` 연습 문서 삭제 실패(${authErr(error)}) — 값은 되돌렸고 숨김 상태로 남아 있습니다.`;
      }
    }
  }
}

// ====== 3) 주문 금액 쓰기 테스트 (연습 주문 문서) ======
orderBtn.addEventListener("click", () => runWriteTest({
  coll: "orders",
  docId: `__rules_test_order__${currentUser.uid}`,
  baseline: { userId: currentUser.uid, totalPrice: 1000, status: "practice", items: [], __rulesTest: true },
  field: "totalPrice",
  newValue: 999999,
  label: "주문 금액",
  out: orderOut,
  confirmMsg: "연습용 주문 문서를 만들어 금액 쓰기를 시험하고, 끝나면 삭제(원복)합니다. 실제 주문은 건드리지 않습니다. 진행할까요?"
}));

// ====== 4) 상품 가격 0원 쓰기 테스트 (연습 상품 문서, 진열 제외) ======
productBtn.addEventListener("click", () => runWriteTest({
  coll: "products",
  docId: `__rules_test_product__${currentUser.uid}`,
  baseline: { name: "연습-규칙테스트(삭제예정)", price: 1000, isVisible: false, stock: 0, __rulesTest: true },
  field: "price",
  newValue: 0,
  label: "상품 가격",
  out: productOut,
  confirmMsg: "진열되지 않는(isVisible:false) 연습 상품을 만들어 가격 0원 쓰기를 시험하고, 끝나면 삭제(원복)합니다. 실제 상품은 건드리지 않습니다. 진행할까요?"
}));
