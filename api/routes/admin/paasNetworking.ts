import { Router, Request, Response } from 'express'
import { authenticateToken, requireAdmin } from '../../middleware/auth.js'
import { UncloudService } from '../../services/uncloudService.js'

const router = Router()

router.use(authenticateToken)
router.use(requireAdmin)

// Get cluster network information
router.get('/', async (req: Request, res: Response) => {
  try {
    const { context } = req.query
    const result = await UncloudService.listMachines(context as string | undefined)
    res.status(result.success ? 200 : 500).json(result)
  } catch (error: any) {
    res.status(500).json({ success: false, machines: [], error: error.message })
  }
})

export default router
