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
  let atlases = {}; // atlas_name -> atlas data
  let elements = new Map(); // entry.id -> { el, inputId, imgPressed, imgUnpressed, shapeUnpressed, shapePressed }

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
    if (!id) return "";
    return `${id.type}:${id.value}`;
  }

  function findShapeStyle(styleId) {
    if (styleId && layout && layout.shape_styles) {
      return layout.shape_styles.find((s) => s.id === styleId) || null;
    }
    return null;
  }

  function findTextStyle(styleId) {
    if (styleId && layout && layout.text_styles) {
      return layout.text_styles.find((s) => s.id === styleId) || null;
    }
    return null;
  }

  function isImageRefEmpty(ref) {
    if (!ref) return true;
    if (typeof ref === "string") return ref === "";
    return false;
  }

  function getImageUrl(atlasName, layoutName, filename) {
    if (!filename) return "";
    if (atlasName) {
      return `${baseUrl}/api/atlas/${atlasName}/images/${filename}`;
    }
    return `${baseUrl}/api/layout/${layoutName}/images/${filename}`;
  }

  function createImageElement(imageRef, atlasName, layoutName, displayW, displayH) {
    if (isImageRefEmpty(imageRef)) return null;

    if (typeof imageRef === "string") {
      const img = new Image();
      img.src = getImageUrl(atlasName, layoutName, imageRef);
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
    img.src = getImageUrl(atlasName, layoutName, imageRef.source);
    return canvas;
  }

  function createShapeElement(shape, opts) {
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.inset = "0";
    el.style.backgroundColor = opts.fill !== false ? opts.color : "transparent";
    if (shape === "circle") el.style.borderRadius = "50%";
    const sw = opts.strokeWidth ?? 0;
    if (sw > 0) {
      el.style.border = `${sw}px solid ${opts.strokeColor ?? "#ffffff"}`;
      el.style.boxSizing = "border-box";
    }
    return el;
  }

  /** Resolve entry source to its display properties. */
  function resolveEntry(entry) {
    const src = entry.source;
    if (src.type === "atlas") {
      const atlas = atlases[src.atlas_name];
      if (!atlas) return null;
      const ae = atlas.entries.find((e) => e.id === src.entry_id);
      if (!ae) return null;
      return {
        inputId: ae.input_id,
        width: ae.width,
        height: ae.height,
        unpressedImage: ae.unpressed_image,
        pressedImage: ae.pressed_image,
        imageSource: src.atlas_name,
        isShape: false,
      };
    }
    if (src.type === "inline") {
      return {
        inputId: src.input_id || null,
        width: src.width,
        height: src.height,
        unpressedImage: src.unpressed_image,
        pressedImage: src.pressed_image,
        imageSource: null,
        isShape: false,
      };
    }
    // shape - resolve unpressed and pressed styles separately
    const unpressedStyle = findShapeStyle(src.shape_style_id) || src;
    const pressedStyle = findShapeStyle(src.pressed_shape_style_id) || unpressedStyle;
    return {
      inputId: src.input_id || null,
      width: src.width,
      height: src.height,
      shape: src.shape,
      color: unpressedStyle.color,
      fill: unpressedStyle.fill,
      strokeColor: unpressedStyle.stroke_color,
      strokeWidth: unpressedStyle.stroke_width,
      pressedColor: pressedStyle.color,
      pressedFill: pressedStyle.fill,
      pressedStrokeColor: pressedStyle.stroke_color,
      pressedStrokeWidth: pressedStyle.stroke_width,
      isShape: true,
    };
  }

  function buildDisplay() {
    container.innerHTML = "";
    elements.clear();

    if (!layout) return;

    container.style.width = layout.canvas_width + "px";
    container.style.height = layout.canvas_height + "px";

    const sorted = [...layout.entries].sort((a, b) => a.z_index - b.z_index);

    for (const entry of sorted) {
      const resolved = resolveEntry(entry);
      if (!resolved) continue;

      const w = resolved.width * entry.scale;
      const h = resolved.height * entry.scale;

      const el = document.createElement("div");
      el.className = "display-entry";
      el.style.left = entry.x - w / 2 + "px";
      el.style.top = entry.y - h / 2 + "px";
      el.style.width = w + "px";
      el.style.height = h + "px";
      el.style.transform = `rotate(${entry.rotation}deg)`;
      el.style.zIndex = entry.z_index;

      let imgUnpressed = null;
      let imgPressed = null;
      let shapeUnpressed = null;
      let shapePressed = null;

      if (resolved.isShape) {
        shapeUnpressed = createShapeElement(resolved.shape, {
          color: resolved.color, fill: resolved.fill,
          strokeColor: resolved.strokeColor, strokeWidth: resolved.strokeWidth,
        });
        shapePressed = createShapeElement(resolved.shape, {
          color: resolved.pressedColor, fill: resolved.pressedFill,
          strokeColor: resolved.pressedStrokeColor, strokeWidth: resolved.pressedStrokeWidth,
        });
        shapePressed.style.display = "none";
        el.appendChild(shapeUnpressed);
        el.appendChild(shapePressed);
      } else {
        imgUnpressed = createImageElement(
          resolved.unpressedImage, resolved.imageSource, layout.name, w, h,
        );
        imgPressed = createImageElement(
          resolved.pressedImage, resolved.imageSource, layout.name, w, h,
        );
        if (imgPressed) imgPressed.style.display = "none";
        if (imgUnpressed) el.appendChild(imgUnpressed);
        if (imgPressed) el.appendChild(imgPressed);
      }

      // Text label overlay
      let labelUnpressedStyle = null;
      let labelPressedStyle = null;
      if (entry.label) {
        labelUnpressedStyle = findTextStyle(entry.label.text_style_id) || entry.label;
        labelPressedStyle = findTextStyle(entry.label.pressed_text_style_id) || labelUnpressedStyle;
        const labelEl = document.createElement("div");
        labelEl.className = "label-overlay";
        labelEl.textContent = entry.label.text;
        labelEl.style.fontFamily = labelUnpressedStyle.font_family || "sans-serif";
        labelEl.style.fontSize = (labelUnpressedStyle.font_size || 14) + "px";
        labelEl.style.color = labelUnpressedStyle.color;
        if (labelUnpressedStyle.bold) labelEl.style.fontWeight = "bold";
        if (labelUnpressedStyle.italic) labelEl.style.fontStyle = "italic";
        if (entry.label.text_direction === "vertical") {
          labelEl.style.writingMode = "vertical-rl";
          labelEl.style.textOrientation = "upright";
        }
        el.appendChild(labelEl);
      }

      container.appendChild(el);

      elements.set(entry.id, {
        el,
        inputId: resolved.inputId,
        imgPressed,
        imgUnpressed,
        shapePressed,
        shapeUnpressed,
        labelEl: entry.label ? el.querySelector(".label-overlay") : null,
        labelUnpressedStyle,
        labelPressedStyle,
      });
    }
  }

  function updateDisplay(inputState) {
    const pressedSet = new Set(
      (inputState.pressed || []).map((id) => inputIdToString(id)),
    );

    for (const [, data] of elements) {
      if (!data.inputId) continue; // background element, never toggles
      const isPressed = pressedSet.has(inputIdToString(data.inputId));
      if (data.imgUnpressed) data.imgUnpressed.style.display = isPressed ? "none" : "";
      if (data.imgPressed) data.imgPressed.style.display = isPressed ? "" : "none";
      if (data.shapeUnpressed) data.shapeUnpressed.style.display = isPressed ? "none" : "";
      if (data.shapePressed) data.shapePressed.style.display = isPressed ? "" : "none";
      if (data.labelEl && data.labelUnpressedStyle) {
        const ts = isPressed ? data.labelPressedStyle : data.labelUnpressedStyle;
        data.labelEl.style.color = ts.color;
        data.labelEl.style.fontWeight = ts.bold ? "bold" : "normal";
        data.labelEl.style.fontStyle = ts.italic ? "italic" : "normal";
        data.labelEl.style.fontFamily = ts.font_family || "sans-serif";
        data.labelEl.style.fontSize = (ts.font_size || 14) + "px";
      }
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
      setStatus("disconnected", "What Pressed is not running - waiting for reconnect...");
      setTimeout(connectWebSocket, 2000);
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  /** Collect unique atlas names from layout entries and fetch them. */
  async function loadAtlases() {
    if (!layout) return;
    const names = new Set();
    for (const entry of layout.entries) {
      if (entry.source.type === "atlas") {
        names.add(entry.source.atlas_name);
      }
    }
    atlases = {};
    await Promise.all(
      [...names].map(async (name) => {
        const atlas = await fetchAtlas(name);
        if (atlas) atlases[name] = atlas;
      }),
    );
  }

  async function reload() {
    const newLayout = await fetchLayout();
    if (!newLayout) return;
    layout = newLayout;
    await loadAtlases();
    buildDisplay();
  }

  async function init() {
    layout = await fetchLayout();
    if (!layout) {
      console.log("No active layout, retrying in 2s...");
      setStatus("waiting", "Waiting for an active layout - select one in What Pressed");
      setTimeout(init, 2000);
      return;
    }

    await loadAtlases();

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
