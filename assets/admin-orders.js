/* 관리 화면 「주문」 탭
   - 권한 판단은 admin.js 가 한다. admin.js 가 상품 관리(#ad-products)를 보여 줄 때(staff / admin)만
     탭과 주문 목록을 보여 주고, 다시 숨기면 주문 화면도 비운다.
   - orders 를 createdAt 최신순으로 20건씩 읽는다. 상태 거르기는 Firestore 쿼리(where status ==)로 한다.
   - 상태 바꾸기는 paid → preparing → shipped → delivered 한 단계씩만. 취소 버튼은 두지 않는다.
     저장할 때는 status 와 statusUpdatedAt(서버 시각) 두 필드만 updateDoc 으로 쓰고, adminLogs 에는 쓰지 않는다.
   - 오류 원문은 console.error 로 남기고, 화면에는 짧은 문구와 오류 코드만 보인다. */
import { auth } from "./auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, updateDoc, serverTimestamp,
  query, where, orderBy, limit, startAfter
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const db = getFirestore(auth.app);
const PAGE_SIZE = 20;
// 지금 상태 → 버튼 글자와 바꿀 상태. delivered · canceled 는 버튼이 없다
const NEXT_STEP = {
  paid: { label: "포장 시작", to: "preparing" },
  preparing: { label: "배송 시작", to: "shipped" },
  shipped: { label: "배송 완료", to: "delivered" }
};
const seoulTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "medium"
});

const productsBox = document.getElementById("ad-products");
const tabs = document.getElementById("ad-tabs");
const tabButtons = tabs.querySelectorAll("[role=tab]");
const listStatus = document.getElementById("ad-order-status");
const orderRows = document.getElementById("ad-order-rows");
const moreButton = document.getElementById("ad-order-more");
const filterButtons = document.querySelectorAll("#ad-orders [data-status]");
const detailBox = document.getElementById("ad-order-detail");
const detailTitle = document.getElementById("ad-order-detail-title");
const detailInfo = document.getElementById("ad-order-detail-info");
const detailActions = document.getElementById("ad-order-detail-actions");
const detailResult = document.getElementById("ad-order-detail-result");
const dialog = document.getElementById("ad-order-confirm");
const dialogId = document.getElementById("ad-order-confirm-id");
const dialogTo = document.getElementById("ad-order-confirm-to");

// 화면에 보일 문구. 오류 원문은 콘솔에만
function failText(what, error) {
  console.error(`[주문] ${what}`, error);
  return `${what} — ${error?.code ?? "오류"} (자세한 내용은 브라우저 콘솔)`;
}
const timeText = value => value && typeof value.toDate === "function" ? `${seoulTime.format(value.toDate())} (서울)` : null;
const priceText = value => typeof value === "number" ? `${value.toLocaleString("ko-KR")}원` : String(value ?? "-");

/* --- 탭 --- */
function selectTab(button) {
  tabButtons.forEach(b => {
    const on = b === button;
    b.setAttribute("aria-selected", String(on));
    b.tabIndex = on ? 0 : -1;
    document.getElementById(b.getAttribute("aria-controls")).hidden = !on;
  });
}
tabButtons.forEach(button => button.addEventListener("click", () => selectTab(button)));

/* --- 목록 --- */
let statusFilter = "all";
let orders = [];
let lastSnap = null;   // 다음 20건을 읽을 기준 문서
let listCount = 0;     // 거르기를 바꾸거나 화면을 닫으면 늘려서, 늦게 온 응답을 버린다
let active = false;

function ordersQuery(after) {
  const parts = [collection(db, "orders")];
  if (statusFilter !== "all") parts.push(where("status", "==", statusFilter));
  parts.push(orderBy("createdAt", "desc"));
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE_SIZE));
  return query(...parts);
}

