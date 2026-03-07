import { useState, useEffect, forwardRef } from "react";
import { readFile, BaseDirectory } from "@tauri-apps/plugin-fs";

interface Props extends React.ImgHTMLAttributes<HTMLImageElement> {
  atlasName: string;
  filename: string;
}

export const AtlasImage = forwardRef<HTMLImageElement, Props>(
  ({ atlasName, filename, ...imgProps }, ref) => {
    const [url, setUrl] = useState("");

    useEffect(() => {
      if (!filename || !atlasName) return;

      let objectUrl: string | undefined;
      let cancelled = false;

      readFile(`atlases/${atlasName}/images/${filename}`, {
        baseDir: BaseDirectory.AppData,
      })
        .then((data) => {
          if (cancelled) return;
          const blob = new Blob([data]);
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
        })
        .catch(() => {});

      return () => {
        cancelled = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [atlasName, filename]);

    if (!url) return null;
    return <img ref={ref} src={url} {...imgProps} />;
  },
);
