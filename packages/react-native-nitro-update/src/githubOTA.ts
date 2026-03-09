/**
 * GitHub OTA URL helper (inspired by react-native-nitro-ota).
 * Build version and download URLs for a GitHub repo — either from a branch (raw) or from the latest release.
 *
 * @see https://github.com/riteshshukla04/react-native-nitro-ota
 */

export interface GithubOTAOptions {
  /** Full GitHub repo URL, e.g. 'https://github.com/owner/repo' */
  githubUrl: string
  /** Path to the version file (plain text), e.g. 'version.txt' or 'ota.version'. Default: 'version.txt' */
  otaVersionPath?: string
  /** Path to the bundle zip file name. Default: 'bundle.zip' */
  bundlePath?: string
  /**
   * - If useReleases is true: uses .../releases/latest/download/... (one app build for all future OTAs).
   * - Otherwise ref is the branch/tag for raw URLs, e.g. 'main'. Default: 'main'
   */
  ref?: string
  /** Use GitHub Releases "latest" asset URLs. Default: true for easiest OTA flow. */
  useReleases?: boolean
}

/**
 * Parse owner and repo from a GitHub URL.
 */
function parseGithubUrl(githubUrl: string): { owner: string; repo: string } | null {
  const trimmed = githubUrl.trim().replace(/\/$/, '')
  const match = trimmed.match(/github\.com[/:](\w[-.\w]*)\/(\w[-.\w]*)/)
  const owner = match?.[1]
  const repo = match?.[2]
  if (!owner || !repo) return null
  return { owner, repo: repo.replace(/\.git$/, '') }
}

export interface GithubOTAResult {
  versionUrl: string
  downloadUrl: string
  owner: string
  repo: string
}

/**
 * Returns version and download URLs for hosting OTA on GitHub.
 * Aligns with how react-native-nitro-ota does GitHub OTA:
 * https://github.com/riteshshukla04/react-native-nitro-ota#option-1-github-ota-easiest
 *
 * @example
 * // Releases (recommended): one app build, create new release for each OTA
 * const { versionUrl, downloadUrl } = githubOTA({
 *   githubUrl: 'https://github.com/your-username/your-ota-repo',
 *   useReleases: true,
 * });
 *
 * @example
 * // Branch (raw): push version.txt and bundle.zip to main
 * const { versionUrl, downloadUrl } = githubOTA({
 *   githubUrl: 'https://github.com/your-username/your-ota-repo',
 *   otaVersionPath: 'version.txt',
 *   ref: 'main',
 *   useReleases: false,
 * });
 */
export function githubOTA(options: GithubOTAOptions): GithubOTAResult {
  const {
    githubUrl,
    otaVersionPath = 'version.txt',
    bundlePath = 'bundle.zip',
    ref = 'main',
    useReleases = true,
  } = options

  const parsed = parseGithubUrl(githubUrl)
  if (!parsed) {
    throw new Error(
      `githubOTA: invalid githubUrl "${githubUrl}". Expected e.g. https://github.com/owner/repo`
    )
  }
  const { owner, repo } = parsed

  if (useReleases) {
    const base = `https://github.com/${owner}/${repo}/releases/latest/download`
    return {
      versionUrl: `${base}/${otaVersionPath}`,
      downloadUrl: `${base}/${bundlePath}`,
      owner,
      repo,
    }
  }

  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}`
  return {
    versionUrl: `${base}/${otaVersionPath}`,
    downloadUrl: `${base}/${bundlePath}`,
    owner,
    repo,
  }
}
