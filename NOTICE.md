# NOTICE

This file covers the things the MIT licence in [LICENSE](LICENSE) does **not** cover.

## Audio recordings

No audio file is part of this repository, and none is covered by the MIT licence.

Every recording Sound Atlas plays stays on the archive that hosts it — Wikimedia Commons or
iNaturalist — and keeps its own licence, its own author and its own attribution requirement.
The application links back to the original file page for each record and renders the licence
and recordist in every detail panel.

Licences of the records in the bundled catalogue (`public/data/commons-catalog.json`) are
limited by the build script to:

- CC0 1.0
- Public domain
- CC BY 1.0 / 2.0 / 2.5 / 3.0 / 4.0
- CC BY-SA 1.0 / 2.0 / 2.5 / 3.0 / 4.0

If you fork this project, you must keep the attribution for every record you display. Removing
author or licence information from a CC BY or CC BY-SA recording breaks that recording's
licence, which is a real bug, not a design choice.

iNaturalist records are surfaced through its public API with `licensed=true` and
`quality_grade=research`, and are additionally filtered to CC0 / CC BY / CC BY-SA sound files.
iNaturalist's own terms apply to that data.

## Basemap and geodata

- Raster basemaps: CARTO (`basemaps.cartocdn.com`), under CARTO's own attribution and usage
  terms. Commercial reuse of CARTO basemaps requires a CARTO agreement; the provider table in
  `src/components/SoundMap.tsx` exists so it can be swapped.
- Fallback tiles: OpenStreetMap (`tile.openstreetmap.org`), subject to the
  [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/).
- Map data © OpenStreetMap contributors, ODbL 1.0.
- Place search: [Photon](https://photon.komoot.io/) (komoot), with iNaturalist's place index
  as a fallback.

## Third-party code

Every runtime dependency is MIT, ISC, BSD or Apache-2.0 licensed. The complete tree is pinned in
`package-lock.json`; run `npm ls --all` to audit it against your own policy.
