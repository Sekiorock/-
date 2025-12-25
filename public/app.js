// 脳汁ゴリラ PWA
const $ = (id) => document.getElementById(id);

const out = $("out");
const toast = $("toast");
const rankEl = $("rank");
const xpEl = $("xp");

const RANKS = [
  { name: "最下層ゴリラ", min: 0 },
  { name: "床バナナ拾いゴリラ", min: 20 },
  { name: "枝バナナ管理ゴリラ", min: 60 },
  { name: "洞窟の参謀ゴリラ", min: 120 },
  { name: "王の影武者ゴリラ", min: 220 },
  { name: "ゴリラ王", min: 400 }
];

function loadState(){
  const xp = Number(localStorage.getItem("noujiru_xp") || "0");
  return { xp };
}
function saveXP(xp){
  localStorage.setItem("noujiru_xp", String(xp));
  render();
}
function calcRank(xp){
  let r = RANKS[0].name;
  for (const it of RANKS) if (xp >= it.min) r = it.name;
  return r;
}
function render(){
  const { xp } = loadState();
  xpEl.textContent = String(xp);
  rankEl.textContent = calcRank(xp);
}
function showToast(msg){
  toast.textContent = msg;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 2800);
}

function formatOutput(payload){
  // payload: { summary, stuckType, nextStep, success, nextPrompt, flavor }
  const lines = [];
  if (payload.flavor) lines.push(payload.flavor);
  lines.push("");
  lines.push("【いま】 " + payload.summary);
  lines.push("【迷いの種類】 " + payload.stuckType);
  lines.push("");
  lines.push("🦍【次の一歩（1つだけ）】");
  lines.push(payload.nextStep);
  lines.push("");
  lines.push("🔭【成功条件（正解じゃなく観測）】");
  lines.push(payload.success);
  lines.push("");
  lines.push("📌【次回の相談テンプレ】");
  lines.push(payload.nextPrompt);
  lines.push("");
  lines.push("——");
  lines.push("これは答えではなく、次の実験です。");
  return lines.join("\n");
}

// オフライン/フォールバック用の簡易ローカル生成（AI未接続でも動く）
function localFallback(stuck, minutes, mode){
  const summary = stuck.trim().slice(0, 40) + (stuck.trim().length > 40 ? "…" : "");
  const stuckType = ["情報不足","選択肢過多","評価不安","対人調整","時間不足","エネルギー不足"][Math.floor(Math.random()*6)];
  const nextStep = `タイマー${minutes}分。\n「いまの詰まり」を“名詞1つ＋動詞1つ”に言い換えて、紙に3案書く。\n例：『テーマ決定→仮説を立てる』みたいに。\n書けたら一番弱そうな案を選んで、最初の質問を1つ作る。`;
  const success = "3案が紙に出ていて、質問が1つできている（良し悪しは問わない）";
  const nextPrompt = "いまの詰まり：___ / 3案：___ / 作った質問：___ / 次に5分でやれること：___";
  const flavor = (mode==="student")
    ? "ゴリラ王国の掟：迷いは“脳汁”の前兆。答えを探すな、次の一手を出せ。"
    : "原則：結論を出さず、次の検証だけ決める。";
  return { summary, stuckType, nextStep, success, nextPrompt, flavor };
}

async function getNextStep(stuck, minutes, mode){
  // Try API first
  const res = await fetch("/api/next-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stuck, minutes, mode })
  });
  if (!res.ok) throw new Error("api_error");
  return await res.json();
}

$("go").addEventListener("click", async () => {
  const stuck = $("stuck").value;
  const minutes = Number($("timebox").value || "20");
  const mode = $("mode").value;

  if (!stuck.trim()){
    showToast("まずは“詰まり”を1行で書け。ゴリラは空欄に弱い。");
    return;
  }

  $("go").disabled = true;
  $("go").textContent = "🦍 脳汁生成中…";
  out.classList.remove("empty");
  out.textContent = "……（ゴリラ王国の通信中）";

  try{
    const payload = await getNextStep(stuck, minutes, mode);
    out.textContent = formatOutput(payload);

    // XP加算：行動しただけで勝ち
    const st = loadState();
    const gain = Math.max(6, Math.min(20, Math.floor(minutes/2) + 6));
    saveXP(st.xp + gain);
    showToast(`脳汁 +${gain}（階級が上がるかも）`);
  }catch(e){
    const payload = localFallback(stuck, minutes, mode);
    out.textContent = formatOutput(payload);
    showToast("オフライン/未設定：ローカル作戦で前進した。");
  }finally{
    $("go").disabled = false;
    $("go").textContent = "🦍 脳汁を出す（次の一歩）";
  }
});

$("reset").addEventListener("click", () => {
  localStorage.removeItem("noujiru_xp");
  render();
  out.textContent = "ここに「次の一歩」が表示されます。";
  out.classList.add("empty");
  showToast("記録をリセットした。最下層からやり直せ。");
});

// register service worker
if ("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

render();
