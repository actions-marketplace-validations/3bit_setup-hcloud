import * as core from '@actions/core'
import * as installer from './installer'
import path from 'path'
import axios from 'axios'

async function getLatestVersion(): Promise<string> {
  const url = 'https://github.com/hetznercloud/cli/releases/latest'

  const response = await axios.get(url)
  const req = response.request
  const latestReleaseUrl = `${req.protocol}://${req.hostname}${req.pathname}`
  const latestVersion = removeLeadingV(path.basename(latestReleaseUrl))
  if (!latestVersion || latestVersion === 'latest') {
    throw new Error('Unable to determine latest version.')
  }
  core.info(`Latest version found: ${latestVersion}`)
  return latestVersion
}

function removeLeadingV(version: string): string {
  return version.startsWith('v') ? version.substring(1) : version
}

export async function run(): Promise<void> {
  try {
    let version = core.getInput('hcloud-version')
    if (typeof version != 'undefined' && version && version !== 'latest') {
      version = removeLeadingV(version)
    } else {
      version = await getLatestVersion()
    }

    core.info(`Setup hcloud ${version}`)
    const installDir = await installer.run(version)
    core.addPath(installDir)
    core.info(`Successfully setup hcloud version ${version}`)
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
    else throw error
  }
}
