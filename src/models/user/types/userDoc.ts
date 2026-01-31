import { IWallet } from "../../wallet/types/walletDoc";

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
    bio?: string;
    password: string;
    emailVerifiedAt?: Date;
    emailVerificationToken?: string;
    avatar?: string;
    gender: string;
    totalGamesPlayed?: number;
    totalWins?: number;
    totalLosses?: number;
    experiencePoints?: number;
    currentStreak?: number;
    bestStreak?: number;
    country?: ICountry;
    wallet?: IWallet;
}

export default interface UserDoc extends IUser, Document {
    accountStatus?: string;
    isVerified: boolean;
    lastLogin: Date;

    __v: number;
    _id: string;
}