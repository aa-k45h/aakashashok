# Aakash Ashok, content writer

A portfolio you dive into. It opens on a boat, in first person. Press "Dive in", go through the surface, and scroll down from sunlit shallows to a rusted shipwreck on the seabed.

Static files only. There is no build step and no backend, and nothing tracks visitors.

## What is in it

- The opening: a calm sea at golden hour, the bow of a boat, your fins, and the name, tagline and pitch. The section links work from here too. They dive first, then take you there.
- The descent: scrolling takes the camera down about 40 metres. The water starts warm and clear and ends deep and dark. A gauge on the right shows the depth and doubles as the navigation.
- In the water: sunbeams, drifting specks, bubbles, jellyfish, sea grass and two schools of fish that form a ball, a figure of eight, a spiral and a wave, one after the other.
- The wreck: a wooden ship with a torn hull, ribs, masts, rags of sail, rigging, a cannon and a wheel, with barrels, crates, a propeller, a sea chest and an anchor around it.
- The duck: a rubber duck that follows the cursor all the way down. On touch it swims to wherever you tap.
- The TV: an old set tied into the anchor line at about 13 metres. Click the remote hanging beside it and the screen plays one original line in the spirit of a sitcom. Lines are in `js/lines.js`.
- The content sits on riveted iron plates hung on chain. The Medium lines are in corked bottles: click one and the note unrolls. Contact is three brass tags.
- The penalty kick (About): drag or flick the old leather football into the rusted goal. A seal patrols the goal mouth and noses away what it can reach. A hard flick to the far side beats it. With a keyboard, focus the ball, aim with the left and right arrows and press Space.

Everything that hangs or drifts moves to one shared, slow current, so the page feels like one body of water.

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

### Netlify or Vercel

Connect the repo with an empty build command and `.` as the output directory. On Netlify you can also drag the folder onto https://app.netlify.com/drop.

Every path in the site is relative (`./css/...`, `./js/...`), so it works from a subfolder URL and from a domain root.

## Getting around

- Mouse: the duck follows the cursor. Use the gauge on the right, or scroll.
- Touch: scroll to descend. Tap the water and the duck swims over.
- Keyboard: Tab to a link in the gauge and press Enter, or press 1, 2, 3 or 4.
- Reduced motion: the dive is a quick cut, the water moves at half speed, and there are fewer fish, jellyfish and specks.
- No WebGL: the 3D sea is replaced by a plain gradient from sky to deep water. All the content, the bottles and the penalty kick still work.
- Reloading part way down, or opening a link to a section, skips the boat and starts you under water.

## Sound

Sound is off until the visitor clicks the round speaker button in the bottom corner. The choice is remembered in `localStorage`, and a remembered "on" still waits for the first click before anything plays. With reduced motion set, sound always starts muted and plays quieter. It pauses when the tab is hidden.

Everything is synthesized in `js/audio.js` with the Web Audio API: slow pads and chimes, the splash of the dive, bubbles, the TV click. Under water a filter closes over all of it. There are no audio files, so there is nothing to license.

## Files

```
index.html        page and all copy
css/style.css     layout, type, plates, gauge
js/main.js        the dive, navigation, depth, TV, sound toggle
js/sea.js         the 3D sea and wreck (loaded after first paint)
js/kick.js        the penalty kick
js/lines.js       the TV lines
js/audio.js       synthesized sound (loaded when sound is turned on)
vendor/           Three.js r160
assets/fonts/     Sacramento (the name) and Manrope (everything else)
```

Nothing in the scene is a downloaded model or image. The ship, the fish, the rust and the sand are all built in code in `js/sea.js`.

## Credits

- Three.js r160, MIT license. https://threejs.org
- Sacramento by Astigmatic, SIL Open Font License 1.1.
- Manrope by Mikhail Sharanda, SIL Open Font License 1.1.
- The underwater direction was inspired by Abyssal Garden by Noniv (MIT). https://github.com/Noniv/abyssal-garden No code or assets from it are used.

Font files come from the Fontsource packages and are served from this repo.

The sitcom nods are original lines only. There are no logos, screenshots, character images or copied dialogue.
