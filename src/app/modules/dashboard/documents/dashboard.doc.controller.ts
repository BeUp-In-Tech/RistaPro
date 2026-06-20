/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextFunction, Request, Response } from "express";
import { CatchAsync } from "../../../utils/CatchAsync";
import { SendResponse } from "../../../utils/SendResponse";
import { StatusCodes } from "http-status-codes";
import { dashboardDocuments } from "./dashboard.doc.service";
import { JwtPayload } from "jsonwebtoken";

const readCandidatesDocuments = CatchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const query = req.query as Record<string, string>;
    const user = req.user as JwtPayload;
    const result = await dashboardDocuments.readCandidatesDocuments(user, query);

    // HTTP CACHE CONTROL
    res.setHeader('Cache-Control', 'no-store');

    SendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Documents retrieved successfully",
        data: result
    })
});

const readCandidateDocuments = CatchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as JwtPayload;
    const candidateId = req.params.candidateId as string;
    const result = await dashboardDocuments.readCandidateDocuments(user,  candidateId);

    // HTTP CACHE CONTROL
    res.setHeader('Cache-Control', 'no-store');

    SendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Document retrieved successfully",
        data: result
    })
});


const viewDocument = CatchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const documentId = req.params.documentId as string;
    const result = await dashboardDocuments.viewDocument(documentId);

    // HTTP CACHE CONTROL
    res.setHeader('Cache-Control', 'no-store');

    SendResponse(res, {
        success: true,
        statusCode: StatusCodes.OK,
        message: "Document retrieved successfully",
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
    readCandidatesDocuments,
    readCandidateDocuments,
    approveDocument,
    rejectDocument,
    viewDocument
}