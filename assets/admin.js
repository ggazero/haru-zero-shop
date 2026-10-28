/* 관리 화면 입구
   - 권한은 ID 토큰의 커스텀 클레임 role 로만 판단한다 (Firestore users 문서는 보지 않는다).
   - staff / admin 이면 「관리자: role」, 그 외에는 「주인 명찰 받기」로 grantOwnerRole 을 부른다.
   - 명찰을 받은 뒤와 「다시 확인」에서는 getIdToken(true) 로 토큰을 새로 받아 다시 확인한다.
   - staff / admin 에게만 상품 관리 표를 보여 준다. 숨긴 상품까지 products 전체를 읽는다.
     지우기 버튼은 만들지 않는다 (규칙에서도 delete 는 막혀 있다). */
import { auth, subscribeAuth } from "./auth.js";
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import {
  getFirestore, collection, doc, getDocs, addDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const grantOwnerRole = httpsCallable(getFunctions(auth.app, "us-central1"), "grantOwnerRole");
const db = getFirestore(auth.app);
const ADMIN_ROLES = ["staff", "admin"];

const state = document.getElementById("ad-state");
const loginLink = document.getElementById("ad-login");
const grant = document.getElementById("ad-grant");
const recheck = document.getElementById("ad-recheck");
const result = document.getElementById("ad-result");
const info = document.getElementById("ad-info");
const infoEmail = document.getElementById("ad-email");
const infoIssued = document.getElementById("ad-issued");
const seoulTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "medium"
});

let check = 0;
async function showRole(user, refresh) {
  const current = ++check;
  loginLink.hidden = true;
  grant.hidden = true;
  recheck.hidden = true;
  info.hidden = true;
  showProducts(false);
  if (!user) {
    state.textContent = "로그인이 필요합니다";
    loginLink.hidden = false;
    return;
  }
  state.textContent = "확인 중…";
  let token, role;
  try {
    token = await user.getIdTokenResult(refresh);
    role = token.claims.role;
  } catch (error) {
    if (current !== check) return;
    state.textContent = "권한을 확인하지 못했습니다";
    result.textContent = error.code ?? error.message;
    recheck.hidden = false;
    return;
  }
  if (current !== check || auth.currentUser !== user) return;
  recheck.hidden = false;
  if (ADMIN_ROLES.includes(role)) {
    state.textContent = `관리자: ${role}`;
    infoEmail.textContent = user.email ?? "-";
    infoIssued.textContent = `${seoulTime.format(new Date(token.issuedAtTime))} (서울)`;
    info.hidden = false;
    showProducts(true);
  } else {
    state.textContent = "권한이 없습니다";
    grant.hidden = false;
  }
}

grant.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  grant.disabled = true;
  result.textContent = "";
  try {
    await grantOwnerRole();
    await user.getIdToken(true);
    await showRole(user, false);
  } catch (error) {
    result.textContent = `${error.code ?? "error"}: ${error.message}`;
  } finally {
    grant.disabled = false;
  }
});

recheck.addEventListener("click", async () => {
  recheck.disabled = true;
  result.textContent = "";
  try {
    await showRole(auth.currentUser, true);
  } finally {
    recheck.disabled = false;
  }
});

/* --- 상품 관리 --- */
const productsBox = document.getElementById("ad-products");
const listStatus = document.getElementById("ad-list-status");
const rows = document.getElementById("ad-product-rows");
const newButton = document.getElementById("ad-new");
const newForm = document.getElementById("ad-new-form");
const newCancel = document.getElementById("ad-new-cancel");
const newResult = document.getElementById("ad-new-result");

const errorText = error => error.code ? `${error.code}: ${error.message}` : String(error.message || error);
// 입력 칸 글자를 숫자로 바꾼다. 비어 있으면 NaN
const toNumber = text => String(text).trim() === "" ? NaN : Number(text);
const priceError = price => Number.isFinite(price) && price > 0 ? "" : "가격은 0보다 큰 숫자로 적어 주세요";
const stockError = (stock, min) => Number.isInteger(stock) && stock >= min ? "" : `재고는 ${min} 이상의 정수로 적어 주세요`;

let products = [];
const messages = new Map(); // 문서 ID → 그 상품 옆에 보일 결과 한 줄
let editing = null;         // 고치는 중인 문서 ID
let loadCount = 0;

function showProducts(on) {
  loadCount++;
  productsBox.hidden = !on;
  if (on) { loadProducts(); return; }
  products = [];
  messages.clear();
  editing = null;
  rows.replaceChildren();
  listStatus.textContent = "";
  newForm.hidden = true;
  newResult.textContent = "";
}

// 조건 없이 products 전체를 읽는다 (isVisible: false 인 숨긴 상품도 함께)
async function loadProducts() {
  const current = ++loadCount;
  listStatus.textContent = "상품을 불러오는 중입니다.";
  try {
    const snap = await getDocs(collection(db, "products"));
    if (current !== loadCount) return;
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const hidden = products.filter(p => p.isVisible !== true).length;
    listStatus.textContent = `상품 ${products.length}개 (숨김 ${hidden}개 포함)`;
  } catch (error) {
    if (current !== loadCount) return;
    products = [];
    listStatus.textContent = `상품을 불러오지 못했습니다 — ${errorText(error)}`;
  }
  renderProducts();
}

function renderProducts() {
  rows.replaceChildren(...products.flatMap(p => editing === p.id ? [productRow(p), editRow(p)] : [productRow(p)]));
}

