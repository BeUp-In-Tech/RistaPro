import AppError from '../../errorHelpers/AppError';
import Candidate from '../candidate/candidate.model';
import {
  IVerificationStatus,
  VerificationState,
} from '../candidate/candidate.interface';
import DocumentModel from './document.model';
import {
  DocumentType,
  DocumentVerification,
  IDocumentFile,
} from './document.interface';
import { StatusCodes } from 'http-status-codes';
import { JwtPayload } from 'jsonwebtoken';

// FACE VERIFY
const verifyFace = async (candidateId: string, isFaceVerified: boolean) => {
  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate not found');
  }

  if (
    candidate.verification_status?.face_verified?.status ===
    VerificationState.APPROVED
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Face verification is already approved'
    );
  }

  // Ensure verification_status object exists
  if (!candidate.verification_status) {
    candidate.verification_status = {
      face_verified: { status: VerificationState.NONE },
      id_verified: { status: VerificationState.NONE },
      parent_verified: { status: VerificationState.NONE },
      education_verified: { status: VerificationState.NONE },
      admin_verified: { status: VerificationState.NONE },
    };
  }
  const verificationStatus =
    candidate.verification_status as IVerificationStatus;

  const faceVerificationResult = {
    status: isFaceVerified
      ? VerificationState.APPROVED
      : VerificationState.REJECTED,
    date: new Date(),
    success: isFaceVerified,
  };

  verificationStatus.face_verified = faceVerificationResult;
  candidate.face_verify_logs = [
    ...(candidate.face_verify_logs ?? []),
    faceVerificationResult,
  ];

  await candidate.save();

  return {
    candidate: candidate._id,
    face_verified: verificationStatus.face_verified,
  };
};

// UPLOAD DOCUMENT
const uploadDocument = async (
  candidateId: string,
  type: DocumentType,
  documents: IDocumentFile[]
) => {
  if (type !== DocumentType.ID && type !== DocumentType.EDUCATION) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Only ID and education documents can be uploaded here'
    );
  }

  if (!documents.length) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Document files are required');
  }

  if (
    type === DocumentType.EDUCATION &&
    documents.some((document) => !document.title?.trim())
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Each education certificate must have a title'
    );
  }

  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate not found');
  }

  if (
    (type === DocumentType.ID &&
      candidate.verification_status?.id_verified?.status ===
        VerificationState.APPROVED) ||
    (type === DocumentType.EDUCATION &&
      candidate.verification_status?.education_verified?.status ===
        VerificationState.APPROVED)
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `${type} document is already approved`
    );
  }

  const approvedDocument = await DocumentModel.findOne({
    candidate: candidateId,
    type,
    verification_status: DocumentVerification.APPROVED,
  });

  if (approvedDocument) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `${type} document is already approved`
    );
  }

  await DocumentModel.updateMany(
    {
      candidate: candidateId,
      type,
      verification_status: DocumentVerification.PENDING,
    },
    {
      $set: {
        verification_status: DocumentVerification.REJECTED,
        rejected_reason: 'Replaced by a new upload',
      },
    }
  );

  const document = await DocumentModel.create({
    candidate: candidateId,
    type,
    document: documents[0].file,
    documents: documents.map((document) => ({
      file: document.file,
      ...(document.title?.trim() && { title: document.title.trim() }),
    })),
    verification_status: DocumentVerification.PENDING,
  });

  // Ensure verification_status object exists
  if (!candidate.verification_status) {
    candidate.verification_status = {
      face_verified: { status: VerificationState.NONE },
      id_verified: { status: VerificationState.NONE },
      parent_verified: { status: VerificationState.NONE },
      education_verified: { status: VerificationState.NONE },
      admin_verified: { status: VerificationState.NONE },
    };
  }
  const verificationStatus =
    candidate.verification_status as IVerificationStatus;

  // Update specific verification status to pending based on type
  if (type === DocumentType.ID) {
    verificationStatus.id_verified = {
      status: VerificationState.PENDING,
      date: new Date(),
    };
  } else if (type === DocumentType.EDUCATION) {
    verificationStatus.education_verified = {
      status: VerificationState.PENDING,
      date: new Date(),
    };
  }

  await candidate.save();

  return document;
};

