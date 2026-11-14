# verbal-app

Portfolio site for Aakash Ashok, content writer. A pond, a rubber duck and some writing.

Static files only. There is no build step and no backend, and nothing tracks visitors.

## Status

All three stages are in: the pond and duck, the sections and their content, and the interactive pieces with sound.
Two blocks in the Writing section are still marked `[PLACEHOLDER]`: website and landing page copy, and social and short-form. Aakash will supply those.

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

## The interactive pieces

- Sitcom remote (hero): each click shows one random line on a small TV screen. The lines are original and live in `js/extras.js`, grouped by show.
- Writing desk (Writing): hover, tap or tab to the window, notebook, headphones and mug. The four notes are drafts in Aakash's voice. Edit the `data-note` text in `index.html`, under the comment that starts "WRITING HABITS DESK".
- Prompt jar (About): click the jar and four slips float out.
- Penalty kick (About): drag or flick the ball into the net. The frog saves anything it can reach. A goal brings the sun out, a save darkens the sky. With a keyboard, focus the ball, aim with the left and right arrows and press Space.

## Sound

Sound is off until the visitor clicks the lily pad speaker in the bottom corner. The choice is remembered in `localStorage`, and a remembered "on" still waits for the first click before anything plays. With reduced motion set, sound always starts muted and plays quieter. It pauses when the tab is hidden.

Everything is synthesized in `js/audio.js` with the Web Audio API: the background pads and chimes, water, the sun swell, the rumble, the remote click, the jar clink and the rain. There are no audio files, so there is nothing to license.

## Hidden bits (spoilers)

- Click the paperclip on the Writing sheet.
- Click the yellow umbrella on the About sheet.
- Click the atom on the Contact sheet.
- Type 99 anywhere.
- Double-click the water.

## Files

```
index.html        page and all copy
css/style.css     layout, type, the flat fallback pond
js/main.js        navigation, input, fallback duck
js/pond.js        the 3D pond (loaded after first paint)
js/extras.js      remote, desk, jar, penalty kick, hidden bits, sound toggle
js/audio.js       synthesized sound (loaded when sound is turned on)
vendor/           Three.js r160
assets/fonts/     Sacramento (the name) and Manrope (everything else)
```

To move a lily pad, edit its `--x` and `--y` (landscape), `--px` and `--py` (portrait) or `--cx` and `--cy` (parked) values in `index.html`. They are percentages of the screen.

## Credits

- Three.js r160, MIT license. https://threejs.org
- Sacramento by Astigmatic, SIL Open Font License 1.1.
- Manrope by Mikhail Sharanda, SIL Open Font License 1.1.

Font files come from the Fontsource packages and are served from this repo. No audio files are used.

The sitcom nods are colors, props and original lines only. There are no logos, screenshots, character images or copied dialogue.
