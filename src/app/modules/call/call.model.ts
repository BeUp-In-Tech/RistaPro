import { Schema, model } from 'mongoose';
import { CallStatus, CallType, ICall } from './call.interface';

const callSchema = new Schema<ICall>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'match' },
    callerCandidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },
    receiverCandidate: { type: Schema.Types.ObjectId, ref: 'candidate', required: true },    type: { type: String, enum: Object.values(CallType), required: true },
    status: {
      type: String,
      enum: Object.values(CallStatus),
      default: CallStatus.INITIATED,
    },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

const Call = model<ICall>('call', callSchema);

export default Call;