// UPLOAD PARENT PHOTO
const uploadParentPhoto = async (candidateId: string, photoUrl: string) => {
  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate not found');
  }

  if (
    candidate.verification_status?.parent_verified?.status ===
    VerificationState.APPROVED
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Parent verification is already approved'
    );
  }

  const approvedParentPhoto = await DocumentModel.findOne({
    candidate: candidateId,
    type: DocumentType.PARENT_PHOTO,
    verification_status: DocumentVerification.APPROVED,
  });

  if (approvedParentPhoto) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Parent photo is already face verified'
    );
  }

  await DocumentModel.updateMany(
    {
      candidate: candidateId,
      type: DocumentType.PARENT_PHOTO,
      verification_status: DocumentVerification.PENDING,
    },
    {
      $set: {
        verification_status: DocumentVerification.REJECTED,
        rejected_reason: 'Replaced by a new parent photo',
      },
    }
  );

  const document = await DocumentModel.create({
    candidate: candidateId,
    type: DocumentType.PARENT_PHOTO,
    document: photoUrl,
    documents: [{ file: photoUrl, title: 'Parent photo' }],
    verification_status: DocumentVerification.PENDING,
  });

  if (!candidate.verification_status) {
    candidate.verification_status = {
      face_verified: { status: VerificationState.NONE },
      id_verified: { status: VerificationState.NONE },
      parent_verified: { status: VerificationState.NONE },
      education_verified: { status: VerificationState.NONE },
      admin_verified: { status: VerificationState.NONE },
    };
  }
  const verificationStatus =
    candidate.verification_status as IVerificationStatus;

  verificationStatus.parent_verified = {
    status: VerificationState.PENDING,
    date: new Date(),
  };

  await candidate.save();

  return document;
};


// UPLOAD PARENT ID DOCUMENT
const uploadParentIdDocument = async (
  candidateId: string,
  documents: IDocumentFile[]
) => {
  if (!documents.length) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Parent ID card files are required'
    );
  }

  const candidate = await Candidate.findById(candidateId);
  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate not found');
  }

  if (
    candidate.verification_status?.parent_verified?.status ===
    VerificationState.APPROVED
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Parent verification is already approved'
    );
  }

  const approvedParentId = await DocumentModel.findOne({
    candidate: candidateId,
    type: DocumentType.PARENT_ID,
    verification_status: DocumentVerification.APPROVED,
  });

  if (approvedParentId) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Parent ID card is already approved'
    );
  }

  await DocumentModel.updateMany(
    {
      candidate: candidateId,
      type: DocumentType.PARENT_ID,
      verification_status: DocumentVerification.PENDING,
    },
    {
      $set: {
        verification_status: DocumentVerification.REJECTED,
        rejected_reason: 'Replaced by a new parent ID upload',
      },
    }
  );

  const document = await DocumentModel.create({
    candidate: candidateId,
    type: DocumentType.PARENT_ID,
    document: documents[0].file,
    documents: documents.map((document) => ({
      file: document.file,
      ...(document.title?.trim() && { title: document.title.trim() }),
    })),
    verification_status: DocumentVerification.PENDING,
  });

  if (!candidate.verification_status) {
    candidate.verification_status = {
      face_verified: { status: VerificationState.NONE },
      id_verified: { status: VerificationState.NONE },
      parent_verified: { status: VerificationState.NONE },
      education_verified: { status: VerificationState.NONE },
      admin_verified: { status: VerificationState.NONE },
    };
  }
  const verificationStatus =
    candidate.verification_status as IVerificationStatus;

  verificationStatus.parent_verified = {
    status: VerificationState.PENDING,
    date: new Date(),
  };

  await candidate.save();

  return document;
};



// READ CANDIDATE DOCUMENTS
const getCandidateDocuments = async (candidateId: string, user: JwtPayload) => {

  const candidate = await Candidate.findOne({user: user.userId }).select("user");

  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, "Candidate profile not found");
  }

  if (candidate?._id.toString() !== candidateId) {
    throw new AppError(StatusCodes.FORBIDDEN, "You are not permitted to access");
  }

  const documents = await DocumentModel.find({ candidate: candidateId }).sort({
    createdAt: -1,
  });
  
  return documents;
};

export const DocumentService = {
  verifyFace,
  uploadDocument,
  uploadParentPhoto,
  uploadParentIdDocument,
  getCandidateDocuments,
};
