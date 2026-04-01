/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-console */
import { deleteImageFromCLoudinary } from "../config/cloudinary.config"


export const asyncMultipleImageDelete = async (images: string[]) => {
    setImmediate(async () =>  {
        try {
             images.forEach(async (iamge) => {
                await deleteImageFromCLoudinary(iamge);
             })
        } catch (error: any) {
            console.log("Cloudinary image delete error: ", error.message);
        }
    })
}