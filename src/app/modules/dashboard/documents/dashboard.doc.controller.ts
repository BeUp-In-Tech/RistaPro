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


const approveDocument = CatchAsync(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const result = await dashboardDocuments.approveDocument(String(documentId));

  SendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Document approved successfully',
    data: result,
  });
});

const rejectDocument = CatchAsync(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const { rejected_reason } = req.body;
  const result = await dashboardDocuments.rejectDocument(
    String(documentId),
    rejected_reason
  );

  SendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: 'Document rejected successfully',
    data: result,
  });
});


export const dashboardDocumentsController = {
    readDocuments,
    approveDocument,
    rejectDocument
}