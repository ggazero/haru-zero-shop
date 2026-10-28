/* ===========================================================
   하루상점 — Firestore products 컬렉션을 읽는 코드
   이름 · 가격 · 한 줄 소개 · 재고는 여기서 읽고,
   긴 설명(detail)과 그림(emoji)은 그대로 shop.js 에서 읽습니다.
   상품 만들기 · 고치기는 관리 화면(admin.html)에서 합니다.
   =========================================================== */
import {
  getFirestore, collection, doc, query, where, orderBy, limit, startAfter, getDocs, getDoc,
  serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { auth, authReady } from "./auth.js";

const db = getFirestore(auth.app);
const storage = getStorage(auth.app);

// 상품 문서의 imagePath(Storage 경로)로 사진 다운로드 URL을 받는다
// Firestore 문서를 읽는 것이 아니므로 읽은 문서 수에 더하지 않는다
export function loadImageUrl(imagePath) {
  return getDownloadURL(ref(storage, imagePath));
}

// 한 번에 읽는 상품 수
const PAGE_SIZE = 3;

// 숨기지 않은 상품만, 가격이 낮은 순서로, PAGE_SIZE 개까지 Firestore 쿼리에서 바로 읽는다
// (isVisible + price 복합 색인이 있어야 동작한다)
// after 에 지난번 마지막 문서를 넘기면 그 다음부터 PAGE_SIZE 개를 읽는다
export async function loadProducts(after) {
  const parts = [
    collection(db, "products"),
    where("isVisible", "==", true),
    orderBy("price")
  ];
  if (after) parts.push(startAfter(after));
  parts.push(limit(PAGE_SIZE));
  const snap = await getDocs(query(...parts));
  return {
    products: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    reads: snap.size,
    last: snap.docs[snap.docs.length - 1] || null,
    // PAGE_SIZE 개를 다 못 채웠으면 더 가져올 것이 없다
    hasMore: snap.size === PAGE_SIZE
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

/* --- 「바로 주문」: 재고 확인 · 주문 만들기 · 재고 1개 빼기를 트랜잭션 하나로 ---
   셋 다 되거나 하나도 안 된다. 이름과 가격은 트랜잭션에서 읽은 상품 문서 값을 쓴다.
   돌려주는 status: "login"(로그인 안 함) · "soldout"(재고 없음) · "ok"(주문 완료) */
export async function placeOrder(productId) {
  const user = await authReady && auth.currentUser;
  if (!user) return { status: "login" };

  const productRef = doc(db, "products", productId);
  const orderRef = doc(collection(db, "orders"));
  return runTransaction(db, async tx => {
    const snap = await tx.get(productRef);
    if (!snap.exists()) throw new Error(`products/${productId} 문서가 없습니다.`);
    const p = snap.data();
    if (!(p.stock >= 1)) return { status: "soldout", stock: p.stock };

    const quantity = 1;
    tx.set(orderRef, {
      userId: user.uid,
      items: [{ productId, name: p.name, price: p.price, quantity }],
      totalPrice: p.price * quantity,
      status: "paid",
      createdAt: serverTimestamp()
    });
    tx.update(productRef, { stock: p.stock - quantity });
    return { status: "ok", orderId: orderRef.id, stock: p.stock - quantity };
  });
}
