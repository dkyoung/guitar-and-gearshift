# AGENTS.md

## Project
Guitar & Gearshift is a small browser-based birthday mini-game built with:
- `index.html`
- `styles.css`
- `app.js`

It is a static GitHub Pages project.
Do not introduce frameworks, build tools, bundlers, transpilers, or new architecture unless explicitly requested.

## Core Rules
1. Keep the project simple.
2. Preserve the current single-page HTML/CSS/JS structure.
3. Do not add React, Vue, TypeScript, Canvas libraries, game engines, npm packages, or build pipelines.
4. Do not create unnecessary folders or files.
5. Prioritize gameplay reliability over visual overengineering.
6. Assume the browser/screenshot tool is not available in this environment.
7. Reason carefully about layout, collision boxes, element sizes, and lane positioning without visual access.

## Privacy Rules
1. Treat the entered full name and birth date as session-only inputs.
2. Do not store personal data in:
   - localStorage
   - sessionStorage
   - cookies
   - IndexedDB
   - URL parameters
   - analytics tools
   - external APIs
   - backend services
3. Do not add telemetry, tracking scripts, pixels, or third-party analytics unless explicitly requested.
4. Do not transmit user-entered personal data off-device.
5. Keep all birthday calculations in browser memory only for the active page session.
6. If a future feature would require storing or sharing personal data, stop and require explicit approval first.

## Gameplay Principles
1. The game must be clearly playable on both desktop and mobile browsers.
2. Player movement must feel fair and readable.
3. Collision detection must match what the player actually sees on screen.
4. Avoid “invisible hitbox” behavior.
5. Avoid spawning or collision behavior that causes instant or unfair losses.
6. Keep controls large and reliable on touch devices.

## Collision and Layout Guidance
1. Do not use oversized full-element rectangles for collisions when the visible emoji/art is smaller than the container.
2. Prefer smaller, centered inner hitboxes for the player and falling items.
3. Keep lane coordinates stable unless a bug specifically requires lane changes.
4. Do not shrink the play area unless explicitly requested.
5. Preserve visual clarity: the car, obstacles, and collectibles must be easy to see.

## Change Discipline
When making changes:
1. Make the smallest reliable fix first.
2. Do not rewrite working systems just to “clean up.”
3. Avoid touching unrelated logic.
4. Keep comments brief but useful.
5. Clearly mark:
   - player size controls
   - lane coordinate logic
   - collision box tuning
   - spawn timing logic

## Testing Discipline
If browser-based visual testing is unavailable:
1. Still reason through the UI carefully.
2. Check for obvious math mismatches between:
   - CSS sizes
   - JS positions
   - collision box dimensions
3. Prefer predictable lane-based logic over loose free-position math.
4. Mention any limitations honestly.

## Output Expectations
For gameplay bug fixes:
- Explain the root cause briefly
- Edit only the necessary files
- Keep the result mobile-friendly
- Do not overengineer
