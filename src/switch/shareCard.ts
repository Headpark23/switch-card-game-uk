import type { ShareCardContent } from "./club";

const W = 1080;
const H = 1350;
const GREEN = "#053527";
const GOLD = "#ac7b26";
const CREAM = "#fbf8f0";

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: (size: number) => string, start: number, min: number) {
  let size = start;
  ctx.font = font(size);
  while (size > min && ctx.measureText(text).width > maxWidth) ctx.font = font((size -= 2));
  return size;
}

/** Draws a shareable picture in the app's cream, green and gold style. */
export async function renderShareCard(content: ShareCardContent): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load('72px "DM Serif Display"'), document.fonts.load('600 32px "DM Sans"')]);
  } catch {
    // Fall back to system fonts.
  }
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the picture.");
  const serif = (size: number) => `${size}px "DM Serif Display", Georgia, serif`;
  const sans = (size: number, weight = 400) => `${weight} ${size}px "DM Sans", system-ui, sans-serif`;

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, W, 250);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, 250, W, 8);

  ctx.fillStyle = CREAM;
  ctx.font = serif(84);
  ctx.fillText("SWITCH", 80, 135);
  ctx.fillStyle = "#d7b776";
  ctx.font = sans(30, 600);
  ctx.fillText((content.club || "A better game night").toUpperCase(), 80, 195);

  ctx.fillStyle = GOLD;
  ctx.font = sans(28, 600);
  ctx.fillText(content.eyebrow, 80, 360);
  ctx.fillStyle = GREEN;
  fit(ctx, content.title, W - 160, serif, 104, 52);
  ctx.fillText(content.title, 80, 470);
  ctx.fillStyle = "#59605b";
  fit(ctx, content.subtitle, W - 160, (size) => sans(size), 34, 22);
  ctx.fillText(content.subtitle, 80, 535);

  const rowHeight = 118;
  content.rows.forEach((row, index) => {
    const y = 600 + index * rowHeight;
    ctx.fillStyle = row.highlight ? "#f2e6bd" : index % 2 ? CREAM : "#f4efe1";
    ctx.beginPath();
    ctx.roundRect(60, y, W - 120, rowHeight - 14, 22);
    ctx.fill();
    ctx.fillStyle = row.highlight ? GOLD : GREEN;
    ctx.font = serif(52);
    ctx.textAlign = "center";
    if (row.rank !== null) ctx.fillText(String(row.rank), 130, y + 72);
    else if (row.highlight) ctx.fillText("★", 130, y + 72);
    ctx.textAlign = "left";
    ctx.fillStyle = GREEN;
    fit(ctx, row.label, 520, (size) => sans(size, 600), 42, 26);
    ctx.fillText(row.label, 190, y + 70);
    ctx.textAlign = "right";
    ctx.fillStyle = row.highlight ? "#7a5518" : "#59605b";
    ctx.font = sans(36, 600);
    ctx.fillText(row.value, W - 100, y + 70);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = GOLD;
  ctx.fillRect(80, H - 120, W - 160, 3);
  ctx.fillStyle = "#59605b";
  ctx.font = sans(26);
  ctx.fillText("Learn Switch free: switchcardgame.co.uk", 80, H - 62);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The picture could not be made."))), "image/png"));
}

/** Opens the phone's share sheet when it can share files, otherwise downloads the picture. */
export async function shareOrDownload(blob: Blob, filename: string, title: string, text = "Learn Switch free: https://switchcardgame.co.uk"): Promise<"shared" | "downloaded"> {
  const file = new File([blob], filename, { type: "image/png" });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return "shared";
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
