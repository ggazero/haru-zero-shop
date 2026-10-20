/* ===========================================================
   하루상점 — 포트원 V2 테스트 결제창
   「결제하기」를 누르면 테스트 결제창만 엽니다.
   주문 저장·장바구니 비우기·완료 화면 이동은 하지 않습니다.
   =========================================================== */

const PORTONE_STORE_ID = "store-576194bc-c6f2-4a0a-824c-3c5a10f836a3";
const PORTONE_CHANNEL_KEY = "channel-key-130fa5dc-3363-47e7-ab70-c958ac1d0f37";

// 결제 번호 - HARU- 뒤에 누른 시각(밀리초)과 임의 글자를 붙인다
function makePaymentId() {
  return "HARU-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

// 주문 이름 - 첫 상품 이름, 나머지 종류가 있으면 「외 N건」
function makeOrderName(items) {
  const first = findProduct(items[0].id);
  const rest = items.length - 1;
  return rest > 0 ? `${first.name} 외 ${rest}건` : first.name;
}

// 최종 결제 금액 - 결제 화면과 같은 shippingOf() 로 배송비·무료배송 할인까지 반영
function payableAmount() {
  return shippingOf(Cart.total()).payable;
}

function showPayResult(lines) {
  const box = document.querySelector("#pay-result");
  if (box) box.textContent = lines.join("\n");
}

/* app.js 의 제출 처리(purchase·장바구니 비우기·완료 화면 이동)보다 먼저 받아서
   그쪽으로 넘어가지 않게 막는다. 받는 분·주소·연락처 required 검사는
   브라우저가 제출 전에 하므로 그대로 유지된다. */
document.addEventListener("submit", async e => {
  const form = e.target;
  if (!form || form.id !== "pay-form") return;
  e.preventDefault();
  e.stopPropagation();

  const items = Cart.read();
  if (items.length === 0) {
    showPayResult(["장바구니가 비어 있습니다."]);
    return;
  }
  if (!window.PortOne) {
    showPayResult(["포트원 SDK 없음"]);
    return;
  }

  const paymentId = makePaymentId();
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  showPayResult(["결제창을 여는 중", "paymentId: " + paymentId]);

  try {
    const response = await PortOne.requestPayment({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_CHANNEL_KEY,
      paymentId,
      orderName: makeOrderName(items),
      totalAmount: payableAmount(),
      currency: "CURRENCY_KRW",
      payMethod: "CARD"
    });

    // 요약하지 않고 requestPayment() 가 돌려준 응답을 그대로 보여 준다
    showPayResult(["paymentId: " + paymentId, JSON.stringify(response, null, 2) ?? "undefined"]);
  } catch (err) {
    showPayResult(["paymentId: " + paymentId, String(err)]);
  } finally {
    if (button) button.disabled = false;
  }
}, true);
