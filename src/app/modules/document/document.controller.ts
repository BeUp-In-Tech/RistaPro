import { Request, Response } from 'express';
import { DocumentService } from './document.service';
import { CatchAsync } from '../../utils/CatchAsync';
import { StatusCodes } from 'http-status-codes';
import { SendResponse } from '../../utils/SendResponse';
import AppError from '../../errorHelpers/AppError';

const verifyFace = CatchAsync(async (req: Request, res: Response) => {
  const { candidateId, isFaceVerified } = req.body;

  const result = await DocumentService.verifyFace(candidateId, isFaceVerified);

  SendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: isFaceVerified
      ? 'Face verified successfully'
      : 'Face verification failed',
    data: result,
  });
});

const uploadDocument = CatchAsync(async (req: Request, res: Response) => {
  const { candidateId, title, titles, type } = req.body;
  const uploadedDocuments = Array.isArray(req.files)
    ? req.files.map((file, index) => ({
        file: file.path,
        title: titles?.[index] ?? (index === 0 ? title : undefined),
      }))
    : [];

  if (!uploadedDocuments.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Document files are required');
  }

  const result = await DocumentService.uploadDocument(
    candidateId,
    type,
    uploadedDocuments
  );

  SendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Document uploaded successfully',
    data: result,
  });
});

const uploadParentPhoto = CatchAsync(async (req: Request, res: Response) => {
  const { candidateId } = req.body;

  if (!req.file?.path) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Parent photo is required');
  }

  const result = await DocumentService.uploadParentPhoto(
    candidateId,
    req.file.path
  );

  SendResponse(res, {
    statusCode: StatusCodes.CREATED,
    success: true,
    message: 'Parent photo uploaded successfully',
    data: result,
  });
});

const verifyParentFace = CatchAsync(async (req: Request, res: Response) => {
  const { candidateId, isFaceVerified } = req.body;

  const result = await DocumentService.verifyParentFace(
    candidateId,
    isFaceVerified
  );

  SendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: isFaceVerified
      ? 'Parent face verified successfully'
      : 'Parent face verification failed',
    data: result,
  });
});

const uploadParentIdDocument = CatchAsync(
  async (req: Request, res: Response) => {
    const { candidateId, title, titles } = req.body;
    const uploadedDocuments = Array.isArray(req.files)
      ? req.files.map((file, index) => ({
          file: file.path,
          title: titles?.[index] ?? (index === 0 ? title : undefined),
        }))
      : [];

    if (!uploadedDocuments.length) {
      throw new AppError(
        StatusCodes.BAD_REQUEST,
        'Parent ID card files are required'
      );
    }

    const result = await DocumentService.uploadParentIdDocument(
      candidateId,
      uploadedDocuments
    );

    SendResponse(res, {
      statusCode: StatusCodes.CREATED,
      success: true,
      message: 'Parent ID card uploaded successfully',
      data: result,
    });
  }
);

const approveDocument = CatchAsync(async (req: Request, res: Response) => {
  const { documentId } = req.params;
  const result = await DocumentService.approveDocument(String(documentId));

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
  const result = await DocumentService.rejectDocument(
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

const getCandidateDocuments = CatchAsync(
  async (req: Request, res: Response) => {
    const { candidateId } = req.params;
    const result = await DocumentService.getCandidateDocuments(
      candidateId as string
    );

    SendResponse(res, {
      statusCode: StatusCodes.OK,
      success: true,
      message: 'Documents retrieved successfully',
      data: result,
    });
  }
);

export const DocumentController = {
  verifyFace,
  uploadDocument,
  uploadParentPhoto,
  verifyParentFace,
  uploadParentIdDocument,
  approveDocument,
  rejectDocument,
  getCandidateDocuments,
};
