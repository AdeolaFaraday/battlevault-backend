import express from 'express';
import multer from 'multer';
import { isAuthenticated } from '../middlewares/auth';
import { uploadFile, uploadMultipleFiles } from '../controllers/upload';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
    },
});

router.post('/upload', isAuthenticated, upload.single('file'), uploadFile);
router.post('/upload/multiple', isAuthenticated, upload.array('files', 10), uploadMultipleFiles);

export default router;
