export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = decodeURIComponent(url.pathname);
    const sort = url.searchParams.get("sort") || "name";
    const order = url.searchParams.get("order") || "asc";

    // Handle root path
    if (path === "/") {
      return new Response(
        await generateDirectoryListing("/", env, sort, order),
        {
          headers: { "Content-Type": "text/html;charset=UTF-8" },
        }
      );
    }

    try {
      // Try to get the file from R2
      const object = await env.FILES.get(path.slice(1));

      if (object === null) {
        // If not found, try to list directory
        if (path.endsWith("/")) {
          return new Response(
            await generateDirectoryListing(path, env, sort, order),
            {
              headers: { "Content-Type": "text/html;charset=UTF-8" },
            }
          );
        }
        return new Response("File not found", { status: 404 });
      }

      // Return file with appropriate headers
      const headers = new Headers();
      headers.set(
        "Content-Type",
        object.httpMetadata.contentType || "application/octet-stream"
      );
      headers.set("Content-Length", object.size);
      headers.set("ETag", object.httpEtag);
      headers.set("Cache-Control", "public, max-age=14400"); // 4 hours cache

      if (object.httpMetadata.contentDisposition) {
        headers.set(
          "Content-Disposition",
          object.httpMetadata.contentDisposition
        );
      }

      return new Response(object.body, { headers });
    } catch (error) {
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

function getFileIcon(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  const icons = {
    // Images
    jpg: "🖼️",
    jpeg: "🖼️",
    png: "🖼️",
    gif: "🖼️",
    webp: "🖼️",
    svg: "🖼️",
    bmp: "🖼️",
    ico: "🖼️",
    tiff: "🖼️",
    // Documents
    pdf: "📄",
    doc: "📝",
    docx: "📝",
    txt: "📝",
    md: "📝",
    rtf: "📝",
    odt: "📝",
    // Spreadsheets
    xls: "📊",
    xlsx: "📊",
    csv: "📊",
    ods: "📊",
    // Presentations
    ppt: "📽️",
    pptx: "📽️",
    odp: "📽️",
    // Archives
    zip: "📦",
    rar: "📦",
    "7z": "📦",
    tar: "📦",
    gz: "📦",
    bz2: "📦",
    xz: "📦",
    // Executables
    exe: "⚙️",
    msi: "⚙️",
    app: "⚙️",
    dmg: "⚙️",
    sh: "⚙️",
    bat: "⚙️",
    cmd: "⚙️",
    // Code
    js: "👨‍💻",
    ts: "👨‍💻",
    jsx: "👨‍💻",
    tsx: "👨‍💻",
    css: "👨‍💻",
    scss: "👨‍💻",
    less: "👨‍💻",
    html: "👨‍💻",
    py: "👨‍💻",
    java: "👨‍💻",
    cpp: "👨‍💻",
    c: "👨‍💻",
    h: "👨‍💻",
    hpp: "👨‍💻",
    rs: "👨‍💻",
    go: "👨‍💻",
    rb: "👨‍💻",
    php: "👨‍💻",
    swift: "👨‍💻",
    kt: "👨‍💻",
    // Media
    mp3: "🎵",
    wav: "🎵",
    ogg: "🎵",
    flac: "🎵",
    m4a: "🎵",
    aac: "🎵",
    mp4: "🎥",
    mov: "🎥",
    avi: "🎥",
    mkv: "🎥",
    webm: "🎥",
    flv: "🎥",
    // Fonts
    ttf: "🔤",
    otf: "🔤",
    woff: "🔤",
    woff2: "🔤",
    // Config
    json: "⚙️",
    yaml: "⚙️",
    yml: "⚙️",
    xml: "⚙️",
    toml: "⚙️",
    ini: "⚙️",
    conf: "⚙️",
    // Default
    default: "📄",
  };
  return icons[ext] || icons.default;
}

function formatDate(date) {
  const now = new Date();
  const d = new Date(date);

  // If invalid date, return "-"
  if (isNaN(d.getTime())) return "-";

  const diff = now.getTime() - d.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  // If less than 24 hours ago, show relative time
  if (days < 1) {
    if (hours < 1) {
      if (minutes < 1) {
        return "just now";
      }
      return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    }
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  // If this year, omit the year
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Otherwise show full date
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSortIcon(currentSort, currentOrder, columnSort) {
  if (currentSort !== columnSort) return "↕️";
  return currentOrder === "asc" ? "↑" : "↓";
}

function getSortUrl(currentSort, currentOrder, newSort) {
  const newOrder =
    currentSort === newSort && currentOrder === "asc" ? "desc" : "asc";
  return `?sort=${newSort}&order=${newOrder}`;
}

async function generateDirectoryListing(
  prefix,
  env,
  sort = "name",
  order = "asc"
) {
  prefix = prefix.slice(1); // Remove leading slash
  const options = {
    prefix: prefix,
    delimiter: "/",
  };

  const listing = await env.FILES.list(options);
  let objects = listing.objects;
  const directories = listing.delimitedPrefixes;

  // Sort the objects
  objects = objects.filter((obj) => !obj.key.endsWith("/"));

  const sortFunctions = {
    name: (a, b) => a.key.localeCompare(b.key),
    size: (a, b) => Number(a.size) - Number(b.size),
    date: (a, b) =>
      new Date(a.uploaded || 0).getTime() - new Date(b.uploaded || 0).getTime(),
  };

  objects.sort(sortFunctions[sort]);
  if (order === "desc") objects.reverse();

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Files - SoftwareRat</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📂</text></svg>" type="image/svg+xml">
    <link rel="apple-touch-icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📂</text></svg>">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
    <style>
        :root {
            --primary-color: #2563eb;
            --secondary-color: #1e40af;
            --background-color: #f8fafc;
            --surface-color: #ffffff;
            --text-primary: #1e293b;
            --text-secondary: #64748b;
            --border-color: #e2e8f0;
            --hover-color: #f1f5f9;
            --accent-color: #3b82f6;
            --success-color: #22c55e;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            line-height: 1.6;
            background: var(--background-color);
            color: var(--text-primary);
            padding: 2rem;
        }

        .header {
            max-width: 1200px;
            margin: 0 auto 2rem;
        }

        .header h1 {
            font-size: 1.75rem;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .header h1::before {
            content: "📂";
        }

        .header a {
            color: inherit;
            text-decoration: none;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: var(--surface-color);
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            overflow: hidden;
            transition: transform 0.2s;
        }

        .container:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .breadcrumb {
            padding: 1rem 1.5rem;
            background: var(--surface-color);
            border-bottom: 1px solid var(--border-color);
            font-size: 0.875rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .breadcrumb::before {
            content: "🏠";
        }

        .breadcrumb a {
            color: var(--primary-color);
            text-decoration: none;
            transition: all 0.2s;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
        }

        .breadcrumb a:hover {
            color: var(--secondary-color);
            background: var(--hover-color);
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th {
            text-align: left;
            padding: 1rem 1.5rem;
            font-weight: 500;
            font-size: 0.875rem;
            color: var(--text-secondary);
            background: var(--surface-color);
            border-bottom: 1px solid var(--border-color);
            position: sticky;
            top: 0;
            transition: background-color 0.2s;
        }

        th a {
            color: inherit;
            text-decoration: none;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            transition: all 0.2s;
        }

        th a:hover {
            color: var(--primary-color);
            background: var(--hover-color);
        }

        td {
            padding: 0.75rem 1.5rem;
            font-size: 0.9375rem;
            border-bottom: 1px solid var(--border-color);
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr {
            transition: all 0.2s;
        }

        tr:hover td {
            background-color: var(--hover-color);
        }

        .name-cell {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .icon {
            flex-shrink: 0;
            color: var(--text-secondary);
            font-size: 1.25rem;
            transition: transform 0.2s;
        }

        tr:hover .icon {
            transform: scale(1.1);
        }

        .name {
            color: var(--primary-color);
            text-decoration: none;
            transition: all 0.2s;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            position: relative;
        }

        .name:hover {
            color: var(--secondary-color);
            background: var(--hover-color);
        }

        .size {
            color: var(--text-secondary);
            font-size: 0.875rem;
            white-space: nowrap;
        }

        .date {
            color: var(--text-secondary);
            font-size: 0.875rem;
            white-space: nowrap;
        }

        .recent {
            color: var(--success-color);
        }

        .footer {
            max-width: 1200px;
            margin: 2rem auto 0;
            text-align: center;
            color: var(--text-secondary);
            font-size: 0.875rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        .footer::before {
            content: "☁️";
        }

        @media (max-width: 768px) {
            body {
                padding: 1rem;
            }

            .date {
                display: none;
            }

            td, th {
                padding: 0.75rem 1rem;
            }
        }

        @media (max-width: 480px) {
            .size {
                display: none;
            }
        }

        @media (prefers-color-scheme: dark) {
            :root {
                --background-color: #0f172a;
                --surface-color: #1e293b;
                --text-primary: #f1f5f9;
                --text-secondary: #94a3b8;
                --border-color: #334155;
                --hover-color: #334155;
            }
        }

        @media (prefers-reduced-motion: reduce) {
            * {
                animation: none !important;
                transition: none !important;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <h1><a href="/">Directory: ${prefix || "/"}</a></h1>
    </header>

    <main class="container">
        <div class="breadcrumb">
            <a href="/">root</a>${
              prefix
                ? " / " +
                  prefix
                    .split("/")
                    .filter(Boolean)
                    .map(
                      (part, index, array) =>
                        `<a href="/${array.slice(0, index + 1).join("/")}/">${part}</a>`
                    )
                    .join(" / ")
                : ""
            }
        </div>

        <table>
            <thead>
                <tr>
                    <th><a href="${getSortUrl(sort, order, "name")}">Name ${getSortIcon(sort, order, "name")}</a></th>
                    <th><a href="${getSortUrl(sort, order, "size")}">Size ${getSortIcon(sort, order, "size")}</a></th>
                    <th><a href="${getSortUrl(sort, order, "date")}">Date Modified ${getSortIcon(sort, order, "date")}</a></th>
                </tr>
            </thead>
            <tbody>
                ${
                  prefix !== ""
                    ? `
                <tr>
                    <td>
                        <div class="name-cell">
                            <span class="icon">📁</span>
                            <a href="../" class="name">..</a>
                        </div>
                    </td>
                    <td class="size">-</td>
                    <td class="date">-</td>
                </tr>`
                    : ""
                }

                ${directories
                  .map(
                    (dir) => `
                <tr>
                    <td>
                        <div class="name-cell">
                            <span class="icon">📁</span>
                            <a href="${dir}" class="name">${dir.split("/").slice(-2)[0]}/</a>
                        </div>
                    </td>
                    <td class="size">-</td>
                    <td class="date">-</td>
                </tr>`
                  )
                  .join("")}

                ${objects
                  .map((obj) => {
                    const date = formatDate(obj.uploaded);
                    const isRecent =
                      date.includes("ago") || date === "just now";
                    return `
                <tr>
                    <td>
                        <div class="name-cell">
                            <span class="icon">${getFileIcon(obj.key.split("/").pop())}</span>
                            <a href="/${obj.key}" class="name">${obj.key.split("/").pop()}</a>
                        </div>
                    </td>
                    <td class="size">${formatSize(obj.size)}</td>
                    <td class="date${isRecent ? " recent" : ""}">${date}</td>
                </tr>`;
                  })
                  .join("")}
            </tbody>
        </table>
    </main>

    <footer class="footer">
        <p>© ${new Date().getFullYear()} SoftwareRat • All files are served through Cloudflare's global network</p>
    </footer>
</body>
</html>`;

  return html;
}

function formatSize(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KiB", "MiB", "GiB", "TiB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
