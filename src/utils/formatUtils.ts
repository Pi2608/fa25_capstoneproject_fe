/**
 * Safe date formatting that avoids hydration mismatch
 * by using consistent formatting between server and client
 */

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  
  // Use consistent format that doesn't depend on locale
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  
  return `${day}/${month}/${year}`;
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "—";
  
  // Use consistent format that doesn't depend on locale
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function formatNumber(num: number | null | undefined): string {
  if (num == null) return "0";
  
  // Use consistent number formatting
  return num.toLocaleString('en-US');
}

export function formatCurrency(amount: number | null | undefined, currency = 'VND'): string {
  if (amount == null) return "0₫";
  
  // Use consistent currency formatting
  return `${amount.toLocaleString('en-US')}₫`;
}
