/* 관리 화면 입구
   - 권한은 ID 토큰의 커스텀 클레임 role 로만 판단한다 (Firestore users 문서는 보지 않는다).
   - staff / admin 이면 「관리자: role」, 그 외에는 「주인 명찰 받기」로 grantOwnerRole 을 부른다.
   - 명찰을 받은 뒤와 「다시 확인」에서는 getIdToken(true) 로 토큰을 새로 받아 다시 확인한다.
   - staff / admin 에게만 상품 관리 표를 보여 준다. 숨긴 상품까지 products 전체를 읽는다.
     지우기 버튼은 만들지 않는다 (규칙에서도 delete 는 막혀 있다).
   - 사진은 Storage products/{문서 ID}/main.jpg 에 올리고, 100% 올라간 뒤에만 그 경로를 imagePath 에 저장한다. */
import { auth, subscribeAuth } from "./auth.js";
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";
import {
  getFirestore, collection, doc, getDocs, addDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";

const grantOwnerRole = httpsCallable(getFunctions(auth.app, "us-central1"), "grantOwnerRole");
const db = getFirestore(auth.app);
const storage = getStorage(auth.app);
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

/* --- 사진 --- */
const PHOTO_MAX = 5 * 1024 * 1024; // Storage 규칙과 같게: 5MB 미만 이미지만
// 맨 앞에 / 를 붙이지 않는다. 예: products/p1/main.jpg
const photoPath = id => `products/${id}/main.jpg`;
const photoError = file => !file ? ""
  : !file.type.startsWith("image/") ? "이미지 파일만 올릴 수 있습니다"
  : file.size >= PHOTO_MAX ? "사진은 5MB 미만이어야 합니다"
  : "";

// 고른 파일 하나를 그대로 올리고 몇 % 올라갔는지 onPercent 로 알려 준다
function uploadPhoto(path, file, onPercent) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on("state_changed",
      snap => onPercent(snap.totalBytes ? Math.floor(snap.bytesTransferred / snap.totalBytes * 100) : 0),
      reject,
      resolve
    );
  });
}

// 미리보기 다운로드 URL 은 경로마다 한 번만 받는다 (사진을 새로 올리면 지운다)
const photoUrls = new Map();
function photoUrl(path) {
  if (!photoUrls.has(path)) {
    const url = getDownloadURL(ref(storage, path));
    url.catch(() => photoUrls.delete(path));
    photoUrls.set(path, url);
  }
  return photoUrls.get(path);
}

function photoCell(p) {
  const td = cell("ad-photo");
  if (!p.imagePath) { td.textContent = "-"; return td; }
  const img = document.createElement("img");
  img.className = "ad-thumb";
  img.alt = p.name ?? p.id;
  photoUrl(p.imagePath)
    .then(url => { img.src = url; td.replaceChildren(img); })
    .catch(error => { td.textContent = errorText(error); });
  return td;
}

let products = [];
let loaded = false;         // products 를 끝까지 읽었는가 (개수 줄은 읽었을 때만)
const messages = new Map(); // 문서 ID → 그 상품 옆에 보일 결과 한 줄
let editing = null;         // 고치는 중인 문서 ID
let loadCount = 0;

/* --- 거르기 · 이름 검색 · 정렬 ---
   이미 읽은 products 배열만 브라우저에서 다시 고른다 (Firestore 를 다시 읽지 않는다).
   품절만: stock 이 숫자 0 인 상품 / 숨김만: isVisible 이 false 인 상품 */
