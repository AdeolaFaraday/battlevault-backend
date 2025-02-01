export type TGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface IUser {
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    emailVerifiedAt?: Date;
    avatar?: string;
    gender: string;
    totalGamesPlayed?: number;
    totalWins?: number;
    totalLosses?: number;
    experiencePoints?: number;
}

export default interface UserDoc extends IUser, Document {
    accountStatus?: string;
    isVerified: boolean;
    lastLogin: Date;

    __v: number;
    _id: string;
}