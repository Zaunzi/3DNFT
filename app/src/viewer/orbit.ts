/** Spherical camera angles keep the horizon level and the view above the parcel. */
export function dragOrbit(angle:number, elevation:number, dx:number, dy:number) {
  // Parcel azimuth uses x=cos(angle), z=sin(angle), the reverse of OrbitControls theta.
  // Increasing it matches CryptoDoodz's default OrbitControls horizontal drag.
  return {angle:angle+dx*0.006,elevation:Math.max(0.15,Math.min(1.35,elevation+dy*0.006))};
}

/** Relative to the automatic parcel fit, so state refreshes never reset user zoom. */
export function zoomOrbit(scale:number, wheelPixels:number) {
  return Math.max(.25, Math.min(2, scale * Math.exp(Math.max(-500, Math.min(500, wheelPixels)) * .002)));
}
