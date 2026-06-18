import { put } from '@vercel/blob';

const isProd = process.env.NODE_ENV === 'production';


export async function uploadFile(file: File, prefix: string): Promise<string> {
    if (!file || file.size === 0) return "";

    const ext = file.name.split('.').pop();
    
    const filename = `${prefix}_${Date.now()}.${ext}`;

    if (isProd) {

        const blob = await put(filename, file, { 
            access: 'public', 
            token: process.env.BLOB_READ_WRITE_TOKEN 
        });
        
        return blob.url; 
        
    } else {

        await Bun.write(`./uploads/${filename}`, file);
        
        const port = process.env.PORT || 8000;
        
        return `http://localhost:${port}/uploads/${filename}`;
    }
}