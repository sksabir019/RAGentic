import React from 'react';

interface Citation {
  documentId: string;
  chunkId: string;
  content: string;
}

interface ResponseDisplayProps {
  response: {
    response: string;
    confidence: number;
    citations: Citation[];
    warning?: string;
  };
}

const ResponseDisplay: React.FC<ResponseDisplayProps> = ({ response }) => {
  return (
    <div className="response-section">
      <h2>Response</h2>
      
      {response.warning && (
        <div className="warning">
          ⚠️ {response.warning}
        </div>
      )}

      <div className="response-text">
        <p>{response.response}</p>
      </div>

      <div className="confidence">
        <label htmlFor="confidence-bar">Confidence Score:</label>
        <div id="confidence-bar" className="confidence-bar">
          <div
            className="confidence-fill"
            style={{ width: `${response.confidence * 100}%` }}
          />
        </div>
        <span>{(response.confidence * 100).toFixed(1)}%</span>
      </div>

      {response.citations.length > 0 && (
        <div className="citations">
          <h3>Sources</h3>
          <ul>
            {response.citations.map((citation) => (
              <li key={`${citation.documentId}-${citation.chunkId}`}>
                <strong>{citation.documentId}</strong>
                <p>{citation.content.substring(0, 100)}...</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ResponseDisplay;
