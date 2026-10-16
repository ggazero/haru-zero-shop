/* ===========================================================
   보안 규칙 점검 — orders/products 읽기·쓰기 테스트
   목적: 로그인한 계정으로 보안 규칙이 어디까지 허용하는지 확인한다.
     1) 신원 표시(로그인 상태 · 이메일 · UID)
     2) 주문 전체 읽기(읽기 전용) — 건수 + 각 주문의 문서ID·userId·totalPrice 표
     3) 내 주문 금액 고치기 — 내 기존 주문 totalPrice 를 1 로
     4) 상품 가격 0원으로 — products/p1 의 price 를 0 으로
   안전 원칙(요청사항 그대로):
     - Firebase 보안 규칙은 변경하지 않는다.
     - 쓰기 테스트는 실제 데이터를 대상으로 하되, 버튼 클릭 뒤 확인 창에서
       사용자가 명시적으로 동의하기 전에는 절대 쓰지 않는다.
     - 쓰기 전에 원래 값과 변경 대상을 화면에 보여 준다.
     - 쓰기 성공 시 곧바로 원래 값으로 자동 복구를 시도하고,
       복구 실패 시 원래 값을 화면에 남겨 수동 복구할 수 있게 한다(복구 주의사항 표시).
   로그인/로그아웃은 기존 기능을 재사용한다(중복 구현하지 않음):
     - 로그인: login.html?next=rules-test.html 로 이동 → 로그인 후 자동 복귀.
     - 로그아웃: 헤더(auth-ui.js)의 로그아웃을 사용(이 화면에는 두지 않음).
   =========================================================== */
import {
  getFirestore, collection, doc, query, where, getDocs, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, subscribeAuth } from "./auth.js";

const db = getFirestore(auth.app);

// --- DOM ---
const $ = id => document.getElementById(id);
const statusEl = $("rt-login-status");
const emailOut = $("rt-email");
const uidOut = $("rt-uid");
const loginLink = $("rt-login-link");

const readBtn = $("rt-read");
const readOut = $("rt-read-result");
const orderBtn = $("rt-write-order");
const orderOut = $("rt-write-order-result");
const productBtn = $("rt-write-product");
const productOut = $("rt-write-product-result");

let currentUser = null;

function errText(error) {
  return error && (error.code || error.message) || String(error);
}
const won = n => Number(n).toLocaleString("ko-KR");

// ====== 1) 신원 표시 + 로그인 안내 ======
subscribeAuth(user => {
  currentUser = user;
  if (user) {
    statusEl.textContent = "로그인됨";
    emailOut.textContent = user.email || "(이메일 없음)";
    uidOut.textContent = user.uid;
    loginLink.hidden = true; // 로그인 상태에서는 로그인 이동 버튼 숨김
    [readBtn, orderBtn, productBtn].forEach(b => b.disabled = false);
  } else {
    statusEl.textContent = "로그아웃 상태";
    emailOut.textContent = "-";
    uidOut.textContent = "-";
    loginLink.hidden = false;
    [readBtn, orderBtn, productBtn].forEach(b => b.disabled = true);
  }
});

// ====== 2) 주문 전체 읽기 (읽기 전용) ======
// 각 주문의 문서 ID · userId · totalPrice 를 표로 보여 준다(내 것/타인 구분).
readBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  readBtn.disabled = true;
  readOut.textContent = "orders 컬렉션 전체 읽기를 시도하는 중입니다…";
  try {
    const snap = await getDocs(collection(db, "orders"));
    let mine = 0, others = 0;
    const rows = [];
    snap.forEach(d => {
      const uid = d.get("userId");
      const isMine = uid === currentUser.uid;
      if (isMine) mine++; else others++;
      rows.push({ id: d.id, uid: uid == null ? "(없음)" : String(uid), total: d.get("totalPrice"), isMine });
    });

    const summary = document.createElement("p");
    summary.className = "rt-result";
    const verdict = others > 0
      ? `⚠️ 취약: 내 것이 아닌 주문 ${others}건이 읽혔습니다. 규칙이 타인 주문 읽기를 허용합니다.`
      : "✅ 안전: 내 것이 아닌 주문은 읽히지 않았습니다.";
    summary.textContent = `읽기 성공 — 전체 ${snap.size}건 (내 주문 ${mine}건, 타인 주문 ${others}건). ${verdict}`;

    readOut.replaceChildren(summary);
    if (rows.length) {
      const wrap = document.createElement("div");
      wrap.className = "rt-table-wrap";
      const table = document.createElement("table");
      table.className = "rt-table";
      const thead = document.createElement("thead");
      thead.innerHTML = "<tr><th>#</th><th>문서 ID</th><th>userId</th><th>totalPrice</th><th>구분</th></tr>";
      const tbody = document.createElement("tbody");
      rows.forEach((r, i) => {
        const tr = document.createElement("tr");
        const cells = [
          String(i + 1),
          r.id,
          r.uid,
          r.total == null ? "-" : won(r.total),
          r.isMine ? "내 주문" : "타인"
        ];
        cells.forEach((text, c) => {
          const td = document.createElement("td");
          td.textContent = text;
          if (c === 4) td.className = r.isMine ? "rt-mine" : "rt-other";
          tr.append(td);
        });
        tbody.append(tr);
      });
      table.append(thead, tbody);
      wrap.append(table);
      readOut.append(wrap);
    }
    console.log("[규칙 점검] 읽기", { total: snap.size, mine, others });
  } catch (error) {
    readOut.textContent = `읽기 실패 — 오류 코드: ${errText(error)} (규칙이 전체 읽기를 막고 있을 수 있습니다.)`;
    console.error("[규칙 점검] 읽기 실패", error);
  } finally {
    readBtn.disabled = false;
  }
});

