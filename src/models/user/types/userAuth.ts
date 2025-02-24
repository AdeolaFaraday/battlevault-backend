import { TGender } from "./userDoc";


export interface CreateUserInputs {
  userName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  avatar?: string;
  totalGamesPlayed?: number;
  emailVerifiedAt?: Date;
  totalWins?: number;
  totalLosses?: number;
  experiencePoints?: number;
  gender?: TGender;
}