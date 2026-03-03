/**
 * Build environment variables for authenticated git operations.
 *
 * Uses GIT_CONFIG_COUNT to define an inline credential helper — no
 * scripts on disk, no persistent state. The token lives only in the
 * child process env for the duration of the git command.
 *
 * Requires git >= 2.31 (GIT_CONFIG_COUNT support).
 */
export function buildGitAuthEnv(token: string): Record<string, string> {
  return {
    GIT_TERMINAL_PROMPT: "0",
    GIT_TOKEN: token,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "credential.helper",
    GIT_CONFIG_VALUE_0: '!f() { echo "username=x-access-token"; echo "password=$GIT_TOKEN"; }; f',
  }
}
