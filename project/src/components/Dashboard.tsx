import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import Papa from 'papaparse';
import { supabase } from '../lib/supabase';
import { useDataStore } from '../store/dataStore';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const { setActiveDataset } = useDataStore();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFile(file);
      setLoading(true);
      
      try {
        // Parse CSV
        const results = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            complete: resolve,
            error: reject,
          });
        });

        // Create dataset entry
        const { data: dataset, error: datasetError } = await supabase
          .from('financial_datasets')
          .insert({
            user_id: user?.id,
            filename: file.name,
            columns: results.meta.fields,
          })
          .select()
          .single();

        if (datasetError) throw datasetError;

        // Insert data points
        const dataPoints = results.data.map((row: any) => ({
          dataset_id: dataset.id,
          data: row,
          timestamp: new Date(),
        }));

        const { error: dataError } = await supabase
          .from('financial_data')
          .insert(dataPoints);

        if (dataError) throw dataError;

        // Set as active dataset
        await setActiveDataset(dataset.id);

        setLoading(false);
      } catch (error) {
        console.error('Error uploading file:', error);
        setLoading(false);
      }
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Financial Data Analysis Dashboard</h1>
        
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Upload CSV File</label>
          <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
            <div className="space-y-1 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500">
                  <span>Upload a file</span>
                  <input
                    type="file"
                    className="sr-only"
                    accept=".csv"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">CSV files only</p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="mt-4">
            <div className="animate-pulse flex space-x-4">
              <div className="flex-1 space-y-4 py-1">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {file && !loading && (
          <div className="mt-4">
            <h2 className="text-lg font-semibold">File uploaded successfully!</h2>
            <p className="text-sm text-gray-600">
              Filename: {file.name}
              <br />
              Size: {(file.size / 1024).toFixed(2)} KB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}