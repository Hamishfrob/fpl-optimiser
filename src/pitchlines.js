// Football pitch markings at the real proportions (68 x 105 m, goals at the top and bottom), stretched to fit any box.
// Circles stay round: their radius uses the smaller of the two scales. Returns shapes in pixels for the page to draw.

/** @returns {{outline,halfway,centreCircle,centreSpot,ends:object[],corners:string[]}|null} */
export function pitchMarkings(width, height, margin = 10) {
  const fw = width - 2 * margin, fh = height - 2 * margin;
  if (fw < 80 || fh < 80) return null;
  const sx = fw / 68, sy = fh / 105, sr = Math.min(sx, sy);
  const x0 = margin, y0 = margin, cx = width / 2, cy = height / 2;
  const pen = { w: 40.32 * sx, h: 16.5 * sy }, goal = { w: 18.32 * sx, h: 5.5 * sy };
  const spotDist = 11 * sy, arcR = 9.15 * sr;

  const end = (top) => {
    const edge = top ? y0 : y0 + fh;                    // the goal line
    const dir = top ? 1 : -1;                           // into the pitch
    const penEdge = edge + dir * pen.h, spotY = edge + dir * spotDist;
    const d = Math.abs(penEdge - spotY);                // from the spot to the box edge
    const dx = d < arcR ? Math.sqrt(arcR * arcR - d * d) : 0;
    // the arc bulges away from the goal: from the left meeting point to the right, through the far side
    const sweep = top ? 0 : 1;
    return {
      penaltyArea: { x: cx - pen.w / 2, y: top ? edge : penEdge, w: pen.w, h: pen.h },
      goalArea: { x: cx - goal.w / 2, y: top ? edge : edge - goal.h, w: goal.w, h: goal.h },
      spot: { x: cx, y: spotY },
      arc: `M ${(cx - dx).toFixed(1)} ${penEdge.toFixed(1)} A ${arcR.toFixed(1)} ${arcR.toFixed(1)} 0 0 ${sweep} ${(cx + dx).toFixed(1)} ${penEdge.toFixed(1)}`,
    };
  };

  const rc = Math.max(8, 1 * sr * 1.6);
  const corner = (x, y, sxn, syn) => `M ${(x + sxn * rc).toFixed(1)} ${y.toFixed(1)} A ${rc.toFixed(1)} ${rc.toFixed(1)} 0 0 ${sxn * syn > 0 ? 1 : 0} ${x.toFixed(1)} ${(y + syn * rc).toFixed(1)}`;
  return {
    outline: { x: x0, y: y0, w: fw, h: fh },
    halfway: { x1: x0, y1: cy, x2: x0 + fw, y2: cy },
    centreCircle: { cx, cy, r: arcR },
    centreSpot: { cx, cy, r: 3 },
    ends: [end(true), end(false)],
    corners: [corner(x0, y0, 1, 1), corner(x0 + fw, y0, -1, 1), corner(x0, y0 + fh, 1, -1), corner(x0 + fw, y0 + fh, -1, -1)],
  };
}
