import { useState, useEffect } from 'react';
import { ArrowLeft, FileText, Clock, Hash } from 'react-feather';
import Button from '../components/Button';

export default function ResultsPage() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBenchmarkRuns();
  }, []);

  const fetchBenchmarkRuns = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/benchmark-runs');

      if (!response.ok) {
        throw new Error(`Failed to fetch runs: ${response.status} ${response.statusText}`);
      }

      const runsData = await response.json();
      setRuns(runsData);
    } catch (err) {
      console.error('Error fetching benchmark runs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch (err) {
      return dateString;
    }
  };

  const handleBackToConsole = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-600" size={32} />
            <h1 className="text-3xl font-bold text-gray-900">Benchmark Results</h1>
          </div>

          <Button
            onClick={handleBackToConsole}
            icon={<ArrowLeft height={16} />}
            className="bg-gray-600"
          >
            Back to Console
          </Button>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-sm border">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500">Loading benchmark runs...</div>
            </div>
          )}

          {error && (
            <div className="p-6">
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-red-800 font-medium">Error loading results</div>
                <div className="text-red-600 text-sm mt-1">{error}</div>
                <Button
                  onClick={fetchBenchmarkRuns}
                  className="bg-red-600 mt-3 text-sm"
                >
                  Retry
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && (
            <>
              {runs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText className="text-gray-300 mb-4" size={48} />
                  <div className="text-gray-500 text-lg">No benchmark runs found</div>
                  <div className="text-gray-400 text-sm mt-2">
                    Start a benchmark run from the console to see results here
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left py-3 px-6 font-medium text-gray-700">
                          <div className="flex items-center gap-2">
                            <Hash size={16} />
                            Run ID
                          </div>
                        </th>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">
                          <div className="flex items-center gap-2">
                            <Clock size={16} />
                            Created At
                          </div>
                        </th>
                        <th className="text-left py-3 px-6 font-medium text-gray-700">
                          <div className="flex items-center gap-2">
                            <FileText size={16} />
                            Turns
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run, index) => (
                        <tr
                          key={run.run_id}
                          className={`border-b hover:bg-gray-50 ${
                            index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                          }`}
                        >
                          <td className="py-4 px-6">
                            <button
                              onClick={() => window.location.href = `/results/${run.run_id}`}
                              className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                              title="Click to view full transcript"
                            >
                              {run.run_id}
                            </button>
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-sm text-gray-700">
                              {formatDate(run.created_at)}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-sm text-gray-900 font-medium">
                              {run.num_turns}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {runs.length > 0 && (
                <div className="px-6 py-4 border-t bg-gray-50">
                  <div className="text-sm text-gray-500">
                    Total: {runs.length} benchmark run{runs.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Info Note */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="text-blue-800 text-sm">
            <strong>Note:</strong> This page displays metadata for completed benchmark runs.
            Full transcripts and event logs are stored securely on the server and not exposed in the browser interface.
          </div>
        </div>
      </div>
    </div>
  );
}