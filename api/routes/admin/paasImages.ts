import { Router, Request, Response } from 'express'
import { authenticateToken } from '../../middleware/auth.js'
import { requireAdmin } from '../../middleware/auth.js'
import type { AuthenticatedRequest } from '../../middleware/auth.js'
import { UnregistryService } from '../../services/unregistryService.js'
import { PaaSWorkerService } from '../../services/paasWorkerService.js'
import { logActivity } from '../../services/activityLogger.js'

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

router.get('/workers/:workerId', async (req: Request, res: Response) => {
  try {
    const worker = await PaaSWorkerService.getWorkerById(req.params.workerId)
    if (!worker) {
      return res.status(404).json({ success: false, images: [], error: 'Worker not found' })
    }

    const result = await UnregistryService.listRemoteImages({
      remoteHost: worker.hostIp,
      remoteUser: worker.sshUser,
      remotePort: worker.sshPort,
      sshKeyPath: worker.sshKeyPath,
    })

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

router.delete('/workers/:workerId', async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest
    const worker = await PaaSWorkerService.getWorkerById(req.params.workerId)

    if (!worker) {
      return res.status(404).json({ success: false, error: 'Worker not found' })
    }

    const rawImage = (req.query.image as string | undefined)?.trim() || ''
    if (!rawImage) {
      return res.status(400).json({ success: false, error: 'image query parameter is required' })
    }

    const lastColon = rawImage.lastIndexOf(':')
    if (lastColon <= 0 || lastColon === rawImage.length - 1) {
      return res.status(400).json({ success: false, error: 'image must be in the form repository:tag' })
    }

    const imageName = rawImage.slice(0, lastColon)
    const imageTag = rawImage.slice(lastColon + 1)

    const result = await UnregistryService.removeRemoteImage(
      {
        remoteHost: worker.hostIp,
        remoteUser: worker.sshUser,
        remotePort: worker.sshPort,
        sshKeyPath: worker.sshKeyPath,
      },
      imageName,
      imageTag
    )

    if (!result.success) {
      return res.status(500).json({ success: false, error: result.error || 'Failed to remove image' })
    }

    if (authReq.user?.id) {
      await logActivity(
        {
          userId: authReq.user.id,
          organizationId: authReq.user.organizationId ?? null,
          eventType: 'paas_image_delete',
          entityType: 'paas_worker_image',
          entityId: `${worker.id}:${imageName}:${imageTag}`,
          message: `Removed image ${imageName}:${imageTag} from worker ${worker.name}`,
          status: 'success',
          metadata: {
            workerId: worker.id,
            workerName: worker.name,
            imageName,
            imageTag,
          },
        },
        authReq as any
      )
    }

    res.json({ success: true })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