function cell(className, ...children) {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.append(...children);
  return td;
}

function smallButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn ghost ad-small";
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

function toggle(label, button) {
  const box = document.createElement("div");
  box.className = "ad-toggle";
  const text = document.createElement("span");
  text.textContent = label;
  box.append(text, button);
  return box;
}

// 숫자가 아닌 값이 들어 있으면 그대로 보이고 (숫자 아님) 을 붙인다
const numberText = value => value === undefined ? "-"
  : typeof value === "number" ? value.toLocaleString("ko-KR") : `${JSON.stringify(value)} (숫자 아님)`;

function productRow(p) {
  const soldOut = !(p.stock > 0);
  const visible = p.isVisible === true;
  const tr = document.createElement("tr");
  tr.append(
    cell("ad-id", p.id),
    cell("", p.name ?? "-"),
    cell("ad-num", numberText(p.price)),
    cell("ad-num", numberText(p.stock)),
    cell("", toggle(soldOut ? "품절" : "판매 중",
      smallButton(soldOut ? "품절 끄기" : "품절 켜기", () => soldOut ? restock(p) : save(p.id, { stock: 0 })))),
    cell("", toggle(visible ? "보임" : "숨김",
      smallButton(visible ? "노출 끄기" : "노출 켜기", () => save(p.id, { isVisible: !visible })))),
    cell("", smallButton(editing === p.id ? "닫기" : "고치기", () => {
      editing = editing === p.id ? null : p.id;
      renderProducts();
    })),
    cell("ad-msg", messages.get(p.id) ?? "")
  );
  return tr;
}

function field(label, name, type, value) {
  const wrap = document.createElement("label");
  const input = document.createElement("input");
  input.name = name;
  input.type = type;
  if (type === "number") input.step = name === "stock" ? "1" : "any";
  input.value = value ?? "";
  wrap.append(label, input);
  return wrap;
}

function editRow(p) {
  const tr = document.createElement("tr");
  tr.className = "ad-edit";
  const fields = document.createElement("div");
  fields.className = "ad-edit-fields";
  const price = field("가격", "price", "number", p.price);
  const summary = field("한 줄 소개", "summary", "text", p.summary);
  const stock = field("재고", "stock", "number", p.stock);
  const value = wrap => wrap.querySelector("input").value;
  fields.append(price, summary, stock,
    smallButton("저장", () => {
      const data = { price: toNumber(value(price)), summary: value(summary).trim(), stock: toNumber(value(stock)) };
      const problem = priceError(data.price) || stockError(data.stock, 0);
      if (problem) { messages.set(p.id, problem); renderProducts(); return; }
      save(p.id, data, true);
    }),
    smallButton("취소", () => { editing = null; renderProducts(); }));
  const td = cell("", fields);
  td.colSpan = 8;
  tr.append(td);
  return tr;
}

// 품절 끄기: 다시 팔 재고를 받아 1 이상의 정수로 저장한다
function restock(p) {
  const text = prompt(`${p.name ?? p.id} — 판매할 재고 수를 적어 주세요 (1 이상의 정수)`);
  if (text === null) return;
  const stock = toNumber(text);
  const problem = stockError(stock, 1);
  if (problem) { messages.set(p.id, problem); renderProducts(); return; }
  save(p.id, { stock });
}

// 고친 칸만 updateDoc 으로 저장하고, 성공하면 목록을 다시 읽는다. 실패하면 오류를 그 상품 옆에 남긴다
async function save(id, data, closeEdit) {
  rows.querySelectorAll("button").forEach(b => { b.disabled = true; });
  messages.set(id, "저장 중…");
  renderProducts();
  try {
    await updateDoc(doc(db, "products", id), data);
    messages.set(id, "저장했습니다");
    if (closeEdit) editing = null;
    await loadProducts();
  } catch (error) {
    messages.set(id, errorText(error));
    renderProducts();
  }
}

newButton.addEventListener("click", () => {
  newForm.hidden = !newForm.hidden;
  newResult.textContent = "";
  if (!newForm.hidden) newForm.elements.name.focus();
});

newCancel.addEventListener("click", () => {
  newForm.reset();
  newForm.hidden = true;
  newResult.textContent = "";
});

// 새 상품: 문서 ID 는 자동, 숨긴 채로(isVisible: false) 시작한다
newForm.addEventListener("submit", async event => {
  event.preventDefault();
  const f = newForm.elements;
  const data = {
    name: f.name.value.trim(),
    price: toNumber(f.price.value),
    summary: f.summary.value.trim(),
    stock: toNumber(f.stock.value)
  };
  const problem = (data.name ? "" : "상품명을 적어 주세요") || priceError(data.price) || stockError(data.stock, 0);
  if (problem) { newResult.textContent = problem; return; }
  const submit = newForm.querySelector("button[type=submit]");
  submit.disabled = true;
  newResult.textContent = "만드는 중…";
  try {
    const ref = await addDoc(collection(db, "products"), { ...data, isVisible: false, createdAt: serverTimestamp() });
    newForm.reset();
    newForm.hidden = true;
    newResult.textContent = "";
    messages.set(ref.id, "새 상품을 만들었습니다 (숨김)");
    await loadProducts();
  } catch (error) {
    newResult.textContent = errorText(error);
  } finally {
    submit.disabled = false;
  }
});

// 위의 상품 관리 변수를 모두 만든 뒤에 로그인 상태를 받는다
subscribeAuth(user => {
  result.textContent = "";
  showRole(user, false);
});
