import { StatusCodes } from 'http-status-codes';
import AppError from '../../../errorHelpers/AppError';
import { Role } from '../../user/user.interface';
import { JwtPayload } from 'jsonwebtoken';
import DocumentModel from '../../document/document.model';
import {
  IVerificationStatus,
  VerificationState,
} from '../../candidate/candidate.interface';
import {
  DocumentType,
  DocumentVerification,
} from '../../document/document.interface';
import Candidate from '../../candidate/candidate.model';

// READ USER'S DOCUMENTS
const readDocuments = async (
  user: JwtPayload,
  query: Record<string, string>
) => {
  if (user.role !== Role.ADMIN) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Your are not permitted to access'
    );
  }

  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const order = query.order?.toLocaleLowerCase() || 'desc';
  const sort: 1 | -1 = order === 'asc' ? 1 : -1;

  const documentsPromise = DocumentModel.aggregate([
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $group: {
        _id: '$candidate',
        lastSubmitted: {
          $first: '$$ROOT',
        },
        latestCreatedAt: {
          $first: '$createdAt',
        },
      },
    },
    {
      $lookup: {
        from: 'candidates',
        localField: '_id',
        foreignField: '_id',
        as: 'profile',
        pipeline: [
          {
            $project: {
              name: 1,
              images: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: '$profile',
    },
    {
      $sort: {
        latestCreatedAt: sort,
      },
    },
    {
      $skip: skip,
    },
    {
      $limit: limit,
    },
  ]);

  const totalResultPromise = DocumentModel.aggregate([
    {
      $group: {
        _id: '$candidate',
      },
    },
    {
      $count: 'totalDocuments',
    },
  ]);

  const [documents, totalDocuments] = await Promise.all([
    documentsPromise,
    totalResultPromise,
  ]);

  const total = totalDocuments[0]?.totalDocuments || 0;

  const meta = {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    links: {
      single: `/d/doc/:documentId`,
      approve: `/d/doc/:documentId/approve`,
      reject: `/d/doc/:documentId/reject`,
    },
  };

  return {
    meta,
    documents,
  };
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

export const dashboardDocuments = {
  readDocuments,
  rejectDocument,
  approveDocument,
};
