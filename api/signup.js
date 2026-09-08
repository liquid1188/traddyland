// Act I signup for traddyland.com.
// Emails the reader Act I as a PDF attachment (via Resend), notifies Lou,
// and records the subscriber in src/_data/subscribers.json so the list lives in the editor.
import site from "../src/_data/site.json" with { type: "json" };

const OWNER = "liquid1188", REPO = "traddyland", BRANCH = "main";
const GH = "https://api.github.com";
const SITE = site.url;
const FROM = `Lou Massett <${site.email}>`;
const FALLBACK_FROM = process.env.RESEND_FALLBACK_FROM || ""; // e.g. "Lou Massett <traddyland@likoudislegacy.com>" while traddyland.com is unverified
const PDF_URL = `${SITE}/files/traddyland-act-one.pdf`;

const gh = () => ({ Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "traddyland-signup" });
const clean = (s, max) => String(s || "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

function parseBody(req) {
  return new Promise((resolve) => {
    let data = ""; req.on("data", (c) => (data += c)); req.on("end", () => {
      const ct = req.headers["content-type"] || "";
      if (ct.includes("application/json")) { try { return resolve(JSON.parse(data)); } catch { return resolve({}); } }
      resolve(Object.fromEntries(new URLSearchParams(data)));
    });
  });
}

const text = `Thank you for wanting to read Traddyland. Act I is attached, the prologue through chapter nine. It begins on a December night in 1983, when I was thirteen and my family knelt for the Rosary in a drafty house on Oneida Lake.

If it stays with you, the whole book is on Amazon in paperback and for Kindle, and I would be grateful if you kept going:
${site.amazon}

${site.telegram ? `Readers also talk with me and each other in a Telegram group. You are welcome there, whether you agree with me or not:
${site.telegram}` : `There is also a forum on the site where readers can post and talk about the book. You are welcome there, whether you agree with me or not:
${SITE}/forum/`}

Every few weeks I send a short letter about the book, the podcast, and the parts of this story still unfolding. Write back anytime. I read everything.

Lou Massett`;

const html = `<div style="font:17px/1.6 Georgia,serif;color:#1c1b18;max-width:560px">
<p>Thank you for wanting to read <em>Traddyland</em>. Act I is attached, the prologue through chapter nine. It begins on a December night in 1983, when I was thirteen and my family knelt for the Rosary in a drafty house on Oneida Lake.</p>
<p>If it stays with you, the whole book is <a href="${site.amazon}">on Amazon in paperback and for Kindle</a>, and I would be grateful if you kept going.</p>
${site.telegram ? `<p>Readers also talk with me and each other in <a href="${site.telegram}">a Telegram group</a>. You are welcome there, whether you agree with me or not.</p>` : `<p>There is also <a href="${SITE}/forum/">a forum on the site</a> where readers can post and talk about the book. You are welcome there, whether you agree with me or not.</p>`}
<p>Every few weeks I send a short letter about the book, the podcast, and the parts of this story still unfolding. Write back anytime. I read everything.</p>
<p>Lou Massett</p>
</div>`;

async function resend(payload, retry = true) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const msg = await r.text();
    // Domain not yet verified: send from the fallback address, replies still go to Lou.
    if (retry && FALLBACK_FROM && /domain|verif/i.test(msg)) return resend({ ...payload, from: FALLBACK_FROM, reply_to: site.email }, false);
    throw new Error(`resend ${r.status}: ${msg}`);
  }
  return r.json();
}

async function recordSubscriber(email) {
  const path = "src/_data/subscribers.json";
  let list = [], sha;
  try {
    const r = await fetch(`${GH}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: gh() });
    if (r.ok) { const j = await r.json(); sha = j.sha; const parsed = JSON.parse(Buffer.from(j.content, "base64").toString("utf8")); list = Array.isArray(parsed) ? parsed : (parsed.subscribers || []); }
  } catch {}
  if (list.some((s) => s.email.toLowerCase() === email.toLowerCase())) return;
  list.push({ email, date: new Date().toISOString().slice(0, 10), source: "Act I signup" });
  const body = { message: `Signup: ${email}`, content: Buffer.from(JSON.stringify({ subscribers: list }, null, 2) + "\n", "utf8").toString("base64"), branch: BRANCH, committer: { name: "Traddyland Signup", email: "signup@traddyland.com" } };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH}/repos/${OWNER}/${REPO}/contents/${path}`, { method: "PUT", headers: { ...gh(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`record ${r.status}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("POST only");
  const f = await parseBody(req);
  const go = (q) => { res.statusCode = 303; res.setHeader("Location", `${SITE}/act-one/${q || ""}`); res.end(); };
  if (f.website) return go(); // honeypot
  const email = clean(f.email, 200).toLowerCase();
  if (!isEmail(email)) return go("?error=email");
  if (!process.env.RESEND_API_KEY) return go("?error=config");

  const results = await Promise.allSettled([
    resend({ from: FROM, to: [email], reply_to: site.email, subject: "Act I of Traddyland", text, html,
      attachments: [{ path: PDF_URL, filename: "Traddyland-Act-I.pdf" }] }),
    resend({ from: `Traddyland <${site.email}>`, to: [site.email], subject: `New Act I signup: ${email}`,
      text: `${email} just asked for Act I on traddyland.com and it was sent to them automatically.\n\nThe full list is in the editor under Subscribers.` }),
    process.env.GITHUB_TOKEN ? recordSubscriber(email) : Promise.resolve(),
  ]);
  const failed = results.filter((r) => r.status === "rejected");
  failed.forEach((r) => console.error(r.reason));
  if (results[0].status === "rejected") return go("?error=send");
  return go();
}
