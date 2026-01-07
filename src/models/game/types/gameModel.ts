import { Model } from 'mongoose';
import GameDoc from './gameDoc';

interface GameModel extends Model<GameDoc> { }
export default GameModel;
