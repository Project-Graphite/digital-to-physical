# digital-to-physical

A private, client-side web tool to turn digital comic archives (`.cbz`, `.cbr`, `.zip`, `.rar`) into properly bound, print-ready PDFs for personal physical reading.

---

> [!IMPORTANT]
> ### Ethical Use & Anti-Piracy Notice
> **This project strictly does NOT endorse, encourage, or facilitate piracy.**
> 
> This software is a personal formatting utility designed exclusively for printing and binding comics that **you legally own, created, or hold the rights to print for personal physical use**:
> - Original comics, manga, or graphic novels you created, drew, or wrote;
> - Works you commissioned, contracted, or hold publishing rights to;
> - Material in the public domain or released under licenses permitting personal reproduction;
> - Legally purchased digital copies where your jurisdiction or license grants you the right to format-shift or create a personal physical archival copy for private use.
> 
> **Zero Content Hosted, Stored, or Transmitted:**
> This repository contains **no comics, no scans, and no artwork**. The application downloads nothing, tracks nothing, and transmits no files. All extraction, layout computation, and PDF generation happen **100% client-side inside your web browser**.

---

## Why this tool exists

Converting a folder of images into a basic PDF is trivial. Making a PDF that **binds cleanly into a physical booklet** is where things go wrong:

1. **Split spreads across page turns:** Double-page spreads split in half can accidentally land on opposite sides of a physical page turn, breaking the artwork across sheets instead of opening as a seamless spread.
2. **Page count arithmetic:** A folded booklet (saddle-stitched) requires a total page count that is a multiple of four. If your story runs 25 pages, a physical fold requires padding with blanks—which often displaces your intended back cover.
3. **Scanner cards & credit pages:** Stray landscape credit cards get accidentally sliced in half if treated as comic spreads.
4. **Blank padding pages:** Blank pages inside a comic break the reading rhythm. Authentic vintage comic books filled these gaps with house adverts and period announcements.

This tool resolves these issues interactively directly in your browser.

---

## Key Features

- **100% Client-Side & Private:** Powered by WebAssembly (`node-unrar-js`) and pure JavaScript libraries (`fflate`). Your comic files never leave your machine and no backend server is required.
- **Archive Support:** Drag and drop `.cbz`, `.cbr`, `.zip`, and `.rar` files directly into the web interface.
- **Interactive Visual Preview:** Real-time dual-page booklet preview and full page grid showing exact trim boxes, spreads, padding slots, and cover placements.
- **Smart Spread Splitting:** Automatically detects landscape double-page spreads, splits them into left/right halves, and supports both Left-to-Right (LTR) and Right-to-Left (RTL manga) reading orders.
- **Duplex Parity Alignment:** Aligns spreads so the left and right halves always face each other across the fold once printed and bound.
- **Booklet Padding:** Automatically pads your document to multiples of 4 (or custom booklet multiples) to guarantee clean folding.
- **Balanced Advert & Filler Pool:** Drop in period advertisements or custom filler images to occupy padding pages. The distribution algorithm guarantees that **the difference between the maximum and minimum frequency of any advert across the comic is at most 1**, with deterministic book seeding and no consecutive duplicate placements.
- **Flexible Back Covers:** Choose between auto-generated art compositions, solid color backings, variant covers, dedicated pages from the archive, custom file uploads, or advert pool selections.
- **Live Pre-Print Audit:** Instantly validates multiple-of-4 booklet geometry, checks facing spread pairs, and monitors advert distribution balance before you generate your final PDF.
- **Lossless Embedding:** JPEG streams are embedded directly into the generated PDF without lossy re-compression.

---

## Quick Start (Running Locally)

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or newer)
- `npm` (installed with Node.js)

### Installation & Development Server

```bash
# Navigate to the web app directory
cd web-app

# Install dependencies
npm install

# Launch local development server with HMR
npm run dev
```

Open `http://localhost:5173` in your web browser.

---

## Usage

1. **Drop your comic archive:** Drag and drop any `.cbz` or `.cbr` file onto the dropzone.
2. **Review the Live Audit:** Check the top audit banner to confirm that your page count is a multiple of four and that all split spreads face each other properly.
3. **Adjust Settings:**
   - **Presets:** Quick options for *Print & bind* (saddle-stitch booklet), *Faithful copy* (preserve source exactly), or *Two-up on screen* (facing reader).
   - **Double-page spreads:** Toggle splitting, alignment, and reading direction (LTR / RTL).
   - **Advert Pool:** Optionally drop filler images to replace blank pages. Frequency badges indicate how many times each advert appears in the planned volume.
   - **Back Cover:** Select an auto-composed cover, custom upload, or advert.
   - **Binding & Margins:** Configure inner gutter binding margins, bleed allowances, and target paper sizes.
4. **Build PDF:** Click **Build PDF**. The PDF is assembled client-side and automatically offered as a download.

---

## Production Build & Static Deployment

You can build the production-ready static assets:

```bash
cd web-app
npm run build
```

The compiled bundle is output to `web-app/dist/`. Because the application is entirely static and requires no server runtime, you can deploy this directory to any static web host:

- **Cloudflare Pages**
- **Vercel**
- **Netlify**
- **GitHub Pages**
- **Amazon S3 / Any Static Web Server**

---

## Development Scripts

Inside `web-app/`:

| Command | Description |
|---|---|
| `npm run dev` | Starts the Vite local development server with hot module replacement |
| `npm run build` | Compiles TypeScript and builds the optimized production bundle |
| `npm run lint` | Runs the high-performance Oxlint linter across the codebase |
| `npm run preview` | Previews the production build locally |

---

## License

This software is released under the [MIT License](LICENSE).

This license covers the application source code only. It does not grant rights to any third-party comics, artwork, or publications formatted with this tool. Users are solely responsible for ensuring they hold the appropriate rights or permissions for any material they process.
