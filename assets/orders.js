/* ===========================================================
   하루상점 — 마이페이지 「내 주문」
   orders 컬렉션에서 userId 가 로그인한 사람의 uid 인 문서만
   onSnapshot 으로 실시간으로 받는다. 정렬은 받은 뒤 여기서 한다.
   =========================================================== */
import {
  getFirestore, collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, subscribeAuth } from "./auth.js";

const db = getFirestore(auth.app);
const list = document.getElementById("order-list");
const listStatus = document.getElementById("order-status");
const listEnded = document.getElementById("order-ended");

// 이 상태만 남으면 더 바뀔 주문이 없다고 보고 그만 듣는다
const FINAL_STATUSES = ["delivered", "canceled"];

const won = n => Number(n || 0).toLocaleString("ko-KR") + "원";

// 리스너는 한 번에 하나만. 같은 사람이면 다시 붙이지 않는다
// 주문이 다 끝나 그만 들은 사람도 새로고침 전까지는 다시 붙이지 않는다
let unsubscribe = null;
let listeningUid = null;
let finishedUid = null;

function stopListening() {
  if (unsubscribe) unsubscribe();
  unsubscribe = null;
  listeningUid = null;
}

// 주문이 1건 이상이고 전부 delivered 또는 canceled 이면 true
function allFinished(snap) {
  return snap.size > 0 && snap.docs.every(d => FINAL_STATUSES.includes(d.data().status));
}

function finishListening(snap) {
  const uid = listeningUid;
  stopListening();
  finishedUid = uid;
  console.log("[그만 듣기]", `주문 ${snap.size}건이 모두 delivered 또는 canceled 라 실시간 감지를 해제했습니다.`);
  listEnded.textContent = "모든 주문이 완료되어 실시간 업데이트를 종료했어요. 최신 주문 상태는 새로고침하여 확인해 주세요.";
  listEnded.hidden = false;
}

// 서버 시간이 아직 안 들어온 새 주문은 추정 시간으로 보여 준다
function orderFrom(d) {
  const data = d.data({ serverTimestamps: "estimate" });
  return {
    id: d.id,
    createdAt: data.createdAt ? data.createdAt.toDate() : null,
    names: (data.items || []).map(item => item.name).join(", "),
    totalPrice: data.totalPrice,
    status: data.status
  };
}

function render(orders) {
  if (!orders.length) {
    list.replaceChildren();
    listStatus.textContent = "아직 주문이 없습니다.";
    return;
  }
  listStatus.textContent = "";
  list.replaceChildren(...orders.map(order => {
    const li = document.createElement("li");
    li.className = "order-item";
    const date = document.createElement("span");
    date.className = "order-date";
    date.textContent = order.createdAt ? order.createdAt.toLocaleString("ko-KR") : "-";
    const names = document.createElement("span");
    names.className = "order-names";
    names.textContent = order.names || "-";
    const total = document.createElement("span");
    total.className = "order-total";
    total.textContent = won(order.totalPrice);
    // status 는 Firestore 에 저장된 영어 값 그대로
    const state = document.createElement("span");
    state.className = "order-state";
    state.textContent = order.status ?? "-";
    li.append(date, names, total, state);
    return li;
  }));
}

function startListening(user) {
  if (listeningUid === user.uid || finishedUid === user.uid) return;
  stopListening();
  finishedUid = null;
  listEnded.hidden = true;
  listeningUid = user.uid;
  listStatus.textContent = "주문을 불러오는 중입니다.";
  const q = query(collection(db, "orders"), where("userId", "==", user.uid));
  unsubscribe = onSnapshot(q, snap => {
    const changes = snap.docChanges().map(c => `${c.type} ${c.doc.id} ${c.doc.data().status}`);
    console.log("[주문 알림]", `${snap.size}건`, changes);
    // 최근 주문이 위로. 시간이 없는 주문은 맨 위에
    const time = order => order.createdAt ? order.createdAt.getTime() : Number.MAX_SAFE_INTEGER;
    const orders = snap.docs.map(orderFrom).sort((a, b) => time(b) - time(a));
    render(orders);
    if (allFinished(snap)) finishListening(snap);
  }, error => {
    console.error("[주문 알림] 오류", error);
    listStatus.textContent = error.code || error.message;
  });
}

if (list) subscribeAuth(user => {
  if (user) startListening(user);
  else {
    stopListening();
    finishedUid = null;
    listEnded.hidden = true;
    list.replaceChildren();
  }
});
