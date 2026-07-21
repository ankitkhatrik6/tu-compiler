<div align="center">

# 🖥️ TU Compiler

**A browser-based IDE for writing, compiling, and running C/C++ programs — right from your browser.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](./LICENSE)

</div>

---

## What is this?

I built TU Compiler because I was tired of setting up a local compiler just to test small C/C++ programs for uni labs. It's a clean, minimal browser-based IDE where you can write C or C++ code, run it, provide inputs, and see the output — all without installing anything.

It uses the Gemini API under the hood to simulate a real GCC/G++ compiler and Linux execution environment. The output mimics what you'd see in a real terminal, including compile errors, runtime errors, and interactive input prompts.

---

## Features

- **Monaco Editor** — the same editor that powers VS Code, with full C/C++ syntax highlighting
- **Virtual File System** — create, rename, and manage multiple `.c` and `.cpp` files in a folder structure
- **Interactive Terminal** — handles `cin`, `scanf`, `getline` and other input functions interactively
- **Real Compiler Output** — compile errors look exactly like GCC/G++ output
- **Multi-file Support** — includes other workspace files when resolving `#include "header.h"`
- **Terminal Screenshot** — export your terminal session as a clean PNG image
- **Customizable Prompt** — set your own terminal username and hostname

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Editor | Monaco Editor |
| AI Backend | Google Gemini API (`@google/genai`) |
| Animations | Motion (Framer Motion) |
| Icons | Lucide React |
| Language | TypeScript 5.9 |

---

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Gemini API key — get one free at [aistudio.google.com](https://aistudio.google.com/apikey)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-username/tucompiler.git
cd tucompiler

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local and add your Gemini API key
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Environment Variables

Create a `.env.local` file in the root directory:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

> ⚠️ Never commit your `.env.local` file. It's already in `.gitignore`.

---

## Deployment

This project is configured for standalone output, which works well with Docker or any Node.js hosting platform.

### Deploy on Vercel

The easiest way — just connect your GitHub repo to [Vercel](https://vercel.com) and add the `GEMINI_API_KEY` environment variable in the project settings.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

### Build for Production

```bash
npm run build
npm start
```

---

## Project Structure

```
tucompiler/
├── app/
│   ├── api/
│   │   └── compile/
│   │       └── route.ts    # Gemini API route for compilation
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # Main IDE interface
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
├── .env.example            # Environment variable template
├── next.config.ts
└── package.json
```

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

## License

This project is licensed under the [MIT License](./LICENSE).

---

<div align="center">
  <sub>Built with ☕ by Ankit Khatri KC</sub>
</div>
