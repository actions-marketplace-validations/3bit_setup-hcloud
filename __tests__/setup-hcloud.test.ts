/* eslint-disable @typescript-eslint/no-explicit-any */
import * as core from '@actions/core'
import * as tc from '@actions/tool-cache'
import osm from 'os'
import path from 'path'
import axios from 'axios'
import * as main from '../src/main'

describe('setup-hcloud', () => {
  let inputs = {} as any
  let os = {} as any

  let inSpy: jest.SpyInstance
  let findSpy: jest.SpyInstance
  let cnSpy: jest.SpyInstance
  let logSpy: jest.SpyInstance
  let platSpy: jest.SpyInstance
  let archSpy: jest.SpyInstance
  let dlSpy: jest.SpyInstance
  let exSpy: jest.SpyInstance
  let cacheSpy: jest.SpyInstance
  let reqSpy: jest.SpyInstance | null

  beforeEach(() => {
    // @actions/core
    inputs = {}
    inSpy = jest.spyOn(core, 'getInput')
    inSpy.mockImplementation(name => inputs[name])

    // node
    os = {}
    platSpy = jest.spyOn(osm, 'platform')
    platSpy.mockImplementation(() => os['platform'])
    archSpy = jest.spyOn(osm, 'arch')
    archSpy.mockImplementation(() => os['arch'])

    // @actions/tool-cache
    findSpy = jest.spyOn(tc, 'find')
    dlSpy = jest.spyOn(tc, 'downloadTool')
    exSpy = jest.spyOn(tc, 'extractTar')
    cacheSpy = jest.spyOn(tc, 'cacheDir')

    // writes
    cnSpy = jest.spyOn(process.stdout, 'write')
    cnSpy.mockImplementation(() => {})
    logSpy = jest.spyOn(core, 'info')
    logSpy.mockImplementation(() => {})
  })

  function mockAxiosRequest(
    url: string = 'https://github.com/hetznercloud/cli/releases/v77.77.77'
  ) {
    const _url = new URL(url)
    reqSpy = jest.spyOn(axios, 'get')
    reqSpy.mockImplementation(() =>
      Promise.resolve({
        request: {
          path: _url.pathname,
          protocol: _url.protocol,
          host: _url.hostname
        }
      })
    )
  }

  afterEach(() => {
    if (reqSpy) {
      reqSpy.mockClear()
      reqSpy = null
    }
    jest.resetAllMocks()
    jest.clearAllMocks()
  })

  afterAll(async () => {}, 100000)

  it('find hcloud in cache', async () => {
    mockAxiosRequest()
    inputs['hcloud-version'] = '99.99.99'
    const toolPath = path.normalize('/cache/hcloud/99.99.99')
    findSpy.mockImplementation(() => toolPath)
    await main.run()

    expect(logSpy).toHaveBeenCalledWith(`Found in cache @ ${toolPath}`)
  })

  it('get version - input=latest', async () => {
    mockAxiosRequest()
    inputs['hcloud-version'] = 'latest'
    await main.run()

    expect(logSpy).toHaveBeenCalledWith('Latest version found: 77.77.77')
  })

  it('get version - input=', async () => {
    mockAxiosRequest()
    inputs['hcloud-version'] = ''
    await main.run()

    expect(logSpy).toHaveBeenCalledWith('Latest version found: 77.77.77')
  })

  it('get version - no input', async () => {
    mockAxiosRequest()
    await main.run()

    expect(logSpy).toHaveBeenCalledWith('Latest version found: 77.77.77')
  })

  it('reports error if version cannot be determined - empty href', async () => {
    mockAxiosRequest('https://github.com/hetznercloud/cli/releases/latest')
    await main.run()

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Unable to determine latest version.${osm.EOL}`
    )
  })

  it('reports error if version cannot be determined - no redirect', async () => {
    mockAxiosRequest('https://github.com/hetznercloud/cli/releases/latest')
    await main.run()

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Unable to determine latest version.${osm.EOL}`
    )
  })

  it('download version not in cache', async () => {
    mockAxiosRequest()
    os.platform = 'linux'
    os.arch = 'x64'
    inputs['hcloud-version'] = '99.99.99'
    const toolPath = path.normalize('/cache/hcloud/99.99.99')
    dlSpy.mockImplementation(() => '/some/temp/path')
    exSpy.mockImplementation(() => '/some/other/temp/path')
    cacheSpy.mockImplementation(() => toolPath)
    await main.run()

    expect(dlSpy).toHaveBeenCalled()
    expect(exSpy).toHaveBeenCalled()
  })

  it('handles unhandled error and reports error', async () => {
    mockAxiosRequest()
    const errMsg = 'unhandled error message'
    inputs['hcloud-version'] = '99.99.99'
    findSpy.mockImplementation(() => {
      throw new Error(errMsg)
    })
    await main.run()

    expect(cnSpy).toHaveBeenCalledWith(`::error::${errMsg}${osm.EOL}`)
  })

  it('does not find a version that does not exist', async () => {
    mockAxiosRequest()
    os.platform = 'linux'
    os.arch = 'x64'
    inputs['hcloud-version'] = '99.99.99'

    await main.run()

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Failed to install version '99.99.99': Error: Unable to download hcloud version '99.99.99' for platform 'linux' and architecture 'amd64'${osm.EOL}`
    )
  })

  it('reports a failed download', async () => {
    mockAxiosRequest()
    const errMsg = 'unhandled download message'
    os.platform = 'linux'
    os.arch = 'x64'
    inputs['hcloud-version'] = '99.99.99'

    dlSpy.mockImplementation(() => {
      throw new Error(errMsg)
    })
    await main.run()

    expect(cnSpy).toHaveBeenCalledWith(
      `::error::Failed to install version '99.99.99': Error: ${errMsg}${osm.EOL}`
    )
  })

  it('correct download url for win32-x64', async () => {
    mockAxiosRequest()
    const platform = 'win32'
    const arch = 'x64'

    const resultFn = setupUrlTest(platform, arch)
    await main.run()

    expect(resultFn()).toEqual(
      'https://github.com/hetznercloud/cli/releases/download/v99.99.99/hcloud-windows-amd64.zip'
    )
  })

  it('correct download url for win32-x32', async () => {
    mockAxiosRequest()
    const platform = 'win32'
    const arch = 'x32'

    const resultFn = setupUrlTest(platform, arch)
    await main.run()

    expect(resultFn()).toEqual(
      'https://github.com/hetznercloud/cli/releases/download/v99.99.99/hcloud-windows-386.zip'
    )
  })

  it('correct download url for linux-x64', async () => {
    mockAxiosRequest()
    const platform = 'linux'
    const arch = 'x64'

    const resultFn = setupUrlTest(platform, arch)
    await main.run()

    expect(resultFn()).toEqual(
      'https://github.com/hetznercloud/cli/releases/download/v99.99.99/hcloud-linux-amd64.tar.gz'
    )
  })

  it('correct download url for darwin-x64', async () => {
    mockAxiosRequest()
    const platform = 'darwin'
    const arch = 'x64'

    const resultFn = setupUrlTest(platform, arch)
    await main.run()

    expect(resultFn()).toEqual(
      'https://github.com/hetznercloud/cli/releases/download/v99.99.99/hcloud-darwin-amd64.tar.gz'
    )
  })

  it('correct download url for darwin-x64 pre v1.30', async () => {
    mockAxiosRequest()
    const platform = 'darwin'
    const arch = 'x64'
    const version = '1.29'

    const resultFn = setupUrlTest(platform, arch, version)
    await main.run()

    expect(resultFn()).toEqual(
      'https://github.com/hetznercloud/cli/releases/download/v1.29/hcloud-macos-amd64.zip'
    )
  })

  function setupUrlTest(
    platform: string,
    arch: string,
    version: string = '99.99.99'
  ): () => string {
    os.platform = platform
    os.arch = arch
    inputs['hcloud-version'] = version

    let downloadUrl = ''
    dlSpy.mockImplementation(url => {
      downloadUrl = url
      return '/some/temp/path'
    })

    return () => downloadUrl
  }
})
