import React, { useState, useEffect } from 'react';
import { Brain, TrendingUp, LineChart as LineChartIcon, AlertCircle, Settings, RefreshCw, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { supabase } from '../lib/supabase';
import { trainModel, type TrainingResult } from '../lib/ml';
import { getModelSuggestions, analyzeResults, type AIModelSuggestion } from '../lib/ai';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface ModelConfig {
  target: string;
  features: string[];
  splitRatio: number;
  optimizationMethod: string;
  hyperparameters: {
    epochs?: number;
    batchSize?: number;
    learningRate?: number;
    hiddenLayers?: number[];
    dropout?: number;
    treeDepth?: number;
    numTrees?: number;
  };
}

interface ModelResult {
  id: string;
  model_name: string;
  model_parameters: {
    target: string;
    features: string[];
  };
  accuracy: number;
  metrics: {
    r2: number;
    mse: number;
    rmse: number;
    mae: number;
  };
  created_at?: string;
}

interface TargetAnalysis {
  target: string;
  results: ModelResult[];
  bestAccuracy: number;
  averageAccuracy: number;
}

export default function Models() {
  const { activeDataset, modelResults, updateModelResults } = useDataStore();
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [training, setTraining] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelConfig, setModelConfig] = useState<ModelConfig>({
    target: '',
    features: [],
    splitRatio: 0.8,
    optimizationMethod: 'adam',
    hyperparameters: {
      epochs: 50,
      batchSize: 32,
      learningRate: 0.001,
      hiddenLayers: [64, 32],
      dropout: 0.2,
      treeDepth: 10,
      numTrees: 100
    }
  });
  const [currentResult, setCurrentResult] = useState<TrainingResult | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AIModelSuggestion | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [loadingAI, setLoadingAI] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    if (training) {
      const interval = setInterval(() => {
        setTrainingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 1;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [training]);

  const models = [
    {
      id: 'linear-regression',
      name: 'Linear Regression',
      description: 'Predicts continuous values based on linear relationships',
      icon: TrendingUp,
      hyperparameters: ['learningRate']
    },
    {
      id: 'random-forest',
      name: 'Random Forest',
      description: 'Ensemble learning method for classification and regression',
      icon: Brain,
      hyperparameters: ['treeDepth', 'numTrees']
    },
    {
      id: 'neural-network',
      name: 'Neural Network',
      description: 'Deep learning model for complex pattern recognition',
      icon: LineChartIcon,
      hyperparameters: ['epochs', 'batchSize', 'learningRate', 'hiddenLayers', 'dropout']
    },
  ];

  const handleConfigChange = (field: keyof ModelConfig, value: any) => {
    setModelConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleHyperparameterChange = (param: string, value: any) => {
    setModelConfig(prev => ({
      ...prev,
      hyperparameters: {
        ...prev.hyperparameters,
        [param]: value
      }
    }));
  };

  const getAISuggestions = async () => {
    if (!activeDataset || !modelConfig.target) return;

    setLoadingAI(true);
    try {
      const data = activeDataset.data.map(item => item.data);
      const availableFeatures = Object.keys(data[0] || {});
      
      const suggestion = await getModelSuggestions(
        data,
        availableFeatures.filter(f => f !== modelConfig.target),
        modelConfig.target
      );

      setAiSuggestion(suggestion);
      
      setSelectedModel(suggestion.modelType);
      handleConfigChange('features', suggestion.suggestedFeatures);
      if (suggestion.hyperparameters) {
        Object.entries(suggestion.hyperparameters).forEach(([key, value]) => {
          handleHyperparameterChange(key, value);
        });
      }
    } catch (error) {
      console.error('Error getting AI suggestions:', error);
    } finally {
      setLoadingAI(false);
    }
  };

  const trainSelectedModel = async () => {
    if (!activeDataset || !selectedModel || !modelConfig.target || modelConfig.features.length === 0) {
      return;
    }

    setTraining(true);
    setTrainingProgress(0);
    try {
      const result = await trainModel(
        activeDataset.data.map((d: any) => d.data),
        modelConfig.target,
        modelConfig.features,
        selectedModel,
        modelConfig.splitRatio,
        modelConfig.hyperparameters
      );

      setCurrentResult(result);
      setTrainingProgress(100);

      const maxValue = Math.max(...result.actualValues);
      const minValue = Math.min(...result.actualValues);
      const range = maxValue - minValue;
      const normalizedMSE = result.metrics.mse / (range * range);
      const accuracy = Math.max(0, Math.min(100, (1 - normalizedMSE) * 100));

      const newResult: ModelResult = {
        id: crypto.randomUUID(),
        model_name: selectedModel,
        model_parameters: {
          target: modelConfig.target,
          features: modelConfig.features
        },
        accuracy: accuracy,
        metrics: result.metrics,
        created_at: new Date().toISOString()
      };

      updateModelResults([...modelResults, newResult]);

      const analysis = analyzeResults(
        selectedModel,
        result.metrics,
        result.predictions,
        result.actualValues
      );
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('Error training model:', error);
    } finally {
      setTraining(false);
    }
  };

  const getResultsByTarget = (): TargetAnalysis[] => {
    const groupedResults = modelResults.reduce((acc, result) => {
      const target = result.model_parameters.target;
      if (!acc[target]) {
        acc[target] = [];
      }
      acc[target].push(result);
      return acc;
    }, {} as Record<string, ModelResult[]>);

    return Object.entries(groupedResults).map(([target, results]) => ({
      target,
      results: results.sort((a, b) => b.accuracy - a.accuracy),
      bestAccuracy: Math.max(...results.map(r => r.accuracy)),
      averageAccuracy: results.reduce((sum, r) => sum + r.accuracy, 0) / results.length
    }));
  };

  if (!activeDataset) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-center text-gray-500">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>Please upload a CSV file from the Dashboard to train models.</p>
          </div>
        </div>
      </div>
    );
  }

  const availableFeatures = Object.keys(activeDataset.data[0]?.data || {});

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-6">Machine Learning Models</h1>

        <div className="mb-6">
          <button
            onClick={getAISuggestions}
            disabled={!modelConfig.target || loadingAI}
            className={`flex items-center justify-center w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
              loadingAI ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {loadingAI ? 'Getting AI Suggestions...' : 'Get AI Suggestions'}
          </button>
        </div>

        {aiSuggestion && (
          <div className="mb-6 p-4 bg-purple-50 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">AI Recommendations</h3>
            <div className="space-y-2">
              <p className="text-purple-800">
                <span className="font-medium">Recommended Model:</span> {aiSuggestion.modelType}
              </p>
              <p className="text-purple-800">
                <span className="font-medium">Confidence:</span> {(aiSuggestion.confidence * 100).toFixed(1)}%
              </p>
              <p className="text-purple-800">
                <span className="font-medium">Reasoning:</span> {aiSuggestion.reasoning}
              </p>
              <div>
                <span className="font-medium text-purple-800">Suggested Features:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {aiSuggestion.suggestedFeatures.map(feature => (
                    <span key={feature} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {models.map((model) => {
            const Icon = model.icon;
            return (
              <div
                key={model.id}
                className={`border rounded-lg p-6 cursor-pointer transition-all ${
                  selectedModel === model.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedModel(model.id)}
              >
                <div className="flex items-center mb-4">
                  <Icon className="h-6 w-6 text-blue-600 mr-2" />
                  <h3 className="text-lg font-semibold">{model.name}</h3>
                </div>
                <p className="text-gray-600 mb-4">{model.description}</p>
              </div>
            );
          })}
        </div>

        {selectedModel && (
          <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Model Configuration</h2>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center text-blue-600 hover:text-blue-700"
              >
                <Settings className="h-4 w-4 mr-1" />
                {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Variable
              </label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                value={modelConfig.target}
                onChange={(e) => handleConfigChange('target', e.target.value)}
              >
                <option value="">Select target variable</option>
                {availableFeatures.map(feature => (
                  <option key={feature} value={feature}>{feature}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Features
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableFeatures
                  .filter(f => f !== modelConfig.target)
                  .map(feature => (
                    <button
                      key={feature}
                      onClick={() => {
                        const features = modelConfig.features.includes(feature)
                          ? modelConfig.features.filter(f => f !== feature)
                          : [...modelConfig.features, feature];
                        handleConfigChange('features', features);
                      }}
                      className={`px-3 py-1 rounded-full text-sm ${
                        modelConfig.features.includes(feature)
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {feature}
                    </button>
                  ))}
              </div>
            </div>

            {showAdvanced && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-4">Advanced Configuration</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedModel === 'neural-network' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Epochs
                        </label>
                        <input
                          type="number"
                          value={modelConfig.hyperparameters.epochs}
                          onChange={(e) => handleHyperparameterChange('epochs', parseInt(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Batch Size
                        </label>
                        <input
                          type="number"
                          value={modelConfig.hyperparameters.batchSize}
                          onChange={(e) => handleHyperparameterChange('batchSize', parseInt(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Learning Rate
                        </label>
                        <input
                          type="number"
                          step="0.001"
                          value={modelConfig.hyperparameters.learningRate}
                          onChange={(e) => handleHyperparameterChange('learningRate', parseFloat(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Dropout Rate
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={modelConfig.hyperparameters.dropout}
                          onChange={(e) => handleHyperparameterChange('dropout', parseFloat(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
                  {selectedModel === 'random-forest' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tree Depth
                        </label>
                        <input
                          type="number"
                          value={modelConfig.hyperparameters.treeDepth}
                          onChange={(e) => handleHyperparameterChange('treeDepth', parseInt(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of Trees
                        </label>
                        <input
                          type="number"
                          value={modelConfig.hyperparameters.numTrees}
                          onChange={(e) => handleHyperparameterChange('numTrees', parseInt(e.target.value))}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {training && (
              <div className="mb-6">
                <div className="flex items-center mb-2">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  <span className="text-sm text-gray-600">Training in Progress...</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${trainingProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <button
              className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                training ? 'opacity-75 cursor-not-allowed' : ''
              }`}
              disabled={training || !modelConfig.target || modelConfig.features.length === 0}
              onClick={trainSelectedModel}
            >
              {training ? 'Training in Progress...' : 'Train Model'}
            </button>
          </div>
        )}

        {currentResult && (
          <div className="mt-8 border-t pt-6">
            <h2 className="text-lg font-semibold mb-4">Latest Training Results</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800">R² Score</h3>
                <p className="mt-2 text-2xl font-semibold text-blue-900">
                  {currentResult.metrics.r2.toFixed(4)}
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-green-800">RMSE</h3>
                <p className="mt-2 text-2xl font-semibold text-green-900">
                  {currentResult.metrics.rmse.toFixed(4)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-purple-800">MSE</h3>
                <p className="mt-2 text-2xl font-semibold text-purple-900">
                  {currentResult.metrics.mse.toFixed(4)}
                </p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-orange-800">MAE</h3>
                <p className="mt-2 text-2xl font-semibold text-orange-900">
                  {currentResult.metrics.mae.toFixed(4)}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4">Predictions vs Actual Values</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={currentResult.predictions.map((pred, i) => ({
                      index: i,
                      predicted: pred,
                      actual: currentResult.actualValues[i],
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="index" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      stroke="#3b82f6"
                      name="Predicted"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="#10b981"
                      name="Actual"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {aiAnalysis && (
          <div className="mt-6 p-4 bg-purple-50 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-900 mb-2">AI Analysis</h3>
            <p className="text-purple-800 whitespace-pre-line">{aiAnalysis}</p>
          </div>
        )}

        {modelResults.length > 0 && (
          <>
            <div className="mt-8 border-t pt-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Training History</h2>
                <button
                  onClick={() => setShowComparison(!showComparison)}
                  className="flex items-center text-blue-600 hover:text-blue-700"
                >
                  {showComparison ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Hide Comparison
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4 mr-1" />
                      Show Comparison
                    </>
                  )}
                </button>
              </div>

              {showComparison && (
                <div className="mb-6 bg-white rounded-lg shadow p-4">
                  <h3 className="text-lg font-semibold mb-4">Model Performance Comparison</h3>
                  {getResultsByTarget().map(({ target, results, bestAccuracy, averageAccuracy }) => (
                    <div key={target} className="mb-6">
                      <h4 className="text-md font-medium mb-2">Target: {target}</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <p className="text-sm text-gray-600">Best Accuracy</p>
                            <p className="text-xl font-semibold text-blue-600">{bestAccuracy.toFixed(2)}%</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Average Accuracy</p>
                            <p className="text-xl font-semibold text-green-600">{averageAccuracy.toFixed(2)}%</p>
                          </div>
                        </div>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={results}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="model_name" />
                              <YAxis domain={[0, 100]} />
                              <Tooltip />
                              <Bar dataKey="accuracy" fill="#3b82f6" name="Accuracy %" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="mt-4">
                          <h5 className="text-sm font-medium mb-2">Model Rankings:</h5>
                          <div className="space-y-2">
                            {results.map((result, index) => (
                              <div key={index} className="flex justify-between items-center text-sm">
                                <span className="text-gray-700">{index + 1}. {result.model_name}</span>
                                <span className="font-medium text-blue-600">{result.accuracy.toFixed(2)}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-md font-medium mb-2">Key Insights:</h4>
                    <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
                      <li>Different models perform better for different target variables due to varying data patterns and relationships</li>
                      <li>Consider using the best-performing model type for each specific target variable</li>
                      <li>Higher accuracy indicates better prediction capability for that particular target</li>
                      <li>Compare both accuracy and R² scores to get a complete picture of model performance</li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {modelResults.map((result: ModelResult, index: number) => (
                  <div key={`${result.model_name}-${index}`} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{result.model_name}</h3>
                        <p className="text-sm text-gray-500">
                          Target: {result.model_parameters.target}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-blue-600 block">
                          Accuracy: {result.accuracy.toFixed(2)}%
                        </span>
                        <span className="text-gray-500 text-sm block">
                          R² Score: {result.metrics.r2.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}