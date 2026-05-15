/* eslint-disable @typescript-eslint/no-explicit-any */
import multer from 'multer';
import { Request } from 'express';
import { cloudinaryUpload } from './cloudinary.config';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import AppError from '../errorHelpers/AppError';
import { StatusCodes } from 'http-status-codes';

const storage = new CloudinaryStorage({
  cloudinary: cloudinaryUpload,
  params: {
    folder: 'RistaPro',
    resource_type: 'auto',
    public_id: (_req: Request, file: Express.Multer.File) => {
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
    },
  } as any,
});

export const multerUpload = multer({ storage: storage });

export const documentMulterUpload = multer({
  storage: storage,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'application/pdf' ||
      file.mimetype.startsWith('image/')
    ) {
      cb(null, true);
      return;
    }

    cb(
      new AppError(
        StatusCodes.BAD_REQUEST,
        'Only PDF or image documents are allowed'
      )
    );
  },
});

export const imageMulterUpload = multer({
  storage: storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
      return;
    }

    cb(new AppError(StatusCodes.BAD_REQUEST, 'Only image files are allowed'));
  },
});
