import fs from "fs-extra";
import path from "path";
import RSS from "rss";
import frontMatter from "front-matter";
import { marked } from "marked";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure RSS feed
const feed = new RSS({
  title: "SoftwareRat's Blog",
  description: "Personal blog about software development, tech, and more",
  feed_url: "https://softwarerat.tech/feed.xml",
  site_url: "https://softwarerat.tech",
  image_url: "https://softwarerat.tech/images/logo.png",
  managingEditor: "SoftwareRat",
  webMaster: "SoftwareRat",
  copyright: `${new Date().getFullYear()} SoftwareRat`,
  language: "en",
  categories: ["Technology", "Programming", "Software Development"],
  pubDate: new Date().toUTCString(),
  ttl: 60,
});

// Read blog posts
const postsDir = path.join(process.cwd(), "content/blog/posts");
const posts = [];

if (fs.existsSync(postsDir)) {
  const files = fs.readdirSync(postsDir);
  files.forEach((file) => {
    if (path.extname(file) === ".md") {
      const content = fs.readFileSync(path.join(postsDir, file), "utf8");
      const { attributes, body } = frontMatter(content);
      const html = marked.parse(body);

      // Add post to feed
      feed.item({
        title: attributes.title,
        description: attributes.excerpt || html,
        url: `https://softwarerat.tech/blog/posts/${path.basename(file, ".md")}/`,
        guid: path.basename(file, ".md"),
        categories: attributes.tags || [],
        author: "SoftwareRat",
        date: attributes.date,
        custom_elements: [{ "content:encoded": html }],
      });

      posts.push({
        ...attributes,
        content: html,
        slug: path.basename(file, ".md"),
      });
    }
  });
}

// Sort posts by date
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

// Write RSS feed to file
fs.writeFileSync("public/feed.xml", feed.xml({ indent: true }));
console.log("RSS feed generated successfully!");
