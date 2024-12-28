# Minimalist Portfolio Site Generator

A clean, modern portfolio website generator that converts Markdown content into a beautiful static website.

## Project Structure

```
.
├── content/              # Markdown content files
│   ├── about/           # Professional summary and skills
│   ├── projects/        # Project showcases
│   └── blog/            # Blog posts and articles
├── layouts/             # HTML templates
├── static/              # Static assets (CSS, images, etc.)
├── scripts/             # Build scripts
└── public/              # Generated website (output)
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Add your content in Markdown format to the respective folders in `content/`

3. Build the site:
```bash
npm run build
```

The compiled site will be available in the `public/` directory.

## Development

- Run development server:
```bash
npm run dev
```

## Features

- Markdown-based content management
- Responsive design
- Modern, minimalist aesthetic
- Blog support
- Project showcase
- Contact form
- Fast build process 