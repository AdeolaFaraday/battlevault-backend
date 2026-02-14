import { Document } from 'mongoose';

export default interface DailyBlitzDoc extends Document {
    userId: string;
    date: string;
    loginRewardClaimed: boolean;
    winsToday: number;
    win1RewardClaimed: boolean;
    win3RewardClaimed: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}
