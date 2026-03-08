# What Pressed

A desktop application that globally captures keyboard, mouse, and gamepad inputs and displays them visually. Works as both a standalone display and an OBS browser source with transparent background.

Users create **atlases** (input-to-image mappings with pressed/unpressed states) and **layouts** (visual arrangements of atlas entries on a canvas). Both are shareable via ZIP export/import.

## Features

- **Global input capture** - keyboard, mouse, and gamepad via [rdev](https://github.com/Narsil/rdev) and [gilrs](https://gitlab.com/gilrs-project/gilrs)
- **Atlas builder** - map any input to pressed/unpressed image pairs
- **Layout editor** - drag-and-drop canvas to arrange atlas entries with position, scale, rotation, and z-order
- **Live display** - real-time visualization of which inputs are active
- **OBS browser source** - embedded HTTP server serves a transparent overlay page with WebSocket-driven updates
- **ZIP sharing** - export/import atlases and layouts (layouts bundle their referenced atlas)

## Tech Stack

| Layer         | Technology                             |
| ------------- | -------------------------------------- |
| Framework     | [Tauri 2](https://v2.tauri.app/)       |
| Frontend      | React 19, TypeScript, Vite             |
| Input capture | rdev (keyboard/mouse), gilrs (gamepad) |
| Web server    | axum (HTTP + WebSocket)                |
| Data          | JSON + images on disk, ZIP for sharing |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (1.77.2+)
- [Node.js](https://nodejs.org/) (20+)
- [Tauri CLI](https://v2.tauri.app/start/create-project/) (`cargo install tauri-cli --version "^2"`)

### Development

```bash
npm install
cargo tauri dev
```

### Build

```bash
cargo tauri build
```

## Usage

### 1. Create an Atlas

Open the **Atlas Builder** tab. Create a new atlas, then add entries. For each entry:

- Click **Assign** and press a key/button to bind an input
- Choose **unpressed** and **pressed** images via the file picker
- Set the display size

### 2. Create a Layout

Open the **Layout Editor** tab. Create a new layout, select which atlas it uses, and set the canvas size. Add entries from the atlas palette and drag them into position on the canvas. Adjust scale, rotation, and z-order in the properties panel.

### 3. Preview

Open the **Display** tab, select a layout, and see your inputs rendered live.

### 4. OBS Browser Source

From the Display tab, start the embedded server (default port 9120). In OBS, add a **Browser Source** pointing to:

```
http://localhost:9120/
```

The page has a transparent background and updates in real-time via WebSocket.

## Data Storage

Data is stored in the app data directory:

```
{app_data_dir}/
  atlases/{name}/
    atlas.json
    images/*.png
  layouts/{name}/
    layout.json
```

## Project Structure

```
what-pressed/
  src/                          # React frontend
    App.tsx                     # Tab navigation
    components/
      atlas/                    # Atlas builder UI
      layout/                   # Layout editor with drag-and-drop canvas
      display/                  # Live display + server controls
    hooks/                      # useInputState, useAtlas, useLayout
    types/                      # TypeScript type definitions
    lib/commands.ts             # Tauri invoke wrappers
  src-tauri/
    src/
      lib.rs                    # Tauri commands + app setup
      state.rs                  # AppState struct
      input/                    # Global input capture (rdev + gilrs)
      server/                   # Axum HTTP + WebSocket server
      atlas/                    # Atlas CRUD + ZIP
      layout/                   # Layout CRUD + ZIP
  obs-source/                   # Embedded HTML/CSS/JS for OBS browser source
```

## Releasing

Bump the version across all config files:

```bash
npm run bump patch   # 0.1.6 -> 0.1.7
npm run bump minor   # 0.1.6 -> 0.2.0
npm run bump major   # 0.1.6 -> 1.0.0
npm run bump 2.0.0   # explicit version
```

Then commit, tag, and push:

```bash
git add -A
git commit -m "bump version to 0.2.0"
git tag v0.2.0
git push origin main --tags
```

The GitHub Actions workflow will build the app and create a release with the installer. The app checks for updates on startup via the Tauri updater plugin.

## License

ISC
