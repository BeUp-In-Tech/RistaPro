/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextFunction, Request, Response } from "express";
import { CatchAsync } from "../../../utils/CatchAsync";
import { SendResponse } from "../../../utils/SendResponse";
import { StatusCodes } from "http-status-codes";
import { dashboardDocuments } from "./dashboard.doc.service";
import { JwtPayload } from "jsonwebtoken";

const readDocuments = CatchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query as Record<string, string>;
    const user = req.user as JwtPayload;
    const result = await dashboardDocuments.readDocuments(user, query);

    SendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Documents retrieved successfully",
        data: result
    })
});


export const dashboardDocumentsController = {
    readDocuments
}