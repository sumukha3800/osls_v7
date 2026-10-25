import { invokedMessage } from './typescript-message.mts';

interface Event {
  shouldFail?: boolean;
}

export const handler = async (event: Event | null): Promise<{ statusCode: number; body: string }> => {
  if (event && event.shouldFail) throw new Error('Failed on request');
  return { statusCode: 200, body: JSON.stringify({ message: invokedMessage, event }) };
};
