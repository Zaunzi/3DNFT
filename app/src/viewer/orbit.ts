/** Spherical camera angles keep the horizon level and the view above the parcel. */
export function dragOrbit(angle:number, elevation:number, dx:number, dy:number) {
  return {angle:angle-dx*0.006,elevation:Math.max(0.15,Math.min(1.35,elevation+dy*0.006))};
}