const isSoldOut = p => p.stock === 0;
const isHidden = p => p.isVisible === false;
const FILTERS = { all: () => true, soldout: isSoldOut, hidden: isHidden };
const byName = new Intl.Collator("ko", { numeric: true, sensitivity: "base" });
const nameOf = p => String(p.name ?? "");
const SORTS = {
  // 재고가 숫자가 아닌 상품은 맨 뒤로, 재고가 같으면 이름순
  stock: (a, b) => {
    const sa = typeof a.stock === "number" ? a.stock : Infinity;
    const sb = typeof b.stock === "number" ? b.stock : Infinity;
    return sa === sb ? byName.compare(nameOf(a), nameOf(b)) : sa < sb ? -1 : 1;
  },
  name: (a, b) => byName.compare(nameOf(a), nameOf(b)) || byName.compare(a.id, b.id),
  // updatedAt 이 늦은 상품이 위로. Firestore Timestamp 의 toMillis() 로 비교하고,
  // updatedAt 이 없거나 Timestamp 가 아닌 상품은 맨 아래로 (그 안에서는 이름순)
  recent: (a, b) => {
    const ta = updatedMillis(a), tb = updatedMillis(b);
    return ta === tb ? byName.compare(nameOf(a), nameOf(b)) : tb > ta ? 1 : -1;
  }
};
function updatedMillis(p) {
  return p.updatedAt && typeof p.updatedAt.toMillis === "function" ? p.updatedAt.toMillis() : -Infinity;
}
const view = { filter: "all", search: "", sort: "stock" }; // 지금 고른 것 - 다시 읽거나 저장해도 그대로 둔다

function pickProducts(list, { filter, search, sort }) {
  const word = search.trim().toLowerCase();
  const picked = list.filter(p => FILTERS[filter](p) && (!word || nameOf(p).toLowerCase().includes(word)));
  return SORTS[sort] ? picked.sort(SORTS[sort]) : picked;
}

const countLine = document.getElementById("ad-count");
const filterButtons = document.querySelectorAll("#ad-products [data-filter]");
const searchInput = document.getElementById("ad-search");
const sortSelect = document.getElementById("ad-sort");

filterButtons.forEach(button => button.addEventListener("click", () => {
  view.filter = button.dataset.filter;
  filterButtons.forEach(b => b.setAttribute("aria-pressed", String(b === button)));
  renderProducts();
}));
searchInput.addEventListener("input", () => { view.search = searchInput.value; renderProducts(); });
sortSelect.addEventListener("change", () => { view.sort = sortSelect.value; renderProducts(); });

function showProducts(on) {
  loadCount++;
  productsBox.hidden = !on;
  if (on) { loadProducts(); return; }
  products = [];
  loaded = false;
  messages.clear();
  editing = null;
  rows.replaceChildren();
  listStatus.textContent = "";
  countLine.textContent = "";
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
    loaded = true;
    listStatus.textContent = "";
  } catch (error) {
    if (current !== loadCount) return;
    products = [];
    loaded = false;
    listStatus.textContent = `상품을 불러오지 못했습니다 — ${errorText(error)}`;
  }
  renderProducts();
}

// 지금 고른 거르기 · 검색 · 정렬로 표를 다시 그린다
function renderProducts() {
  const shown = pickProducts(products, view);
  countLine.textContent = loaded ? `지금 보이는 상품 ${shown.length}개 / 전체 ${products.length}개` : "";
  if (loaded && shown.length === 0) {
    const empty = cell("ad-empty", products.length ? "조건에 맞는 상품이 없습니다" : "상품이 없습니다");
    empty.colSpan = 9;
    const tr = document.createElement("tr");
    tr.append(empty);
    rows.replaceChildren(tr);
    return;
  }
  rows.replaceChildren(...shown.flatMap(p => editing === p.id ? [productRow(p), editRow(p)] : [productRow(p)]));
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
  const msg = cell("ad-msg", messages.get(p.id) ?? "");
  msg.dataset.id = p.id;
  tr.append(
    cell("ad-id", p.id),
    photoCell(p),
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
    msg
  );
  return tr;
}

// 표를 다시 그리지 않고 그 상품의 결과 칸만 바꾼다 (고치던 입력 칸과 고른 사진을 지키려고)
function setMessage(id, text) {
  messages.set(id, text);
  const msg = [...rows.querySelectorAll(".ad-msg")].find(td => td.dataset.id === id);
  if (msg) msg.textContent = text;
}

