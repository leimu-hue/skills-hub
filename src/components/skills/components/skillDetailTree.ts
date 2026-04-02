export function getExpandedPathsForFile(path: string | null): Set<string> {
  const expanded = new Set<string>()
  if (!path) return expanded

  const parts = path.split('/').filter(Boolean)
  for (let i = 1; i < parts.length; i++) {
    expanded.add(parts.slice(0, i).join('/'))
  }

  return expanded
}
