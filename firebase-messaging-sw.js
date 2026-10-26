/* 하루상점 — 웹 푸시 알림을 받는 서비스 워커
   가게 화면(assets/auth.js)과 같은 Firebase 버전 · 같은 설정 값을 씁니다. */
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

/* 가게 화면에서 직접 띄운 알림(assets/push-token.js 의 showNotification)을 눌렀을 때
   - 백그라운드 FCM 알림(data.FCM_MSG)은 Firebase SDK 가 fcmOptions.link 로 연다 → 여기서는 손대지 않는다
   - 이 가게 주소만 연다. 열린 가게 탭이 있으면 그 탭을 옮기고 앞으로, 없으면 새 탭 */
self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data;
  if (!data?.link || data.FCM_MSG) return;
  event.notification.close();

  const url = new URL(data.link, self.location.origin);
  if (url.origin !== self.location.origin) return;
  event.waitUntil(openShop(url.href));
});

async function openShop(href) {
  const tabs = await clients.matchAll({ type: "window", includeUncontrolled: true });
  const tab = tabs.find((client) => new URL(client.url).origin === self.location.origin);
  if (tab) {
    try {
      // navigate 는 이 서비스 워커가 맡은 탭에서만 된다 → 안 되면 새 탭으로
      const moved = await tab.navigate(href);
      return (moved ?? tab).focus();
    } catch (error) {
      // 아래 새 탭 열기로 넘어간다
    }
  }
  return clients.openWindow(href);
}
