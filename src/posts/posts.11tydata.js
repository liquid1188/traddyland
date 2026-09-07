export default {
  layout: "post.njk",
  tags: "post",
  eleventyComputed: {
    permalink: (data) => data.approved === false ? false : `/forum/${data.page.fileSlug.replace(/^\d{4}-\d{2}-\d{2}-/, "")}/`,
    eleventyExcludeFromCollections: (data) => data.approved === false,
    approvedComments: (data) => (data.comments || []).filter((c) => c.approved !== false)
  }
};