function photoField() {
  const wrap = document.createElement("label");
  const input = document.createElement("input");
  input.name = "photo";
  input.type = "file";
  input.accept = "image/*";
  wrap.append("사진 (바꿀 때만)", input);
  return wrap;
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
  const photo = photoField();
  const value = wrap => wrap.querySelector("input").value;
  fields.append(price, summary, stock, photo,
    smallButton("저장", () => {
      const data = { price: toNumber(value(price)), summary: value(summary).trim(), stock: toNumber(value(stock)) };
      const file = photo.querySelector("input").files[0];
      const problem = priceError(data.price) || stockError(data.stock, 0) || photoError(file);
      if (problem) { setMessage(p.id, problem); return; }
      save(p.id, data, true, file);
    }),
    smallButton("취소", () => { editing = null; renderProducts(); }));
  const td = cell("", fields);
  td.colSpan = 9;
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
// 사진(file)이 있으면 먼저 products/{id}/main.jpg 에 덮어 올리고, 다 올라간 뒤에 imagePath 와 함께 저장한다.
// 올리기가 실패하면 문서는 아무것도 바꾸지 않는다
async function save(id, data, closeEdit, file) {
  const controls = rows.querySelectorAll("button, input");
  controls.forEach(c => { c.disabled = true; });
  setMessage(id, file ? "올리는 중 … 0%" : "저장 중…");
  try {
    if (file) {
      const path = photoPath(id);
      try {
        await uploadPhoto(path, file, percent => setMessage(id, `올리는 중 … ${percent}%`));
      } catch (error) {
        throw new Error(`사진을 올리지 못해 저장하지 않았습니다 — ${errorText(error)}`);
      }
      photoUrls.delete(path);
      data = { ...data, imagePath: path };
      setMessage(id, "저장 중…");
    }
    // 품절 · 노출 토글, 고치기, 사진 변경 모두 여기서 저장한다 - 고친 시각(updatedAt)을 함께 적는다
    await updateDoc(doc(db, "products", id), { ...data, updatedAt: serverTimestamp() });
    messages.set(id, "저장했습니다");
    if (closeEdit) editing = null;
    await loadProducts();
  } catch (error) {
    setMessage(id, errorText(error));
    controls.forEach(c => { c.disabled = false; });
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
// 사진을 골랐으면 ① 문서 만들기 → ② 그 ID 로 사진 올리기 → ③ 다 올라간 뒤 imagePath 저장
newForm.addEventListener("submit", async event => {
  event.preventDefault();
  const f = newForm.elements;
  const data = {
    name: f.name.value.trim(),
    price: toNumber(f.price.value),
    summary: f.summary.value.trim(),
    stock: toNumber(f.stock.value)
  };
  const file = f.photo.files[0];
  const problem = (data.name ? "" : "상품명을 적어 주세요") || priceError(data.price) || stockError(data.stock, 0)
    || photoError(file);
  if (problem) { newResult.textContent = problem; return; }
  const submit = newForm.querySelector("button[type=submit]");
  submit.disabled = true;
  newResult.textContent = "만드는 중…";
  let created;
  try {
    created = await addDoc(collection(db, "products"),
      { ...data, isVisible: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    if (file) {
      const path = photoPath(created.id);
      newResult.textContent = "올리는 중 … 0%";
      await uploadPhoto(path, file, percent => { newResult.textContent = `올리는 중 … ${percent}%`; });
      await updateDoc(created, { imagePath: path, updatedAt: serverTimestamp() });
    }
    newForm.reset();
    newForm.hidden = true;
    newResult.textContent = "";
    messages.set(created.id, "새 상품을 만들었습니다 (숨김)");
    await loadProducts();
  } catch (error) {
    // 문서는 만들어졌는데 사진에서 멈췄으면, 그 사실을 함께 알린다 (imagePath 는 비어 있다)
    newResult.textContent = created
      ? `상품 ${created.id} 는 만들었지만 사진을 저장하지 못했습니다 — ${errorText(error)}`
      : errorText(error);
    if (created) {
      newForm.reset();
      await loadProducts();
    }
  } finally {
    submit.disabled = false;
  }
});

// 위의 상품 관리 변수를 모두 만든 뒤에 로그인 상태를 받는다
subscribeAuth(user => {
  result.textContent = "";
  showRole(user, false);
});
