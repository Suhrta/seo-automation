import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const REPORTS_DIR = "reports";
const OUTPUT = "docs/index.html";

const files = readdirSync(REPORTS_DIR)
  .filter((f) => f.endsWith(".json"))
  .sort();

const reports = files.map((f) => ({
  date: f.replace("report-", "").replace(".json", ""),
  data: JSON.parse(readFileSync(`${REPORTS_DIR}/${f}`, "utf-8")),
}));

const latest = reports[reports.length - 1];
if (!latest) {
  console.log("No reports found");
  process.exit(0);
}

function siteCard(name, site, label) {
  const sc = site.searchConsole;
  if (!sc) return `<div class="card"><h2>${label}</h2><p class="muted">データなし</p></div>`;

  const totalClicks = sc.topPages.reduce((s, p) => s + p.clicks, 0);
  const totalImpressions = sc.topPages.reduce((s, p) => s + p.impressions, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0.0";

  const queryRows = sc.topQueries
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)
    .map(
      (q) => `<tr>
        <td>${q.query}</td>
        <td class="num">${q.impressions}</td>
        <td class="num">${q.clicks}</td>
        <td class="num ${parseFloat(q.ctr) === 0 ? "danger" : ""}">${q.ctr}</td>
        <td class="num ${parseFloat(q.position) <= 10 ? "good" : parseFloat(q.position) <= 20 ? "warn" : ""}">${q.position}</td>
      </tr>`
    )
    .join("");

  const pageRows = sc.topPages
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10)
    .map(
      (p) => {
        const path = p.page.replace(/https?:\/\/[^/]+/, "");
        return `<tr>
          <td title="${p.page}">${path || "/"}</td>
          <td class="num">${p.impressions}</td>
          <td class="num">${p.clicks}</td>
          <td class="num ${parseFloat(p.ctr) === 0 ? "danger" : ""}">${p.ctr}</td>
          <td class="num ${parseFloat(p.position) <= 10 ? "good" : parseFloat(p.position) <= 20 ? "warn" : ""}">${p.position}</td>
        </tr>`;
      }
    )
    .join("");

  return `
    <div class="card">
      <h2>${label} <span class="badge">${name}</span></h2>
      <div class="stats">
        <div class="stat"><div class="stat-value">${totalClicks}</div><div class="stat-label">Clicks</div></div>
        <div class="stat"><div class="stat-value">${totalImpressions}</div><div class="stat-label">Impressions</div></div>
        <div class="stat"><div class="stat-value">${avgCtr}%</div><div class="stat-label">CTR</div></div>
      </div>

      <h3>Top Queries</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Query</th><th>Imp.</th><th>Click</th><th>CTR</th><th>Pos.</th></tr></thead>
          <tbody>${queryRows || '<tr><td colspan="5" class="muted">データなし</td></tr>'}</tbody>
        </table>
      </div>

      <h3>Top Pages</h3>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Page</th><th>Imp.</th><th>Click</th><th>CTR</th><th>Pos.</th></tr></thead>
          <tbody>${pageRows || '<tr><td colspan="5" class="muted">データなし</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
}

function trendData(siteName) {
  return reports.map((r) => {
    const site = r.data[siteName];
    if (!site?.searchConsole) return { date: r.date, clicks: 0, impressions: 0 };
    const pages = site.searchConsole.topPages;
    return {
      date: r.date,
      clicks: pages.reduce((s, p) => s + p.clicks, 0),
      impressions: pages.reduce((s, p) => s + p.impressions, 0),
    };
  });
}

const siteLabels = {
  smaplan: "スマートプラン",
  "gacha-now": "ガチャなう",
  orenocosme: "オレのコスメ",
};

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SEO Dashboard</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', sans-serif; background: #f5f5f7; color: #1d1d1f; padding: 24px; }
  h1 { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
  .subtitle { font-size: 14px; color: #86868b; margin-bottom: 24px; }
  .grid { display: flex; flex-direction: column; gap: 20px; max-width: 1200px; margin: 0 auto; }
  .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  .card h2 { font-size: 20px; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
  .card h3 { font-size: 14px; font-weight: 600; color: #86868b; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
  .badge { font-size: 11px; font-weight: 500; background: #f0f0f5; color: #86868b; padding: 2px 8px; border-radius: 6px; }
  .stats { display: flex; gap: 24px; margin-bottom: 8px; }
  .stat { text-align: center; }
  .stat-value { font-size: 32px; font-weight: 700; color: #1d1d1f; }
  .stat-label { font-size: 12px; color: #86868b; margin-top: 2px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 10px; border-bottom: 2px solid #f0f0f5; font-weight: 600; color: #86868b; font-size: 11px; text-transform: uppercase; }
  td { padding: 7px 10px; border-bottom: 1px solid #f5f5f7; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .danger { color: #ff3b30; font-weight: 600; }
  .warn { color: #ff9500; font-weight: 600; }
  .good { color: #34c759; font-weight: 600; }
  .muted { color: #86868b; }
  .trend { margin: 20px 0; }
  .trend-bar { display: flex; align-items: end; gap: 3px; height: 60px; }
  .trend-col { flex: 1; background: #007aff; border-radius: 3px 3px 0 0; min-width: 8px; transition: height 0.3s; position: relative; }
  .trend-col:hover::after { content: attr(data-label); position: absolute; bottom: 100%; left: 50%; transform: translateX(-50%); background: #1d1d1f; color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 10px; white-space: nowrap; }
  .trend-dates { display: flex; gap: 3px; font-size: 9px; color: #86868b; margin-top: 4px; }
  .trend-dates span { flex: 1; text-align: center; overflow: hidden; }
  @media (min-width: 768px) { .grid { display: grid; grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="grid">
  <div>
    <h1>SEO Dashboard</h1>
    <div class="subtitle">期間: ${latest.data.smaplan?.searchConsole?.period || latest.date} ・ 最終更新: ${latest.date}</div>
  </div>

  ${Object.entries(siteLabels)
    .map(([key, label]) => {
      const site = latest.data[key];
      if (!site || site.error) return `<div class="card"><h2>${label}</h2><p class="muted">エラー: ${site?.error || "データなし"}</p></div>`;

      const trend = trendData(key);
      const maxImp = Math.max(...trend.map((t) => t.impressions), 1);
      const trendBars = trend
        .map((t) => {
          const h = Math.max((t.impressions / maxImp) * 60, 2);
          return `<div class="trend-col" style="height:${h}px" data-label="${t.date}: ${t.impressions}imp / ${t.clicks}click"></div>`;
        })
        .join("");
      const trendLabels = trend.map((t) => `<span>${t.date.slice(5)}</span>`).join("");

      return siteCard(key, site, label) +
        (trend.length > 1
          ? `<div class="card"><h3>${label} - Impressions 推移</h3><div class="trend"><div class="trend-bar">${trendBars}</div><div class="trend-dates">${trendLabels}</div></div></div>`
          : "");
    })
    .join("\n")}
</div>
</body>
</html>`;

import { mkdirSync } from "node:fs";
mkdirSync("docs", { recursive: true });
writeFileSync(OUTPUT, html);
console.log(`Dashboard generated: ${OUTPUT}`);
