import { google } from "googleapis";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const TOKEN_PATH = "token.json";
const CLIENT_PATH = "client_secret.json";
const OUTPUT_DIR = "reports";

const SITES = [
  {
    name: "smaplan",
    scUrl: "https://smaplan.com/",
    gaPropertyId: "properties/472889270",
    repo: "C:/Users/suhr5/erabook",
  },
  {
    name: "gacha-now",
    scUrl: "https://gacha-now.net/",
    gaPropertyId: "properties/464137498",
    repo: "C:/Users/suhr5/gacha-now",
  },
  {
    name: "orenocosme",
    scUrl: "https://oreno-cosme.com/",
    gaPropertyId: "properties/477498498",
    repo: "C:/Users/suhr5/orenocosme",
  },
];

function getAuth() {
  const creds = JSON.parse(readFileSync(CLIENT_PATH, "utf-8"));
  const { client_id, client_secret } = creds.installed || creds.web;
  const redirect_uri = "http://localhost:3939/callback";
  const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uri);
  const tokens = JSON.parse(readFileSync(TOKEN_PATH, "utf-8"));
  oauth2.setCredentials(tokens);
  oauth2.on("tokens", (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });
  return oauth2;
}

async function fetchSearchConsole(auth, siteUrl) {
  const sc = google.searchconsole({ version: "v1", auth });
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 28);

  const fmt = (d) => d.toISOString().split("T")[0];

  const [byQuery, byPage] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["query"],
        rowLimit: 30,
        type: "web",
      },
    }),
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ["page"],
        rowLimit: 20,
        type: "web",
      },
    }),
  ]);

  return {
    period: `${fmt(startDate)} ~ ${fmt(endDate)}`,
    topQueries: (byQuery.data.rows || []).map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: (r.ctr * 100).toFixed(1) + "%",
      position: r.position.toFixed(1),
    })),
    topPages: (byPage.data.rows || []).map((r) => ({
      page: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: (r.ctr * 100).toFixed(1) + "%",
      position: r.position.toFixed(1),
    })),
  };
}

async function fetchGA4(auth, propertyId) {
  const analytics = google.analyticsdata({ version: "v1beta", auth });

  const res = await analytics.properties.runReport({
    property: propertyId,
    requestBody: {
      dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
      dimensions: [{ name: "pagePath" }],
      metrics: [
        { name: "screenPageViews" },
        { name: "sessions" },
        { name: "averageSessionDuration" },
        { name: "bounceRate" },
      ],
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 20,
    },
  });

  return (res.data.rows || []).map((r) => ({
    page: r.dimensionValues[0].value,
    pageviews: Number(r.metricValues[0].value),
    sessions: Number(r.metricValues[1].value),
    avgDuration: Number(r.metricValues[2].value).toFixed(0) + "s",
    bounceRate: (Number(r.metricValues[3].value) * 100).toFixed(1) + "%",
  }));
}

async function main() {
  const auth = getAuth();
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const timestamp = new Date().toISOString().split("T")[0];
  const report = {};

  for (const site of SITES) {
    console.log(`\n📊 ${site.name} のデータを取得中...`);
    try {
      const sc = await fetchSearchConsole(auth, site.scUrl);
      console.log(`  Search Console: ${sc.topQueries.length} queries, ${sc.topPages.length} pages`);

      let ga = [];
      try {
        ga = await fetchGA4(auth, site.gaPropertyId);
        console.log(`  GA4: ${ga.length} pages`);
      } catch (e) {
        console.log(`  GA4: スキップ (${e.message})`);
      }

      report[site.name] = { searchConsole: sc, ga4: ga, repo: site.repo };
    } catch (e) {
      console.error(`  ❌ エラー: ${e.message}`);
      report[site.name] = { error: e.message };
    }
  }

  const outPath = `${OUTPUT_DIR}/report-${timestamp}.json`;
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\n✅ レポート保存: ${outPath}`);
}

main().catch(console.error);
