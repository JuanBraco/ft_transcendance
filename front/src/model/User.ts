//TO DO CLEAN USER

interface GameMdl {
  id: string;
  players: User[];
  scoreR: number;
  scoreL: number;
  error: string;
  mode: string;
  status: string;
  winnerId: string;
  type: string;
  owner: User;
}

export interface User {
    id: string;
    nickname: string;
    email: string;
    fullName: string;
    imageUrl?: string;
    online:   boolean;
    isPlaying: boolean;
    playerOf: GameMdl[];
  }
