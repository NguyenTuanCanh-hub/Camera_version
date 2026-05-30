import { Router } from 'express'
import {
  getGood,
  getGoodStats,
  getNotGood,
  getNotGoodStats,
  getNotGoodImage,
  getAll,
  getAllStats,
  getDeviceActivity,
  getDeviceTypes,
  getLines,
  getDailyTarget,
} from '@/controllers/visionController'
import { getDevices, pingBatch } from '@/controllers/devicesController'

const router = Router()

router.get('/good',              getGood)
router.get('/good/stats',        getGoodStats)
router.get('/notgood/stats',     getNotGoodStats)
router.get('/notgood/image/:id', getNotGoodImage)
router.get('/notgood',           getNotGood)
router.get('/all',               getAll)
router.get('/all/stats',         getAllStats)
router.get('/device-types',      getDeviceTypes)
router.get('/lines',             getLines)
router.get('/devices/activity',  getDeviceActivity)
router.get('/devices',           getDevices)
router.get('/target',            getDailyTarget)
router.post('/ping/batch',       pingBatch)

export default router