import { Response } from 'express';
import { Readable } from 'stream';
import StorageService from '../services/storage';
import { AuthRequest } from '../middlewares/auth';

export const uploadFile = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded' });
            return;
        }

        // Convert buffer to stream for StorageService
        const fileStream = Readable.from(req.file.buffer);

        const fileUpload = {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            encoding: req.file.encoding,
            createReadStream: () => fileStream,
        };

        const result = await StorageService.uploadFile(fileUpload);

        if (!result.success) {
            res.status(400).json({ success: false, message: result.message });
            return;
        }

        res.status(200).json({
            success: true,
            message: result.message,
            data: {
                url: result.url,
                fileName: result.fileName,
            },
        });
    } catch (error: any) {
        console.error('REST Upload Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

export const uploadMultipleFiles = async (req: AuthRequest, res: Response) => {
    try {
        if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
            res.status(400).json({ success: false, message: 'No files uploaded' });
            return;
        }

        const files = req.files as Express.Multer.File[];
        const fileUploads = files.map(file => ({
            filename: file.originalname,
            mimetype: file.mimetype,
            encoding: file.encoding,
            createReadStream: () => Readable.from(file.buffer),
        }));

        const results = await StorageService.uploadMultipleFiles(fileUploads);

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        if (failed.length === results.length) {
            res.status(400).json({ success: false, message: 'All file uploads failed' });
            return;
        }

        const data = successful.map(r => ({
            url: r.url,
            fileName: r.fileName,
        }));

        res.status(200).json({
            success: true,
            message: failed.length > 0
                ? `Uploaded ${successful.length} files, ${failed.length} failed`
                : 'All files uploaded successfully',
            data: { files: data },
        });

    } catch (error: any) {
        console.error('REST Multiple Upload Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
