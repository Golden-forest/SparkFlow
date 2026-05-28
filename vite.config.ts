import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'path'
import { generateResourceManifest } from './scripts/resource-manifest'

function resourceManifestPlugin(): Plugin {
  const projectRoot = __dirname
  const watchRoots = [
    path.resolve(projectRoot, 'public/images'),
    path.resolve(projectRoot, 'public/courseware'),
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

      // Serve static HTML from public/courseware subdirectories before SPA fallback
      server.middlewares.use('/courseware', (req, res, next) => {
        const coursewareRoot = path.resolve(projectRoot, 'public/courseware')
        const urlPath = req.url?.split('?')[0] ?? ''
        // Match /courseware/<dirname>/ or /courseware/<dirname>
        const dirMatch = urlPath.match(/^\/([^/]+)\/?$/)
        if (dirMatch) {
          const indexPath = path.join(coursewareRoot, dirMatch[1], 'index.html')
          if (fs.existsSync(indexPath)) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            fs.createReadStream(indexPath).pipe(res)
            return
          }
        }
        next()
      })

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
export default defineConfig({
  plugins: [resourceManifestPlugin(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
