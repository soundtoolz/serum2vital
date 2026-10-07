# Serum2Vital Web

> Convert Serum presets to Vital - entirely in your browser. No uploads. No Python. No command line.

**Live App:** https://soundtoolz.github.io/serum2vital/

---

## What is this?

Serum2Vital Web is a browser-based interface for the open-source [serum2vital](https://github.com/btesser/serum2vital) converter.

It converts:
- **Serum 1** `.fxp` presets
- **Serum 2** `.SerumPreset` presets

into **Vital** `.vital` presets - locally in your browser using [Pyodide](https://pyodide.org/) (Python compiled to WebAssembly).

Your files never leave your device.

---

## Features

- Drag and drop or browse preset files
- Batch convert hundreds of presets
- Optional wavetable and noise sample support
- Live conversion progress
- Per-preset conversion warnings and approximation reports
- Download individual `.vital` files or all as a ZIP
- Works without a server, backend, or account
- Deployable as a static site on GitHub Pages

---

## Privacy

Conversion happens locally inside your browser.
Your presets, wavetables, and noise samples are **never uploaded** anywhere.

----

## Local Development

```bash
git clone https://github.com/soundtoolz/serum2vital.git
cd serum2vital
npm install
npm run dev
```

Open http://localhost:5173

### Production Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

---

## Technology Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Pyodide (Python in WebAssembly)
- Web Workers
- JSZip
- GitHub Pages

---

## Attribution

The conversion engine is based on [btesser/serum2vital](https://github.com/btesser/serum2vital).

See [ATTRIBUTION.md](ATTRIBUTION.md) for full details.

---

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).

The original serum2vital project is also GPL-3.0-or-later.
