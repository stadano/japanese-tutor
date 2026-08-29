#!/usr/bin/env node
/**
 * One-shot: turn a Google OAuth desktop client into a refresh token.
 *
 * Run it on your own machine (it needs a browser and a loopback port), paste the
 * result into `wrangler secret put GOOGLE_REFRESH_TOKEN`, and forget about it
 * until Google expires it — see the README on the 7-day testing-mode rule.
 *
 *   node authorize.mjs <client-id> <client-secret>
 *
 * No dependencies. Nothing leaves your machine except the token exchange itself.
 */

import http from "node:http";
import { spawn } from "node:child_process";

const SCOPES = [
  "googlehealth.activity_and_fitness.readonly",
  "googlehealth.sleep.readonly",
  "googlehealth.health_metrics_and_measurements.readonly",
  "googlehealth.profile.readonly",
].map((s) => `https://www.googleapis.com/auth/${s}`);

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error("usage: node authorize.mjs <client-id> <client-secret>");
  process.exit(1);
}

const PORT = 8731;
const REDIRECT = `http://localhost:${PORT}`;

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",   // without this there is no refresh token at all
    prompt: "consent",        // force a fresh one even if you have consented before
  });

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  if (!code) {
    res.writeHead(400).end("No code in callback.");
    return;
  }

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT,
      grant_type: "authorization_code",
    }),
  });
  const body = await r.json();

  if (!r.ok || !body.refresh_token) {
    res.writeHead(500).end("Token exchange failed — see the terminal.");
    console.error("\n✗ failed:", JSON.stringify(body, null, 2));
    if (r.ok) console.error("\nNo refresh_token came back. Revoke this app's access at\nhttps://myaccount.google.com/permissions and run again.");
    server.close();
    process.exit(1);
  }

  res.writeHead(200, { "Content-Type": "text/html" })
     .end("<h2>Done.</h2><p>Refresh token is in your terminal. You can close this tab.</p>");

  console.log("\n✓ refresh token:\n");
  console.log(body.refresh_token);
  console.log("\nNext:  wrangler secret put GOOGLE_REFRESH_TOKEN\n");
  server.close();
  process.exit(0);
});

server.listen(PORT, () => {
  console.log("Opening your browser. If nothing happens, visit:\n\n" + authUrl + "\n");
  const open = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(open, [authUrl], { stdio: "ignore", detached: true, shell: process.platform === "win32" }).unref();
});
