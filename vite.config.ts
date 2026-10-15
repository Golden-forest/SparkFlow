import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'path'
import { generateResourceManifest } from './scripts/resource-manifest'
import { accountBuildOrigins, CONTENT_DIRECTORIES, isolateAccountBuild } from './scripts/account-build'

function resourceManifestPlugin(contentOrigin?: string, accountAPI?: string): Plugin {
  const projectRoot = __dirname
  const watchRoots = [
    path.resolve(projectRoot, 'public/images'),
    path.resolve(projectRoot, 'public/courseware'),
    path.resolve(projectRoot, 'public/simcanvas'),
  ]

  const regenerate = () => {
    generateResourceManifest(projectRoot)
  }

  const shouldRegenerate = (targetPath: string): boolean =>
    watchRoots.some((watchRoot) => targetPath.startsWith(watchRoot))

  let pendingTimer: NodeJS.Timeout | undefined
  const scheduleRegenerate = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer)
    }
    pendingTimer = setTimeout(() => {
      regenerate()
      pendingTimer = undefined
    }, 80)
  }

  return {
    name: 'resource-manifest-plugin',
    buildStart() {
      regenerate()
    },
    configureServer(server) {
      regenerate()
      watchRoots.forEach((watchRoot) => server.watcher.add(watchRoot))

      if (contentOrigin) {
        const resourceURL = new URL(contentOrigin)
        const developmentHost = typeof server.config.server.host === 'string' ? server.config.server.host : 'localhost'
        if (accountAPI && resourceURL.hostname === developmentHost) {
          throw new Error('Account development resources require a different hostname from the app.')
        }
        server.middlewares.use((req, res, next) => {
          const requested = new URL(req.url ?? '/', 'http://development.invalid')
          if (CONTENT_DIRECTORIES.some(directory => requested.pathname.startsWith(`/${directory}/`))) {
            res.statusCode = 302
            res.setHeader('Location', new URL(`${requested.pathname}${requested.search}`, contentOrigin).href)
            res.end()
            return
          }
          next()
        })
      }

      // Serve static HTML from public subdirectories (courseware / simcanvas) before SPA fallback
      const serveSubdirectoryIndex = (mountPath: string, rootDir: string) => {
        server.middlewares.use(mountPath, (req, res, next) => {
          const urlPath = req.url?.split('?')[0] ?? ''
          // Match /<mountPath>/<dirname>/ or /<mountPath>/<dirname>
          const dirMatch = urlPath.match(/^\/([^/]+)\/?$/)
          if (dirMatch) {
            const indexPath = path.join(rootDir, dirMatch[1], 'index.html')
            if (fs.existsSync(indexPath)) {
              res.setHeader('Content-Type', 'text/html; charset=utf-8')
              fs.createReadStream(indexPath).pipe(res)
              return
            }
          }
          next()
        })
      }

      serveSubdirectoryIndex('/courseware', path.resolve(projectRoot, 'public/courseware'))
      serveSubdirectoryIndex('/simcanvas', path.resolve(projectRoot, 'public/simcanvas'))

      const onWatchChange = (targetPath: string) => {
        if (shouldRegenerate(targetPath)) {
          scheduleRegenerate()
        }
      }

      server.watcher.on('add', onWatchChange)
      server.watcher.on('change', onWatchChange)
      server.watcher.on('unlink', onWatchChange)
      server.watcher.on('addDir', onWatchChange)
      server.watcher.on('unlinkDir', onWatchChange)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = { ...loadEnv(mode, __dirname, ''), ...process.env }
  const origins = command === 'build' ? accountBuildOrigins(env) : null
  const contentOrigin = env.VITE_CONTENT_BASE_URL?.trim()
  if (command === 'serve' && env.VITE_ACCOUNT_API_URL?.trim() && !contentOrigin) {
    throw new Error('Account-enabled development requires a separate VITE_CONTENT_BASE_URL.')
  }
  if (contentOrigin) {
    const resourceURL = new URL(contentOrigin)
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(resourceURL.hostname)
    if (resourceURL.username || resourceURL.password || resourceURL.search || resourceURL.hash || resourceURL.pathname !== '/'
      || resourceURL.hostname.includes('*') || (resourceURL.protocol !== 'https:' && !(command === 'serve' && resourceURL.protocol === 'http:' && local))) {
      throw new Error('VITE_CONTENT_BASE_URL must be an explicit resource origin.')
    }
    if (env.VITE_ACCOUNT_API_URL?.trim() && new URL(env.VITE_ACCOUNT_API_URL).hostname === resourceURL.hostname) {
      throw new Error('Account resources require a separate hostname from the API; ports do not isolate cookies.')
    }
  }
  const isolation: Plugin = {
    name: 'account-origin-isolation',
    closeBundle() {
      if (origins) isolateAccountBuild(path.resolve(__dirname, 'dist'), origins)
    },
  }
  return {
  plugins: [resourceManifestPlugin(contentOrigin, env.VITE_ACCOUNT_API_URL), react(), tailwindcss(), isolation],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  }
})
