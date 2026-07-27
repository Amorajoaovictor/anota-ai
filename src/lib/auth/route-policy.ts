const PASSWORD_ONLY_ROUTES = new Set([
  'sign-in/email',
  'get-session',
  'sign-out',
])

export function isPasswordOnlyAuthRoute(path: string[]) {
  return PASSWORD_ONLY_ROUTES.has(path.join('/'))
}
