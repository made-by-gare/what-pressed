import type { Layout } from "../../types/layout";
import type { Atlas } from "../../types/atlas";
import { inputIdToString } from "../../types/input";
import { AtlasImage } from "../atlas/AtlasImage";

interface Props {
  layout: Layout;
  atlas: Atlas;
  pressedSet: Set<string>;
  serverBaseUrl?: string;
}

export function DisplayRenderer({
  layout,
  atlas,
  pressedSet,
  serverBaseUrl,
}: Props) {
  const sorted = [...layout.entries].sort((a, b) => a.z_index - b.z_index);

  const getServerImageUrl = (filename: string) => {
    if (!filename) return "";
    const base = serverBaseUrl || "http://localhost:9120";
    return `${base}/api/atlas/${layout.atlas_name}/images/${filename}`;
  };

  return (
    <div
      className="display-renderer"
      style={{
        position: "relative",
        width: layout.canvas_width,
        height: layout.canvas_height,
        margin: "0 auto",
      }}
    >
      {sorted.map((entry) => {
        const atlasEntry = atlas.entries.find(
          (ae) => ae.id === entry.atlas_entry_id,
        );
        if (!atlasEntry) return null;

        const isPressed = pressedSet.has(inputIdToString(atlasEntry.input_id));
        const image = isPressed
          ? atlasEntry.pressed_image
          : atlasEntry.unpressed_image;

        const imgStyle = {
          width: "100%" as const,
          height: "100%" as const,
          objectFit: "contain" as const,
          imageRendering: "pixelated" as const,
        };

        return (
          <div
            key={entry.id}
            style={{
              position: "absolute",
              left: entry.x - (atlasEntry.width * entry.scale) / 2,
              top: entry.y - (atlasEntry.height * entry.scale) / 2,
              width: atlasEntry.width * entry.scale,
              height: atlasEntry.height * entry.scale,
              transform: `rotate(${entry.rotation}deg)`,
              zIndex: entry.z_index,
            }}
          >
            {image &&
              (serverBaseUrl ? (
                <img
                  src={getServerImageUrl(image)}
                  alt={atlasEntry.label}
                  style={imgStyle}
                />
              ) : (
                <AtlasImage
                  atlasName={layout.atlas_name}
                  filename={image}
                  alt={atlasEntry.label}
                  style={imgStyle}
                />
              ))}
          </div>
        );
      })}
    </div>
  );
}
