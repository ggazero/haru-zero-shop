/* ===========================================================
   보안 규칙 점검 — orders 전체 읽기 테스트
   목적: 로그인한 계정으로 orders 컬렉션 '전체'를 읽어
         보안 규칙이 남의 주문까지 내어 주는지 확인한다.
   주의: 보안 규칙·주문 데이터는 절대 수정하지 않는다(읽기 전용).
         개인정보·주문 상세는 화면에 표시하지 않고,
         문서 수와 '타인 주문 존재 여부'만 집계해서 보여 준다.
   =========================================================== */
import { getFirestore, collection, getDocs }
  from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, subscribeAuth } from "./auth.js";

const db = getFirestore(auth.app);
const runButton = document.getElementById("rules-test-run");
const loginNote = document.getElementById("rules-test-login");
const result = document.getElementById("rules-test-result");

let currentUser = null;

// 로그인 상태에 따라 버튼을 열고 닫는다. 로그인하지 않으면 읽기를 시도하지 않는다.
subscribeAuth(user => {
  currentUser = user;
  if (user) {
    loginNote.textContent = "로그인됨: 이 계정으로 orders 전체 읽기를 시도할 수 있습니다.";
    runButton.disabled = false;
  } else {
    loginNote.innerHTML = '로그인이 필요합니다. <a href="login.html?next=rules-test.html">로그인하기</a>';
    runButton.disabled = true;
  }
});

// orders 컬렉션 '전체'를 userId 필터 없이 읽는다.
// 내 것이 아닌 문서가 하나라도 읽히면 보안 규칙이 타인 주문을 내어 주는 것이다.
runButton.addEventListener("click", async () => {
  if (!currentUser) return;
  runButton.disabled = true;
  result.textContent = "orders 컬렉션 전체 읽기를 시도하는 중입니다…";
  try {
    const snap = await getDocs(collection(db, "orders"));
    const total = snap.size;

    // 개인정보는 읽지 않는다. userId를 내 uid와 비교만 하고, 값 자체는 표시하지 않는다.
    let mine = 0;
    let others = 0;
    snap.forEach(docSnap => {
      const ownerId = docSnap.get("userId");
      if (ownerId === currentUser.uid) mine += 1;
      else others += 1; // 내 uid가 아니거나 userId가 없는 문서
    });

    const verdict = others > 0
      ? `⚠️ 취약: 내 것이 아닌 주문 ${others}건이 읽혔습니다. 보안 규칙이 타인 주문 읽기를 허용합니다.`
      : "✅ 안전: 내 것이 아닌 주문은 읽히지 않았습니다.";

    result.textContent =
      `읽기 성공 — 전체 ${total}건 (내 주문 ${mine}건, 타인 주문 ${others}건). ${verdict}`;
    console.log("[규칙 점검] 성공", { total, mine, others });
  } catch (error) {
    // permission-denied 등 오류 코드를 그대로 보여 준다.
    const code = error.code || error.message;
    result.textContent = `읽기 실패 — 오류 코드: ${code} (보안 규칙이 전체 읽기를 막고 있을 수 있습니다.)`;
    console.error("[규칙 점검] 실패", error);
  } finally {
    runButton.disabled = false;
  }
});
