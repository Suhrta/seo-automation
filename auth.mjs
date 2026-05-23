import { google } from "googleapis";
import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
];
const TOKEN_PATH = "token.json";
const CLIENT_PATH = "client_secret.json";

const creds = JSON.parse(readFileSync(CLIENT_PATH, "utf-8"));
const { client_id, client_secret } = creds.installed || creds.web;
const redirect_uri = "http://localhost:3939/callback";

const oauth2 = new google.auth.OAuth2(client_id, client_secret, redirect_uri);

const authUrl = oauth2.generateAuthUrl({
  access_type: "offline",
  scope: SCOPES,
  prompt: "consent",
});

console.log("\n=== OAuth 認証 ===");
console.log("ブラウザで以下のURLを開いてGoogleアカウントでログインしてください:\n");

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) return;
  const url = new URL(req.url, "http://localhost:3939");
  const code = url.searchParams.get("code");
  if (!code) {
    res.end("Error: no code");
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(code);
    writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    res.end("認証成功！このタブを閉じてください。");
    console.log("\n✅ 認証成功！token.json を保存しました。");
    server.close();
    process.exit(0);
  } catch (e) {
    res.end("Error: " + e.message);
    console.error("認証エラー:", e.message);
    server.close();
    process.exit(1);
  }
});

server.listen(3939, () => {
  console.log(authUrl);
  console.log("\nブラウザが自動で開かない場合は上のURLをコピーして貼り付けてください。\n");
  try {
    execSync(`start "" "${authUrl}"`, { stdio: "ignore" });
  } catch { /* ignore */ }
});
