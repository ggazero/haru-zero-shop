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
const RETURN_PATHS = ["mypage.html", "rules-test.html"];
export function loginReturnPath() {
  const next = new URLSearchParams(location.search).get("next");
  return RETURN_PATHS.includes(next) ? next : null;
}
export async function logoutToHome() {
  await signOut(auth);
  location.replace("index.html");
}
