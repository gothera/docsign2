import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.VITE_PATH_TO_ROOT + 'public/pdfjs/pdf.worker.min.js'
}

// Individual form field input with local state
const FormFieldInput = memo(({ 
  field, 
  pageRect,
  onValueChange 
}) => {
  const [value, setValue] = useState('');
  const adjustedX = field.x + pageRect.left;
  const adjustedY = field.y + pageRect.top;

  const handleBlur = useCallback(() => {
    onValueChange(field.id, value);
  }, [field.id, value, onValueChange]);

  return (
    <div 
      className="absolute border-2 border-blue-500 bg-white bg-opacity-90" 
      style={{ 
        left: `${adjustedX}px`,
        top: `${adjustedY}px`,
        height: `${field.height}px`,
        width: `${field.width}px`,
      }}
    >
      <div className="text-xs text-black-500 font-semibold absolute -top-4 left-0">
        {field.type}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="w-full h-full px-1 bg-transparent border-none focus:outline-none text-black"
        style={{
          fontSize: '12px',
          lineHeight: `${field.height}px`,
        }}
      />
    </div>
  );
});

// Form fields container
const FormFieldsOverlay = memo(({ 
  formFields, 
  pageRect,
  onFieldValueChange
}) => {
  return (
    <div className="absolute inset-0">
      {formFields.map((field) => (
        <FormFieldInput
          key={field.id}
          field={field}
          pageRect={pageRect}
          onValueChange={onFieldValueChange}
        />
      ))}
    </div>
  );
});

const PDFSigner = () => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageRect, setPageRect] = useState(null);
  const { documentID } = useParams();
  const pageRef = useRef(null);
  const fieldValuesRef = useRef({});

  const handleFieldValueChange = useCallback((fieldId, value) => {
    fieldValuesRef.current[fieldId] = value;
  }, []);

  const fillAndSavePDF = async () => {
    try {
      let existingPdfBytes;
      if (pdfBlob instanceof Blob || pdfBlob instanceof File) {
        existingPdfBytes = await new Response(pdfBlob).arrayBuffer();
      } else if (pdfBlob instanceof ArrayBuffer) {
        existingPdfBytes = pdfBlob;
      } else if (typeof pdfBlob === 'string') {
        const response = await fetch(pdfBlob);
        existingPdfBytes = await response.arrayBuffer();
      } else {
        throw new Error('Unsupported PDF input format');
      }
      
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const pages = pdfDoc.getPages();
      
      for (const field of documentData.form_fields) {
        const page = pages[field.pageNumber - 1];
        const { width, height } = page.getSize();
        const fieldValue = fieldValuesRef.current[field.id] || '';
        const yPosition = height - (field.y + field.height / 2);
        
        page.drawText(fieldValue, {
          x: field.x,
          y: yPosition,
          size: 12,
          font: font,
          lineHeight: field.height,
          color: rgb(0, 0, 0),
        });
      }
      
      const modifiedPdfBytes = await pdfDoc.save();
      const modifiedPdfBlob = new Blob([modifiedPdfBytes], { type: 'application/pdf' });
      
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

  // Update pageRect when necessary
  useEffect(() => {
    const updatePageRect = () => {
      if (pageRef.current) {
        const rect = pageRef.current.getBoundingClientRect();
        setPageRect(prev => {
          // Only update if the dimensions actually changed
          if (!prev || 
              prev.width !== rect.width || 
              prev.height !== rect.height || 
              prev.left !== rect.left || 
              prev.top !== rect.top) {
            return rect;
          }
          return prev;
        });
      }
    };

    // Add resize listener
    window.addEventListener('resize', updatePageRect);
    
    // Initial update with a small delay to ensure PDF is rendered
    const timeoutId = setTimeout(updatePageRect, 100);
    
    return () => {
      window.removeEventListener('resize', updatePageRect);
      clearTimeout(timeoutId);
    };
  }, [pageNumber]);

  const onDocumentLoadSuccess = useCallback(({ numPages }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  const pdfBlob = documentData?.pdf 
    ? URL.createObjectURL(new Blob([Uint8Array.from(atob(documentData.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' }))
    : null;

  const currentPageFields = documentData?.form_fields
    ?.filter(field => field.pageNumber === pageNumber) || [];

  if (!pdfBlob) {
    return <div className="flex justify-center items-center h-64">Loading document...</div>;
  }

  return (
    <div className="relative">
      <Document
        file={pdfBlob}
        onLoadSuccess={onDocumentLoadSuccess}
        loading={
          <div className="flex justify-center items-center h-64">
            Loading PDF...
          </div>
        }
      >
        <div className="relative" ref={pageRef}>
          <Page 
            pageNumber={pageNumber}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading=""
            onRenderSuccess={() => {
              // Single update after initial render
              if (!pageRect && pageRef.current) {
                const rect = pageRef.current.getBoundingClientRect();
                setPageRect(rect);
              }
            }}
          />
          
          {pageRect && (
            <FormFieldsOverlay
              formFields={currentPageFields}
              pageRect={pageRect}
              onFieldValueChange={handleFieldValueChange}
            />
          )}
        </div>
      </Document>
      
      <button
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={fillAndSavePDF}
      >
        Save Filled PDF
      </button>
      
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