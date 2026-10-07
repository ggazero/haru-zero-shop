import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
  const firebaseConfig = {
    apiKey: "AIzaSyA6xKS1r79xUj2wDsK-OaroN6a2SrB-qFg",
    authDomain: "small-shop-80f62.firebaseapp.com",
    projectId: "small-shop-80f62",
    storageBucket: "small-shop-80f62.firebasestorage.app",
    messagingSenderId: "852740748392",
    appId: "1:852740748392:web:83c836620d0665f28db7dd"
  };
export const auth = getAuth(getApps().length ? getApp() : initializeApp(firebaseConfig));
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
export function loginReturnPath() {
  return new URLSearchParams(location.search).get("next") === "mypage.html" ? "mypage.html" : null;
}
export async function logoutToHome() {
  await signOut(auth);
  location.replace("index.html");
}
