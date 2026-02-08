import { admin } from '../auth';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Initialize Firebase Storage bucket
const bucket = admin.storage().bucket(`${process.env.FIREBASE_STORAGE_BUCKET || ''}`);

export interface UploadResult {
    success: boolean;
    url?: string;
    fileName?: string;
    message: string;
}

export interface FileUpload {
    filename: string;
    mimetype: string;
    encoding: string;
    createReadStream: () => NodeJS.ReadableStream;
}

/**
 * Allowed MIME types for uploads
 */
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'application/pdf',
];

/**
 * Maximum file size in bytes (10MB)
 */
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Upload a file to Firebase Storage
 * @param file - The file upload object from GraphQL
 * @param folder - Optional folder path in storage (default: 'uploads')
 * @returns Upload result with public URL
 */
export async function uploadFile(
    file: FileUpload,
    folder: string = 'uploads'
): Promise<UploadResult> {
    try {
        const { filename, mimetype, createReadStream } = file;

        // Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
            return {
                success: false,
                message: `File type ${mimetype} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
            };
        }

        // Generate unique filename
        const ext = path.extname(filename);
        const uniqueFileName = `${folder}/${uuidv4()}${ext}`;

        // Create file reference in bucket
        const fileRef = bucket.file(uniqueFileName);

        // Create write stream with metadata
        const writeStream = fileRef.createWriteStream({
            metadata: {
                contentType: mimetype,
            },
            resumable: false,
        });

        // Create read stream from uploaded file
        const readStream = createReadStream();

        // Track file size
        let fileSize = 0;

        return new Promise((resolve, reject) => {
            readStream.on('data', (chunk: Buffer) => {
                fileSize += chunk.length;
                if (fileSize > MAX_FILE_SIZE) {
                    (readStream as any).destroy();
                    writeStream.destroy();
                    resolve({
                        success: false,
                        message: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
                    });
                }
            });

            readStream.on('error', (error: Error) => {
                console.error('Read stream error:', error);
                resolve({
                    success: false,
                    message: 'Error reading uploaded file',
                });
            });

            writeStream.on('error', (error: Error) => {
                console.error('Write stream error:', error);
                resolve({
                    success: false,
                    message: 'Error uploading file to storage',
                });
            });

            writeStream.on('finish', async () => {
                try {
                    // Make the file publicly accessible
                    await fileRef.makePublic();

                    // Get public URL
                    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFileName}`;

                    resolve({
                        success: true,
                        url: publicUrl,
                        fileName: uniqueFileName,
                        message: 'File uploaded successfully',
                    });
                } catch (error: any) {
                    console.error('Error making file public:', error);
                    resolve({
                        success: false,
                        message: 'File uploaded but failed to get public URL',
                    });
                }
            });

            // Pipe the read stream to the write stream
            readStream.pipe(writeStream);
        });
    } catch (error: any) {
        console.error('Upload error:', error);
        return {
            success: false,
            message: error.message || 'Failed to upload file',
        };
    }
}

/**
 * Upload multiple files to Firebase Storage
 * @param files - Array of file upload objects
 * @param folder - Optional folder path in storage
 * @returns Array of upload results
 */
export async function uploadMultipleFiles(
    files: FileUpload[],
    folder: string = 'uploads'
): Promise<UploadResult[]> {
    const results = await Promise.all(
        files.map(file => uploadFile(file, folder))
    );
    return results;
}

/**
 * Delete a file from Firebase Storage
 * @param fileName - The file path in storage
 * @returns Success boolean
 */
export async function deleteFile(fileName: string): Promise<boolean> {
    try {
        await bucket.file(fileName).delete();
        return true;
    } catch (error: any) {
        console.error('Delete error:', error);
        return false;
    }
}

export default {
    uploadFile,
    uploadMultipleFiles,
    deleteFile,
};
