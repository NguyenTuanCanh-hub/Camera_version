import { Router } from 'express'
import visionRoutes   from './visionRoutes'
import customerRoutes from './customerRoutes'

const router = Router()

router.use('/vision',   visionRoutes)
router.use('/customer', customerRoutes)

export default router
