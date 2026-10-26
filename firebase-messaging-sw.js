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
