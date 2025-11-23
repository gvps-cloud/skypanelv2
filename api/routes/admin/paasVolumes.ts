import { Router, Request, Response } from 'express'
import { authenticateToken, requireAdmin } from '../../middleware/auth.js'
import { UncloudService } from '../../services/uncloudService.js'

const router = Router()

router.use(authenticateToken)
router.use(requireAdmin)

router.get('/', async (req: Request, res: Response) => {
  try {
    const { context } = req.query
    const result = await UncloudService.listVolumes(context as string | undefined)
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, volumes: [], error: error.message })
  }
})

router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { context } = req.query
    const result = await UncloudService.inspectVolume({ volumeName: req.params.name, context: context as string | undefined })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, output: '', error: error.message })
  }
})

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, context } = req.body
    if (!name) return res.status(400).json({ success: false, output: '', error: 'name required' })
    const result = await UncloudService.createVolume({ volumeName: name, context })
    res.status(result.success ? 201 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, output: '', error: error.message })
  }
})

router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const { context } = req.query
    const result = await UncloudService.removeVolume({ volumeName: req.params.name, context: context as string | undefined })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, output: '', error: error.message })
  }
})

export default router