async function loadOrders(more) {
  const current = more ? listCount : ++listCount;
  if (!more) {
    orders = [];
    lastSnap = null;
    renderOrders();
  }
  moreButton.hidden = true;
  moreButton.disabled = true;
  listStatus.textContent = "주문을 불러오는 중입니다.";
  try {
    const snap = await getDocs(ordersQuery(more ? lastSnap : null));
    if (current !== listCount) return;
    orders = orders.concat(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    if (snap.docs.length) lastSnap = snap.docs[snap.docs.length - 1];
    listStatus.textContent = orders.length ? "" : "주문이 없습니다";
    moreButton.hidden = snap.docs.length < PAGE_SIZE;
  } catch (error) {
    if (current !== listCount) return;
    listStatus.textContent = failText("주문을 불러오지 못했습니다", error);
    moreButton.hidden = !more; // 더 보기에서 실패했으면 다시 누를 수 있게 남긴다
  } finally {
    if (current === listCount) moreButton.disabled = false;
  }
  renderOrders();
}

function cell(className, text) {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

function renderOrders() {
  orderRows.replaceChildren(...orders.map(o => {
    const tr = document.createElement("tr");
    const open = document.createElement("button");
    open.type = "button";
    open.className = "btn ghost ad-small";
    open.textContent = "자세히";
    open.addEventListener("click", () => openDetail(o.id));
    const action = document.createElement("td");
    action.append(open);
    tr.append(
      cell("ad-id", o.id),
      cell("ad-num", priceText(o.totalPrice)),
      cell("ad-id", String(o.status ?? "-")),
      cell("", timeText(o.createdAt) ?? "-"),
      action
    );
    return tr;
  }));
}

filterButtons.forEach(button => button.addEventListener("click", () => {
  statusFilter = button.dataset.status;
  filterButtons.forEach(b => b.setAttribute("aria-pressed", String(b === button)));
  closeDetail();
  loadOrders(false);
}));
moreButton.addEventListener("click", () => loadOrders(true));

/* --- 상세 --- */
let detailId = null;
let detailCount = 0;

// 있는 필드만 dt / dd 로 보여 준다
function infoRow(label, value) {
  const div = document.createElement("div");
  const dt = document.createElement("dt");
  const dd = document.createElement("dd");
  dt.textContent = label;
  if (value instanceof Node) dd.append(value); else dd.textContent = value;
  div.append(dt, dd);
  return div;
}

// 주문 상품 한 줄. items 모양은 두 가지다
//  - 화면에서 만든 주문(바로 주문 · 장바구니 결제): { productId, name, price, quantity } — price 는 한 개 값
//  - 결제 웹훅이 만든 주문(functions createOrder): { id, qty } — 이름 · 가격이 없다
// 없는 값은 지어내지 않는다: 이름이 없으면 상품 ID 를, 둘 다 없으면 「상품 정보 없음」을 보인다
function itemText(i) {
  if (!i || typeof i !== "object") return String(i);
  const id = i.productId ?? i.id;
  const name = typeof i.name === "string" && i.name.trim() ? i.name
    : id !== undefined && id !== null && id !== "" ? `상품 ID ${id}` : "상품 정보 없음";
  const qty = i.quantity ?? i.qty;
  const qtyText = typeof qty === "number" ? ` × ${qty.toLocaleString("ko-KR")}개` : " (수량 정보 없음)";
  const priceText = typeof i.price !== "number" ? ""
    : ` (${qty === 1 ? "" : "개당 "}${i.price.toLocaleString("ko-KR")}원)`;
  return name + qtyText + priceText;
}

function itemsList(items) {
  if (!Array.isArray(items)) return JSON.stringify(items);
  const ul = document.createElement("ul");
  ul.className = "ad-order-items";
  ul.append(...items.map(i => {
    const li = document.createElement("li");
    li.textContent = itemText(i);
    return li;
  }));
  return ul;
}

function renderDetail(id, data) {
  detailTitle.textContent = `주문 ${id}`;
  // 값이 없는(undefined · null · 빈 글자) 항목은 줄을 만들지 않는다
  const has = key => Object.hasOwn(data, key) && data[key] !== undefined && data[key] !== null && data[key] !== "";
  const fields = [];
  // 화면에 보이는 이름만 한국어. Firestore 필드명은 그대로 읽는다
  if (has("items")) fields.push(infoRow("주문 상품", itemsList(data.items)));
  if (has("totalPrice")) fields.push(infoRow("주문 금액", priceText(data.totalPrice)));
  if (has("status")) fields.push(infoRow("주문 상태", String(data.status)));
  if (has("receivedAt")) fields.push(infoRow("주문 접수 시각", timeText(data.receivedAt) ?? String(data.receivedAt)));
  if (has("processStatus")) fields.push(infoRow("처리 상태", String(data.processStatus)));
  if (has("processError")) fields.push(infoRow("처리 오류", String(data.processError)));
  if (has("mailStatus")) fields.push(infoRow("메일 발송 상태", String(data.mailStatus)));
  if (has("statusUpdatedAt")) fields.push(infoRow("상태 변경 시각", timeText(data.statusUpdatedAt) ?? String(data.statusUpdatedAt)));
  detailInfo.replaceChildren(...fields);
  detailInfo.hidden = fields.length === 0;

  const step = Object.hasOwn(NEXT_STEP, data.status) ? NEXT_STEP[data.status] : null;
  if (step) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = step.label;
    button.addEventListener("click", () => changeStatus(id, step.to, button));
    detailActions.replaceChildren(button);
  } else {
    detailActions.replaceChildren();
  }
}

// 목록에 있는 그 주문 줄도 새로 읽은 값으로 맞춘다
// 상태 거르기 중인데 새 상태가 조건에 안 맞으면 목록에서 뺀다 (다음 쪽 기준 문서 lastSnap 은 그대로 둔다)
function syncRow(id, data) {
  const i = orders.findIndex(o => o.id === id);
  if (i === -1) return;
  if (statusFilter !== "all" && data.status !== statusFilter) {
    orders.splice(i, 1);
    if (!orders.length && moreButton.hidden) listStatus.textContent = "주문이 없습니다";
  } else {
    orders[i] = { id, ...data };
  }
  renderOrders();
}

async function openDetail(id, message = "") {
  const current = ++detailCount;
  detailId = id;
  detailBox.hidden = false;
  detailTitle.textContent = `주문 ${id}`;
  detailInfo.hidden = true;
  detailActions.replaceChildren();
  detailResult.textContent = "주문을 불러오는 중입니다.";
  try {
    const snap = await getDoc(doc(db, "orders", id));
    if (current !== detailCount) return;
    if (!snap.exists()) {
      detailResult.textContent = "주문 문서가 없습니다";
      return;
    }
    renderDetail(id, snap.data());
    syncRow(id, snap.data());
    detailResult.textContent = message;
  } catch (error) {
    if (current !== detailCount) return;
    detailResult.textContent = failText("주문을 불러오지 못했습니다", error);
  }
}

function closeDetail() {
  detailCount++;
  detailId = null;
  detailBox.hidden = true;
  detailInfo.replaceChildren();
  detailActions.replaceChildren();
  detailResult.textContent = "";
}

/* --- 상태 바꾸기 --- */
// 「바꾸기」를 눌렀을 때만 true (「그만두기」 · Esc 는 false)
function confirmChange(id, to) {
  dialogId.textContent = id;
  dialogTo.textContent = to;
  if (typeof dialog.showModal !== "function") return Promise.resolve(confirm(`주문 ${id} 의 상태를 ${to} 로 바꿉니다`));
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise(resolve => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
  });
}

