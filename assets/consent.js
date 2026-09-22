/* 동의 배너
   - 네 신호(ad_storage, analytics_storage, ad_user_data, ad_personalization)를
     기본 denied 로 두고, 수락을 누른 화면에서만 granted 로 update 합니다.
   - 고른 값은 localStorage("haru_consent")에 기억합니다. */
(function () {
  var KEY = "haru_consent";
  var SIGNALS = ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"];

  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function () { window.dataLayer.push(arguments); };
  }

  function state(value) {
    var o = {};
    for (var i = 0; i < SIGNALS.length; i++) o[SIGNALS[i]] = value;
    return o;
  }

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function save(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
  }

  /* 1) 기본값: 모두 denied (태그 관리자 코드보다 먼저 실행됩니다) */
  gtag("consent", "default", state("denied"));

  /* 2) 앞 화면에서 수락을 골랐다면 이 화면에서도 granted 로 올려 둡니다 */
  var saved = read();
  if (saved === "granted") gtag("consent", "update", state("granted"));

  /* 3) 배너와 다시 고르기 링크 */
  var CSS =
    '#consent-banner{position:fixed;left:0;right:0;bottom:0;z-index:9999;' +
    'background:var(--card,#fffbef);border-top:1px solid var(--line,#cbbb9e);' +
    'box-shadow:0 -3px 14px rgba(72,76,59,.10);font-size:13.5px;color:var(--ink,#3e3428)}' +
    '#consent-banner .consent-in{max-width:var(--max,1040px);margin:0 auto;padding:14px 20px;' +
    'display:flex;align-items:center;gap:14px;flex-wrap:wrap}' +
    '#consent-banner p{margin:0;flex:1 1 260px;line-height:1.6}' +
    '#consent-banner button{border-radius:8px;padding:9px 18px;font-size:13.5px;font-weight:600;' +
    'font-family:inherit;cursor:pointer;border:1px solid var(--line,#cbbb9e);background:transparent;' +
    'color:var(--ink,#3e3428)}' +
    '#consent-banner button.ok{background:var(--accent,#465c39);color:var(--accent-ink,#fffbee);' +
    'border-color:var(--accent,#465c39)}' +
    '#consent-reopen{display:block;text-align:center;padding:14px 20px;font-size:13px;' +
    'color:var(--sub,#68634f)}';

  function addStyle() {
    var s = document.createElement("style");
    s.id = "consent-style";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function hide() {
    var b = document.getElementById("consent-banner");
    if (b) b.parentNode.removeChild(b);
  }

  function show() {
    if (document.getElementById("consent-banner")) return;
    var box = document.createElement("div");
    box.id = "consent-banner";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", "쿠키 사용 동의");
    box.innerHTML =
      '<div class="consent-in">' +
      "<p>더 나은 가게를 만들려고 쿠키를 씁니다. 수락하시면 방문 기록과 광고 정보를 함께 봅니다.</p>" +
      '<button type="button" class="no">거부</button>' +
      '<button type="button" class="ok">수락</button>' +
      "</div>";
    box.querySelector(".ok").addEventListener("click", function () {
      gtag("consent", "update", state("granted"));
      save("granted");
      hide();
    });
    box.querySelector(".no").addEventListener("click", function () {
      /* 거부는 기본값 그대로 두고 기억만 합니다 */
      save("denied");
      hide();
    });
    document.body.appendChild(box);
  }

  function addReopen() {
    /* 이미 붙여 둔 링크가 있으면 다시 만들지 않습니다 */
    if (document.getElementById("consent-reopen")) return;

    var link = document.createElement("a");
    link.id = "consent-reopen";
    link.href = "#";
    link.textContent = "동의 다시 고르기";
    link.addEventListener("click", function (e) {
      e.preventDefault();
      show();
    });
    /* .wrap 안이 아니라 footer.site 의 자식으로 붙입니다.
       app.js 의 paintChrome() 이 .wrap 의 textContent 를 덮어써도
       그 바깥에 있는 이 링크는 지워지지 않습니다. */
    var foot = document.querySelector("footer.site");
    (foot || document.body).appendChild(link);
  }

  function start() {
    addStyle();
    addReopen();
    if (read() === null) show();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
