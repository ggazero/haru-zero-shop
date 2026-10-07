import { subscribeAuth, logoutToHome } from "./auth.js";
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
subscribeAuth(user => {
  account.replaceChildren();
  if (user) {
    const email = document.createElement("span");
    email.className = "account-email";
    email.textContent = user.email;
    account.append(email, link("마이페이지", "mypage.html"), logoutButton());
  } else account.append(link("로그인", "login.html"));
  const page = document.getElementById("mypage-content");
  if (!page) return;
  page.hidden = true;
  if (!user) { location.replace("login.html?next=mypage.html"); return; }
  document.getElementById("mypage-email").textContent = user.email;
  document.getElementById("mypage-actions").replaceChildren(logoutButton());
  page.hidden = false;
});
