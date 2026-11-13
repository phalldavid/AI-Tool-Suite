// A stand-in picture for the loader preview in Customise: a villa by a pool at dusk,
// plus the same scene as a plain line drawing (the "SketchUp view").

const IW = 960;
const IH = 540;

function scene(c: CanvasRenderingContext2D, line: boolean): void {
  c.save();
  if (!line) {
    const g = c.createLinearGradient(0, 0, 0, 400);
    g.addColorStop(0, "#1b2a4a");
    g.addColorStop(0.45, "#4b5f8e");
    g.addColorStop(0.9, "#e9a676");
    g.addColorStop(1, "#f6c48f");
    c.fillStyle = g;
    c.fillRect(0, 0, IW, 400);
    const s = c.createRadialGradient(760, 380, 0, 760, 380, 220);
    s.addColorStop(0, "rgba(255,205,150,.75)");
    s.addColorStop(1, "rgba(255,205,150,0)");
    c.fillStyle = s;
    c.fillRect(0, 0, IW, 400);
  } else {
    c.fillStyle = "#d9d9d9";
    c.fillRect(0, 0, IW, IH);
    c.strokeStyle = "#222";
    c.lineWidth = 2;
  }
  c.beginPath();
  c.moveTo(0, 380);
  c.quadraticCurveTo(200, 330, 420, 370);
  c.quadraticCurveTo(700, 400, 960, 355);
  if (line) c.stroke();
  else {
    c.lineTo(960, 400);
    c.lineTo(0, 400);
    c.fillStyle = "#33405a";
    c.fill();
  }
  const R: [number, number, number, number, string][] = [
    [0, 400, 960, 140, "#2a3128"],
    [0, 408, 960, 34, "#3b5530"],
    [130, 442, 500, 8, "#8b6a4c"],
    [150, 450, 460, 34, "#4f93b8"],
    [150, 450, 460, 4, "#8cc6df"],
    [140, 290, 560, 12, "#efe8db"],
    [160, 302, 520, 106, "#d8cbb4"],
  ];
  for (let i = 0; i < 6; i++) R.push([185 + i * 82, 322, 58, 72, "#ffcf86"]);
  R.push([260, 215, 420, 80, "#ebe2d0"], [280, 232, 380, 46, "#28323c"], [230, 200, 480, 14, "#f5f0e7"]);
  for (const [x, y, w, h, col] of R) {
    if (line) {
      if (h > 6) c.strokeRect(x, y, w, h);
    } else {
      c.fillStyle = col;
      c.fillRect(x, y, w, h);
    }
  }
  for (let x = 284; x < 656; x += 12) {
    if (line) {
      c.beginPath();
      c.moveTo(x, 232);
      c.lineTo(x, 278);
      c.stroke();
    } else {
      c.fillStyle = "#8a6440";
      c.fillRect(x, 232, 3, 46);
    }
  }
  for (const [x, y, r] of [
    [80, 330, 62],
    [150, 352, 42],
    [820, 320, 72],
    [892, 346, 50],
    [740, 348, 38],
  ]) {
    if (line) {
      c.beginPath();
      c.arc(x, y, r, 0, 7);
      c.stroke();
      continue;
    }
    c.fillStyle = "#3a2a1e";
    c.fillRect(x - 4, y, 8, 410 - y);
    c.fillStyle = "#1e3523";
    c.beginPath();
    c.arc(x, y, r, 0, 7);
    c.fill();
    c.fillStyle = "#2f5534";
    c.beginPath();
    c.arc(x - r * 0.25, y - r * 0.3, r * 0.55, 0, 7);
    c.fill();
  }
  c.restore();
}

let cached: { view: HTMLCanvasElement; result: HTMLCanvasElement } | null = null;

export function makeDemo(): { view: HTMLCanvasElement; result: HTMLCanvasElement } {
  if (cached) return cached;
  const make = (line: boolean) => {
    const c = document.createElement("canvas");
    c.width = IW;
    c.height = IH;
    scene(c.getContext("2d")!, line);
    return c;
  };
  cached = { view: make(true), result: make(false) };
  return cached;
}
