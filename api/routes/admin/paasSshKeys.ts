import { Router, Request, Response } from 'express'
import { authenticateToken, requireAdmin } from '../../middleware/auth.js'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'

const execAsync = promisify(exec)
const router = Router()

router.use(authenticateToken)
router.use(requireAdmin)

// Storage for SSH key metadata (in production, this should be in database)
const SSH_KEYS_DIR = '/root/.ssh/paas_keys'
const SSH_KEYS_METADATA_FILE = '/root/.ssh/paas_keys_metadata.json'

interface SshKeyMetadata {
  id: string
  name: string
  publicKey: string
  keyPath: string
  fingerprint: string
  usedByWorkers: number
  createdAt: string
}

// Ensure SSH keys directory exists
async function ensureSshKeysDir() {
  try {
    await fs.mkdir(SSH_KEYS_DIR, { recursive: true, mode: 0o700 })
  } catch (error) {
    console.error('Failed to create SSH keys directory:', error)
  }
}

// Load metadata
async function loadMetadata(): Promise<SshKeyMetadata[]> {
  try {
    const data = await fs.readFile(SSH_KEYS_METADATA_FILE, 'utf-8')
    return JSON.parse(data)
  } catch {
    return []
  }
}

// Save metadata
async function saveMetadata(keys: SshKeyMetadata[]) {
  await fs.writeFile(SSH_KEYS_METADATA_FILE, JSON.stringify(keys, null, 2), { mode: 0o600 })
}

// GET /api/admin/paas/ssh-keys - List all SSH keys
router.get('/', async (req: Request, res: Response) => {
  try {
    const keys = await loadMetadata()
    res.json({ success: true, keys })
  } catch (error: any) {
    console.error('Failed to list SSH keys:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// POST /api/admin/paas/ssh-keys/generate - Generate new SSH key pair
router.post('/generate', async (req: Request, res: Response) => {
  try {
    await ensureSshKeysDir()
    
    const { name } = req.body
    const keyName = name || `paas-worker-${Date.now()}`
    const keyId = `key-${Date.now()}`
    const keyPath = path.join(SSH_KEYS_DIR, keyId)
    
    // Generate ED25519 key pair
    await execAsync(`ssh-keygen -t ed25519 -f ${keyPath} -N "" -C "${keyName}"`)
    
    // Read public key
    const publicKey = (await fs.readFile(`${keyPath}.pub`, 'utf-8')).trim()
    
    // Get fingerprint
    const { stdout: fingerprintOutput } = await execAsync(`ssh-keygen -lf ${keyPath}.pub`)
    const fingerprint = fingerprintOutput.split(' ')[1] || 'unknown'
    
    // Save metadata
    const metadata: SshKeyMetadata = {
      id: keyId,
      name: keyName,
      publicKey,
      keyPath,
      fingerprint,
      usedByWorkers: 0,
      createdAt: new Date().toISOString()
    }
    
    const keys = await loadMetadata()
    keys.push(metadata)
    await saveMetadata(keys)
    
    res.json({ success: true, key: metadata })
  } catch (error: any) {
    console.error('Failed to generate SSH key:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// DELETE /api/admin/paas/ssh-keys/:id - Delete SSH key
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const keys = await loadMetadata()
    const keyIndex = keys.findIndex(k => k.id === id)
    
    if (keyIndex === -1) {
      return res.status(404).json({ success: false, error: 'Key not found' })
    }
    
    const key = keys[keyIndex]
    
    // Check if key is in use
    if (key.usedByWorkers > 0) {
      return res.status(400).json({ 
        success: false, 
        error: `Key is in use by ${key.usedByWorkers} worker(s)` 
      })
    }
    
    // Delete key files
    try {
      await fs.unlink(key.keyPath)
      await fs.unlink(`${key.keyPath}.pub`)
    } catch (error) {
      console.warn('Failed to delete key files:', error)
    }
    
    // Remove from metadata
    keys.splice(keyIndex, 1)
    await saveMetadata(keys)
    
    res.json({ success: true })
  } catch (error: any) {
    console.error('Failed to delete SSH key:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
