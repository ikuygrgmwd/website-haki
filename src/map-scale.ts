export interface DistrictCount { name: string; count: number }
export interface LegendRange { min: number; max: number; color: string; label: string }
const COLORS = ['#f8d9ce', '#edaf9b', '#d77c63', '#98442f']
const ZERO_COLOR = '#e3e5e8'

/** One shared, integer-only scale for the map, legend, and chart. */
export function getLegend(counts: DistrictCount[]): LegendRange[] {
  const max = Math.max(0, ...counts.map(({ count }) => Math.max(0, Math.floor(count))))
  const ranges: LegendRange[] = [{ min: 0, max: 0, color: ZERO_COLOR, label: '0 inovasi' }]
  if (!max) return ranges
  const steps = Math.min(4, max)
  for (let index = 0; index < steps; index++) {
    const min = Math.floor(index * max / steps) + 1
    const upper = Math.floor((index + 1) * max / steps)
    ranges.push({ min, max: upper, color: COLORS[steps === 1 ? 1 : Math.round(index * 3 / (steps - 1))], label: min === upper ? `${min} inovasi` : `${min}–${upper} inovasi` })
  }
  return ranges
}

export function countColor(count: number, counts: DistrictCount[]): string {
  const ranges = getLegend(counts)
  return ranges.find(({ min, max }) => count >= min && count <= max)?.color ?? ranges[ranges.length - 1].color
}
