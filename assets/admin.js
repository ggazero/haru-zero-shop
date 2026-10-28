/* 관리 화면 입구
   - 권한은 ID 토큰의 커스텀 클레임 role 로만 판단한다 (Firestore users 문서는 보지 않는다).
   - staff / admin 이면 「관리자: role」, 그 외에는 「주인 명찰 받기」로 grantOwnerRole 을 부른다.
   - 명찰을 받은 뒤와 「다시 확인」에서는 getIdToken(true) 로 토큰을 새로 받아 다시 확인한다. */
import { auth, subscribeAuth } from "./auth.js";
import {
  getFunctions, httpsCallable
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js";

const grantOwnerRole = httpsCallable(getFunctions(auth.app, "us-central1"), "grantOwnerRole");
const ADMIN_ROLES = ["staff", "admin"];

const state = document.getElementById("ad-state");
const loginLink = document.getElementById("ad-login");
const grant = document.getElementById("ad-grant");
const recheck = document.getElementById("ad-recheck");
const result = document.getElementById("ad-result");

let check = 0;
async function showRole(user, refresh) {
  const current = ++check;
  loginLink.hidden = true;
  grant.hidden = true;
  recheck.hidden = true;
  if (!user) {
    state.textContent = "로그인이 필요합니다";
    loginLink.hidden = false;
    return;
  }
  state.textContent = "확인 중…";
  let role;
  try {
    role = (await user.getIdTokenResult(refresh)).claims.role;
  } catch (error) {
    if (current !== check) return;
    state.textContent = "권한을 확인하지 못했습니다";
    result.textContent = error.code ?? error.message;
    recheck.hidden = false;
    return;
  }
  if (current !== check || auth.currentUser !== user) return;
  recheck.hidden = false;
  if (ADMIN_ROLES.includes(role)) {
    state.textContent = `관리자: ${role}`;
  } else {
    state.textContent = "권한이 없습니다";
    grant.hidden = false;
  }
}

subscribeAuth(user => {
  result.textContent = "";
  showRole(user, false);
});

grant.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  grant.disabled = true;
  result.textContent = "";
  try {
    await grantOwnerRole();
    await user.getIdToken(true);
    await showRole(user, false);
  } catch (error) {
    result.textContent = `${error.code ?? "error"}: ${error.message}`;
  } finally {
    grant.disabled = false;
  }
});

recheck.addEventListener("click", async () => {
  recheck.disabled = true;
  result.textContent = "";
  try {
    await showRole(auth.currentUser, true);
  } finally {
    recheck.disabled = false;
  }
});
