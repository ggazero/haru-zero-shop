
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

// Firebase Admin SDK 초기화
if (getApps().length === 0) {
  initializeApp();
}

// 반드시 실제 구글 로그인 계정 이메일로 변경
const OWNER_EMAIL = "ggayoung.llee@gmail.com";

// 주인 계정에만 관리자 권한 부여
exports.grantOwnerRole = onCall({ region: "us-central1" }, async (request) => {
  const token = request.auth ? request.auth.token : null;
  const email = token && token.email ? token.email.toLowerCase() : "";

  if (email !== OWNER_EMAIL.toLowerCase() || token.email_verified !== true) {
    throw new HttpsError(
      "permission-denied",
      "주인 계정만 명찰을 달 수 있습니다"
    );
  }

  await getAuth().setCustomUserClaims(request.auth.uid, { role: "admin" });

  return { role: "admin" };
});
