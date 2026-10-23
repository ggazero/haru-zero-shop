

// 1. 쓰는 묶음 불러오기
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// 2. 서버용 라이브러리 준비 - 이미 준비돼 있으면 건너뛴다
if (getApps().length === 0) {
  initializeApp();
}

// 3. 주문 문서가 생기면 받은 시각을 적는 함수

exports.onOrderCreated = onDocumentCreated(
  { document: "orders/{orderId}", region: "us-central1" },
  async (event) => {
    const order = event.data.data();

    // 이미 처리가 끝난 주문은 다시 처리하지 않음
    if (order.processStatus === "done") return;

    try {
      // 실패 상황을 일부러 만드는 연습용 조건
      if (order.testMode === "fail") {
        throw new Error("연습용 실패");
      }

      // 정상 처리
      await event.data.ref.update({
        receivedAt: FieldValue.serverTimestamp(),
        processStatus: "done",
      });
    } catch (e) {
      console.error("주문 처리 실패", event.params.orderId, e.message);

      // 실패 사실을 주문 문서에 기록
      await event.data.ref.update({
        processStatus: "failed",
        processError: e.message,
      });
    }
  }
);



const {onRequest: mailOnRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const nodemailer = require("nodemailer");

const gmailAppPassword = defineSecret("GMAIL_APP_PASSWORD");

// 앱 비밀번호를 발급받은 본인 Gmail 주소
const SENDER = "ggayoung.llee@gmail.com";

exports.sendTestMail = mailOnRequest(
  {region: "us-central1", secrets: [gmailAppPassword]},
  async (req, res) => {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: SENDER,
          pass: gmailAppPassword.value(),
        },
      });

      await transporter.sendMail({
        from: SENDER,
        to: SENDER,
        subject: "[하루상점] 주문이 접수됐습니다 - " + new Date().toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" }),

        text: "주문 번호: test-194\n산 것: 연습 상품 1개\n낸 금액: 7,500원\n다음에 일어날 일: 주문 접수 상태를 확인합니다.\n문의처: 본 실습은 테스트 메일입니다.",
      });

      res.status(200).send("테스트 메일 발송 완료");
    } catch (error) {
      console.error("메일 발송 실패:", error.message);
      res.status(500).send("메일 발송 실패");
    }
  },
);

exports.countDailyOrders = onSchedule(
  { schedule: "every day 00:05", timeZone: "Asia/Seoul", region: "us-central1" },
  async () => {
    const nowSeoul = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const y = nowSeoul.getUTCFullYear();
    const m = nowSeoul.getUTCMonth();
    const d = nowSeoul.getUTCDate();

    const start = new Date(Date.UTC(y, m, d - 1) - 9 * 60 * 60 * 1000);
    const end = new Date(Date.UTC(y, m, d) - 9 * 60 * 60 * 1000);
    const day = new Date(Date.UTC(y, m, d - 1));
    const dateId = String(day.getUTCFullYear()) +
      String(day.getUTCMonth() + 1).padStart(2, "0") +
      String(day.getUTCDate()).padStart(2, "0");

    const snap = await getFirestore()
      .collection("orders")
      .where("createdAt", ">=", start)
      .where("createdAt", "<", end)
      .get();

    
    // 4-3. 건수와 합계, 취소 건수 세기
    let total = 0;
    let canceled = 0;
    snap.forEach((doc) => {
      total += Number(doc.data().totalPrice) || 0;
      if (doc.data().status === "canceled") canceled += 1;
    });

    // 4-4. 집계 문서 한 장에 적기
    await getFirestore().doc("dailyStats/" + dateId).set({
      orderCount: snap.size,
      totalSales: total,
      canceledCount: canceled,
      countedAt: FieldValue.serverTimestamp(),
    });


    console.log("어제 집계", dateId, snap.size, total);
  }
);
