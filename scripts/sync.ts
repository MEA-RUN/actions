import { cp, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const [mode, sitePath, sourcePath, sourceRepository] = Bun.argv.slice(2)

if (!['all', 'content', 'tools'].includes(mode || ''))
  throw new Error('Usage: sync.ts <all|content|tools> <site> <source> <owner/repo>')
if (!sourceRepository?.match(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/))
  throw new Error('Invalid source repository')

const site = resolve(sitePath)
const source = resolve(sourcePath)

async function replaceDirectory(from: string, to: string) {
  await mkdir(to, { recursive: true })
  for (const entry of await readdir(to))
    await rm(join(to, entry), { recursive: true, force: true })

  if (existsSync(from))
    await cp(from, to, { recursive: true })
}

async function parseYaml(path: string): Promise<Record<string, unknown>> {
  const value = Bun.YAML.parse(await Bun.file(path).text())
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${path} must contain an object`)
  return value as Record<string, unknown>
}

async function run(command: string[], options: { stdout?: 'pipe' | 'inherit' } = {}) {
  const process = Bun.spawn(command, {
    env: Bun.env,
    stdout: options.stdout || 'inherit',
    stderr: 'pipe',
  })
  const stderr = await new Response(process.stderr).text()
  const exitCode = await process.exited
  if (exitCode !== 0)
    throw new Error(`${command[0]} failed: ${stderr}`)
  return process
}

if (mode === 'all' || mode === 'content') {
  await replaceDirectory(join(source, 'subjects'), join(site, 'content'))
  await replaceDirectory(join(source, 'assets'), join(site, 'public', 'assets'))
}

if (mode === 'all' || mode === 'tools') {
  const toolsRoot = join(site, 'public', 'tools')
  await rm(toolsRoot, { recursive: true, force: true })
  await mkdir(toolsRoot, { recursive: true })

  const subjectManifestPath = join(source, 'metadata.yml')
  const subjectManifest = existsSync(subjectManifestPath)
    ? await parseYaml(subjectManifestPath)
    : { tools: [] }
  if (!existsSync(subjectManifestPath))
    console.warn('metadata.yml not found; generating a site without tools')

  const tools = subjectManifest.tools ?? []
  if (!Array.isArray(tools))
    throw new Error('metadata.yml: tools must be an array')

  const renderedTools = []

  for (const value of tools) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('metadata.yml: each tool must be an object')

    const tool = value as Record<string, unknown>
    const id = tool.id
    const repository = tool.repository
    const localPath = tool.path
    const ref = tool.ref ?? 'main'
    if (typeof id !== 'string' || !id.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
      throw new Error(`Invalid tool id: ${JSON.stringify(id)}`)

    const hasRepository = repository !== undefined
    const hasLocalPath = localPath !== undefined
    if (hasRepository === hasLocalPath)
      throw new Error(`Tool ${id} must define exactly one of repository or path`)

    const destination = join(toolsRoot, id)
    await mkdir(destination, { recursive: true })

    if (hasRepository) {
      if (typeof repository !== 'string' || !repository.match(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/))
        throw new Error(`Invalid tool repository: ${JSON.stringify(repository)}`)
      if (typeof ref !== 'string' || !ref.match(/^[^\s\0]+$/))
        throw new Error(`Invalid tool ref: ${JSON.stringify(ref)}`)

      const temporary = await mkdtemp(join(tmpdir(), 'reef-tool-'))
      try {
        const archive = join(temporary, 'tool.tar.gz')
        const endpoint = `repos/${repository}/tarball/${encodeURIComponent(ref)}`
        const download = Bun.spawn(['gh', 'api', endpoint], { env: Bun.env, stdout: 'pipe', stderr: 'pipe' })
        const archiveBytes = await new Response(download.stdout).arrayBuffer()
        await Bun.write(archive, archiveBytes)
        const downloadError = await new Response(download.stderr).text()
        if (await download.exited !== 0)
          throw new Error(`Unable to download ${repository}@${ref}: ${downloadError}`)
        await run(['tar', '-xzf', archive, '-C', destination, '--strip-components=1'])
      } finally {
        await rm(temporary, { recursive: true, force: true })
      }
    } else {
      if (typeof localPath !== 'string' || isAbsolute(localPath))
        throw new Error(`Invalid local path for ${id}: ${JSON.stringify(localPath)}`)

      const localToolsRoot = resolve(source, 'tools')
      const localSource = resolve(source, localPath)
      const pathInsideTools = relative(localToolsRoot, localSource)
      if (!pathInsideTools || pathInsideTools.startsWith('..') || isAbsolute(pathInsideTools))
        throw new Error(`Local tool ${id} must be inside the tools directory`)
      if (!existsSync(localSource))
        throw new Error(`Local tool not found for ${id}: ${localPath}`)

      await cp(localSource, destination, { recursive: true })
    }

    const metadataPath = join(destination, 'metadata.yml')
    const metadata = existsSync(metadataPath) ? await parseYaml(metadataPath) : {}
    const entrypoint = tool.entrypoint ?? metadata.entrypoint ?? 'index.html'
    if (typeof entrypoint !== 'string' || !entrypoint.match(/^(?!\/)(?!.*\.\.)[^\0]+\.html$/))
      throw new Error(`Invalid entrypoint for ${id}`)
    if (!existsSync(join(destination, entrypoint)))
      throw new Error(`Entrypoint not found for ${id}: ${entrypoint}`)

    renderedTools.push({
      id,
      name: tool.name ?? metadata.name ?? id,
      icon: tool.icon ?? metadata.icon ?? 'i-lucide-wrench',
      description: tool.description ?? metadata.description ?? '',
      githubUrl: tool.githubUrl ?? metadata.githubUrl ?? (hasRepository ? `https://github.com/${repository}` : ''),
      version: tool.version ?? metadata.version ?? (hasRepository ? ref : ''),
      category: tool.category ?? metadata.category ?? 'tool',
      path: `/tools/${id}/${entrypoint}`,
      localPath: `public/tools/${id}`,
    })
  }

  const generatedManifest = {
    title: subjectManifest.title ?? basename(sourceRepository),
    description: subjectManifest.description ?? '',
    tools: renderedTools,
    assets: { logo: null, images: [] },
  }
  await Bun.write(join(toolsRoot, 'manifests.json'), `${JSON.stringify(generatedManifest, null, 2)}\n`)
}
