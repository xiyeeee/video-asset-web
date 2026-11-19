const workspaceRoots = new Set(['/', '/projects', '/analysis', '/assets', '/story', '/export'])

export const safeDestination = (value: string | null) => {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/'
  try {
    const destination = new URL(value, window.location.origin)
    const isProjectDetail = /^\/projects\/[^/]+$/.test(destination.pathname)
    if (destination.origin !== window.location.origin || (!workspaceRoots.has(destination.pathname) && !isProjectDetail)) {
      return '/'
    }
    return destination.pathname + destination.search
  } catch {
    return '/'
  }
}

export const withRedirect = (path: string, redirect: string | null) => {
  if (!redirect) return path
  return `${path}?${new URLSearchParams({ redirect }).toString()}`
}