/* ====== 실제 데이터 쓰기 테스트 공통 ======
   절차:
   1) 대상 문서를 읽어 원래 값을 확인하고 화면에 보여 준다(여기까지는 읽기).
   2) 확인 창(window.confirm)에서 사용자가 동의해야만 실제로 쓴다.
   3) 쓰기(updateDoc) → 읽어서 변경 확인(getDoc).
   4) 곧바로 원래 값으로 자동 복구(updateDoc). 실패하면 원래 값을 화면에 남긴다.
   성공하면 "쓰기 허용(취약)", permission-denied 등이면 "차단(안전)". */
async function runRealWriteTest({ ref, field, newValue, label, out, targetName }) {
  if (!currentUser) return;
  // 1) 원래 값 읽기 (읽기만)
  out.textContent = `${targetName} 의 현재 값을 읽는 중입니다…`;
  let original;
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) { out.textContent = `${targetName} 문서가 없어 테스트할 수 없습니다.`; return; }
    original = snap.get(field);
  } catch (error) {
    out.textContent = `원래 값 읽기 실패 — 오류 코드 ${errText(error)}.`;
    return;
  }

  const origView = original == null ? "(없음)" : won(original);
  // 쓰기 전에 원래 값·변경 대상을 화면에 표시
  out.textContent = `대상: ${targetName} / ${label} 원래 값 ${origView} → ${won(newValue)} (으)로 변경 예정. 확인 창에 동의해야만 실제로 씁니다.`;

  // 2) 명시적 확인 — 동의 전에는 절대 쓰지 않는다
  const agreed = window.confirm(
    `실제 데이터 쓰기 테스트입니다.\n\n대상: ${targetName}\n${label}: ${origView} → ${won(newValue)}\n\n` +
    `동의하면 지금 실제로 씁니다. 쓰기 성공 시 곧바로 원래 값(${origView})으로 자동 복구를 시도합니다.\n진행할까요?`
  );
  if (!agreed) { out.textContent = `사용자가 취소했습니다. (쓰기 실행 안 함) 원래 값 ${origView} 유지.`; return; }

  // 3) 실제 쓰기
  try {
    await updateDoc(ref, { [field]: newValue });
    const after = (await getDoc(ref)).get(field);
    const confirmed = after === newValue;
    let msg = `⚠️ 취약: 쓰기가 허용되었습니다 — ${targetName} ${label} ${origView} → ${won(after)}${confirmed ? " (변경 확인됨)" : ""}.`;
    // 4) 자동 복구
    try {
      await updateDoc(ref, { [field]: original });
      msg += ` 원래 값 ${origView} 으로 자동 복구 완료.`;
    } catch (restoreError) {
      msg += ` ❗복구 실패(${errText(restoreError)}) — 반드시 수동으로 ${field} 를 ${origView} (으)로 되돌려 주세요.`;
    }
    out.textContent = msg;
    console.log("[규칙 점검] 쓰기 허용", { targetName, field, original, newValue });
  } catch (error) {
    out.textContent = `✅ 안전/차단: 쓰기 실패 — 오류 코드 ${errText(error)}. 원래 값 ${origView} 그대로입니다.`;
    console.error("[규칙 점검] 쓰기 실패", error);
  }
}

// ====== 3) 내 주문 금액 고치기 (내 기존 주문 totalPrice → 1) ======
orderBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  orderBtn.disabled = true;
  try {
    // 내 주문 1건을 찾아 그 문서를 대상으로 한다
    orderOut.textContent = "내 주문을 찾는 중입니다…";
    let target;
    try {
      const snap = await getDocs(query(collection(db, "orders"), where("userId", "==", currentUser.uid)));
      target = snap.docs[0];
    } catch (error) {
      orderOut.textContent = `내 주문 조회 실패 — 오류 코드 ${errText(error)}.`;
      return;
    }
    if (!target) { orderOut.textContent = "내 주문이 없어 테스트할 수 없습니다. 먼저 주문을 하나 만들어 주세요."; return; }
    await runRealWriteTest({
      ref: target.ref,
      field: "totalPrice",
      newValue: 1,
      label: "totalPrice",
      out: orderOut,
      targetName: `내 주문 orders/${target.id}`
    });
  } finally {
    orderBtn.disabled = false;
  }
});

// ====== 4) 상품 가격 0원으로 (products/p1 price → 0) ======
productBtn.addEventListener("click", async () => {
  if (!currentUser) return;
  productBtn.disabled = true;
  try {
    await runRealWriteTest({
      ref: doc(db, "products", "p1"),
      field: "price",
      newValue: 0,
      label: "price",
      out: productOut,
      targetName: "상품 products/p1"
    });
  } finally {
    productBtn.disabled = false;
  }
});
