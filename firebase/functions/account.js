// 탈퇴 정리 - Firebase Authentication 계정이 지워지면 그 UID 의 문서 두 장만 지운다
//   users/{uid}, pushTokens/{uid}
// orders · adminLogs 등 다른 문서는 건드리지 않는다

// 1. 쓰는 묶음 불러오기
// 인증 트리거(2세대): firebase-functions 7.x 의 v2/identity onUserDeleted (@beta)
const { onUserDeleted } = require("firebase-functions/v2/identity");
const logger = require("firebase-functions/logger");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// 2. 서버용 라이브러리 준비 - 이미 준비돼 있으면 건너뛴다
if (getApps().length === 0) {
  initializeApp();
}

// 3. 계정이 지워지면 그 UID 의 users · pushTokens 문서를 지우는 함수
// 같은 삭제 이벤트가 다시 와도 안전하다: 없는 문서를 delete() 해도 오류 없이 끝난다
exports.cleanupDeletedUser = onUserDeleted(
  { region: "us-central1" },
  async (event) => {
    const uid = event.data?.uid;
    if (!uid) {
      logger.warn("탈퇴 정리 건너뜀 - UID 없음", { eventId: event.id });
      return;
    }

    const db = getFirestore();
    // 두 장을 한 번에 지운다 (하나만 지워지는 일이 없게)
    const batch = db.batch();
    batch.delete(db.doc("users/" + uid));
    batch.delete(db.doc("pushTokens/" + uid));
    await batch.commit();

    logger.info("탈퇴 정리", { uid });
  }
);
