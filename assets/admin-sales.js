/* 관리 화면 「매출」 탭
   - 권한 판단은 admin.js 가 한다. admin.js 가 상품 관리(#ad-products)를 보여 줄 때(staff / admin)만
     매출 탭이 보이고(탭 줄은 admin-orders.js 가 보이고 숨긴다), 숨기면 매출 화면을 비운다.
   - dailyStats 만 읽는다. orders 는 읽지 않는다 (오늘 주문을 직접 세지 않는다).
     집계 함수 countDailyOrders(functions/automation.js)가 매일 00:05(서울)에 전날을
     dailyStats/{YYYYMMDD} 한 장에 { orderCount, totalSales, canceledCount, countedAt } 로 적는다.
   - 서울 날짜로 어제부터 거꾸로 7일, 날짜마다 문서 한 장씩 getDoc 으로 읽는다.
   - 문서가 없는 날은 0원이 아니라 「집계 없음」 — 차트 막대를 비우고 표에도 그렇게 적는다.
   - 오류 원문은 console.error 로 남기고, 화면에는 한 줄만 보인다. */
import { auth } from "./auth.js";
import {
  getFirestore, doc, getDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const db = getFirestore(auth.app);
const DAYS = 7;
const NO_STATS = "집계 없음";
const seoulTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul", dateStyle: "long", timeStyle: "medium"
});
const seoulParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
});

// 서울 날짜로 어제부터 거꾸로 days 일. 오래된 날이 앞에 온다
// 반환: [{ id: "20261023", label: "10/23", long: "2026년 10월 23일" }, …]
export function recentDays(now = new Date(), days = DAYS) {
  const p = Object.fromEntries(seoulParts.formatToParts(now).map(x => [x.type, x.value]));
  const y = Number(p.year), m = Number(p.month), d = Number(p.day);
  const list = [];
  for (let back = days; back >= 1; back--) {
    const day = new Date(Date.UTC(y, m - 1, d - back));
    const yy = day.getUTCFullYear(), mm = day.getUTCMonth() + 1, dd = day.getUTCDate();
    list.push({
      id: `${yy}${String(mm).padStart(2, "0")}${String(dd).padStart(2, "0")}`,
      label: `${mm}/${dd}`,
      long: `${yy}년 ${mm}월 ${dd}일`
    });
  }
  return list;
}

const won = n => `${n.toLocaleString("ko-KR")}원`;
const numberOrDash = (value, unit) => typeof value === "number" ? `${value.toLocaleString("ko-KR")}${unit}` : "-";
const timeText = value => value && typeof value.toDate === "function" ? `${seoulTime.format(value.toDate())} (서울)` : "-";

const productsBox = document.getElementById("ad-products");
const tabButton = document.getElementById("ad-tab-sales-btn");
const statusLine = document.getElementById("ad-sales-status");
const basis = document.getElementById("ad-sales-basis");
const basisDay = document.getElementById("ad-sales-basis-day");
const lastCounted = document.getElementById("ad-sales-counted");
const canvas = document.getElementById("ad-sales-chart");
const chartBox = document.getElementById("ad-sales-chart-box");
const salesHead = document.getElementById("ad-sales-head");
const salesRows = document.getElementById("ad-sales-rows");
const reload = document.getElementById("ad-sales-reload");

let active = false;
let loaded = false;
let loadCount = 0;
let chart = null;

async function loadSales() {
  const current = ++loadCount;
  loaded = true;
  reload.disabled = true;
  statusLine.textContent = "매출을 불러오는 중입니다.";
  const days = recentDays();
  try {
    const snaps = await Promise.all(days.map(day => getDoc(doc(db, "dailyStats", day.id))));
    if (current !== loadCount) return;
    // stats: 문서가 없으면 null (0원과 구분한다)
    const rows = days.map((day, i) => ({ ...day, stats: snaps[i].exists() ? snaps[i].data() : null }));
    statusLine.textContent = "";
    render(rows);
  } catch (error) {
    if (current !== loadCount) return;
    console.error("[매출] dailyStats 를 읽지 못했습니다", error);
    statusLine.textContent = `매출을 불러오지 못했습니다 — ${error?.code ?? "오류"} (자세한 내용은 브라우저 콘솔)`;
    clear(false);
  } finally {
    if (current === loadCount) reload.disabled = false;
  }
}

