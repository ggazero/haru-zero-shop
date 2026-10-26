/* ===========================================================
   하루상점 — 알림 받을 주소(FCM 토큰)를 받아 pushTokens/{UID} 에 적는다
   - 로그인했고 알림 권한이 granted 일 때만 토큰을 받는다. 권한은 여기서 묻지 않는다.
   - 「배송 알림 받기」로 granted 가 된 직후(push-ask.js)에는 늘 적는다.
   - 화면을 열 때(auth.js)는 적힌 토큰과 같고 30일이 안 지났으면 적지 않는다.
   - 토큰 값은 화면 · Console 에 내지 않는다. 오류는 이름만 한 줄 남긴다.
   =========================================================== */
import { getMessaging, getToken, isSupported, onMessage } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { auth, authReady } from "./auth.js";

// Firebase 콘솔 → 프로젝트 설정 → 클라우드 메시징 → 웹 푸시 인증서의 「키 쌍」(공개 키)
const VAPID_KEY = "BPDS52nsMaRpLH8rpfl62Rj33M_4v2KhxJ9KCZmz7MEGG88_9mqUSV4r8-dMk-_eu6dk3scB72rmXrgFM-dT5rQ";
const FRESH_MS = 30 * 24 * 60 * 60 * 1000;
let listening = false;

export async function syncPushToken({ force = false } = {}) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const user = await authReady && auth.currentUser;
    if (!user) return;
    if (!(await isSupported())) return;

    // 이미 등록해 둔 /firebase-messaging-sw.js 를 그대로 쓴다 (새로 등록하지 않는다)
    const registration = await navigator.serviceWorker.ready;
    const messaging = getMessaging(auth.app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    if (!token) return;

    // 가게 화면을 보고 있을 때 온 알림은 서비스 워커가 띄우지 않고 이 화면으로 넘긴다 → 여기서 직접 띄운다
    if (!listening) {
      listening = true;
      onMessage(messaging, ({ notification }) => {
        if (notification) registration.showNotification(notification.title, { body: notification.body });
      });
    }

    const ref = doc(getFirestore(auth.app), "pushTokens", user.uid);
    if (!force) {
      const saved = (await getDoc(ref)).data();
      const savedAt = saved?.updatedAt?.toMillis?.();
      // 같은 토큰을 30일 안에 적어 두었으면 다시 쓰지 않는다
      if (saved?.token === token && savedAt && Date.now() - savedAt < FRESH_MS) return;
    }
    // 문서가 없으면 만들고, 있으면 token · updatedAt 두 필드만 바꾼다
    await setDoc(ref, { token, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.warn("알림 주소 저장 실패:", error?.name ?? "Error");
  }
}
