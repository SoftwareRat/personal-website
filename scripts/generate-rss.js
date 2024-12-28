const fs = require("fs-extra");
const path = require("path");
const frontMatter = require("front-matter");
const { marked } = require("marked");

function formatDate(date) {
  const d = new Date(date);
  const pad = (num) => String(num).padStart(2, "0");

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

async function generateRSS() {
  const blogDir = path.join(__dirname, "../content/blog/posts");
  const outputFile = path.join(__dirname, "../public/rss.xml");

  // Ensure blog directory exists
  if (!fs.existsSync(blogDir)) {
    console.error("Blog directory not found");
    return;
  }

  // Read all blog posts
  const posts = [];
  const files = await fs.readdir(blogDir);

  for (const file of files) {
    if (!file.endsWith(".md")) continue;

    const content = await fs.readFile(path.join(blogDir, file), "utf-8");
    const { attributes, body } = frontMatter(content);
    const html = marked(body);

    posts.push({
      title: attributes.title,
      date: attributes.date,
      formattedDate: formatDate(attributes.date),
      content: html,
      link: `/blog/posts/${path.basename(file, ".md")}`,
      tags: attributes.tags || [],
      excerpt: attributes.excerpt || "",
    });
  }

  // Sort posts by date
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Generate RSS XML
  const rss = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
    <title>SoftwareRat's Blog</title>
    <description>Security Research, FOSS Development, and Technical Writings</description>
    <link>https://softwarerat.tech</link>
    <atom:link href="https://softwarerat.tech/rss.xml" rel="self" type="application/rss+xml" />
    <language>en</language>
    <lastBuildDate>${formatDate(new Date())}</lastBuildDate>
    ${posts
      .map(
        (post) => `
    <item>
        <title>${escapeXML(post.title)}</title>
        <link>https://softwarerat.tech${post.link}</link>
        <guid isPermaLink="true">https://softwarerat.tech${post.link}</guid>
        <dc:creator>SoftwareRat</dc:creator>
        <pubDate>${post.formattedDate}</pubDate>
        <description><![CDATA[
            ${post.excerpt ? `<p>${escapeXML(post.excerpt)}</p>` : ""}
            ${post.content}
        ]]></description>
        ${post.tags.map((tag) => `<category>${escapeXML(tag)}</category>`).join("\n        ")}
    </item>
    `
      )
      .join("\n")}
</channel>
</rss>`;

  // Write RSS file
  await fs.ensureDir(path.dirname(outputFile));
  await fs.writeFile(outputFile, rss);
  console.log("✅ RSS feed generated successfully!");
}

function escapeXML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

generateRSS().catch(console.error);
