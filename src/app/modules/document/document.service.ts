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

// VERIFY PARENT FACE
const verifyParentFace = async (
  candidateId: string,
  isFaceVerified: boolean
) => {
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

  const parentPhoto = await DocumentModel.findOne({
    candidate: candidateId,
    type: DocumentType.PARENT_PHOTO,
    verification_status: DocumentVerification.PENDING,
  }).sort({ createdAt: -1 });

  if (!parentPhoto) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Parent photo upload is required before face verification'
    );
  }

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

  parentPhoto.verification_status = isFaceVerified
    ? DocumentVerification.APPROVED
    : DocumentVerification.REJECTED;
  parentPhoto.rejected_reason = isFaceVerified
    ? undefined
    : 'Parent face verification failed';

  const approvedParentId = await DocumentModel.findOne({
    candidate: candidateId,
    type: DocumentType.PARENT_ID,
    verification_status: DocumentVerification.APPROVED,
  });

  if (!isFaceVerified) {
    verificationStatus.parent_verified = {
      status: VerificationState.REJECTED,
      date: new Date(),
      success: false,
    };
  } else if (approvedParentId) {
    verificationStatus.parent_verified = {
      status: VerificationState.APPROVED,
      date: new Date(),
      success: true,
    };
  } else {
    verificationStatus.parent_verified = {
      status: VerificationState.PENDING,
      date: new Date(),
    };
  }

  await Promise.all([parentPhoto.save(), candidate.save()]);

  return {
    candidate: candidate._id,
    parent_verified: verificationStatus.parent_verified,
    parent_photo: parentPhoto,
  };
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

// APPROVE DOCUMENT
const approveDocument = async (documentId: string) => {
  const document = await DocumentModel.findById(documentId);
  if (!document) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Document not found');
  }

  if (
    document.type !== DocumentType.ID &&
    document.type !== DocumentType.EDUCATION &&
    document.type !== DocumentType.PARENT_ID
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Only ID, education, and parent ID documents can be reviewed here'
    );
  }

  if (document.verification_status === DocumentVerification.APPROVED) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Document is already approved');
  }

  if (document.verification_status !== DocumentVerification.PENDING) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Only pending documents can be approved'
    );
  }

  const candidate = await Candidate.findById(document.candidate);
  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate not found');
  }

  const approvedDocument = await DocumentModel.findOne({
    _id: { $ne: document._id },
    candidate: document.candidate,
    type: document.type,
    verification_status: DocumentVerification.APPROVED,
  });

  if (approvedDocument) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      `${document.type} document is already approved`
    );
  }

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

  document.verification_status = DocumentVerification.APPROVED;
  document.rejected_reason = undefined;

  if (document.type === DocumentType.ID) {
    verificationStatus.id_verified = {
      status: VerificationState.APPROVED,
      date: new Date(),
      success: true,
    };
  } else if (document.type === DocumentType.EDUCATION) {
    verificationStatus.education_verified = {
      status: VerificationState.APPROVED,
      date: new Date(),
      success: true,
    };
  } else if (document.type === DocumentType.PARENT_ID) {
    const approvedParentPhoto = await DocumentModel.findOne({
      candidate: document.candidate,
      type: DocumentType.PARENT_PHOTO,
      verification_status: DocumentVerification.APPROVED,
    });

    verificationStatus.parent_verified = approvedParentPhoto
      ? {
          status: VerificationState.APPROVED,
          date: new Date(),
          success: true,
        }
      : {
          status: VerificationState.PENDING,
          date: new Date(),
        };
  }

  await Promise.all([
    document.save(),
    candidate.save(),
    DocumentModel.updateMany(
      {
        _id: { $ne: document._id },
        candidate: document.candidate,
        type: document.type,
        verification_status: DocumentVerification.PENDING,
      },
      {
        $set: {
          verification_status: DocumentVerification.REJECTED,
          rejected_reason: 'Another document was approved',
        },
      }
    ),
  ]);

  return document;
};

// REJECT DOCUMENT
const rejectDocument = async (documentId: string, rejectedReason: string) => {
  const document = await DocumentModel.findById(documentId);
  if (!document) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Document not found');
  }

  if (
    document.type !== DocumentType.ID &&
    document.type !== DocumentType.EDUCATION &&
    document.type !== DocumentType.PARENT_ID
  ) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Only ID, education, and parent ID documents can be reviewed here'
    );
  }

  if (document.verification_status === DocumentVerification.APPROVED) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Approved document cannot be rejected'
    );
  }

  if (document.verification_status !== DocumentVerification.PENDING) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      'Only pending documents can be rejected'
    );
  }

  const candidate = await Candidate.findById(document.candidate);
  if (!candidate) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Candidate not found');
  }

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

  document.verification_status = DocumentVerification.REJECTED;
  document.rejected_reason = rejectedReason;

  if (document.type === DocumentType.ID) {
    verificationStatus.id_verified = {
      status: VerificationState.REJECTED,
      date: new Date(),
      success: false,
    };
  } else if (document.type === DocumentType.EDUCATION) {
    verificationStatus.education_verified = {
      status: VerificationState.REJECTED,
      date: new Date(),
      success: false,
    };
  } else if (document.type === DocumentType.PARENT_ID) {
    verificationStatus.parent_verified = {
      status: VerificationState.REJECTED,
      date: new Date(),
      success: false,
    };
  }

  await Promise.all([document.save(), candidate.save()]);

  return document;
};

// READ CANDIDATE DOCUMENTS
const getCandidateDocuments = async (candidateId: string) => {
  const documents = await DocumentModel.find({ candidate: candidateId }).sort({
    createdAt: -1,
  });
  return documents;
};

export const DocumentService = {
  verifyFace,
  uploadDocument,
  uploadParentPhoto,
  verifyParentFace,
  uploadParentIdDocument,
  approveDocument,
  rejectDocument,
  getCandidateDocuments,
};
