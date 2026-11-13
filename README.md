# Brew nook roller shutter planner

An interactive 3D model of an outdoor brewing nook, built to plan a motorised aluminium roller shutter across its opening.

**Live page:** https://andreysalenin.github.io/brew-nook-shutter/

## What's in the model

- **The nook:** editable dimensions and floor fall, brick and weatherboard walls, and the laundry door.
- **Rack It shelving:** 400 kg and 1000 kg units, modelled slot by slot. You can move and resize the shelves.
- **Brewing gear:** Ss Brewtech Unitanks with FTSs, mash tun, kettle, HLT, KegLand G40 and Coolossus, Blichmann RipTide, CO₂ bottles with MK4 regulators, kegs and a cable reel.
- **The shutter:** a wound curtain and headbox, with a choice of colour, slat type and motor side.
- **Mounting:** both sides use stainless posts fixed only to the slab and ceiling.
- **Dump line:** a 1.5" tri-clamp hose passes through the right-hand post.
- **Checks:** clashes, drainage and shared-wall fixings, plus a mounting view that highlights the brackets and fixings.

Settings are saved in your browser.

## Building

`index.html` is a single self-contained file that loads Three.js r169 from jsDelivr. To rebuild it from the sources:

```sh
python3 build.py   # writes index.html (CDN) and test.html (local three from node_modules)
```

- `src/`: the app (`main.js`, `body.html`, `style.css`).
- `vessels/`: one module per piece of equipment, plus the shared tri-clamp kit (`triclamp.js`). Only the IDs listed in `vessels/ready.txt` are inlined into the page. See `vessels/README.md` for the module contract.
- `tools/`: Puppeteer scripts for screenshots and the settings-migration test. Run `npm install` first and serve the folder on port 8765.
