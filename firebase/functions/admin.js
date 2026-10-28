
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentWrittenWithAuthContext } = require("firebase-functions/v2/firestore");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

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

// 두 필드 값이 같은지 비교한다
// Timestamp · GeoPoint · DocumentReference 는 isEqual() 로, 배열 · 맵은 안쪽까지 비교한다
function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return Number.isNaN(a) && Number.isNaN(b);
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Buffer.isBuffer(a) || Buffer.isBuffer(b)) return Buffer.isBuffer(a) && Buffer.isBuffer(b) && a.equals(b);
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => sameValue(v, b[i]));
  }
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (typeof a.isEqual === "function") return a.isEqual(b);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => sameValue(a[k], b[k]));
}

// 고치기 전 · 후 문서에서 값이 달라진 필드 이름 (만들기면 새 필드 전부, 지우기면 있던 필드 전부)
function changedKeysOf(before, after) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((k) => !(k in before && k in after && sameValue(before[k], after[k]))).sort();
}

// 상품 문서가 생기거나 · 바뀌거나 · 지워지면 adminLogs 에 한 줄 남긴다
// 바뀐 것이 없거나 stock 만 바뀐 경우(손님 「바로 주문」의 재고 차감 등)는 남기지 않는다
exports.onProductWritten = onDocumentWrittenWithAuthContext(
  { document: "products/{productId}", region: "us-central1" },
  async (event) => {
    if (!event.data) return;
    const { before, after } = event.data;
    const action = !before.exists ? "create" : !after.exists ? "delete" : "update";
    const changedKeys = changedKeysOf(before.data() || {}, after.data() || {});

    if (changedKeys.length === 0) return;
    if (changedKeys.length === 1 && changedKeys[0] === "stock") return;

    await getFirestore().collection("adminLogs").add({
      productId: event.params.productId,
      action,
      changedKeys,
      actorId: event.authId ?? null,
      authType: event.authType ?? null,
      at: FieldValue.serverTimestamp(),
    });
  }
);
