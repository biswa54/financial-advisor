import * as tf from '@tensorflow/tfjs';

export interface AIModelSuggestion {
  modelType: string;
  confidence: number;
  reasoning: string;
  suggestedFeatures: string[];
  hyperparameters?: {
    [key: string]: any;
  };
}

export async function getModelSuggestions(
  data: any[],
  features: string[],
  target: string
): Promise<AIModelSuggestion> {
  // Extract feature data
  const X = data.map(row => features.map(f => parseFloat(row[f]) || 0));
  const y = data.map(row => parseFloat(row[target]) || 0);

  // Convert to tensors
  const tensorX = tf.tensor2d(X);
  const tensorY = tf.tensor1d(y);

  // Analyze data characteristics
  const correlations = await calculateCorrelations(tensorX, tensorY);
  const nonLinearity = await checkNonLinearity(tensorX, tensorY);
  const complexity = features.length;

  // Cleanup tensors
  tensorX.dispose();
  tensorY.dispose();

  // Decision logic for model selection
  let modelType: string;
  let confidence: number;
  let reasoning: string;
  
  if (nonLinearity < 0.3 && correlations.mean > 0.7) {
    modelType = 'linear-regression';
    confidence = 0.8;
    reasoning = 'Strong linear correlations detected with low non-linearity';
  } else if (complexity > 5 || nonLinearity > 0.7) {
    modelType = 'neural-network';
    confidence = 0.75;
    reasoning = 'Complex relationships detected, suggesting deep learning approach';
  } else {
    modelType = 'random-forest';
    confidence = 0.85;
    reasoning = 'Moderate complexity with potential non-linear relationships';
  }

  // Sort features by importance
  const featureImportance = await calculateFeatureImportance(X, y);
  const suggestedFeatures = features
    .map((f, i) => ({ name: f, importance: featureImportance[i] }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5)
    .map(f => f.name);

  // Suggest hyperparameters based on data characteristics
  const hyperparameters = getHyperparameters(modelType, complexity, nonLinearity);

  return {
    modelType,
    confidence,
    reasoning,
    suggestedFeatures,
    hyperparameters
  };
}

export function analyzeResults(
  modelType: string,
  metrics: {
    mse: number;
    rmse: number;
    r2: number;
    mae: number;
  },
  predictions: number[],
  actualValues: number[]
): string {
  const analysis: string[] = [];

  // Analyze model performance
  if (metrics.r2 > 0.8) {
    analysis.push("The model shows strong predictive performance with high R² value.");
  } else if (metrics.r2 > 0.6) {
    analysis.push("The model shows moderate predictive performance.");
  } else {
    analysis.push("The model's predictive performance could be improved.");
  }

  // Analyze prediction errors
  const meanError = metrics.mae;
  const errorVariance = calculateErrorVariance(predictions, actualValues);
  
  if (errorVariance > meanError * 2) {
    analysis.push("High variance in prediction errors suggests inconsistent performance.");
  }

  // Provide improvement suggestions
  if (metrics.r2 < 0.7) {
    if (modelType === 'linear-regression') {
      analysis.push("Consider using non-linear models like Random Forest or Neural Network.");
    } else if (modelType === 'neural-network') {
      analysis.push("Try adjusting the network architecture or increasing training epochs.");
    } else {
      analysis.push("Consider feature engineering or gathering more training data.");
    }
  }

  return analysis.join('\n');
}

// Helper functions
async function calculateCorrelations(X: tf.Tensor2D, y: tf.Tensor1D) {
  const features = await X.array();
  const target = await y.array();
  
  const correlations = features[0].map((_, i) => {
    const featureValues = features.map(row => row[i]);
    return pearsonCorrelation(featureValues, target);
  });

  return {
    mean: correlations.reduce((a, b) => a + b, 0) / correlations.length,
    max: Math.max(...correlations)
  };
}

async function checkNonLinearity(X: tf.Tensor2D, y: tf.Tensor1D) {
  // Simple non-linearity check using polynomial terms
  const linear = await X.dot(X.transpose()).array();
  const squared = await X.pow(2).dot(X.transpose()).array();
  
  const linearCorr = pearsonCorrelation(linear.flat(), await y.array());
  const squaredCorr = pearsonCorrelation(squared.flat(), await y.array());
  
  return Math.abs(squaredCorr - linearCorr);
}

async function calculateFeatureImportance(X: number[][], y: number[]) {
  const importance = X[0].map((_, i) => {
    const featureValues = X.map(row => row[i]);
    return Math.abs(pearsonCorrelation(featureValues, y));
  });
  
  return importance;
}

function getHyperparameters(modelType: string, complexity: number, nonLinearity: number) {
  switch (modelType) {
    case 'neural-network':
      return {
        epochs: Math.min(100, 50 + complexity * 10),
        batchSize: 32,
        learningRate: nonLinearity > 0.5 ? 0.001 : 0.01,
        hiddenLayers: [
          Math.round(complexity * 8),
          Math.round(complexity * 4)
        ],
        dropout: nonLinearity > 0.5 ? 0.3 : 0.1
      };
    case 'random-forest':
      return {
        treeDepth: Math.min(20, 10 + Math.round(complexity / 2)),
        numTrees: Math.min(200, 100 + complexity * 10)
      };
    default:
      return {};
  }
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const meanX = x.reduce((a, b) => a + b, 0) / x.length;
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  
  const covXY = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const varX = x.reduce((sum, xi) => sum + Math.pow(xi - meanX, 2), 0);
  const varY = y.reduce((sum, yi) => sum + Math.pow(yi - meanY, 2), 0);
  
  return covXY / Math.sqrt(varX * varY);
}

function calculateErrorVariance(predictions: number[], actuals: number[]): number {
  const errors = predictions.map((p, i) => Math.abs(p - actuals[i]));
  const mean = errors.reduce((a, b) => a + b, 0) / errors.length;
  return errors.reduce((sum, e) => sum + Math.pow(e - mean, 2), 0) / errors.length;
}