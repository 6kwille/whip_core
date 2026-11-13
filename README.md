# whip_core

The core of the whip framework for FiveM: players and characters, inventory, money and banks, jobs,
vehicles, properties, the admin panel (`/whip`), the Director, and the UI every whip resource uses.

## Start here

Open **`docs.html`** in a browser (it works offline).

1. **Quick Start**: install whip on your server.
2. **Your First Resource**: a coffee stand in about thirty minutes, written the way whip resources are written.
3. **Your First Job**: the same stand with staff, a duty prompt and pay.

Coming from QBCore, ESX or ox? The **Coming from QBCore, ESX or ox** page maps what you know to whip's calls.

## What is in this folder

| Path | What it is |
| --- | --- |
| `config.lua` | The server owner's settings. Most can also be changed in game: `/whip`, then Settings. |
| `CHANGELOG.md` | What changed in each version. Read it before updating. |
| `docs.html`, `docs/` | The developer docs. `docs/` holds the longer guides for the inventory UI and themes, and `docs/examples/`: the tutorial's finished café and a whole delivery job, as resources to copy out and run. |
| `types/` | Editor autocomplete for every export. Copy `types/luarc.template.json` to your resource as `.luarc.json`. |
| `lib/satellite.lua` | The helper your resource includes (`@whip_core/lib/satellite.lua`): `Whip.register`, `Whip.call` and the rest. |
| `server/`, `client/`, `shared/`, `html/` | whip_core itself. |
| `dev/` | Tools for working on whip: the inventory UI preview, checks, test harnesses. Not needed to run a server. |

## Licence

whip_core and whip's own resources are licensed under the GNU LGPL 3.0 (`LICENSE`, with the GPL 3.0 it builds on in
`COPYING`); the example resources are under the MIT licence. Your own resources that use whip through its exports are
yours, closed or open: see **Selling on whip** in the docs.

The whip name and logo, the Rockstar Games material and the third-party parts are not covered by whip's licence:
`NOTICE.md` lists them.