function render(rows) {
  const counted = rows.filter(r => r.stats);
  const latest = counted[counted.length - 1];
  if (latest) {
    basisDay.textContent = latest.long;
    lastCounted.textContent = timeText(latest.stats.countedAt);
    basis.hidden = false;
  } else {
    basis.hidden = true;
    statusLine.textContent = `최근 ${DAYS}일의 집계 문서가 없습니다.`;
  }
  renderTable(rows);
  renderChart(rows);
}

function cell(text, className) {
  const td = document.createElement("td");
  if (className) td.className = className;
  td.textContent = text;
  return td;
}

function renderTable(rows) {
  // 취소 건수 칸은 어느 문서에든 canceledCount 가 있을 때만 둔다
  const showCanceled = rows.some(r => r.stats && r.stats.canceledCount !== undefined);
  const heads = ["날짜", "주문 건수", "매출 금액", "집계 시각"].concat(showCanceled ? ["취소 건수"] : []);
  salesHead.replaceChildren(...heads.map(text => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = text;
    return th;
  }));
  salesRows.replaceChildren(...rows.map(r => {
    const tr = document.createElement("tr");
    tr.append(cell(r.long));
    if (!r.stats) {
      const none = cell(NO_STATS, "ad-sales-none");
      none.colSpan = heads.length - 1;
      tr.append(none);
      return tr;
    }
    tr.append(
      cell(numberOrDash(r.stats.orderCount, "건"), "ad-num"),
      cell(numberOrDash(r.stats.totalSales, "원"), "ad-num"),
      cell(timeText(r.stats.countedAt))
    );
    if (showCanceled) tr.append(cell(numberOrDash(r.stats.canceledCount, "건"), "ad-num"));
    return tr;
  }));
}

function renderChart(rows) {
  if (typeof window.Chart !== "function") {
    console.error("[매출] 차트 도구(Chart.js)를 불러오지 못했습니다");
    statusLine.textContent = "차트 도구를 불러오지 못했습니다 — 아래 표에서 매출을 확인해 주세요";
    chartBox.hidden = true;
    return;
  }
  chartBox.hidden = false;
  const css = getComputedStyle(document.documentElement);
  const ink = css.getPropertyValue("--ink").trim() || "#2b2d25";
  const sub = css.getPropertyValue("--sub").trim() || "#6d7164";
  const line = css.getPropertyValue("--line").trim() || "#deddd0";
  const accent = css.getPropertyValue("--accent").trim() || "#788268";
  // 문서가 없는 날은 null → 막대를 그리지 않고, 날짜 아래 줄에 「집계 없음」
  const labels = rows.map(r => r.stats ? r.label : [r.label, NO_STATS]);
  const values = rows.map(r => r.stats && typeof r.stats.totalSales === "number" ? r.stats.totalSales : null);
  if (chart) chart.destroy();
  chart = new window.Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "매출 금액", data: values, backgroundColor: accent, borderRadius: 3, maxBarThickness: 48 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: items => rows[items[0].dataIndex].long,
            label: item => `매출 ${won(item.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: ctx => rows[ctx.index] && !rows[ctx.index].stats ? sub : ink
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: line },
          ticks: { color: sub, precision: 0, callback: value => won(value) }
        }
      }
    }
  });
}

// 화면을 비운다. 상태 줄까지 지울지는 clearStatus 로 고른다
function clear(clearStatus = true) {
  if (chart) { chart.destroy(); chart = null; }
  basis.hidden = true;
  basisDay.textContent = "";
  lastCounted.textContent = "";
  salesHead.replaceChildren();
  salesRows.replaceChildren();
  if (clearStatus) statusLine.textContent = "";
}

// 매출 탭을 처음 열 때 읽는다 (탭을 바꾸는 일은 admin-orders.js 가 한다)
tabButton.addEventListener("click", () => { if (active && !loaded) loadSales(); });
reload.addEventListener("click", () => { if (active) loadSales(); });

/* --- 보이기 / 숨기기: admin.js 가 상품 관리를 보이거나 숨길 때 따라간다 --- */
function setActive(on) {
  if (on === active) return;
  active = on;
  if (on) return; // 읽기는 탭을 열 때
  loadCount++;
  loaded = false;
  reload.disabled = false;
  clear();
}

new MutationObserver(() => setActive(!productsBox.hidden))
  .observe(productsBox, { attributes: true, attributeFilter: ["hidden"] });
setActive(!productsBox.hidden);
