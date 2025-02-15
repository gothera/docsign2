// First, import required dependencies at app level or in a separate file:
// npm install react-pdf pdfjs-dist
import { useState } from 'react';
import { Document, Page } from 'react-pdf';
import { pdfjs } from 'react-pdf';

// Important: Set the worker source
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFSigner = () => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  // Sample data for boxes - this can be moved to props later
  const boxes = [
    {
      coordinates: {
        height: 15,
        width: 87,
        x: 183.453125,
        y: 286.2265625
      }
    },
    // Add more boxes as needed
  ];

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  return (
    <div className="relative">
      <Document
        file="/path/to/your/document.pdf"
        onLoadSuccess={onDocumentLoadSuccess}
      >
        <div className="relative">
          <Page 
            pageNumber={pageNumber}
            renderTextLayer={false}
            renderAnnotationLayer={false}
          />
          
          {/* Overlay container for boxes */}
          <div className="absolute top-0 left-0 w-full h-full">
            {boxes.map((box, index) => (
              <div
                key={index}
                className="absolute border-2 border-red-500 bg-red-200 bg-opacity-20"
                style={{
                  height: `${box.coordinates.height}px`,
                  width: `${box.coordinates.width}px`,
                  left: `${box.coordinates.x}px`,
                  top: `${box.coordinates.y}px`,
                }}
              />
            ))}
          </div>
        </div>
      </Document>

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