// OBS Browser Source Display
// Connects to the What Pressed web server via WebSocket

(function () {
  const container = document.getElementById("display-container");
  const banner = document.getElementById("status-banner");
  const baseUrl = window.location.origin;
  const wsUrl = `ws://${window.location.host}/ws/input`;
  const isObs = !!window.obsstudio;

  function setStatus(state, message) {
    if (isObs) return;
    banner.className = state;
    banner.textContent = message;
  }

  let layout = null;
  let atlas = null;
  let elements = new Map(); // entry.id -> { el, imgPressed, imgUnpressed }

  async function fetchLayout() {
    try {
      const res = await fetch(`${baseUrl}/api/active-layout`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async function fetchAtlas(name) {
    try {
      const res = await fetch(`${baseUrl}/api/atlas/${name}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function inputIdToString(id) {
    return `${id.type}:${id.value}`;
  }

  function isImageRefEmpty(ref) {
    if (!ref) return true;
    if (typeof ref === "string") return ref === "";
    return false;
  }

  function getImageRefFilename(ref) {
    if (typeof ref === "string") return ref;
    return ref.source;
  }

  function createImageElement(imageRef, displayW, displayH) {
    if (isImageRefEmpty(imageRef)) return null;

    if (typeof imageRef === "string") {
      // Direct file reference
      const img = new Image();
      img.src = `${baseUrl}/api/atlas/${layout.atlas_name}/images/${imageRef}`;
      return img;
    }

    // Sprite rect reference - use canvas
    const canvas = document.createElement("canvas");
    canvas.width = displayW;
    canvas.height = displayH;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(
        img,
        imageRef.x, imageRef.y, imageRef.w, imageRef.h,
        0, 0, displayW, displayH,
      );
    };
    img.src = `${baseUrl}/api/atlas/${layout.atlas_name}/images/${imageRef.source}`;
    return canvas;
  }

  function buildDisplay() {
    container.innerHTML = "";
    elements.clear();

    if (!layout || !atlas) return;

    container.style.width = layout.canvas_width + "px";
    container.style.height = layout.canvas_height + "px";

    const sorted = [...layout.entries].sort((a, b) => a.z_index - b.z_index);

    for (const entry of sorted) {
      const atlasEntry = atlas.entries.find(
        (ae) => ae.id === entry.atlas_entry_id,
      );
      if (!atlasEntry) continue;

      const el = document.createElement("div");
      el.className = "display-entry";

      const w = atlasEntry.width * entry.scale;
      const h = atlasEntry.height * entry.scale;

      el.style.left = entry.x - w / 2 + "px";
      el.style.top = entry.y - h / 2 + "px";
      el.style.width = w + "px";
      el.style.height = h + "px";
      el.style.transform = `rotate(${entry.rotation}deg)`;
      el.style.zIndex = entry.z_index;

      const unpressedEl = createImageElement(atlasEntry.unpressed_image, w, h);
      const pressedEl = createImageElement(atlasEntry.pressed_image, w, h);
      if (pressedEl) pressedEl.style.display = "none";

      if (unpressedEl) el.appendChild(unpressedEl);
      if (pressedEl) el.appendChild(pressedEl);
      container.appendChild(el);

      elements.set(entry.id, {
        el,
        atlasEntry,
        imgPressed: pressedEl,
        imgUnpressed: unpressedEl,
      });
    }
  }

  function updateDisplay(inputState) {
    const pressedSet = new Set(
      (inputState.pressed || []).map((id) => inputIdToString(id)),
    );

    for (const [, data] of elements) {
      const isPressed = pressedSet.has(
        inputIdToString(data.atlasEntry.input_id),
      );
      if (data.imgUnpressed) data.imgUnpressed.style.display = isPressed ? "none" : "";
      if (data.imgPressed) data.imgPressed.style.display = isPressed ? "" : "none";
    }
  }

  function connectWebSocket() {
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setStatus("", "");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.reload) {
          console.log("Layout changed, reloading...");
          reload();
          return;
        }
        updateDisplay(data);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected, reconnecting in 2s...");
      setStatus("disconnected", "What Pressed is not running — waiting for reconnect...");
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  async function reload() {
    const newLayout = await fetchLayout();
    if (!newLayout) return;
    layout = newLayout;
    atlas = await fetchAtlas(layout.atlas_name);
    buildDisplay();
  }

  async function init() {
    layout = await fetchLayout();
    if (!layout) {
      console.log("No active layout, retrying in 2s...");
      setStatus("waiting", "Waiting for an active layout — select one in What Pressed");
      setTimeout(init, 2000);
      return;
    }

    atlas = await fetchAtlas(layout.atlas_name);
    if (!atlas) {
      console.log("Failed to fetch atlas, retrying in 2s...");
      setStatus("waiting", "Waiting for atlas data...");
      setTimeout(init, 2000);
      return;
    }

    setStatus("", "");
    buildDisplay();
    connectWebSocket();
  }

  // In a regular browser, transparent background renders as white,
  // making white key images invisible. Add a dark backdrop when not in OBS.
  if (!window.obsstudio) {
    document.body.style.background = "#1e1e1e";
  }

  init();
})();
