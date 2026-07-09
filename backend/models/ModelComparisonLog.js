/**
 * ModelComparisonLog - private research log comparing the OpenRouter output
 * that was actually delivered to the user against what the same prompt would
 * have produced via a local Ollama model, when the agent happens to be online.
 *
 * This is NOT used anywhere in the product UI and never affects what's
 * generated/delivered — it exists solely so the OpenRouter and Ollama outputs
 * for the same prompt can be compared manually (e.g. directly in the DB) for
 * evaluation/research purposes.
 */
import mongoose from 'mongoose';

const modelResultSchema = new mongoose.Schema({
  model: String,
  output: String,
  latencyMs: Number,
  success: Boolean,
  error: String
}, { _id: false });

const modelComparisonLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    default: null
  },
  deviceType: { type: String, default: null },
  prompt: { type: String, required: true },
  openrouter: { type: modelResultSchema, default: null },
  ollama: { type: modelResultSchema, default: null },
  createdAt: { type: Date, default: Date.now }
});

modelComparisonLogSchema.index({ userId: 1, createdAt: -1 });

const ModelComparisonLog = mongoose.model('ModelComparisonLog', modelComparisonLogSchema);
export default ModelComparisonLog;
