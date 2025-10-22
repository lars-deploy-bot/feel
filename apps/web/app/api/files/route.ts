import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { readdir, stat } from 'fs/promises'
import path from 'node:path'
import { getWorkspace } from '../claude/workspaceRetriever'

interface FileInfo {
  name: string
  type: 'file' | 'directory'
  size: number
  modified: string
  path: string
}

export async function POST(request: NextRequest) {
  try {
    const jar = await cookies()
    if (!jar.get('session')) {
      return NextResponse.json({ error: 'no_session' }, { status: 401 })
    }

    const body = await request.json()
    const host = request.headers.get('host') || 'localhost'
    const requestId = Math.random().toString(36).substring(7)

    const workspaceResult = getWorkspace({ host, body, requestId })
    if (!workspaceResult.success) {
      return workspaceResult.response
    }

    const targetPath = body.path || ''
    const fullPath = path.join(workspaceResult.workspace, targetPath)

    // Security check: ensure path is within workspace
    const resolvedPath = path.resolve(fullPath)
    const resolvedWorkspace = path.resolve(workspaceResult.workspace)
    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      return NextResponse.json({ error: 'path_outside_workspace' }, { status: 403 })
    }

    try {
      const entries = await readdir(fullPath, { withFileTypes: true })
      const files: FileInfo[] = []

      for (const entry of entries) {
        const entryPath = path.join(fullPath, entry.name)
        const stats = await stat(entryPath)

        files.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime.toISOString(),
          path: path.join(targetPath, entry.name)
        })
      }

      // Sort: directories first, then files, alphabetically
      files.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })

      return NextResponse.json({
        ok: true,
        path: targetPath,
        workspace: workspaceResult.workspace,
        files
      })

    } catch (fsError) {
      console.error(`[Files ${requestId}] Error reading directory:`, fsError)
      return NextResponse.json({
        error: 'read_error',
        message: 'Unable to read directory'
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Files API error:', error)
    return NextResponse.json({
      error: 'server_error',
      message: 'Internal server error'
    }, { status: 500 })
  }
}