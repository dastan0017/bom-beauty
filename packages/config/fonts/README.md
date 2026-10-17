# Fonts

Self-hosted, SIL Open Font License (see the OFL files here).

| File                                  | Source                                              | Axes         | Coverage                                      |
| ------------------------------------- | --------------------------------------------------- | ------------ | --------------------------------------------- |
| `onest-var.woff2`                     | google/fonts `ofl/onest/Onest[wght].ttf`            | wght 400–700 | Latin, Cyrillic incl. Kyrgyz (ө ү ң), ₽ ₸ € ✓ |
| `cormorant-garamond-var.woff2`        | `ofl/cormorantgaramond/CormorantGaramond[wght].ttf` | wght 500–600 | same, no ✓                                    |
| `cormorant-garamond-italic-var.woff2` | `.../CormorantGaramond-Italic[wght].ttf`            | wght 500–600 | same, no ✓                                    |
| `noto-sans-kr-bom.woff2`              | Noto Sans KR 500 via Google Fonts `text=봄`         | —            | the single glyph 봄                           |

₩ is not in these fonts and falls back to the system font.

Rebuild (fontTools): `python3 -m fontTools.varLib.instancer <ttf> wght=400:700`, then
`python3 -m fontTools.subset <ttf> --unicodes=<ranges> --layout-features='*' --flavor=woff2`.
Ranges: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0400-052F, U+1C80-1C88,
U+2000-206F, U+2074, U+20A9, U+20AC, U+20B4, U+20B8, U+20BD, U+2116, U+2122, U+2191, U+2193, U+2212, U+2215,
U+2713, U+FEFF, U+FFFD.
