import * as tf from '@tensorflow/tfjs';
import { RandomForestRegression as RFRegression } from 'ml-random-forest';
import SimpleLinearRegression from 'ml-regression-simple-linear';

export interface ModelMetrics {
  mse: number;
  rmse: number;
  r2: number;
  mae: number;
}

export interface TrainingResult {
  modelType: string;
  metrics: ModelMetrics;
  predictions: number[];
  actualValues: number[];
}

interface Hyperparameters {
  epochs?: number;
  batchSize?: number;
  learningRate?: number;
  hiddenLayers?: number[];
  dropout?: number;
  treeDepth?: number;
  numTrees?: number;
}

export async function trainModel(
  data: any[],
  target: string,
  features: string[],
  modelType: string,
  splitRatio = 0.8,
  hyperparameters: Hyperparameters = {}
): Promise<TrainingResult> {
  // Data preprocessing
  const X = data.map(row => features.map(f => {
    const val = parseFloat(row[f]);
    return isNaN(val) ? 0 : val;
  }));
  const y = data.map(row => {
    const val = parseFloat(row[target]);
    return isNaN(val) ? 0 : val;
  });

  // Normalize features
  const X_mean = X[0].map((_, col) => mean(X.map(row => row[col])));
  const X_std = X[0].map((_, col) => std(X.map(row => row[col])));
  const X_normalized = X.map(row => 
    row.map((val, i) => (val - X_mean[i]) / (X_std[i] || 1))
  );

  // Normalize target
  const y_mean = mean(y);
  const y_std = std(y);
  const y_normalized = y.map(val => (val - y_mean) / (y_std || 1));

  // Split data
  const splitIndex = Math.floor(data.length * splitRatio);
  const X_train = X_normalized.slice(0, splitIndex);
  const y_train = y_normalized.slice(0, splitIndex);
  const X_test = X_normalized.slice(splitIndex);
  const y_test = y.slice(splitIndex);

  let predictions: number[] = [];
  
  switch (modelType) {
    case 'linear-regression': {
      const regression = new SimpleLinearRegression(X_train.map(x => x[0]), y_train);
      predictions = X_test.map(x => regression.predict(x[0]) * y_std + y_mean);
      break;
    }

    case 'random-forest': {
      const rf = new RFRegression({
        nEstimators: hyperparameters.numTrees || 100,
        maxFeatures: Math.floor(Math.sqrt(features.length)),
        seed: 42,
        replacement: true,
        treeOptions: {
          maxDepth: hyperparameters.treeDepth || 10,
          minNumSamples: 2
        }
      });
      
      rf.train(X_train, y_train);
      predictions = rf.predict(X_test).map(pred => pred * y_std + y_mean);
      break;
    }

    case 'neural-network': {
      const model = tf.sequential();
      
      // Input layer
      model.add(tf.layers.dense({
        inputShape: [features.length],
        units: hyperparameters.hiddenLayers?.[0] || 64,
        activation: 'relu',
        kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
      }));

      // Hidden layers
      (hyperparameters.hiddenLayers?.slice(1) || [32]).forEach(units => {
        model.add(tf.layers.dense({
          units,
          activation: 'relu',
          kernelInitializer: 'heNormal',
          kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
        }));
        
        if (hyperparameters.dropout) {
          model.add(tf.layers.dropout({ rate: hyperparameters.dropout }));
        }
      });

      // Output layer
      model.add(tf.layers.dense({ units: 1 }));

      model.compile({
        optimizer: tf.train.adam(hyperparameters.learningRate || 0.001),
        loss: 'meanSquaredError',
        metrics: ['mse']
      });

      const xs = tf.tensor2d(X_train);
      const ys = tf.tensor2d(y_train, [y_train.length, 1]);

      await model.fit(xs, ys, {
        epochs: hyperparameters.epochs || 50,
        batchSize: hyperparameters.batchSize || 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch}: loss = ${logs?.loss}`);
          }
        }
      });

      const predictions_tensor = model.predict(tf.tensor2d(X_test)) as tf.Tensor;
      const rawPredictions = Array.from(await predictions_tensor.data());
      predictions = rawPredictions.map(pred => pred * y_std + y_mean);
      
      // Cleanup tensors
      xs.dispose();
      ys.dispose();
      predictions_tensor.dispose();
      model.dispose();
      break;
    }
  }

  // Calculate metrics
  const metrics = calculateMetrics(y_test, predictions);

  return {
    modelType,
    metrics,
    predictions,
    actualValues: y_test
  };
}

function calculateMetrics(actual: number[], predicted: number[]): ModelMetrics {
  const n = actual.length;
  
  // Calculate MSE
  const mse = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0) / n;
  
  // Calculate RMSE
  const rmse = Math.sqrt(mse);
  
  // Calculate R²
  const mean = actual.reduce((sum, val) => sum + val, 0) / n;
  const ssTotal = actual.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  const ssResidual = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const r2 = Math.max(0, Math.min(1, 1 - (ssResidual / ssTotal)));
  
  // Calculate MAE
  const mae = actual.reduce((sum, val, i) => sum + Math.abs(val - predicted[i]), 0) / n;

  return { mse, rmse, r2, mae };
}

function mean(arr: number[]): number {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function std(arr: number[]): number {
  const m = mean(arr);
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length;
  return Math.sqrt(variance);
}