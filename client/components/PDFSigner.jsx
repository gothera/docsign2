// First, import required dependencies at app level or in a separate file:
// npm install react-pdf pdfjs-dist
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';  // Import from react-router-dom, not react
import { Document, Page, pdfjs } from 'react-pdf';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.VITE_PATH_TO_ROOT + 'public/pdfjs/pdf.worker.min.js'
}

const PDFSigner = () => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { documentID } = useParams();

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(`http://localhost:8000/document?id=${documentID}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }
        const data = await response.json();
        setDocumentData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (documentID) {
      fetchDocument();
    }
  }, [documentID]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  // Convert base64 PDF to blob URL
  const pdfBlob = documentData?.pdf 
    ? URL.createObjectURL(new Blob([Uint8Array.from(atob(documentData.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' }))
    : null;

    return (
      <div className="relative">
        {pdfBlob && (
          <Document
            file={pdfBlob}
            onLoadSuccess={onDocumentLoadSuccess}
          >
            <div className="relative">
              <Page 
                pageNumber={pageNumber}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              
              {/* Overlay container for form fields */}
              <div className="absolute top-0 left-0 w-full h-full">
              {documentData?.form_fields
                ?.filter(field => field.pageNumber === pageNumber)
                ?.map((field) => (
                                      <div key={field.id} className="absolute" style={{ left: `${field.x}px`, top: `${field.y}px` }}>
                      <div className="text-xs text-black-500 font-big mb-1 transform -translate-y-4">
                        {field.type}
                      </div>
                      <div
                        className="border-2 border-red-500 bg-red-200 bg-opacity-20"
                        style={{
                          height: `${field.height}px`,
                          width: `${field.width}px`,
                        }}
                      />
                    </div>
                ))}
              </div>
            </div>
          </Document>
        )}
  
        {/* Navigation controls */}
        <div className="mt-4 flex justify-center gap-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            onClick={() => setPageNumber(pageNumber - 1)}
            disabled={pageNumber <= 1}
          >
            Previous
          </button>
          <p>
            Page {pageNumber} of {numPages}
          </p>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
            onClick={() => setPageNumber(pageNumber + 1)}
            disabled={pageNumber >= numPages}
          >
            Next
          </button>
        </div>
      </div>
    );
};

export default PDFSigner;