export function splitVietnameseName(fullName: string) {
  const clean = fullName.replace(/\s+/g, " ").trim()
  if (!clean) return { firstName: "", lastName: "" }
  const parts = clean.split(" ")
  if (parts.length === 1) return { firstName: parts[0], lastName: parts[0] }
  const lastName = parts[0]
  const firstName = parts.slice(1).join(" ")
  return { firstName, lastName }
}
