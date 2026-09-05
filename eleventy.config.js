import { HtmlBasePlugin } from "@11ty/eleventy";
import markdownIt from "markdown-it";
const mdlib = markdownIt({ html: true, typographer: true });
export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/admin": "admin", "src/images": "images", "src/video": "video", "src/CNAME": "CNAME" });
  const opts = { timeZone: "UTC" };
  const d = (iso) => (iso instanceof Date ? iso : new Date(String(iso).slice(0, 10) + "T12:00:00Z"));
  eleventyConfig.addFilter("longDate", (iso) => d(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", ...opts }));
  eleventyConfig.addFilter("urlencode", (t) => encodeURIComponent(t || ""));
  eleventyConfig.addFilter("undated", (t) => (t || "").replace(/^\d{4}-\d{2}-\d{2}-/, ""));
  eleventyConfig.addFilter("md", (t) => mdlib.render(t || ""));
  eleventyConfig.addFilter("mdinline", (t) => mdlib.renderInline(t || ""));
  eleventyConfig.addFilter("dropcap", (h) => (h || "").replace("<p>", '<p class="dropcap">'));
  eleventyConfig.addCollection("posts", (api) => api.getFilteredByTag("post").sort((a, b) => b.date - a.date));
  eleventyConfig.addFilter("year", (iso) => iso.slice(0, 4));
  eleventyConfig.addFilter("iso", (e) => e.date.toISOString().slice(0, 10));
  eleventyConfig.addGlobalData("today", () => new Date().toISOString().slice(0, 10));
  eleventyConfig.addGlobalData("buildId", () => Date.now().toString(36));
  eleventyConfig.addCollection("news", (api) => api.getFilteredByTag("news").sort((a, b) => b.date - a.date));
  return { dir: { input: "src", includes: "_includes", output: "_site" } };
}
