import ClientResponse from '../../../services/response';
import StorageService, { FileUpload } from '../../../services/storage';

export default class UploadService {
    /**
     * Upload a single file
     */
    static async uploadFile(file: Promise<FileUpload>, folder?: string) {
        try {
            const resolvedFile = await file;
            const result = await StorageService.uploadFile(resolvedFile, folder);

            if (!result.success) {
                return new ClientResponse(400, false, result.message, null);
            }

            return new ClientResponse(200, true, result.message, {
                url: result.url,
                fileName: result.fileName,
            });
        } catch (error: any) {
            console.error('Upload service error:', error);
            return new ClientResponse(500, false, error.message || 'Failed to upload file', null);
        }
    }

    /**
     * Upload multiple files
     */
    static async uploadMultipleFiles(files: Promise<FileUpload>[], folder?: string) {
        try {
            const resolvedFiles = await Promise.all(files);
            const results = await StorageService.uploadMultipleFiles(resolvedFiles, folder);

            const successfulUploads = results.filter(r => r.success);
            const failedUploads = results.filter(r => !r.success);

            if (failedUploads.length === results.length) {
                return new ClientResponse(400, false, 'All file uploads failed', null);
            }

            const uploadedFiles = successfulUploads.map(r => ({
                url: r.url,
                fileName: r.fileName,
            }));

            const message = failedUploads.length > 0
                ? `${successfulUploads.length} files uploaded, ${failedUploads.length} failed`
                : 'All files uploaded successfully';

            return new ClientResponse(200, true, message, { files: uploadedFiles });
        } catch (error: any) {
            console.error('Multiple upload service error:', error);
            return new ClientResponse(500, false, error.message || 'Failed to upload files', null);
        }
    }

    /**
     * Delete a file
     */
    static async deleteFile(fileName: string) {
        try {
            const success = await StorageService.deleteFile(fileName);

            if (!success) {
                return new ClientResponse(400, false, 'Failed to delete file', null);
            }

            return new ClientResponse(200, true, 'File deleted successfully', null);
        } catch (error: any) {
            console.error('Delete service error:', error);
            return new ClientResponse(500, false, error.message || 'Failed to delete file', null);
        }
    }
}
