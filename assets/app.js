/* ===========================================================
   하루상점 — 화면을 그리고 장바구니를 다루는 코드
   이 파일은 고치지 않아도 됩니다. (상품은 shop.js 에 있습니다)
   =========================================================== */

const won = n => n.toLocaleString("ko-KR") + "원";
const findProduct = id => PRODUCTS.find(p => p.id === id);
const qs = key => new URLSearchParams(location.search).get(key);

/* --- 배송비 규칙 (shop.js 배송 안내와 같습니다) ---
   배송비는 늘 3,000원으로 적어 두고, 상품 금액이 5만 원 이상이면
   그만큼을 할인으로 빼 줍니다. 그래야 "얼마였는데 왜 안 내는지"가 화면에 남습니다.
   장바구니 화면과 결제 화면이 이 규칙 하나를 같이 씁니다. */
const SHIP_FEE = 3000;
const SHIP_FREE_FROM = 50000;
function shippingOf(goodsTotal) {
  const discount = goodsTotal >= SHIP_FREE_FROM ? SHIP_FEE : 0;
  return {
    fee: SHIP_FEE,
    discount,
    payable: goodsTotal + SHIP_FEE - discount,
    note: discount > 0
      ? "5만 원 이상 주문으로 배송비가 없습니다."
      : "5만 원 미만 주문은 배송비 3,000원입니다."
  };
}

/* --- 장바구니는 브라우저에 저장합니다 --- */
const Cart = {
  read() {
    try { return JSON.parse(localStorage.getItem("haru_cart") || "[]"); }
    catch (e) { return []; }
  },
  write(items) {
    localStorage.setItem("haru_cart", JSON.stringify(items));
  },
  add(id) {
    const items = Cart.read();
    const hit = items.find(i => i.id === id);
    if (hit) hit.qty += 1;
    else items.push({ id, qty: 1 });
    Cart.write(items);

    // ▼ 여기에 「장바구니에 담았다」를 알리는 코드가 들어갑니다 (뒤 수업에서)
     // 담은 상품의 이름과 가격을 상품 목록에서 찾아 온다
const p = findProduct(id);
// 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
window.dataLayer = window.dataLayer || [];
// 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
dataLayer.push({ ecommerce: null });
// 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
dataLayer.push({
  // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
  event: "add_to_cart",
  // 같이 보내는 상품 값 묶음
  ecommerce: {
    // 어느 나라 돈인가
    currency: "KRW",
    // 금액 - 한 번 누르면 한 개라 그 상품 가격 하나
    value: p.price,
    // 담은 상품 상자 하나를 목록에 넣는다
    items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
  }
});

  },
  remove(id) {
    Cart.write(Cart.read().filter(i => i.id !== id));
  },
  clear() {
    localStorage.removeItem("haru_cart");
  },
  count() {
    return Cart.read().reduce((sum, i) => sum + i.qty, 0);
  },
  total() {
    return Cart.read().reduce((sum, i) => {
      const p = findProduct(i.id);
      return sum + (p ? p.price * i.qty : 0);
    }, 0);
  }
};

/* --- 머리글과 꼬리글 --- */
function paintChrome() {
  // 화면마다 제목이 달라야 검색에서 구분됩니다.
  // 그래서 제목을 통째로 바꾸지 않고 가게 이름만 갈아 끼웁니다.
  document.title = document.title.replaceAll("하루상점", SHOP.name);

  const brand = document.querySelector(".brand");
  if (brand) brand.textContent = SHOP.name;

  const badge = document.querySelector(".cart-count");
  if (badge) badge.textContent = Cart.count();

  const foot = document.querySelector("footer.site .wrap");
  if (foot) foot.textContent = SHOP.name + " · " + SHOP.tagline;
}

/* --- Firestore 에서 읽어 오는 상품 (assets/products.js) ---
   이름 · 가격 · 한 줄 소개 · 재고는 Firestore products 컬렉션에서,
   긴 설명(detail)과 그림(emoji)은 shop.js 에서 읽습니다. */
const PRODUCTS_MODULE = new URL("products.js", document.currentScript.src).href;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const stockText = n => n > 0 ? `재고 ${n}개` : "품절";
const errorText = error => error.code ? `${error.code}: ${error.message}` : String(error.message || error);
function showReads(n) {
  const line = document.querySelector("#read-count");
  if (line) line.textContent = `이번 화면에서 읽은 문서 ${n}장`;
}

