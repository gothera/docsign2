// First, import required dependencies at app level or in a separate file:
// npm install react-pdf pdfjs-dist
import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';  // Import from react-router-dom, not react
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.VITE_PATH_TO_ROOT + 'public/pdfjs/pdf.worker.min.js'
}

const PDFSigner = () => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [documentData, setDocumentData] = useState(null);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { documentID } = useParams();
  const pageRef = useRef(null);

  // Function to fill and save the PDF
  const fillAndSavePDF = async () => {
    try {
      // Handle different types of PDF input
      let existingPdfBytes;
      if (pdfBlob instanceof Blob || pdfBlob instanceof File) {
        existingPdfBytes = await new Response(pdfBlob).arrayBuffer();
      } else if (pdfBlob instanceof ArrayBuffer) {
        existingPdfBytes = pdfBlob;
      } else if (typeof pdfBlob === 'string') {
        // Handle base64 or URL string
        const response = await fetch(pdfBlob);
        existingPdfBytes = await response.arrayBuffer();
      } else {
        throw new Error('Unsupported PDF input format');
      }
      
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      
      // Embed the default font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      // Get the first page
      const pages = pdfDoc.getPages();
      
      // Process each form field
      for (const field of documentData.form_fields) {
        const page = pages[field.pageNumber - 1];
        const { width, height } = page.getSize();
        
        // Add text to the page at the specified coordinates
        page.drawText(field.type || '', {
          x: field.x,
          y: height - field.y, // Flip Y coordinate since PDF coordinates start from bottom
          size: 12,
          font: font,
          color: rgb(0, 0, 0),
        });
      }
      
      // Save the modified PDF
      const modifiedPdfBytes = await pdfDoc.save();
      
      // Create a blob from the modified PDF bytes
      const modifiedPdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      
      // Create a download link and trigger download
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(modifiedPdfBlob);
      downloadLink.download = 'filled_form.pdf';
      downloadLink.click();
      
    } catch (error) {
      console.error('Error filling PDF:', error);
    }
  };

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
      <div className="relative" ref={pageRef}>
        <Page 
          pageNumber={pageNumber}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
        
        {/* Overlay container for form fields */}
        <div className="absolute inset-0">
          {documentData?.form_fields
            ?.filter(field => field.pageNumber === pageNumber)
            ?.map((field) => {
              const pageDiv = pageRef.current;
              if (!pageDiv) return null;
              
              const rect = pageDiv.getBoundingClientRect();
              // Add offset based on the page position
              const adjustedX = field.x + rect.left;
              const adjustedY = field.y + rect.top;
              console.log("Da", adjustedX, adjustedY, field.x, field.y)
              return (
                <div 
                  key={field.id} 
                  className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20" 
                  style={{ 
                    left: `${adjustedX}px`,  // Using original x since it's already relative to the page
                    top: `${adjustedY}px`,   // Using original y since it's already relative to the page
                    height: `${field.height}px`,
                    width: `${field.width}px`,
                  }}
                >
                  <div className="text-xs text-black-500 font-big mb-1 transform -translate-y-4">
                    {field.type}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </Document>
        )}
        <button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={fillAndSavePDF}
      >
        Save Filled PDF
      </button>
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