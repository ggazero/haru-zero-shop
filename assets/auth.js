import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, sendEmailVerification } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
  const firebaseConfig = {
    apiKey: "AIzaSyA6xKS1r79xUj2wDsK-OaroN6a2SrB-qFg",
    authDomain: "small-shop-80f62.firebaseapp.com",
    projectId: "small-shop-80f62",
    storageBucket: "small-shop-80f62.firebasestorage.app",
    messagingSenderId: "852740748392",
    appId: "1:852740748392:web:83c836620d0665f28db7dd"
  };
export const auth = getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
auth.languageCode = "ko";
// 웹 푸시 알림용 서비스 워커 등록만 합니다. (알림 허락 요청 · 토큰 받기는 아직 안 함)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("firebase-messaging-sw.js")
    .catch(err => console.warn("서비스 워커 등록 실패", err));
}
export function sendVerificationEmail(user) {
  return sendEmailVerification(user);
}
const listeners = new Set();
let currentUser, ready = false, resolveReady;
export const authReady = new Promise(resolve => { resolveReady = resolve; });
onAuthStateChanged(auth, user => {
  currentUser = user;
  ready = true;
  resolveReady(user);
  listeners.forEach(listener => listener(user));
});
export function subscribeAuth(listener) {
  listeners.add(listener);
  if (ready) listener(currentUser);
  return () => listeners.delete(listener);
}
const RETURN_PATHS = ["mypage.html", "rules-test.html", "admin.html"];
export function loginReturnPath() {
  const next = new URLSearchParams(location.search).get("next");
  return RETURN_PATHS.includes(next) ? next : null;
}
// 이미 로그인했고 알림을 허락해 둔 손님이면 알림 받을 주소를 확인한다 (권한은 묻지 않는다)
if ("Notification" in window && Notification.permission === "granted") {
  authReady.then(user => {
    if (user) import("./push-token.js").then(m => m.syncPushToken());
  }).catch(error => console.warn("알림 주소 저장 실패:", error?.name ?? "Error"));
}
export async function logoutToHome() {
  await signOut(auth);
  location.replace("index.html");
}
