# Case study images

One folder per case study, named after its `id` in `src/cases.js`:

    marbl-hearth/  koki/  illuminer/  greyview/  wyfix/  packforge/

In each folder:

- `cover.webp` is the main image. It shows as the row thumbnail, the hover
  preview and the top of the case study. Landscape works best (about 16:10,
  at least 1600px wide).
- `01.webp`, `02.webp`, ... are the gallery inside the case study.

Then list them in `src/cases.js` on that case:

    cover: 'cover.webp',
    gallery: ['01.webp', '02.webp'],

Until a case has a cover, the site draws one from the case's brand colours.
Keep each image under ~400 KB (WebP at quality 80 is a good default).
