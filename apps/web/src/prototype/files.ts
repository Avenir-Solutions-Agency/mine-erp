// Browser file helpers of the demo: readPhoto() resize, plain-text read, CSV download.

/** The demo's readPhoto(): scales the image to at most 900 px and returns a JPEG data URL. */
export function readPhoto(file: File): Promise<{ img: string; name: string }> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const src = String(r.result);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 900 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = img.width * k;
        cv.height = img.height * k;
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
        resolve({ img: cv.toDataURL("image/jpeg", 0.75), name: file.name });
      };
      img.onerror = () => resolve({ img: src, name: file.name });
      img.src = src;
    };
    r.readAsDataURL(file);
  });
}

export function readText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.readAsText(file);
  });
}

/** Replaces the demo's window.claude 'downloads' capability with a normal browser download. */
export async function downloadFile(filename: string, data: string) {
  const url = URL.createObjectURL(
    new Blob([data], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
