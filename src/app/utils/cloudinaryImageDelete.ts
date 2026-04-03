/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { deleteImageFromCLoudinary } from "../config/cloudinary.config"


export const asyncMultipleImageDelete = async (images: string[]) => {
    setImmediate(async () =>  {
        for (const image of images) {
            try {
                await deleteImageFromCLoudinary(image);
            } catch (error: any) {
                console.log("Cloudinary image delete error: ", error.message);
            }
        }
    })
}