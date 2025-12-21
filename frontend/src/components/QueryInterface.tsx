import React, { FormEvent, useState } from 'react';

interface Document {
  id: string;
  name: string;
}

interface QueryInterfaceProps {
  documents: Document[];
  onQuery: (query: string, selectedDocs: string[]) => Promise<void>;
  loading: boolean;
}

const QueryInterface: React.FC<QueryInterfaceProps> = ({
  documents,
  onQuery,
  loading
}) => {
  const [query, setQuery] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  const handleDocumentToggle = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId)
        ? prev.filter((id) => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (query.trim() && selectedDocs.length > 0) {
      await onQuery(query, selectedDocs);
      setQuery('');
    }
  };

  return (
    <div className="query-section">
      <h2>Query Documents</h2>
      <form onSubmit={handleSubmit}>
        <textarea
          placeholder="Ask a question about your documents..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={loading}
        />

        <div className="documents-selector">
          <label htmlFor="doc-list">Select documents to search:</label>
          {documents.length === 0 ? (
            <p>No documents uploaded yet</p>
          ) : (
            documents.map((doc) => (
              <label key={doc.id} htmlFor={`doc-${doc.id}`}>
                <input
                  id={`doc-${doc.id}`}
                  type="checkbox"
                  checked={selectedDocs.includes(doc.id)}
                  onChange={() => handleDocumentToggle(doc.id)}
                />
                {doc.name}
              </label>
            ))
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !query.trim() || selectedDocs.length === 0}
        >
          {loading ? 'Processing...' : 'Ask Question'}
        </button>
      </form>
    </div>
  );
};

export default QueryInterface;
