# Web report runtime v1 sources

All executable and font assets in this directory are vendored, immutable copies.
The adjacent `manifest.json` records the full SHA-256 digest of every distributed
file. Runtime loading rejects a missing file, a digest mismatch, or an unknown
runtime version.

## html2canvas-pro 1.5.8

- Package: `html2canvas-pro@1.5.8`
- Registry tarball: <https://registry.npmjs.org/html2canvas-pro/-/html2canvas-pro-1.5.8.tgz>
- npm integrity: `sha512-bVGAU7IvhBwBlRAmX6QhekX8lsaxmYoF6zIwf/HNlHscjx+KN8jw/U4PQRYqeEVm9+m13hcS1l5ChJB9/e29Lw==`
- Vendored package member: `dist/html2canvas-pro.min.js`
- Upstream repository: <https://github.com/yorickshan/html2canvas-pro>
- License: MIT, copied from the npm package as `LICENSE-html2canvas-pro.*.txt`

## Manrope variable font

- Family metadata: Google Fonts `ofl/manrope/METADATA.pb`
- Metadata source revision: `google/fonts@ec0464b978de222073645d6d3366f3fdf03376d8`
- Upstream font source revision recorded by that metadata: `aaronbell/manrope@6f81ebecdf65e4463b798cc07b16a4f8d5216917`
- Vendored webfont: Google Fonts CDN Manrope v20 Latin WOFF2, weight axis 400-800
- Exact CDN URL: <https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSvfedN4.woff2>
- License: SIL Open Font License 1.1, copied as `OFL-Manrope.*.txt`

## Playfair Display variable font

- Family metadata: Google Fonts `ofl/playfairdisplay/METADATA.pb`
- Metadata source revision: `google/fonts@ec0464b978de222073645d6d3366f3fdf03376d8`
- Upstream font source revision recorded by that metadata: `clauseggers/Playfair@80a334101928546b04fa9e709ad4b2f11f8a9e10`
- Vendored webfont: Google Fonts CDN Playfair Display v40 Latin WOFF2, weight axis 600-900
- Exact CDN URL: <https://fonts.gstatic.com/s/playfairdisplay/v40/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYgEM86xQ.woff2>
- License: SIL Open Font License 1.1, copied as `OFL-Playfair-Display.*.txt`

The webfonts intentionally contain the Latin subset only. Chinese text continues
to use the local platform CJK fallback stack; the report never contacts Google
Fonts at runtime.

## echarts

- File: echarts.*.min.js
- Source: Apache ECharts (https://echarts.apache.org) v6.1.0 dist bundle
- Copied from: teacher-tools/node_modules/echarts/dist/echarts.min.js (2026-09-29)
- License: Apache-2.0 (see LICENSE-echarts.*.txt)
