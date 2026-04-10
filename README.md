HackerWeb
=========

A simply readable Hacker News web app.

Based on [HackerWeb](https://github.com/cheeaun/hackerweb) by [Lim Chee Aun](https://github.com/cheeaun).

## Stack

- Vanilla JavaScript (ES modules, no framework)
- [Vite](https://vite.dev/) for builds
- Single responsive theme with CSS animations and wide-screen dual-pane layout
- Uses the [unofficial Hacker News API](https://github.com/cheeaun/node-hnapi/)

## Development

```
git clone https://github.com/duebbert/hackerweb.git
cd hackerweb/
npm install
npm run dev
```

### Commands

- `npm run dev` — Vite dev server with HMR
- `npm run build` — production build → `dist/`
- `npm run preview` — preview the production build locally
- `npm run format` — format source files with Prettier
- `npm run format:check` — check formatting without modifying files

## Deployment

Deployed via [Cloudflare Pages](https://pages.cloudflare.com/). Pushing to `master` triggers an automatic build and deploy.

### Cloudflare Pages settings

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node.js version:** 18+ (set via environment variable `NODE_VERSION` if needed)

### Custom domain

Custom domains are configured in the Cloudflare Pages dashboard under **Custom domains**, not via a CNAME file in the repo.

## License

[MIT](https://opensource.org/licenses/MIT).
