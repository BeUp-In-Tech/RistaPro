/* eslint-disable @typescript-eslint/no-explicit-any */
import multer from 'multer';
import { Request } from 'express';
import { cloudinaryUpload } from './cloudinary.config';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const storage = new CloudinaryStorage({
  cloudinary: cloudinaryUpload,
  params: {
    folder: 'RistaPro',
    public_id: (req: Request, file: Express.Multer.File) => {
      const fileName = file.originalname
        .toLowerCase()
        .replace(/\s+/g, '-') // replace spaces with dash
        // eslint-disable-next-line no-useless-escape
        .replace(/[^a-z0-9\-\.]/g, '') // remove unwanted chars
        .replace(/\.[^/.]+$/, ''); // remove the extension

      const uniqueFileName =
        Math.random().toString(15).substring(2) +
        '-' +
        Date.now() +
        '-' +
        fileName;

      return uniqueFileName;
    }
  } as any,
});

export const multerUpload = multer({ storage: storage });
