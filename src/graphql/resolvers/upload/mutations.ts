import ClientResponse from '../../../services/response';
import UploadService from '../../services/upload';
import authenticatedRequest from '../../authenticatedRequest';

const uploadMutations = {
    /**
     * Upload a single file (authenticated)
     */
    uploadFile: authenticatedRequest(
        async (
            _: any,
            { file, folder }: { file: any; folder?: string },
            context: any
        ) => {
            try {
                return await UploadService.uploadFile(file, folder);
            } catch (err: any) {
                return new ClientResponse(500, false, err.message, null);
            }
        }
    ),

    /**
     * Upload multiple files (authenticated)
     */
    uploadMultipleFiles: authenticatedRequest(
        async (
            _: any,
            { files, folder }: { files: any[]; folder?: string },
            context: any
        ) => {
            try {
                return await UploadService.uploadMultipleFiles(files, folder);
            } catch (err: any) {
                return new ClientResponse(500, false, err.message, null);
            }
        }
    ),

    /**
     * Delete a file (authenticated)
     */
    deleteFile: authenticatedRequest(
        async (
            _: any,
            { fileName }: { fileName: string },
            context: any
        ) => {
            try {
                return await UploadService.deleteFile(fileName);
            } catch (err: any) {
                return new ClientResponse(500, false, err.message, null);
            }
        }
    ),
};

export default uploadMutations;
