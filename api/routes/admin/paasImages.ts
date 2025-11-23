import { Router, Request, Response } from 'express'
import { authenticateToken, requireAdmin } from '../../middleware/auth.js'
import { UnregistryService } from '../../services/unregistryService.js'

const router = Router()

router.use(authenticateToken)
router.use(requireAdmin)

router.get('/', async (req: Request, res: Response) => {
  try {
    const { host, user, port, keyPath } = req.query
    if (!host || !user) return res.status(400).json({ success: false, images: [], error: 'host and user required' })
    const result = await UnregistryService.listRemoteImages({ remoteHost: String(host), remoteUser: String(user), remotePort: port ? Number(port) : 22, sshKeyPath: keyPath ? String(keyPath) : undefined })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, images: [], error: error.message })
  }
})

router.post('/push', async (req: Request, res: Response) => {
  try {
    const { imageName, imageTag, sshUser, sshHost, sshKeyPath, sshPort } = req.body
    if (!imageName || !imageTag || !sshUser || !sshHost) {
      return res.status(400).json({ success: false, error: 'imageName, imageTag, sshUser, sshHost required' })
    }
    const result = await UnregistryService.pushImagePussh({ imageName, imageTag, sshUser, sshHost, sshKeyPath, sshPort })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
