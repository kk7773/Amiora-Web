const SKU_SUFFIX = '01'

export function generateAmioraSKU(
  categoryCode: string,
  productNumber: number,
  purityCode: string,
  colorCode: string,
): string {
  const cat = (categoryCode || 'XX').toUpperCase().slice(0, 4)
  const num = String(Math.max(0, Math.floor(productNumber))).padStart(4, '0')
  const purity = String(purityCode || '').toUpperCase().slice(0, 8)
  const color = (colorCode || '').toUpperCase().slice(0, 4)
  return `AMI${cat}${num}${purity}${color}${SKU_SUFFIX}`
}

export function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120)
}
