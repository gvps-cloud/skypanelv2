import { Router, Request, Response } from 'express'
import { authenticateToken, requireAdmin } from '../../middleware/auth.js'
import { UncloudService } from '../../services/uncloudService.js'
import { query } from '../../lib/database.js'

const router = Router()

router.use(authenticateToken)
router.use(requireAdmin)

router.get('/', async (req: Request, res: Response) => {
  try {
    const { context } = req.query
    const services = await UncloudService.listServices(context as string | undefined)
    res.json({ success: true, services })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:name', async (req: Request, res: Response) => {
  try {
    const { context } = req.query
    const result = await UncloudService.serviceInspect({ serviceName: req.params.name, context: context as string | undefined })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, output: '', error: error.message })
  }
})

router.post('/:name/scale', async (req: Request, res: Response) => {
  try {
    const { replicas, context } = req.body
    if (typeof replicas !== 'number' || replicas < 0) {
      return res.status(400).json({ success: false, output: '', error: 'replicas must be a non-negative number' })
    }
    const result = await UncloudService.serviceScale({ serviceName: req.params.name, replicas, context })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, output: '', error: error.message })
  }
})

router.delete('/:name', async (req: Request, res: Response) => {
  try {
    const { context } = req.query.context ? req.query : req.body;
    const result = await UncloudService.removeService({ serviceName: req.params.name, context: context as string | undefined })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, output: '', error: error.message })
  }
})

router.post('/:name/exec', async (req: Request, res: Response) => {
  try {
    const { cmd, context } = req.body
    if (!cmd) {
      return res.status(400).json({ success: false, output: '', error: 'cmd required' })
    }
    const result = await UncloudService.serviceExec({ serviceName: req.params.name, cmd, context })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, output: '', error: error.message })
  }
})

router.get('/:name/logs', async (req: Request, res: Response) => {
  try {
    const { context, lines } = req.query
    const result = await UncloudService.getServiceLogs({ serviceName: req.params.name, lines: Number(lines) || 100, context: context as string | undefined })
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, logs: '', error: error.message })
  }
})

export default router
