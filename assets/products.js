/* ===========================================================
   하루상점 — Firestore products 컬렉션을 읽고 올리는 코드
   이름 · 가격 · 한 줄 소개 · 재고는 여기서 읽고,
   긴 설명(detail)과 그림(emoji)은 그대로 shop.js 에서 읽습니다.
   =========================================================== */
import {
  getFirestore, collection, doc, query, where, orderBy, limit, startAfter, getDocs, getDoc,
  writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, subscribeAuth } from "./auth.js";

const db = getFirestore(auth.app);

// 숨기지 않은 상품만, 가격이 낮은 순서로, 3개까지 Firestore 쿼리에서 바로 읽는다
// (isVisible + price 복합 색인이 있어야 동작한다)
// after 에 지난번 마지막 문서를 넘기면 그 다음부터 3개를 읽는다
export async function loadProducts(after) {
  const parts = [
    collection(db, "products"),
    where("isVisible", "==", true),
    orderBy("price")
  ];
  if (after) parts.push(startAfter(after));
  parts.push(limit(3));
  const snap = await getDocs(query(...parts));
  return {
    products: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    reads: snap.size,
    last: snap.docs[snap.docs.length - 1] || null,
    // 3개를 다 못 채웠으면 더 가져올 것이 없다
    hasMore: snap.size === 3
  };
}

// 상품 한 장을 읽는다. 없는 상품이면 product 는 null
export async function loadProduct(id) {
  const snap = await getDoc(doc(db, "products", id));
  return {
    product: snap.exists() ? { id: snap.id, ...snap.data() } : null,
    reads: snap.exists() ? 1 : 0
  };
}

/* --- 「상품 올리기」: shop.js 의 p3~p6 을 한 번에 올린다 ---
   재고와 보이기 값은 아래 표대로. 이미 있는 p1 · p2 는 건드리지 않는다. */
const UPLOAD = [
  { id: "p3", stock: 8, isVisible: true },
  { id: "p4", stock: 0, isVisible: true },
  { id: "p5", stock: 5, isVisible: false },
  { id: "p6", stock: 40, isVisible: true }
];

// 이미 있는 문서가 하나라도 있으면 덮어쓰지 않고 전부 멈춘다.
// 확인이 끝나면 네 장을 writeBatch 하나로 묶어, 다 올라가거나 하나도 안 올라가게 한다.
async function uploadProducts() {
  const refs = UPLOAD.map(u => doc(db, "products", u.id));
  const snaps = await Promise.all(refs.map(ref => getDoc(ref)));
  const existing = snaps.filter(s => s.exists()).map(s => s.id);
  if (existing.length) throw new Error(`이미 있는 문서가 있어 하나도 올리지 않았습니다: ${existing.join(", ")}`);

  const batch = writeBatch(db);
  UPLOAD.forEach((u, i) => {
    const p = PRODUCTS.find(item => item.id === u.id);
    batch.set(refs[i], {
      name: p.name,
      price: p.price,
      summary: p.summary,
      stock: u.stock,
      isVisible: u.isVisible,
      createdAt: serverTimestamp()
    });
  });
  await batch.commit();
}

// 로그인한 사람에게만 보이는 버튼과 결과 한 줄을 box 안에 만든다
export function mountUploader(box, onDone) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = "상품 올리기";
  const result = document.createElement("p");
  result.className = "upload-result";
  result.setAttribute("role", "status");
  box.replaceChildren(button, result);

  subscribeAuth(user => { box.hidden = !user; });

  button.addEventListener("click", async () => {
    button.disabled = true;
    result.textContent = "올리는 중입니다.";
    try {
      await uploadProducts();
      result.textContent = `${UPLOAD.map(u => u.id).join(" · ")} 네 장을 products 에 올렸습니다.`;
      if (onDone) onDone();
    } catch (error) {
      // 오류 글은 줄이지 않고 그대로 보여 준다
      result.textContent = error.code ? `${error.code}: ${error.message}` : String(error.message || error);
    } finally {
      button.disabled = false;
    }
  });
}
