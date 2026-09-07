// Member submissions for traddyland.com: comments on posts and new forum posts.
// Files each submission into the GitHub repo as pending; Lou approves in the editor.
import yaml from "js-yaml";

const OWNER = "liquid1188", REPO = "traddyland", BRANCH = "main";
const SITE = "https://www.traddyland.com";
const GH = "https://api.github.com";
const headers = () => ({ Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "traddyland-forum" });

const clean = (s, max) => String(s || "").replace(/\r/g, "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").trim().slice(0, max);
const slugify = (t) => t.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").toLowerCase().slice(0, 60).replace(/^-|-$/g, "") || "post";
const today = () => new Date().toISOString().slice(0, 10);
const splitFM = (text) => { const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/); return m ? { fm: yaml.load(m[1]) || {}, body: m[2] } : { fm: {}, body: text }; };
const joinFM = (fm, body) => `---\n${yaml.dump(fm, { lineWidth: -1, quotingType: '"' })}---\n${body}`;

async function ghGet(path) { const r = await fetch(`${GH}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`, { headers: headers() }); if (!r.ok) throw new Error(`GET ${path}: ${r.status}`); return r.json(); }
async function ghPut(path, content, message, sha) {
  const body = { message, content: Buffer.from(content, "utf8").toString("base64"), branch: BRANCH, committer: { name: "Traddyland Forum", email: "forum@traddyland.com" } };
  if (sha) body.sha = sha;
  const r = await fetch(`${GH}/repos/${OWNER}/${REPO}/contents/${path}`, { method: "PUT", headers: { ...headers(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`PUT ${path}: ${r.status} ${await r.text()}`);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = ""; req.on("data", (c) => (data += c)); req.on("end", () => {
      const ct = req.headers["content-type"] || "";
      if (ct.includes("application/json")) { try { return resolve(JSON.parse(data)); } catch { return resolve({}); } }
      resolve(Object.fromEntries(new URLSearchParams(data)));
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("POST only");
  const f = await parseBody(req);
  const back = (q) => { res.statusCode = 303; res.setHeader("Location", `${SITE}${f.return && f.return.startsWith("/") ? f.return : "/forum/"}${q}`); res.end(); };
  if (f.website) return back("?sent=1"); // honeypot: pretend success
  const name = clean(f.name, 80), body = clean(f.body, 8000);
  if (!name || body.length < 2) return back("?error=empty");
  if (!process.env.GITHUB_TOKEN) return back("?error=config");
  try {
    if (f.kind === "post") {
      const title = clean(f.title, 140); if (!title) return back("?error=empty");
      const path = `src/posts/${today()}-${slugify(title)}.md`;
      let exists = false; try { await ghGet(path); exists = true; } catch {}
      const final = exists ? path.replace(/\.md$/, `-${Date.now().toString(36)}.md`) : path;
      const fm = { title, author: name, approved: false, submitted: new Date().toISOString() };
      await ghPut(final, joinFM(fm, body + "\n"), `Forum: new post from ${name} (pending)`);
      return back("?sent=post");
    }
    // comment
    const slug = clean(f.slug, 120).replace(/[^a-z0-9-]/g, "");
    const list = await ghGet("src/posts");
    const file = list.find((x) => x.name.endsWith(".md") && x.name.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "") === slug);
    if (!file) return back("?error=nopost");
    const cur = await ghGet(file.path);
    const text = Buffer.from(cur.content, "base64").toString("utf8");
    const { fm, body: postBody } = splitFM(text);
    fm.comments = Array.isArray(fm.comments) ? fm.comments : [];
    const c = { author: name, date: today(), body, approved: false };
    if (f.replyTo) c.replyTo = clean(f.replyTo, 80);
    fm.comments.push(c);
    await ghPut(file.path, joinFM(fm, postBody), `Forum: comment from ${name} on ${slug} (pending)`, cur.sha);
    return back("?sent=comment");
  } catch (e) {
    console.error(e); return back("?error=server");
  }
}
