import React, { ChangeEvent, FormEvent, useState } from 'react';

interface DocumentUploadProps {
  onUpload: (file: File) => Promise<void>;
  loading: boolean;
}

const DocumentUpload: React.FC<DocumentUploadProps> = ({ onUpload, loading }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setSelectedFile(files[0]);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedFile) {
      await onUpload(selectedFile);
      setSelectedFile(null);
    }
  };

  return (
    <div className="upload-section">
      <h2>Upload Documents</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept=".pdf,.docx,.txt,.csv"
          onChange={handleFileChange}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !selectedFile}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
      {selectedFile && (
        <p>Selected: {selectedFile.name}</p>
      )}
    </div>
  );
};

export default DocumentUpload;
