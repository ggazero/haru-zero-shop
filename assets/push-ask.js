/* ===========================================================
   하루상점 — 주문을 마친 손님에게만 배송 알림을 받을지 묻는 카드
   주문 완료 화면(done.js)과 「바로 주문」(app.js)이 주문 성공 뒤에 부른다.
   - 페이지를 열 때는 묻지 않는다. 「배송 알림 받기」를 눌렀을 때만 권한을 묻는다.
   - 알림 받을 주소(FCM 토큰)는 아직 받지 않는다.
   =========================================================== */

function showPushAsk(anchor) {
  // 알림을 못 쓰는 브라우저면 카드를 띄우지 않는다
  if (!("Notification" in window)) return;

  // 앞 주문의 카드가 남아 있으면 지우고 이번 주문의 카드를 새로 붙인다
  document.querySelectorAll(".push-ask").forEach(n => n.remove());

  const card = document.createElement("section");
  card.className = "push-ask";
  card.innerHTML = `
    <p class="push-ask-title">주문하신 상품이 출발하면 알려드릴까요?</p>
    <div class="push-ask-actions">
      <button class="btn" type="button" data-push="yes">배송 알림 받기</button>
      <button class="btn ghost" type="button" data-push="later">나중에</button>
    </div>
    <p class="push-ask-status" role="status"></p>`;
  anchor.after(card);

  const actions = card.querySelector(".push-ask-actions");
  const status = card.querySelector(".push-ask-status");

  function paint(permission) {
    if (permission === "granted") {
      actions.hidden = true;
      status.textContent = "알림을 받고 있어요";
    } else if (permission === "denied") {
      actions.hidden = true;
      status.textContent = "알림이 막혀 있어요. 주소창 왼쪽의 사이트 정보(자물쇠) 아이콘 → 알림 → 「허용」으로 바꾼 뒤 이 화면을 새로고침해 주세요.";
    }
  }
  // 이미 허락했거나 막아 둔 손님에게는 버튼 대신 지금 상태를 보여 준다
  paint(Notification.permission);

  card.querySelector('[data-push="yes"]').addEventListener("click", async () => {
    const result = await Notification.requestPermission();
    console.log("알림 권한 요청 결과:", result);
    if (result === "default") status.textContent = "아직 정하지 않으셨어요. 다시 누르면 한 번 더 물어볼게요.";
    paint(result);
  });

  // 「나중에」: 이번 주문의 카드만 닫는다 (다음 주문 때 다시 나온다)
  card.querySelector('[data-push="later"]').addEventListener("click", () => card.remove());
}
