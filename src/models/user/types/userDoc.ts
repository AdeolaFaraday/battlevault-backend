export type TGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface ICountry {
    countryName: string;
    countryCode: string;
}

export interface IUser {
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    emailVerifiedAt?: Date;
    emailVerificationToken?: string;
    avatar?: string;
    gender: string;
    totalGamesPlayed?: number;
    totalWins?: number;
    totalLosses?: number;
    experiencePoints?: number;
    country?: ICountry;
}

export default interface UserDoc extends IUser, Document {
    accountStatus?: string;
    isVerified: boolean;
    lastLogin: Date;

    __v: number;
    _id: string;
}