/* --- 상품 목록 --- */
async function paintList() {
  const box = document.querySelector("#product-list");
  if (!box) return;

  document.querySelector("#hero-title").textContent = SHOP.name;
  document.querySelector("#hero-tagline").textContent = SHOP.tagline;

  box.innerHTML = '<p class="empty">상품을 불러오는 중입니다.</p>';
  let mod, list;
  try {
    mod = await import(PRODUCTS_MODULE);
    list = await mod.loadProducts();
  } catch (error) {
    // 원본 오류는 Console 에, 화면에는 한 줄만
    console.error(error);
    box.innerHTML = '<p class="empty">목록을 불러오지 못했습니다</p>';
    return;
  }

  box.innerHTML = list.products.map(p => `
    <a class="card" href="product.html?id=${encodeURIComponent(p.id)}">
      <div class="thumb">${findProduct(p.id) ? findProduct(p.id).emoji : ""}</div>
      <h3>${esc(p.name)}</h3>
      <p class="sum">${esc(p.summary)}</p>
      <div class="price">${won(p.price)}</div>
      <p class="stock">${stockText(p.stock)}</p>
    </a>`).join("");
  showReads(list.reads);

  const uploader = document.querySelector("#upload-box");
  if (uploader && !uploader.dataset.ready) {
    uploader.dataset.ready = "1";
    // 올리기가 끝나면 목록을 다시 읽어 그린다
    mod.mountUploader(uploader, paintList);
  }
}

/* --- 상품 상세 --- */
async function paintDetail() {
  const box = document.querySelector("#product-detail");
  if (!box) return;

  const local = findProduct(qs("id"));
  let found = { product: null, reads: 0 };
  if (local) {
    try {
      const mod = await import(PRODUCTS_MODULE);
      found = await mod.loadProduct(local.id);
    } catch (error) {
      box.innerHTML = `<p class="empty">${esc(errorText(error))}</p>`;
      return;
    }
  }
  showReads(found.reads);

  if (!found.product) { box.innerHTML = '<p class="empty">그런 상품이 없습니다.</p>'; return; }
  const p = { ...local, ...found.product };

  document.title = p.name + " — " + SHOP.name;
  box.innerHTML = `
    <div class="thumb">${p.emoji}</div>
    <div>
      <h1>${esc(p.name)}</h1>
      <p class="sum">${esc(p.summary)}</p>
      <div class="price">${won(p.price)}</div>
      <p class="stock">${stockText(p.stock)}</p>
      <div class="body prose">${p.detail.map(t => `<p>${t}</p>`).join("")}</div>
      <button class="btn" id="add-to-cart"${p.stock > 0 ? "" : " disabled"}>장바구니에 담기</button>
    </div>`;

  // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
  window.dataLayer = window.dataLayer || [];
  // 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
  dataLayer.push({ ecommerce: null });
  // 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
  dataLayer.push({
    // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
    event: "view_item",
    // 같이 보내는 상품 값 묶음
    ecommerce: {
      // 어느 나라 돈인가
      currency: "KRW",
      // 금액 - 지금 보고 있는 그 상품 가격
      value: p.price,
      // 보고 있는 상품 상자 하나를 목록에 넣는다
      items: [{ item_id: p.id, item_name: p.name, price: p.price, quantity: 1 }]
    }
  });

  document.querySelector("#add-to-cart").addEventListener("click", () => {
    Cart.add(p.id);
    location.href = "cart.html";
  });
}

/* --- 장바구니 --- */
function paintCart() {
  const box = document.querySelector("#cart-box");
  if (!box) return;

  const items = Cart.read();
  if (items.length === 0) {
    box.innerHTML = '<p class="empty">장바구니가 비어 있습니다.</p>';
    return;
  }

  /* 결제 화면과 같은 배송 규칙을 미리 보여 줍니다 */
  const goodsTotal = Cart.total();
  const ship = shippingOf(goodsTotal);

  box.innerHTML = `
    <table class="cart">
      <tr><th>상품</th><th>수량</th><th>금액</th><th></th></tr>
      ${items.map(i => {
        const p = findProduct(i.id);
        if (!p) return "";
        return `<tr>
          <td>${p.emoji} ${p.name}</td>
          <td>${i.qty}</td>
          <td>${won(p.price * i.qty)}</td>
          <td><button class="btn ghost drop" data-id="${p.id}">빼기</button></td>
        </tr>`;
      }).join("")}
      <tr><th colspan="2" scope="row">상품 금액</th><td>${won(goodsTotal)}</td><td></td></tr>
      <tr><th colspan="2" scope="row">배송비</th><td>${won(ship.fee)}</td><td></td></tr>
      ${ship.discount > 0
        ? `<tr><th colspan="2" scope="row">무료배송 할인</th><td>-${won(ship.discount)}</td><td></td></tr>`
        : ""}
    </table>
    <div class="total">예상 결제 금액 ${won(ship.payable)}</div>
    <p class="lead">${ship.note}</p>
    <a class="btn" href="checkout.html">결제하기</a>`;

  box.querySelectorAll(".drop").forEach(b => {
    b.addEventListener("click", () => { Cart.remove(b.dataset.id); location.reload(); });
  });
}