async function changeStatus(id, to, button) {
  if (!(await confirmChange(id, to))) return;
  if (detailId !== id) return;
  button.disabled = true;
  detailResult.textContent = "바꾸는 중…";
  try {
    await updateDoc(doc(db, "orders", id), { status: to, statusUpdatedAt: serverTimestamp() });
  } catch (error) {
    if (detailId !== id) return;
    detailResult.textContent = failText("상태를 바꾸지 못했습니다", error);
    button.disabled = false;
    return;
  }
  if (detailId === id) await openDetail(id, `상태를 ${to} 로 바꿨습니다`);
}

/* --- 보이기 / 숨기기: admin.js 가 상품 관리를 보이거나 숨길 때 따라간다 --- */
function setActive(on) {
  if (on === active) return;
  active = on;
  tabs.hidden = !on;
  if (on) {
    selectTab(tabButtons[0]);
    loadOrders(false);
    return;
  }
  listCount++;
  orders = [];
  lastSnap = null;
  renderOrders();
  listStatus.textContent = "";
  moreButton.hidden = true;
  closeDetail();
  if (dialog.open) dialog.close("cancel");
  // 탭을 숨겨도 상품 관리 묶음은 보이게 둔다 (안의 섹션은 admin.js 가 숨긴다)
  selectTab(tabButtons[0]);
}

new MutationObserver(() => setActive(!productsBox.hidden))
  .observe(productsBox, { attributes: true, attributeFilter: ["hidden"] });
setActive(!productsBox.hidden);
