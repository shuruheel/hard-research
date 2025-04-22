export const DEFAULT_CHAT_MODEL: string = 'wander-mode';

interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'wander-mode',
    name: 'Wander',
    description: 'Quick exploration with efficient responses',
  },
  {
    id: 'deep-research-mode',
    name: 'Go Deep',
    description: 'Comprehensive multi-step research with reasoning',
  },
];
