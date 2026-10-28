/* 把 index.html 裡的 JSX 先編譯成純 JS，產出到 dist/
   原本這件事是每次開啟 app 時在手機上做的（Babel standalone），
   搬到這裡之後，使用者端就不必再下載 Babel、也不用即時編譯。 */

const fs = require("fs");
const path = require("path");
const babel = require("@babel/core");

const SRC = "index.html";
const DIST = "dist";

const html = fs.readFileSync(SRC, "utf8");

// 1. 找出 JSX 區塊
const scriptRe = /<script\s+type="text\/babel"[^>]*>([\s\S]*?)<\/script>/;
const m = html.match(scriptRe);
if (!m) {
  console.error("✗ 找不到 <script type=\"text/babel\"> 區塊，沒有東西需要編譯");
  process.exit(1);
}
const jsx = m[1];
console.log(`找到 JSX：${jsx.split("\n").length} 行、${(jsx.length / 1024).toFixed(0)} KB`);

// 2. 編譯。編不過就讓整個流程失敗，不要部署壞掉的版本
let code;
try {
  const out = babel.transformSync(jsx, {
    presets: [["@babel/preset-react", { runtime: "classic" }]],
    sourceType: "module",
    filename: "app.jsx",
    compact: false,
    comments: false,
  });
  code = out.code;
} catch (e) {
  console.error("✗ 編譯失敗，不會部署：");
  console.error(e.message);
  process.exit(1);
}
console.log(`編譯完成：${(code.length / 1024).toFixed(0)} KB`);

// 3. 把 Babel 的 CDN script 拿掉，JSX 區塊換成外部 module
let out = html
  .replace(/<script\s+src="https:\/\/unpkg\.com\/@babel\/standalone[^>]*><\/script>\s*/g, "")
  .replace(scriptRe, '<script type="module" src="./app.js"></script>');

// 4. 輸出 dist/：編譯結果 + 其他要一起上線的檔案
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(path.join(DIST, "index.html"), out);
fs.writeFileSync(path.join(DIST, "app.js"), code);

// 把 repo 根目錄的靜態檔一起帶過去（字型、圖示、manifest、股價快取…）
const COPY_EXT = [".png", ".jpg", ".jpeg", ".svg", ".ico", ".json", ".otf", ".woff", ".woff2", ".webmanifest"];
let copied = 0;
for (const f of fs.readdirSync(".")) {
  if (f === SRC || f === DIST) continue;
  const st = fs.statSync(f);
  if (!st.isFile()) continue;
  if (!COPY_EXT.includes(path.extname(f).toLowerCase())) continue;
  if (f === "package.json" || f === "package-lock.json") continue;
  fs.copyFileSync(f, path.join(DIST, f));
  copied++;
}
console.log(`複製靜態檔 ${copied} 個`);
console.log("✓ 完成，輸出在 dist/");
