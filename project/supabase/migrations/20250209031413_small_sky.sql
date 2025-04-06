/*
  # Financial Data Analysis Schema

  1. New Tables
    - `financial_datasets`
      - Stores metadata about uploaded CSV files
      - Links datasets to users
    - `financial_data`
      - Stores the actual financial data points
      - References financial_datasets
    - `analysis_results`
      - Stores results from ML model analysis
      - Links results to datasets and users
    - `chat_history`
      - Stores chat interactions for context
      - Links messages to datasets and users

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to:
      - Read/write their own data
      - Read their own analysis results
      - Access their chat history
*/

-- Financial Datasets Table
CREATE TABLE IF NOT EXISTS financial_datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  filename text NOT NULL,
  description text,
  columns jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Financial Data Table
CREATE TABLE IF NOT EXISTS financial_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid REFERENCES financial_datasets(id) ON DELETE CASCADE NOT NULL,
  data jsonb NOT NULL,
  timestamp timestamptz NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Analysis Results Table
CREATE TABLE IF NOT EXISTS analysis_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid REFERENCES financial_datasets(id) ON DELETE CASCADE NOT NULL,
  model_name text NOT NULL,
  model_parameters jsonb NOT NULL,
  results jsonb NOT NULL,
  accuracy numeric,
  created_at timestamptz DEFAULT now()
);

-- Chat History Table
CREATE TABLE IF NOT EXISTS chat_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  dataset_id uuid REFERENCES financial_datasets(id) ON DELETE CASCADE,
  message text NOT NULL,
  is_bot boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE financial_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

-- Policies for financial_datasets
CREATE POLICY "Users can read own datasets"
  ON financial_datasets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own datasets"
  ON financial_datasets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policies for financial_data
CREATE POLICY "Users can read own financial data"
  ON financial_data
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM financial_datasets
      WHERE financial_datasets.id = financial_data.dataset_id
      AND financial_datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own financial data"
  ON financial_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM financial_datasets
      WHERE financial_datasets.id = financial_data.dataset_id
      AND financial_datasets.user_id = auth.uid()
    )
  );

-- Policies for analysis_results
CREATE POLICY "Users can read own analysis results"
  ON analysis_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM financial_datasets
      WHERE financial_datasets.id = analysis_results.dataset_id
      AND financial_datasets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own analysis results"
  ON analysis_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM financial_datasets
      WHERE financial_datasets.id = analysis_results.dataset_id
      AND financial_datasets.user_id = auth.uid()
    )
  );

-- Policies for chat_history
CREATE POLICY "Users can read own chat history"
  ON chat_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chat messages"
  ON chat_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);