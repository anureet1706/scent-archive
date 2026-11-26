# Scent Archive

A personal fragrance tracker for phone and desktop. The starting collection contains 133 records from the original `fragrances.json` export. [Open Scent Archive](https://anureet1706.github.io/scent-archive/)

## Use the tracker

1. Open the site and enter your collection unlock code once per browser. You can also choose **Import a collection file** and open the original JSON or a backup.
2. Search by fragrance name, house, or notes, or combine a status tab with the house and kind filters. Tap a fragrance to see its purchase price, size, photo, wearing details, and notes.
3. Choose **Add fragrance** to create a record or **Edit fragrance** to update one. Choose **Gone** to record a departure date, reason, and sale price.

**Total paid (CAD)** adds recorded CAD purchase prices across all statuses, including Gone. A missing price contributes zero. Sale proceeds are recorded separately on the fragrance. Photos load from the saved HTTPS URLs. An illustration appears when a photo is missing or its host is unavailable.

## Back up or move your edits

Each browser saves its own collection on that device. To carry edits from your phone to your computer, use **Backups → Export JSON** on the phone, transfer the file, then use **Import JSON** on the computer. Confirming the import replaces the destination collection. Export the destination first if you want to keep its current records.

The exported JSON contains readable notes and prices. Keep backups and the unlock code with your private files. Clearing browser site data removes that browser’s edits. Import your latest backup to restore them, or use the code to reopen the original collection.

## Files and data model

| File | What it controls |
| --- | --- |
| `index.html` | Page structure, forms, dialogs, and script loading order |
| `styles.css` | Phone and desktop layouts, typography, and colors |
| `app.js` | Unlock, validation, local storage, search, totals, editing, and backups |
| `seed.js` | Encrypted original JSON used on first unlock |
| `amber-still-life.jpg`, `scent-icon.png` | Header photograph and app icon |
| `*.woff2`, `FONT-LICENSES.txt` | Locally served fonts and their licenses |
| `.nojekyll` | Publishes the repository’s static assets as supplied |

An export is a JSON array. Preserve each record’s `id` across edits and imports. Seed IDs are numbers. New entries use a UUID string and `added_at` in milliseconds since the Unix epoch. Optional source values may be `null`.

| Field group | Fields and values |
| --- | --- |
| Identity | `id`, `house`, `name` |
| Kind and status | `kind` accepts `full_bottle`, `decant`, or `wishlist`. `status` independently accepts `owned`, `incoming`, or `gone`. |
| Purchase | `size_ml` in millilitres, `price_paid` in the currency’s main unit, `currency` (CAD in the seed) |
| Wearing notes | `seasons`, `occasions`, `longevity`, `notes`, `photo_url`, `want_full_bottle` |
| Departure | `gone_reason`, `gone_date`, `sold_price` |

The app reads `scent-archive.collection.v1` from `localStorage` on startup. Unlocking decrypts `seed.js` with Web Crypto and saves the editable JSON there. The grid/list preference uses `scent-archive.layout.v1`. Site updates retain the saved collection. A new browser can load later edits by importing a backup.

## Maintain and publish

Use `anureet1706/scent-archive` for tracker changes. The decant-list site has its own repository. This project serves plain HTML, CSS, and JavaScript directly from the repository root.

1. Preview the repository root through a local HTTP server. With Python 3 installed, run `python -m http.server 8000 --bind 127.0.0.1` from that directory and open `http://127.0.0.1:8000/`.
2. Check the unlock screen in a fresh browser profile. On a test copy, search for a record, edit it, reload, and export and restore a backup. Check the header, filters, and editor at phone width. Keep asset paths relative so they resolve under `/scent-archive/`.
3. Commit the updated files to `main`. GitHub Pages publishes `main` from `/ (root)`. Check the Pages deployment and open the live URL after it succeeds. [Pages settings](https://github.com/anureet1706/scent-archive/settings/pages) · [Deployment runs](https://github.com/anureet1706/scent-archive/actions)

Routine collection edits belong in the tracker. To intentionally replace the starter collection, encrypt the new JSON locally using the owner’s 32-byte key, AES-256-GCM, and a fresh random 12-byte IV. `seed.js` assigns `window.scentArchiveSeed` an object with `version: 1`, a base64 `iv`, and base64 `data` containing the ciphertext followed by the 16-byte authentication tag. The unlock code is the base64url form of the key. Verify that decryption reproduces the intended JSON before committing the sealed file. Existing browsers continue using their local edits.

## Update history

### November 26, 2026 · Initial release

- Imported all 133 source records and verified that decrypting the bundled seed reproduced the original file byte for byte.
- Added the responsive gallery and list, search, house and kind filters, status tabs, sort controls, and CAD purchase totals.
- Added fragrance creation and editing, departure details, and JSON backup and restore. Verified that saved edits survive a reload and that restoring the original export returns all 133 records.
- Prepared the static site in its dedicated GitHub repository and documented the release and recovery steps above.

Add a dated entry here when the app, data format, starter collection, or publishing process changes. Git history contains the individual diffs.

## Asset credits

The header still life was generated with ImageGen. The bundled DM Sans and Instrument Serif fonts use the SIL Open Font License. [Font licenses](FONT-LICENSES.txt)

<details>
<summary>Image prompt</summary>

Product photography for the wide banner of a personal fragrance collection web app. Landscape 3:2. A substantial unbranded rectangular perfume bottle made of heavy fluted tobacco-amber glass with warm amber liquid and a smooth dark espresso cylindrical cap, together with one narrow companion travel atomizer lower in the foreground, on a dark burgundy stone plinth. Composition is weighted distinctly to the RIGHT, with the glass bottle at about 71% of the width; keep the entire left 44% as softly shaded, nearly black black-cherry negative space that will sit behind live cream text. A natural shaft of warm evening light from the top right crosses a richly shaded plum-burgundy backdrop, with a slight fabric-like shadow and glowing amber highlights and reflections. Premium fragrance editorial still life, realistic glass optics, restrained film grain, dramatic chiaroscuro but sharp bottle silhouette, contemporary and quiet. The bottle should be largely visible when the photo is masked to a wide horizontal hero. No text, labels, lettering, logos, watermark, people or border.

</details>
