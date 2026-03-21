# Guitar & Gearshift

Guitar & Gearshift is a small browser-based birthday game built with plain HTML, CSS, and vanilla JavaScript. The player enters a name and birth date, then controls a car to collect guitar-and-music themed items while avoiding road hazards.

## Personal data

The game uses the entered full name and birth date only while the page is open. That information is used in memory to:

- calculate the player's age,
- extract the first name for the in-game HUD,
- set the target score to `age × 10`, and
- show a birthday win message.

No backend, API, database, cookies, or local storage are used.

## How to run locally

1. Download or clone this repository.
2. Open `index.html` directly in any modern web browser.
3. Enter a full name and birth date.
4. Press **Start Game**.
5. Move with the **Left/Right Arrow keys** or **A/D** on desktop, or use the on-screen buttons on mobile.

## Gameplay summary

- Collectibles: 🎸, 🎂, 🎵
- Obstacles: 🕳️, 🚧
- Score increases when collectibles are picked up.
- Hitting an obstacle ends the game.
- Reaching the target score wins the game.
- A restart option is shown after both win and loss states.

## Playability improvements

- The car and falling items now snap to responsive lanes so the board stays fair on desktop and mobile sizes.
- A live status line shows the remaining points needed while you play.
- The game spawns the first item immediately, making each run start right away.
- The birth date field is capped at today to prevent invalid future dates.
