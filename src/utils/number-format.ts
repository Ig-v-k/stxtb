export function formatDecimal(value: number) {
  const formatted = value.toFixed(2).replace('.', ',');

  if (!formatted.includes(',')) {
    return formatted;
  }

  return formatted.replace(/0+$/, '').replace(/,$/, '');
}
