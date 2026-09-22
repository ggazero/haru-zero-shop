/* ===========================================================
   하루상점 — 화면을 그리고 장바구니를 다루는 코드
   이 파일은 고치지 않아도 됩니다. (상품은 shop.js 에 있습니다)
   =========================================================== */

const won = n => n.toLocaleString("ko-KR") + "원";
const findProduct = id => PRODUCTS.find(p => p.id === id);
const qs = key => new URLSearchParams(location.search).get(key);

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

/* --- 상품 목록 --- */
function paintList() {
  const box = document.querySelector("#product-list");
  if (!box) return;

  document.querySelector("#hero-title").textContent = SHOP.name;
  document.querySelector("#hero-tagline").textContent = SHOP.tagline;

  box.innerHTML = PRODUCTS.map(p => `
    <a class="card" href="product.html?id=${p.id}">
      <div class="thumb">${p.emoji}</div>
      <h3>${p.name}</h3>
      <p class="sum">${p.summary}</p>
      <div class="price">${won(p.price)}</div>
    </a>`).join("");
}

/* --- 상품 상세 --- */
function paintDetail() {
  const box = document.querySelector("#product-detail");
  if (!box) return;

  const p = findProduct(qs("id"));
  if (!p) { box.innerHTML = '<p class="empty">그런 상품이 없습니다.</p>'; return; }

  document.title = p.name + " — " + SHOP.name;
  box.innerHTML = `
    <div class="thumb">${p.emoji}</div>
    <div>
      <h1>${p.name}</h1>
      <div class="price">${won(p.price)}</div>
      <div class="body prose">${p.detail.map(t => `<p>${t}</p>`).join("")}</div>
      <button class="btn" id="add-to-cart">장바구니에 담기</button>
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
    </table>
    <div class="total">합계 ${won(Cart.total())}</div>
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
     배송 안내(shop.js)와 같은 규칙입니다.
     배송비는 늘 3,000원으로 적어 두고, 5만 원 이상이면 그만큼을 할인으로 빼 줍니다.
     그래야 "얼마였는데 왜 안 내는지"가 화면에 남습니다. */
  const goodsTotal = Cart.total();
  const shipFee = 3000;
  const shipDiscount = goodsTotal >= 50000 ? shipFee : 0;

  const shipBox = document.querySelector("#pay-shipping");
  if (shipBox) shipBox.textContent = won(shipFee);

  const discountRow = document.querySelector("#pay-discount-row");
  const discountBox = document.querySelector("#pay-discount");
  if (discountBox) discountBox.textContent = "-" + won(shipDiscount);
  /* 할인이 없는 주문에서는 할인 줄을 아예 내려 둡니다 */
  if (discountRow) discountRow.hidden = shipDiscount === 0;

  const grandBox = document.querySelector("#pay-grand");
  if (grandBox) grandBox.textContent = won(goodsTotal + shipFee - shipDiscount);

  const shipNote = document.querySelector("#pay-ship-note");
  if (shipNote) shipNote.textContent = shipDiscount > 0
    ? "5만 원 이상 주문으로 배송비가 없습니다."
    : "5만 원 미만 주문은 배송비 3,000원입니다.";

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
