// Vercel Serverless Function (Node.js)
// Path: /api/next-step
// Set env var: OPENAI_API_KEY
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const { stuck, minutes, mode } = req.body || {};
    if (!stuck || typeof stuck !== "string") {
      res.status(400).json({ error: "bad_request", message: "stuck is required" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(501).json({ error: "not_configured", message: "OPENAI_API_KEY is missing" });
      return;
    }

    const userMode = (mode === "adult") ? "adult" : "student";
    const m = Number(minutes || 20);

    const system = [
      "あなたは『脳汁ゴリラ』。ゴリラ王国の最下層の相談者が、迷いながらも活動継続できるようにするコーチAI。",
      "禁止：最適解・正解・結論・総論の提示、説教、長文、抽象的な励ましだけ。",
      "許可：状況の要約、迷いタイプの分類、次の一歩を1つ、観測可能な成功条件、次回相談テンプレ。",
      "出力は必ずJSONのみ。余計な文字は出さない。",
      "高校生に分かる言葉。UI/UXはシンプル。",
      "studentモードではキャラ補正強め（ゴリラ王国の比喩を1〜2行だけ）。adultモードは比喩少なめ。",
    ].join("\n");

    const prompt = {
      stuck,
      minutes: m,
      mode: userMode
    };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(prompt) }
        ]
      })
    });

    if (!response.ok) {
      const t = await response.text();
      res.status(502).json({ error: "upstream_error", detail: t.slice(0, 800) });
      return;
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    let payload;
    try { payload = JSON.parse(content); } catch { payload = null; }

    if (!payload || !payload.nextStep) {
      res.status(502).json({ error: "bad_ai_output", raw: content?.slice?.(0, 800) });
      return;
    }

    // Ensure required keys exist
    const normalized = {
      flavor: payload.flavor || (userMode === "student"
        ? "ゴリラ王国の掟：迷いは脳汁の前兆。答えを探すな、次の一手を出せ。"
        : "原則：結論を出さず、次の検証だけ決める。"),
      summary: payload.summary || stuck.slice(0, 60),
      stuckType: payload.stuckType || "選択肢過多",
      nextStep: payload.nextStep,
      success: payload.success || "“やった/やってない”が判定できる形で、成果物が1つ残る",
      nextPrompt: payload.nextPrompt || "いまの詰まり：___ / やったこと：___ / 観測：___ / 次の一歩：___"
    };

    res.status(200).json(normalized);
  } catch (e) {
    res.status(500).json({ error: "server_error", message: String(e) });
  }
}
