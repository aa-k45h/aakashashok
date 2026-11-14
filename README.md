# verbal-app

Portfolio site for Aakash Ashok, content writer. A pond, a rubber duck and some writing.

Static files only. There is no build step and no backend, and nothing tracks visitors.

## Status

Stage 2 of 3: the pond, the duck, and all the sections with their content.
Two blocks in the Writing section are still marked `[PLACEHOLDER]`: website and landing page copy, and social and short-form. Aakash will supply those.
Sound, the penalty kick, the remote, the prompt jar, the desk and the Easter eggs come in Stage 3.

## Run it locally

Browsers will not load JS modules from a `file://` page, so serve the folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/

## Deploy

### GitHub Pages

1. Push this folder to the `main` branch so `index.html` sits at the top of the repo.
2. In the repo, open Settings, then Pages.
3. Under "Build and deployment", pick "Deploy from a branch", branch `main`, folder `/ (root)`. Save.
4. Wait a minute or two. The site appears at `https://<user>.github.io/<repo>/`.

The empty `.nojekyll` file tells Pages to serve the files as they are.

### Netlify

Drag the folder onto https://app.netlify.com/drop, or connect the repo with an empty build command and `.` as the publish directory.

Every path in the site is relative (`./css/...`, `./js/...`), so it works from a subfolder URL and from a domain root.

## Getting around

- Mouse: the duck follows the cursor. Click a lily pad and the duck swims there, then the page moves.
- Touch: drag the duck and drop it on a lily pad. Tapping a pad works too.
- The Medium lines float beside the Writing sheet as paper boats, bottles and a bird. Click one to unfold it. With JS off they are all shown.
- Once you scroll past the hero, the lily pads park along the right edge. On a phone they slide away and the links up top take over.
- Keyboard: Tab to a lily pad and press Enter, or press 1, 2, 3 or 4. The links in the top corner do the same job.
- Reduced motion: the water slows down, cursor ripples stop and the page jumps without waiting for the duck.
- No WebGL: a flat pond with the same pads and a small drawn duck takes over.

## Files

```
index.html        page and all copy
css/style.css     layout, type, the flat fallback pond
js/main.js        navigation, input, fallback duck
js/pond.js        the 3D pond (loaded after first paint)
vendor/           Three.js r160
assets/fonts/     Sacramento (the name) and Manrope (everything else)
```

To move a lily pad, edit its `--x` and `--y` (landscape), `--px` and `--py` (portrait) or `--cx` and `--cy` (parked) values in `index.html`. They are percentages of the screen.

## Credits

- Three.js r160, MIT license. https://threejs.org
- Sacramento by Astigmatic, SIL Open Font License 1.1.
- Manrope by Mikhail Sharanda, SIL Open Font License 1.1.

Font files come from the Fontsource packages and are served from this repo. No audio files are used.
