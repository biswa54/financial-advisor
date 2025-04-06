import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface DataState {
  activeDatasetId: string | null;
  activeDataset: any | null;
  analysisResults: any[];
  modelResults: any[];
  setActiveDataset: (datasetId: string) => Promise<void>;
  clearActiveDataset: () => void;
  updateAnalysisResults: (results: any[]) => void;
  updateModelResults: (results: any[]) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  activeDatasetId: null,
  activeDataset: null,
  analysisResults: [],
  modelResults: [],

  setActiveDataset: async (datasetId: string) => {
    try {
      // Fetch dataset metadata
      const { data: dataset, error: datasetError } = await supabase
        .from('financial_datasets')
        .select('*')
        .eq('id', datasetId)
        .single();

      if (datasetError) throw datasetError;

      // Fetch actual data
      const { data: financialData, error: dataError } = await supabase
        .from('financial_data')
        .select('*')
        .eq('dataset_id', datasetId);

      if (dataError) throw dataError;

      set({
        activeDatasetId: datasetId,
        activeDataset: {
          ...dataset,
          data: financialData
        }
      });

      // Clear previous results
      set({ analysisResults: [], modelResults: [] });
    } catch (error) {
      console.error('Error setting active dataset:', error);
    }
  },

  clearActiveDataset: () => {
    set({
      activeDatasetId: null,
      activeDataset: null,
      analysisResults: [],
      modelResults: []
    });
  },

  updateAnalysisResults: (results) => {
    set({ analysisResults: results });
  },

  updateModelResults: (results) => {
    set({ modelResults: results });
  }
}));