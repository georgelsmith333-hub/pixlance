# Pixlance Chrome Extension

Auto-injects an "Import to Pixlance" button on eBay, AliExpress, and Amazon product pages.

## Install (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load unpacked**
4. Select this `chrome-extension/` folder
5. Done — visit any eBay/AliExpress/Amazon product page to see the button

## How it works

- Detects eBay (`/itm/`), AliExpress (`/item/`), Amazon (`/dp/`) product pages
- Injects a floating "Import to Pixlance" button (bottom-right corner)
- On click: extracts title, images, price, brand from the page
- Sends data to Pixlance pipeline API → opens fully optimized listing
- Fallback: opens Pixlance with the product URL pre-filled

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension config (MV3) |
| `content.js` | Injected into product pages |
| `content.css` | Styles for the injected button |
| `popup.html` | Extension toolbar popup |
| `background.js` | Service worker (opens tabs) |
