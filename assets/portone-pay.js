/* ===========================================================
   하루상점 — 포트원 V2 테스트 결제창
   「결제하기」를 누르면 테스트 결제창을 열고, 결과를 주문 완료 화면으로 넘깁니다.
   주문 저장·장바구니 비우기는 주문 완료 화면(done.js)이 합니다.
   =========================================================== */

const PORTONE_STORE_ID = "store-576194bc-c6f2-4a0a-824c-3c5a10f836a3";
const PORTONE_CHANNEL_KEY = "channel-key-130fa5dc-3363-47e7-ab70-c958ac1d0f37";
// 휴대폰 결제는 결제를 마치면 이 주소로 돌아온다 (paymentId·code·message 가 주소 뒤에 붙는다)
// 배포 주소가 여러 개(Vercel 기본 도메인·브랜치 도메인)일 수 있어서,
// 지금 열려 있는 결제 화면과 같은 도메인의 done.html 로 돌아오게 한다
const PORTONE_REDIRECT_URL = new URL("done.html", location.href).href;

// PC 결제 결과도 휴대폰과 같은 모양(paymentId·code·message)으로 주문 완료 화면에 넘긴다
function goDone(paymentId, response) {
  const params = new URLSearchParams({ paymentId });
  if (response.code !== undefined) params.set("code", response.code);
  if (response.message !== undefined) params.set("message", response.message);
  location.href = "done.html?" + params.toString();
}

// 결제 번호 - HARU- 뒤에 누른 시각(밀리초)과 임의 글자를 붙인다
function makePaymentId() {
  return "HARU-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
}

// 주문 이름 - 첫 상품 이름, 나머지 종류가 있으면 「외 N건」
function makeOrderName(items) {
  // 이름은 장바구니에 적어 둔 Firestore 값, 없으면 shop.js 값 (app.js 의 cartLine)
  const lines = items.map(cartLine).filter(Boolean);
  if (lines.length === 0) return SHOP.name + " 주문";
  const rest = lines.length - 1;
  return rest > 0 ? `${lines[0].name} 외 ${rest}건` : lines[0].name;
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
      payMethod: "CARD",
      // 상품 ID 와 수량만 담는다 (금액은 넣지 않는다)
      customData: { items: items.map(i => ({ id: i.id, qty: i.qty })) },
      redirectUrl: PORTONE_REDIRECT_URL
    });

    // 응답이 없으면(휴대폰처럼 페이지를 떠나는 경우 등) 화면에 그대로 남긴다
    if (!response) {
      showPayResult(["paymentId: " + paymentId, JSON.stringify(response) ?? "undefined"]);
      return;
    }
    goDone(paymentId, response);
  } catch (err) {
    showPayResult(["paymentId: " + paymentId, String(err)]);
  } finally {
    if (button) button.disabled = false;
  }
}, true);
