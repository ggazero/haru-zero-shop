import { auth, subscribeAuth, logoutToHome, sendVerificationEmail } from "./auth.js";
import { reload, linkWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
const nav = document.querySelector("header.site nav.site");
const account = document.createElement("span");
account.className = "account-nav";
const status = document.createElement("span");
status.setAttribute("role", "status");
if (nav) nav.append(account, status);
function link(text, href) {
  const node = document.createElement("a");
  node.textContent = text;
  node.href = href;
  return node;
}
export function displayName(user) {
  return user.displayName || user.email;
}
export function profileAvatar(user) {
  const avatar = document.createElement("span");
  avatar.className = "account-avatar";
  avatar.setAttribute("aria-hidden", "true");
  const initial = () => {
    avatar.replaceChildren();
    avatar.textContent = (Array.from(displayName(user) || "?")[0] || "?").toUpperCase();
  };
  if (user.photoURL) {
    const img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("error", initial);
    img.src = user.photoURL;
    avatar.append(img);
  } else initial();
  return avatar;
}
function logoutButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn ghost";
  button.textContent = "로그아웃";
  button.addEventListener("click", async () => {
    button.disabled = true;
    try { await logoutToHome(); }
    catch (error) { button.disabled = false; status.textContent = error.code; }
  });
  return button;
}
let verificationCheck = 0;
const verification = document.getElementById("email-verification");
const verificationStatus = document.getElementById("verification-status");
const resend = document.getElementById("resend-verification");
if (resend) resend.addEventListener("click", async () => {
  resend.disabled = true;
  try {
    await sendVerificationEmail(auth.currentUser);
    verificationStatus.textContent = "인증 메일을 보냈습니다. 메일함과 스팸함을 확인해 주세요.";
  } catch (error) {
    verificationStatus.textContent = error.code === "auth/too-many-requests"
      ? "잠시 뒤에 다시 눌러 주세요." : error.code;
  } finally {
    resend.disabled = false;
  }
});
const googleLink = document.getElementById("google-link");
const googleLinkStatus = document.getElementById("google-link-status");
// 이미 구글이 붙어 있으면 버튼 대신 「연결됨」을 보여 준다
function renderGoogleLink(user) {
  if (user.providerData.some(profile => profile.providerId === "google.com")) {
    const linked = document.createElement("span");
    linked.textContent = "연결됨";
    googleLink.replaceChildren(linked);
    return;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "btn";
  button.textContent = "구글 계정 연결하기";
  button.addEventListener("click", async () => {
    // 팝업이 막히지 않도록 클릭 직후 바로 연다. 새 계정이 아니라 지금 계정에 붙인다
    const popup = linkWithPopup(auth.currentUser, new GoogleAuthProvider());
    button.disabled = true;
    googleLinkStatus.textContent = "";
    try {
      const { user: linkedUser } = await popup;
      renderGoogleLink(linkedUser);
      googleLinkStatus.textContent = "구글 계정을 연결했어요.";
    } catch (error) {
      button.disabled = false;
      googleLinkStatus.textContent = error.code || error.message;
    }
  });
  googleLink.replaceChildren(button);
}
subscribeAuth(async user => {
  const check = ++verificationCheck;
  account.replaceChildren();
  if (user) {
    const profile = document.createElement("span");
    profile.className = "account-profile";
    const email = document.createElement("span");
    email.className = "account-email";
    email.textContent = displayName(user);
    profile.append(profileAvatar(user), email);
    account.append(profile, link("마이페이지", "mypage.html"), logoutButton());
  } else account.append(link("로그인", "login.html"));
  const page = document.getElementById("mypage-content");
  if (!page) return;
  page.hidden = true;
  verification.hidden = true;
  if (!user) { location.replace("login.html?next=mypage.html"); return; }
  try {
    await reload(user);
  } catch (error) {
    if (check === verificationCheck) status.textContent = error.code;
    return;
  }
  if (check !== verificationCheck || auth.currentUser !== user) return;
  verification.hidden = user.emailVerified;
  document.getElementById("mypage-email").textContent = user.email;
  document.getElementById("mypage-actions").replaceChildren(logoutButton());
  googleLinkStatus.textContent = "";
  renderGoogleLink(user);
  page.hidden = false;
});