/* --- 결제 --- */
function paintCheckout() {
  const form = document.querySelector("#pay-form");
  if (!form) return;

  const sum = document.querySelector("#pay-total");
  if (sum) sum.textContent = won(Cart.total());

  /* --- 금액 요약: 상품 금액 / 배송비 / 무료배송 할인 / 최종 결제 금액 ---
     배송 규칙은 장바구니 화면과 같은 shippingOf() 를 씁니다 */
  const ship = shippingOf(Cart.total());

  const shipBox = document.querySelector("#pay-shipping");
  if (shipBox) shipBox.textContent = won(ship.fee);

  const discountRow = document.querySelector("#pay-discount-row");
  const discountBox = document.querySelector("#pay-discount");
  if (discountBox) discountBox.textContent = "-" + won(ship.discount);
  /* 할인이 없는 주문에서는 할인 줄을 아예 내려 둡니다 */
  if (discountRow) discountRow.hidden = ship.discount === 0;

  const grandBox = document.querySelector("#pay-grand");
  if (grandBox) grandBox.textContent = won(ship.payable);

  const shipNote = document.querySelector("#pay-ship-note");
  if (shipNote) shipNote.textContent = ship.note;

  // ▼ 여기에 「결제 화면이 열렸다」를 알리는 코드가 들어갑니다 (뒤 수업에서)

  // 지금 장바구니 합계 - 상품 가격 × 수량의 합 (배송비는 들어 있지 않다)
  const cartTotal = Cart.total();

  // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
  window.dataLayer = window.dataLayer || [];
  // 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
  dataLayer.push({ ecommerce: null });
  // 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
  dataLayer.push({
    // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
    event: "begin_checkout",
    // 무료 배송인가 - 합계 50000 이상이면 yes, 아니면 no (ecommerce 밖에 둔다)
    free_shipping: cartTotal >= 50000 ? "yes" : "no",
    // 같이 보내는 상품 값 묶음
    ecommerce: {
      // 어느 나라 돈인가
      currency: "KRW",
      // 금액 - 장바구니 상품 합계
      value: cartTotal,
      // 장바구니에 든 상품을 하나씩 상자에 담아 목록으로 넣는다
      items: Cart.read().map(i => {
        const p = findProduct(i.id);
        return { item_id: p.id, item_name: p.name, price: p.price, quantity: i.qty };
      })
    }
  });

  form.addEventListener("submit", e => {
    e.preventDefault();

    // ▼ 여기에 「결제를 마쳤다」를 알리는 코드가 들어갑니다 (뒤 수업에서)

    // 주문 번호 - 누른 시각(밀리초)에 임의 글자를 붙여 만든다
    const orderId = "HZ" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);

    // 지금 주문한 상품 합계 - 상품 가격 × 수량의 합 (배송비는 들어 있지 않다)
    const orderTotal = Cart.total();

    // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
    window.dataLayer = window.dataLayer || [];
    // 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
    dataLayer.push({ ecommerce: null });
    // 통로 끝에 한 덩어리를 넣는다 - 넣는 순간이 태그 관리자가 듣는 순간
    dataLayer.push({
      // 무슨 일이 일어났나 - 계획서 이름 글자 그대로
      event: "purchase",
      // 같이 보내는 주문 값 묶음
      ecommerce: {
        // 주문 하나를 가리키는 번호 - 같은 주문이 두 번 세어지지 않게 한다
        transaction_id: orderId,
        // 어느 나라 돈인가
        currency: "KRW",
        // 금액 - 주문한 상품 합계
        value: orderTotal,
        // 주문한 상품을 하나씩 상자에 담아 목록으로 넣는다
        items: Cart.read().map(i => {
          const p = findProduct(i.id);
          return { item_id: p.id, item_name: p.name, price: p.price, quantity: i.qty };
        })
      }
    });

    Cart.clear();
    location.href = "done.html";
  });
}

/* --- 가게 소개·배송 안내 글 --- */
function paintProse() {
  const about = document.querySelector("#about-body");
  if (about) about.innerHTML = SHOP.about.map(t => `<p>${t}</p>`).join("");

  const ship = document.querySelector("#shipping-body");
  if (ship) ship.innerHTML = SHOP.shipping.map(t => `<p>${t}</p>`).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  paintChrome();
  paintList();
  paintDetail();
  paintCart();
  paintCheckout();
  paintProse();
});
