import { StatusCodes } from 'http-status-codes';
import AppError from '../../../errorHelpers/AppError';
import { Role } from '../../user/user.interface';
import { JwtPayload } from 'jsonwebtoken';
import DocumentModel from '../../document/document.model';

const readDocuments = async (user: JwtPayload, query: Record<string, string>) => {
  if (user.role !== Role.ADMIN) {
    throw new AppError(
      StatusCodes.FORBIDDEN,
      'Your are not permitted to access'
    );
  }


  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const sort = query.order.toLocaleLowerCase() === 'asc' ? 1 : -1;

  const documents = await DocumentModel.aggregate([
    {
      $group: {
        _id: '$candidate',
        docs: {$push: "$$ROOT"}
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
                        images: 1
                    }
                }
            ]
        }
    },

    {
        $unwind: "$profile"
    },

    {
      $sort: { 'docs.createdAt': sort }
    },

    {
      $skip: skip
    },
    {
      $limit: limit
    }
  ]);

  return documents;
};

export const dashboardDocuments = {
  readDocuments,
};
