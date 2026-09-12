/** Printing a target range. */

/**
 * A band as text. The compact `165–185°` is the nicest form and the wrong one
 * the moment a bound is negative: `-8–8°` puts a minus sign against an en dash
 * and reads as noise. Signed metrics — pelvic tilt, knee valgus, the trunk line
 * — are exactly the ones a professional reads most carefully.
 */
export function formatBand(min: number, max: number, joiner: string): string {
  const signed = min < 0 || max < 0;
  return signed ? `${min} ${joiner} ${max}°` : `${min}–${max}°`;
}
