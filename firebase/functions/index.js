/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const {defineSecret} = require("firebase-functions/params");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

initializeApp();

// 값은 functions/.secret.local 에서 읽는다 (코드에 적지 않는다)
const portoneApiSecret = defineSecret("PORTONE_API_SECRET");

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

// 실습 181: 포트원 웹훅 수신 확인용 (결제 조회·주문 생성은 아직 하지 않음)
exports.portoneWebhook = onRequest({secrets: [portoneApiSecret]}, async (req, res) => {
  if (req.method === "POST") {
    const {type, data} = req.body || {};
    console.log("portoneWebhook type:", type);
    console.log("portoneWebhook paymentId:", data?.paymentId);
    console.log("portoneWebhook transactionId:", data?.transactionId);

    // 실습 182: 결제를 포트원에 다시 조회해 금액 확인
    if (data?.paymentId) {
      try {
        await verifyPayment(data.paymentId);
      } catch (err) {
        console.log("portoneWebhook 금액 확인 오류:", String(err));
      }
    }
  }
  // 어느 경우든 웹훅에는 200 으로 답한다
  res.status(200).send("OK");
});

// 배송비 규칙 - 가게 화면 assets/app.js 의 shippingOf() 와 같다
const SHIP_FEE = 3000;
const SHIP_FREE_FROM = 50000;

async function verifyPayment(paymentId) {
  const response = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {headers: {Authorization: `PortOne ${portoneApiSecret.value()}`}},
  );
  if (!response.ok) {
    console.log("포트원 조회 실패:", response.status, await response.text());
    return;
  }
  const payment = await response.json();
  console.log("결제 상태:", payment.status);
  console.log("결제 금액:", payment.amount?.total);
  console.log("customData:", payment.customData);

  // customData 가 글자 한 줄로 오면 풀어서 읽는다
  let customData = payment.customData;
  if (typeof customData === "string") customData = JSON.parse(customData);
  const items = customData?.items || [];

  // 상품 가격은 Firestore products 문서에서 읽는다
  const db = getFirestore();
  let goodsTotal = 0;
  for (const item of items) {
    const snap = await db.collection("products").doc(String(item.id)).get();
    if (!snap.exists) {
      console.log("상품 없음:", item.id);
      goodsTotal = NaN;
      break;
    }
    goodsTotal += snap.get("price") * item.qty;
  }
  const discount = goodsTotal >= SHIP_FREE_FROM ? SHIP_FEE : 0;
  const expected = goodsTotal + SHIP_FEE - discount;
  const paid = payment.amount?.total;

  if (payment.status === "PAID" && items.length > 0 && paid === expected) {
    console.log(`검증 통과: ${paymentId} 기준 금액 ${expected} 결제 금액 ${paid}`);
    await createOrder(db, {paymentId, customData, items, expected, paid, paidAt: payment.paidAt});
  } else {
    console.log(`금액 불일치: ${paymentId} 기준 금액 ${expected} 결제 금액 ${paid}`);
  }
}

// 실습 183: 검증 통과한 결제만 orders/{결제 ID} 로 남긴다
async function createOrder(db, {paymentId, customData, items, expected, paid, paidAt}) {
  try {
    // create() 는 같은 이름의 문서가 있으면 실패한다 (덮어쓰지 않음)
    await db.collection("orders").doc(paymentId).create({
      paymentId,
      userId: customData?.userId || "",
      items: items.map((i) => ({id: String(i.id), qty: i.qty})),
      totalPrice: expected,
      paidAmount: paid,
      status: "paid",
      createdAt: FieldValue.serverTimestamp(),
      // 포트원에서 다시 조회한 결제의 결제 완료 시각 (없으면 빈 글자)
      paidAt: paidAt || "",
    });
    console.log(`주문 생성: ${paymentId}`);
  } catch (err) {
    if (err.code === 6) { // ALREADY_EXISTS
      console.log(`이미 있는 주문 - 건너뜀: ${paymentId}`);
    } else {
      throw err;
    }
  }
}
