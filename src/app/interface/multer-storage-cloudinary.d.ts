/* eslint-disable @typescript-eslint/no-explicit-any */
// Minimal type declarations for `multer-storage-cloudinary` so TS won't error
// Adjust/expand these types if you need more precise typings later.
import { StorageEngine } from 'multer';

declare module 'multer-storage-cloudinary' {
  interface CloudinaryStorageOptions {
    cloudinary?: any;
    params?: any;
  }

  function CloudinaryStorage(options?: CloudinaryStorageOptions): StorageEngine;

  export = CloudinaryStorage;
}
