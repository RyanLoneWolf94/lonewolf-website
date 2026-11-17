# LoneWolf Digital

The website for [LoneWolf Digital](https://lonewolfdigitech.com), a one-person
studio for brand, code and growth, run by Ryan Nyasha Makwabarara from Harare
and Hanoi.

It is an immersive, single-page experience: one WebGL "world" sits behind the
whole page, and scrolling is a journey through it. A pile of studio-toolkit
icons greets you, then tens of thousands of particles assemble into the LoneWolf
wolf, form the shapes of each stage of the process, and finally settle into a
portal behind the contact form. The cursor pushes the world around; holding the
mouse gathers it.

## Stack

- **Vite** build, vanilla JS (no framework)
- **Three.js** for the 3D world and the GPU particle system
- **GSAP** + **ScrollTrigger** for the scroll choreography
- **Lenis** for smooth scrolling
- No build-time data: the particle shapes, including the wolf, are generated in
  the browser (the wolf is sampled from the logo image at runtime).

## Run it

```bash
cd site
npm install
npm run dev      # http://localhost:5180
npm run build    # outputs to site/dist
```

The site degrades gracefully: without WebGL it shows a static gradient, and it
respects `prefers-reduced-motion` (no smooth-scroll, no particle motion, the
finished state of every effect).

## The "Work with me" form

The three-step contact form creates a client straight away in **Packforge**, the
studio's own operating system, by calling its public `portal_register_client`
function. Configure it in `site/public/config.js`:

- `JOIN_CODE` comes from Packforge → Settings → Client sign-up link (the part
  after `/join/`). While it is empty, the form falls back to opening an email.
- `SUPABASE_URL` and `PUBLISHABLE_KEY` are the public Packforge connection
  details.

## Case study images

Case studies live in `site/src/cases.js`. Their images go in
`site/public/assets/cases/<id>/` — see the README there. A case with no image
shows a cover generated from that client's brand colours until real images are
added.

## Deploy

`deploy/deploy.sh` builds the site and uploads `site/dist` to the server over
SSH, installing the nginx config (`deploy/nginx-lonewolf.conf`) on the first
run. Point the domain's DNS at the server and confirm the box is reachable
before running it.

```bash
bash deploy/deploy.sh --first   # first run: installs nginx + config
bash deploy/deploy.sh           # later: uploads the built site
```
