import { HtmlBasePlugin } from "@11ty/eleventy";
export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPassthroughCopy({ "src/css": "css", "src/admin": "admin", "src/images": "images", "src/video": "video" });
  const opts = { timeZone: "UTC" };
  const d = (iso) => new Date(iso + "T12:00:00Z");
  eleventyConfig.addFilter("longDate", (iso) => d(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", ...opts }));
  eleventyConfig.addFilter("year", (iso) => iso.slice(0, 4));
  eleventyConfig.addFilter("iso", (e) => e.date.toISOString().slice(0, 10));
  eleventyConfig.addGlobalData("today", () => new Date().toISOString().slice(0, 10));
  eleventyConfig.addGlobalData("buildId", () => Date.now().toString(36));
  eleventyConfig.addCollection("news", (api) => api.getFilteredByTag("news").sort((a, b) => b.date - a.date));
  return { dir: { input: "src", includes: "_includes", output: "_site" } };
}
