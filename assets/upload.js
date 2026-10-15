/* ===========================================================
   하루상점 — 상품 사진 올리는 화면 (upload.html)
   사진은 Storage products/{상품 문서 ID}/main.jpg 에 고른 파일 그대로 올리고,
   그 경로 글자만 상품 문서의 imagePath 에 저장한다.
   =========================================================== */
import {
  getFirestore, collection, doc, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-storage.js";
import { auth, subscribeAuth } from "./auth.js";

const db = getFirestore(auth.app);
const storage = getStorage(auth.app);

const loginLine = document.querySelector("#photo-login");
const form = document.querySelector("#photo-form");
const select = document.querySelector("#photo-product");
const fileInput = document.querySelector("#photo-file");
const submit = document.querySelector("#photo-submit");
const result = document.querySelector("#photo-result");

// 오류 글은 줄이지 않고 그대로 보여 준다
const errorText = error => error.code ? `${error.code}: ${error.message}` : String(error.message || error);

// 숨긴 상품까지 products 문서를 전부 읽어 고르는 목록을 만든다
let loaded = false;
async function loadOptions() {
  if (loaded) return;
  loaded = true;
  try {
    const snap = await getDocs(collection(db, "products"));
    const options = snap.docs.map(d => {
      const p = d.data();
      const option = document.createElement("option");
      option.value = d.id;
      option.textContent = `${d.id} · ${p.name ?? ""}${p.isVisible === false ? " (숨김)" : ""}`;
      return option;
    });
    const first = document.createElement("option");
    first.value = "";
    first.textContent = "상품을 고르세요";
    select.replaceChildren(first, ...options);
    select.disabled = false;
  } catch (error) {
    loaded = false;
    console.error(error);
    result.textContent = errorText(error);
  }
}

subscribeAuth(user => {
  loginLine.hidden = !!user;
  form.hidden = !user;
  if (user) loadOptions();
});

// 고른 파일 하나를 그대로 올리고 몇 % 올라갔는지 보여 준다
function uploadPhoto(path, file) {
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(ref(storage, path), file);
    task.on("state_changed",
      snap => {
        const percent = snap.totalBytes ? Math.floor(snap.bytesTransferred / snap.totalBytes * 100) : 0;
        result.textContent = `올리는 중 … ${percent}%`;
      },
      reject,
      resolve
    );
  });
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const id = select.value;
  const file = fileInput.files[0];
  if (!id || !file) return;

  // 맨 앞에 / 를 붙이지 않는다. 예: products/p1/main.jpg
  const path = `products/${id}/main.jpg`;
  submit.disabled = true;
  result.textContent = "올리는 중 … 0%";
  try {
    await uploadPhoto(path, file);
    // 다른 필드는 그대로 두고 imagePath 만 더한다 (다운로드 URL이 아니라 경로만)
    await updateDoc(doc(db, "products", id), { imagePath: path });
    result.textContent = `다 올렸습니다. ${path} 를 ${id} 문서의 imagePath 에 저장했습니다.`;
  } catch (error) {
    console.error(error);
    result.textContent = errorText(error);
  } finally {
    submit.disabled = false;
  }
});
