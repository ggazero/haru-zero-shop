/* 하루상점 — 웹 푸시 알림을 받는 서비스 워커
   가게 화면(assets/auth.js)과 같은 Firebase 버전 · 같은 설정 값을 씁니다. */

// 고칠 때마다 바꾼다 → 브라우저에 어느 버전이 켜져 있는지 확인용
const SW_VERSION = "2026-10-26.2";
const log = (...args) => console.log(`[하루상점 SW ${SW_VERSION}]`, ...args);

// 새 버전이 받아지면 바로 켜지고, 열려 있는 가게 탭도 바로 맡는다 (탭을 다 닫지 않아도 된다)
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim().then(() => log("활성화")));
});

// 가게 화면 Console 에서 켜진 버전을 물어볼 수 있다
//   const ch = new MessageChannel(); ch.port1.onmessage = (e) => console.log(e.data);
//   navigator.serviceWorker.controller.postMessage({ type: "SW_VERSION" }, [ch.port2]);
self.addEventListener("message", (event) => {
  if (event.data?.type !== "SW_VERSION") return;
  const reply = { type: "SW_VERSION", version: SW_VERSION };
  (event.ports[0] ?? event.source)?.postMessage(reply);
});

/* 알림을 눌렀을 때 — Firebase SDK 보다 먼저 등록해야 SDK 처리기보다 먼저 돈다
   - 백그라운드 FCM 알림(data.FCM_MSG): fcmOptions.link 로 간다.
     SDK 는 가게 탭이 열려 있으면 앞으로 가져오기만 하고 주소를 옮기지 않아서 여기서 대신 연다.
   - 가게 화면에서 직접 띄운 알림(assets/push-token.js 의 showNotification): data.link 로 간다.
   - 이 가게 주소만 연다. 열린 가게 탭이 있으면 앞으로 가져와 옮기고, 없으면 새 탭 */
let opening = null; // 처리 중인 클릭 — 연달아 눌러도 탭은 하나만 연다

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data ?? {};
  const fcm = data.FCM_MSG;
  const link = fcm ? fcm.fcmOptions?.link ?? fcm.notification?.click_action : data.link;
  log("알림 클릭", { kind: fcm ? "FCM" : "화면", link: link ?? null, action: event.action || null });

  // 링크가 없거나 알림 버튼을 누른 경우는 SDK(있으면)에 맡긴다
  if (!link || event.action) return log("링크 없음 → 처리 안 함");
  const url = new URL(link, self.location.href);
  if (url.host !== self.location.host) {
    return log("다른 사이트 주소라 열지 않음:", url.host, "≠", self.location.host);
  }

  event.stopImmediatePropagation(); // SDK 처리기는 건너뛴다 → 두 번 열지 않는다
  event.notification.close();
  if (opening) log("이미 여는 중 → 이번 클릭은 합친다");
  opening ??= openShop(url.href).finally(() => { opening = null; });
  event.waitUntil(opening);
});

async function openShop(href) {
  try {
    const tabs = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const shopTabs = tabs.filter((client) => new URL(client.url).host === self.location.host);
    log("열린 가게 탭", shopTabs.map((client) => client.url));
    const tab = shopTabs.find((client) => client.url === href)
      ?? shopTabs.find((client) => client.focused)
      ?? shopTabs[0];

    if (tab) {
      // focus 는 클릭 직후에만 허용된다 → 주소를 옮기기 전에 먼저 한다
      await tab.focus().catch((error) => log("탭 앞으로 가져오기 실패:", error.name, error.message));
      if (tab.url === href) return log("이미 그 주소 → 탭만 앞으로");
      try {
        // navigate 는 이 서비스 워커가 맡은 탭에서만 된다 → 안 되면 새 탭으로
        await tab.navigate(href);
        return log("탭 이동 완료:", href);
      } catch (error) {
        log("탭 이동 실패 → 새 탭으로:", error.name, error.message);
      }
    }

    const opened = await clients.openWindow(href);
    log(opened ? "새 탭 열림:" : "새 탭 열기 결과 없음(브라우저가 막음):", href);
  } catch (error) {
    console.error(`[하루상점 SW ${SW_VERSION}] 알림 클릭 처리 실패:`, error.name, error.message);
  }
}

importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA6xKS1r79xUj2wDsK-OaroN6a2SrB-qFg",
  authDomain: "small-shop-80f62.firebaseapp.com",
  projectId: "small-shop-80f62",
  storageBucket: "small-shop-80f62.firebasestorage.app",
  messagingSenderId: "852740748392",
  appId: "1:852740748392:web:83c836620d0665f28db7dd"
});

const messaging = firebase.messaging();
