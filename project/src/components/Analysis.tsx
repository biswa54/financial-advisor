import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, ZAxis } from 'recharts';
import { AlertCircle, BarChart2, TrendingUp, Activity, CircleDot } from 'lucide-react';
import { useDataStore } from '../store/dataStore';
import { useThemeStore } from '../store/themeStore';
import { format, parseISO , parse } from 'date-fns';

type ChartType = 'line' | 'bar' | 'scatter' | 'correlation';

interface DataStats {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
}

export default function Analysis() {
  const { activeDataset, analysisResults } = useDataStore();
  const { isDarkMode } = useThemeStore();
  const [chartType, setChartType] = useState<ChartType>('line');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState('all');
  const [dataStats, setDataStats] = useState<Record<string, DataStats>>({});
  const [correlationMatrix, setCorrelationMatrix] = useState<any[]>([]);

  console.log('Raw Dataset:', activeDataset.data[0]);

  useEffect(() => {
    if (activeDataset?.data) {
      console.log('Raw Dataset:', activeDataset.data);
      calculateStats();
      calculateCorrelations();
    }
  }, [activeDataset]);

  const calculateStats = () => {
    if (!activeDataset?.data || !activeDataset.data.length) return;

    const stats: Record<string, DataStats> = {};
    const numericColumns = Object.keys(activeDataset.data[0]?.data || {}).filter(key => 
      !isNaN(Number(activeDataset.data[0].data[key]))
    );

    numericColumns.forEach(column => {
      const values = activeDataset.data
        .map(item => Number(item.data[column]))
        .filter(val => !isNaN(val));

      if (values.length === 0) return;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const sortedValues = [...values].sort((a, b) => a - b);
      const median = sortedValues[Math.floor(values.length / 2)];
      const stdDev = Math.sqrt(
        values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length
      );

      stats[column] = {
        mean,
        median,
        stdDev,
        min: Math.min(...values),
        max: Math.max(...values)
      };
    });

    setDataStats(stats);
  };

  const calculateCorrelations = () => {
    if (!activeDataset?.data || !activeDataset.data.length) return;

    const numericColumns = Object.keys(activeDataset.data[0]?.data || {}).filter(key => 
      !isNaN(Number(activeDataset.data[0].data[key]))
    );

    const correlations = numericColumns.map(col1 => {
      const values1 = activeDataset.data
        .map(item => Number(item.data[col1]))
        .filter(val => !isNaN(val));
      
      return numericColumns.map(col2 => {
        const values2 = activeDataset.data
          .map(item => Number(item.data[col2]))
          .filter(val => !isNaN(val));

        if (values1.length === 0 || values2.length === 0) return 0;
        return calculateCorrelation(values1, values2);
      });
    });

    setCorrelationMatrix(correlations.map((row, i) => ({
      name: numericColumns[i],
      ...Object.fromEntries(row.map((val, j) => [numericColumns[j], val]))
    })));
  };

  const calculateCorrelation = (x: number[], y: number[]) => {
    if (x.length !== y.length || x.length === 0) return 0;

    const n = x.length;
    const sum_x = x.reduce((a, b) => a + b, 0);
    const sum_y = y.reduce((a, b) => a + b, 0);
    const sum_xy = x.reduce((a, b, i) => a + b * y[i], 0);
    const sum_x2 = x.reduce((a, b) => a + b * b, 0);
    const sum_y2 = y.reduce((a, b) => a + b * b, 0);

    const numerator = n * sum_xy - sum_x * sum_y;
    const denominator = Math.sqrt((n * sum_x2 - sum_x * sum_x) * (n * sum_y2 - sum_y * sum_y));
    
    return denominator === 0 ? 0 : numerator / denominator;
  };

  if (!activeDataset) {
    return (
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isDarkMode ? 'dark' : ''}`}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-center text-gray-500 dark:text-gray-400">
            <AlertCircle className="h-6 w-6 mr-2" />
            <p>Please upload a CSV file from the Dashboard to see analysis.</p>
          </div>
        </div>
      </div>
    );
  }

  const filterDataByTimeRange = (data: any[]) => {
    if (!data || !data.length) return [];
  
    console.log("Raw Data Sample:", data[0]); // Optional debug log
  
    let count = 30; // default to 30 if timeRange is not provided
  
    switch (timeRange) {
      case 'week':
        count = 7;
        break;
      case 'month':
        count = 30;
        break;
      case 'year':
        count = 365;
        break;
      case 'all':
      default:
        count = data.length;
        break;
    }
  
    return data.slice(-count); // return last N items
  };
  


  const formatXAxisDate = (dateString: string) => {
    try {
      console.log("Raw Date String Received:", dateString); // Debugging log
      if (!dateString) return 'Invalid Date';
  
      const trimmedDateString = dateString.trim(); // Remove extra spaces
      const parsedDate = parse(trimmedDateString, 'dd-MMM-yyyy', new Date());
  
      if (isNaN(parsedDate.getTime())) {
        console.error("Date Parsing Failed for:", trimmedDateString);
        return 'Invalid Date';
      }
  
      const formattedDate = format(parsedDate, 'MMM dd, yyyy'); // e.g., "Feb 14, 2024"
      console.log("Successfully Formatted Date:", formattedDate);
      return formattedDate;
    } catch (error) {
      console.error("Error in Date Formatting:", error, "For Date String:", dateString);
      return 'Invalid Date';
    }
  };
  
  

  const chartData = filterDataByTimeRange(activeDataset.data).map((item: any) => {
    const dateKey = Object.keys(item.data).find(key => key.trim() === "Date"); // Find the correct key
    const rawDate = dateKey ? item.data[dateKey] : null; // Access the Date value
    const formattedName = rawDate ? formatXAxisDate(rawDate.trim()) : 'No Date'; // Format or fallback
  
    console.log("Raw Date:", rawDate); // Debugging log
    console.log("Formatted Name:", formattedName); // Debugging log
  
    return {
      name: formattedName,
      ...item.data
    };
  });
  
  

  const availableMetrics = Object.keys(chartData[0] || {}).filter(
    key => key !== 'name' 
  );

  const handleMetricToggle = (metric: string) => {
    setSelectedMetrics(prev => 
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  };

  const renderChart = () => {
    if (!chartData.length) return null;

    const metrics = selectedMetrics.length > 0 ? selectedMetrics : availableMetrics;
    const chartTheme = isDarkMode ? {
      backgroundColor: '#1f2937',
      textColor: '#9ca3af',
      gridColor: '#374151'
    } : {
      backgroundColor: '#f9fafb',
      textColor: '#4b5563',
      gridColor: '#e5e7eb'
    };
    
    switch (chartType) {
      case 'line':
        return (
          <LineChart data={chartData}
          margin={{ top: 20, right: 30, left: 40, bottom: 20 }} // ⬅️ Add left margin here
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
            <XAxis
              dataKey="name"
              tick={{ fill: chartTheme.textColor }}
              angle={-40}
              textAnchor="end"
              height={90}
            />
            <YAxis tick={{ fill: chartTheme.textColor }} />
            <Tooltip
              contentStyle={{
                backgroundColor: chartTheme.backgroundColor,
                borderColor: chartTheme.gridColor
              }}
            />
            <Legend />
            {metrics.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={`hsl(${index * 45}, 70%, 50%)`}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            ))}
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart data={chartData}
          margin={{ top: 20, right: 30, left: 40, bottom: 20 }} // ⬅️ Add left margin here
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
            <XAxis
              dataKey="name"
              tick={{ fill: chartTheme.textColor }}
              angle={-35}
              textAnchor="end"
              height={90}
            />
            <YAxis tick={{ fill: chartTheme.textColor }} />
            <Tooltip
              contentStyle={{
                backgroundColor: chartTheme.backgroundColor,
                borderColor: chartTheme.gridColor
              }}
            />
            <Legend
             verticalAlign="bottom"
            wrapperStyle={{ marginTop: 20 }} // 👈 Adds space between X-axis and legend
/>
            {metrics.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={`hsl(${index * 45}, 70%, 50%)`}
                
              />
            ))}
          </BarChart>
        );

      case 'scatter':
        return metrics.length >= 2 ? (
          <ScatterChart
          margin={{ top: 20, right: 30, left: 40, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
            <XAxis
              dataKey={metrics[0]}
              type="number"
              tick={{ fill: chartTheme.textColor }}
            />
            <YAxis
              dataKey={metrics[1]}
              type="number"
              tick={{ fill: chartTheme.textColor }}
            />
            <ZAxis range={[100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: chartTheme.backgroundColor,
                borderColor: chartTheme.gridColor
              }}
            />
            <Legend />
            <Scatter
              name={`${metrics[0]} vs ${metrics[1]}`}
              data={chartData}
              fill="#8884d8"
            />
          </ScatterChart>
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-4">
            Please select at least 2 metrics for scatter plot
          </div>
        );

      case 'correlation':
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Metric
                  </th>
                  {availableMetrics.map(metric => (
                    <th key={metric} className="px-6 py-3 bg-gray-50 dark:bg-gray-800 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {metric}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                {correlationMatrix.map((row, i) => (
                  <tr key={row.name}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {row.name}
                    </td>
                    {availableMetrics.map(metric => (
                      <td
                        key={metric}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400"
                        style={{
                          backgroundColor: isDarkMode
                            ? `rgba(59, 130, 246, ${Math.abs(row[metric] || 0) * 0.5})`
                            : `rgba(66, 153, 225, ${Math.abs(row[metric] || 0)})`
                        }}
                      >
                        {(row[metric] || 0).toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
    }
  };

  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 ${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Financial Analysis</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => setChartType('line')}
              className={`p-2 rounded-lg ${
                chartType === 'line'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <TrendingUp className="h-5 w-5" />
            </button>
            <button
              onClick={() => setChartType('bar')}
              className={`p-2 rounded-lg ${
                chartType === 'bar'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <BarChart2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setChartType('scatter')}
              className={`p-2 rounded-lg ${
                chartType === 'scatter'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <CircleDot className="h-5 w-5" />
            </button>
            <button
              onClick={() => setChartType('correlation')}
              className={`p-2 rounded-lg ${
                chartType === 'correlation'
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <Activity className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Time Range Filter */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Time Range</h3>
          <div className="flex space-x-4">
            {['all', 'year', 'month', 'week'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 rounded-lg text-sm ${
                  timeRange === range
                    ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Metric Selection */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Metrics</h3>
          <div className="flex flex-wrap gap-2">
  {availableMetrics.map(metric =>
    metric.trim().toLowerCase() === "date" ? null : (
      <button
        key={metric}
        onClick={() => handleMetricToggle(metric)}
        className={`px-3 py-1 rounded-full text-sm ${
          selectedMetrics.includes(metric)
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
        }`}
      >
        {metric}
      </button>
    )
  )}
</div>

        </div>

        <div className="space-y-6">
          {/* Chart */}
          <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Financial Trends</h2>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {renderChart()}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(dataStats).map(([metric, stats]) => (
              <div key={metric} className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">{metric} Statistics</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-300">Mean</p>
                    <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">{stats.mean.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-300">Median</p>
                    <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">{stats.median.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-300">Std Dev</p>
                    <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">{stats.stdDev.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-300">Range</p>
                    <p className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                      {stats.min.toFixed(2)} - {stats.max.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}