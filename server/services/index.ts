// Export all services from a single file for easy imports

import { emailService } from './emailService';
import { gmailService } from './gmailService';
import { realTimeEmailService } from '../realTimeSync';
import { aiService } from './aiService';
import { aiModelService } from './aiModelService';
import { emailChainService } from './emailChainService';
import { adaptationLearningService } from './adaptationLearningService';
import { feedbackService } from './feedbackService';
import { taskEmbeddingService } from './taskEmbeddingService';
import { ollamaService } from './ollamaService';

export {
  emailService,
  gmailService,
  realTimeEmailService,
  aiService,
  aiModelService,
  emailChainService,
  adaptationLearningService,
  feedbackService,
  taskEmbeddingService,
  ollamaService
};