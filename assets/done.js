/* ===========================================================
   하루상점 — 주문 완료 화면: 결제 결과를 받아 주문을 만든다
   주소 뒤의 paymentId · code · message 를 읽는다.
   (PC 는 portone-pay.js 가, 휴대폰은 포트원 redirectUrl 이 붙여 준다)
   - code 가 있으면: 결제 실패·취소. 주문을 만들지 않는다.
   - code 가 없고 paymentId 가 있으면: 로그인한 사람의 주문을 orders/{paymentId} 로 만든다.
   - 둘 다 없으면: 아무것도 만들지 않는다.
   =========================================================== */
import {
  getFirestore, doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, authReady } from "./auth.js";

const db = getFirestore(auth.app);

const params = new URLSearchParams(location.search);
const paymentId = params.get("paymentId");
const code = params.get("code");
const message = params.get("message");

const title = document.querySelector("#done-title");
const prose = document.querySelector("#done-prose");
const result = document.querySelector("#done-result");

function show(heading, lines) {
  title.textContent = heading;
  prose.hidden = true;
  result.textContent = lines.join("\n");
}

// 새로고침해도 주문·purchase 가 다시 일어나지 않게 주소에서 결제 값을 지운다
function forgetParams() {
  history.replaceState(null, "", location.pathname);
}

// 저장한 주문으로 purchase 를 한 번 보낸다 - transaction_id 는 paymentId
function sendPurchase(order) {
  // 통로가 이미 있으면 그대로 쓰고, 없을 때만 새로 만든다
  window.dataLayer = window.dataLayer || [];
  // 앞에서 넣은 상품 값이 섞이지 않게 먼저 비운다
  dataLayer.push({ ecommerce: null });
  dataLayer.push({
    event: "purchase",
    ecommerce: {
      transaction_id: paymentId,
      currency: "KRW",
      // 금액 - 주문한 상품 합계 (배송비는 들어 있지 않다, 결제 화면 전 purchase 와 같은 기준)
      value: order.goodsTotal,
      items: order.items.map(i => ({ item_id: i.productId, item_name: i.name, price: i.price, quantity: i.quantity }))
    }
  });
}

async function placePaidOrder() {
  const user = await authReady && auth.currentUser;
  if (!user) {
    show("주문을 만들지 않았습니다", [
      "결제 ID: " + paymentId,
      "로그인하지 않은 상태라 주문을 만들지 않았습니다. 장바구니는 그대로입니다."
    ]);
    return;
  }

  const cart = Cart.read();
  if (cart.length === 0) {
    show("주문을 만들지 않았습니다", [
      "결제 ID: " + paymentId,
      "장바구니가 비어 있어 주문을 만들지 않았습니다."
    ]);
    return;
  }

  // 「바로 주문」과 같은 items 모양: productId · name · price · quantity
  // 이름 · 가격은 결제 화면에서 Firestore 최신 값으로 맞춰 둔 장바구니 값 (app.js 의 cartLine)
  const items = cart.map(cartLine).filter(Boolean).map(p =>
    ({ productId: p.id, name: p.name, price: p.price, quantity: p.qty }));
  const goodsTotal = Cart.total();

  try {
    await setDoc(doc(db, "orders", paymentId), {
      userId: user.uid,
      items,
      // 결제한 금액 - 결제 화면과 같은 shippingOf() 로 배송비·무료배송 할인 반영
      totalPrice: shippingOf(goodsTotal).payable,
      status: "paid",
      createdAt: serverTimestamp(),
      paymentId
    });
  } catch (error) {
    // 오류 글은 줄이지 않고 그대로 보여 준다
    console.error(error);
    show("주문을 저장하지 못했습니다", [
      "결제 ID: " + paymentId,
      error.code ? `${error.code}: ${error.message}` : String(error.message || error)
    ]);
    return;
  }

  forgetParams();
  sendPurchase({ items, goodsTotal });
  Cart.clear();
  document.querySelectorAll(".cart-count").forEach(n => { n.textContent = Cart.count(); });
  show("주문이 접수되었습니다", ["결제 ID: " + paymentId, "주문이 접수되었습니다"]);
  // 주문 저장에 성공했을 때만 배송 알림 카드를 띄운다 (push-ask.js)
  showPushAsk(result);
}

if (code) {
  forgetParams();
  show("결제가 완료되지 않았습니다", [message ?? "", "장바구니는 그대로입니다"]);
} else if (paymentId) {
  show("주문을 확인하는 중입니다", ["결제 ID: " + paymentId]);
  placePaidOrder();
} else {
  show("주문 정보가 없습니다", ["주소에 결제 결과(paymentId·code)가 없어 주문을 만들지 않았습니다."]);
}
