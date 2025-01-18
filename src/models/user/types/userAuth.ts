import { TGender } from "./userDoc";


export interface CreateUserInputs {
    username: string;
    email: string;
    password: string;
    avatar?: string;
    totalGamesPlayed?: number;
    totalWins?: number;
    totalLosses?: number;
    experiencePoints?: number;
    gender?: TGender;
  }