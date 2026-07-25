
import { apiClient, ApiError } from '@/lib/api';

export interface RewardPayload {
  eventId: string;
  userId: string;
  amount: number;
}

export interface RewardResponse {
  success: boolean;
  transactionId: string;
}

export async function claimEventReward(payload: RewardPayload): Promise<RewardResponse> {
  try {
    const result = await apiClient.post<RewardResponse>('/rewards/claim', payload);
    return result;
  } catch (error) {
    if (error instanceof ApiError) {
      console.error(`Failed to claim reward (${error.status}): ${error.message}`);
      throw error; 
    }
    throw new Error('An unexpected error occurred while claiming the reward.');
  }
}