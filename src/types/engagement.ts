export interface DailyTask {
  id: string;
  title: string;
  description: string;
  emoji: string;
  progress: number;
  target: number;
  route: string;
  rewardXp: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  claimed: boolean;
  rewardXp: number;
  progress: number;
  target: number;
}

export interface EngagementHub {
  serverNow: number;
  resetsAt: number;
  streak: {
    current: number;
    best: number;
    freezeAvailable: boolean;
  };
  daily: {
    completed: number;
    total: number;
    chestClaimed: boolean;
    chestXp: number;
    tasks: DailyTask[];
  };
  achievements: Achievement[];
}
