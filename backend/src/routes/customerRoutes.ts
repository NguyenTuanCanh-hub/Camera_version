import { Router } from 'express'
import multer from 'multer'
import { getCustomer, getCustomerStats, importCustomer, clearCustomer, uploadCustomer, getCustomerDepNames } from '@/controllers/customerController'

const router  = Router()
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } })

router.get('/depnames',         getCustomerDepNames)
router.get('/stats',            getCustomerStats)
router.get('/',                 getCustomer)
router.post('/upload',          upload.single('file'), uploadCustomer)
router.post('/import',          importCustomer)
router.delete('/clear',         clearCustomer)

export default router
