# PWA Setup Guide

Your SkyPanelV2 application is now configured as a Progressive Web App (PWA)!

## What's Been Added

### 1. PWA Plugin Configuration

- Installed `vite-plugin-pwa` for automatic service worker generation
- Configured in `vite.config.ts` with manifest and caching strategies

### 2. Web App Manifest

- App name: "GVPS Cloud Panel"
- Display mode: Standalone (looks like a native app)
- Theme colors configured for consistent branding
- Icon references for 192x192 and 512x512 sizes

### 3. Service Worker

- Auto-updates when new versions are deployed
- Caches static assets (JS, CSS, HTML, images, fonts)
- Network-first strategy for API calls with 5-minute cache fallback
- Offline support for previously visited pages

### 4. Meta Tags

- Added PWA-required meta tags to `index.html`
- Theme color for browser UI customization
- Apple touch icon support for iOS devices

## Required: Generate PWA Icons

You need to create two PNG icon files from your logo:

### Option 1: Online Tool (Easiest)

1. Visit [https://realfavicongenerator.net/](https://realfavicongenerator.net/) or [https://www.pwabuilder.com/imageGenerator](https://www.pwabuilder.com/imageGenerator)
2. Upload `public/favicon.svg`
3. Download generated icons
4. Save as:
  - `public/pwa-192x192.png` (192x192 pixels)
  - `public/pwa-512x512.png` (512x512 pixels)

### Option 2: ImageMagick (Command Line)

```bash
# Install ImageMagick first if needed
# Then run:
convert public/favicon.svg -resize 192x192 -background white -flatten public/pwa-192x192.png
convert public/favicon.svg -resize 512x512 -background white -flatten public/pwa-512x512.png
```

### Option 3: Design Tool

Create PNG files manually in Photoshop, Figma, or any design tool:

- 192x192 pixels → `public/pwa-192x192.png`
- 512x512 pixels → `public/pwa-512x512.png`

## Testing Your PWA

### Development

```bash
npm run dev
```

Then open Chrome DevTools → Application → Manifest to verify configuration.

### Production Build

```bash
npm run build
npm run preview
```

### Installation Testing

1. Open your app in Chrome/Edge
2. Look for the install icon in the address bar
3. Click to install the app
4. App will appear in your applications menu

### Mobile Testing

1. Open the app on your phone's browser (Chrome/Safari)
2. Tap the "Add to Home Screen" option
3. App icon will appear on your home screen
4. Opens in fullscreen mode like a native app

## PWA Features

### What Works

- ✅ Install to desktop/mobile home screen
- ✅ Offline support for cached pages
- ✅ Fast loading with asset caching
- ✅ Auto-updates when new versions deploy
- ✅ Native app-like experience (no browser UI)
- ✅ API caching with network-first strategy

### Limitations

- Real-time features (WebSocket, SSE) require network connection
- First visit requires internet to load initial assets
- Cache expires after configured time periods

## Customization

### Update App Name

Edit `vite.config.ts` → `VitePWA` → `manifest` → `name` and `short_name`

### Change Theme Colors

Edit `vite.config.ts` → `VitePWA` → `manifest` → `theme_color` and `background_color`

### Adjust Caching Strategy

Edit `vite.config.ts` → `VitePWA` → `workbox` → `runtimeCaching`

### Cache Duration

Currently set to 5 minutes for API calls. Adjust `maxAgeSeconds` in workbox config.

## Troubleshooting

### Icons Not Showing

- Ensure PNG files exist in `public/` directory
- Check file names match exactly: `pwa-192x192.png` and `pwa-512x512.png`
- Clear browser cache and rebuild

### Service Worker Not Updating

- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
- Clear site data in DevTools → Application → Storage
- Unregister old service worker in DevTools → Application → Service Workers

### Install Button Not Appearing

- Must be served over HTTPS (or localhost)
- Manifest must be valid (check DevTools → Application → Manifest)
- Icons must be present and correct sizes
- Service worker must be registered successfully

## Production Deployment

When deploying to production:

1. Ensure icons are generated and committed
2. Run `npm run build` to generate optimized PWA assets
3. Deploy the `dist/` folder contents
4. Serve over HTTPS (required for PWA features)
5. Verify manifest.json is accessible at `/manifest.webmanifest`

## Browser Support

- ✅ Chrome/Edge (full support)
- ✅ Safari (iOS 11.3+, limited support)
- ✅ Firefox (partial support)
- ✅ Samsung Internet (full support)
- ⚠️ Safari desktop (limited PWA features)

## Next Steps

1. Run `npm run pwa:icons` for icon generation instructions
2. Generate and add the required PNG icons
3. Test installation on desktop and mobile
4. Customize manifest settings for your brand
5. Deploy and enjoy your PWA!

