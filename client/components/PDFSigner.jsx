import { useState, useEffect, useRef, memo, useCallback, createContext, useContext, useReducer } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import Tesseract from 'tesseract.js';
import ChatPanel from './ChatPanel';
import SessionControls from './SessionControls';
import { startWebRTCConnection, stopWebRTCConnection, sendClientEvent } from '../utils/webRTC.jsx';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.VITE_PATH_TO_ROOT + 'public/pdfjs/pdf.worker.min.js'
  pdfjsLib.GlobalWorkerOptions.workerSrc = import.meta.env.VITE_PATH_TO_ROOT + 'public/pdfjs/pdf.worker.min.js';
}

const generateFilledPDF = async (documentData, fieldValues, setFilledPdfBlob) => {
  try {
    const pdfBlob = documentData?.pdf 
      ? URL.createObjectURL(new Blob([Uint8Array.from(atob(documentData.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' }))
      : null;

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
      const fieldValue = fieldValues[field.id] || '';
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
    setFilledPdfBlob(modifiedPdfBlob);
    return modifiedPdfBlob;
  } catch (error) {
    console.error('Error generating filled PDF:', error);
    throw error;
  }
};

// Create context for form field values
const FormFieldsContext = createContext();

// Reducer for managing form field values
const formFieldsReducer = (state, action) => {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return {
        ...state,
        [action.fieldId]: action.value
      };
    default:
      return state;
  }
};

// Context provider component
const FormFieldsProvider = ({ children }) => {
  const [fieldValues, dispatch] = useReducer(formFieldsReducer, {});

  const updateFieldValue = useCallback((fieldId, value) => {
    dispatch({ type: 'UPDATE_FIELD', fieldId, value });
  }, []);

  return (
    <FormFieldsContext.Provider value={{ fieldValues, updateFieldValue }}>
      {children}
    </FormFieldsContext.Provider>
  );
};

// Custom hook for accessing form field context
const useFormFields = () => {
  const context = useContext(FormFieldsContext);
  if (!context) {
    throw new Error('useFormFields must be used within a FormFieldsProvider');
  }
  return context;
};

// Individual form field input component
const FormFieldInput = memo(({ 
  field, 
  pageRect,
}) => {
  const { fieldValues, updateFieldValue } = useFormFields();
  const adjustedX = field.x + pageRect.left;
  const adjustedY = field.y + pageRect.top;

  const handleChange = useCallback((e) => {
    updateFieldValue(field.id, e.target.value);
  }, [field.id, updateFieldValue]);

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
        value={fieldValues[field.id] || ''}
        onChange={handleChange}
        className="w-full h-full px-1 bg-transparent border-none focus:outline-none text-black"
        style={{
          fontSize: '12px',
          lineHeight: `${field.height}px`,
        }}
      />
    </div>
  );
});

// Form fields overlay component
const FormFieldsOverlay = memo(({ 
  formFields, 
  pageRect,
}) => {
  return (
    <div className="absolute inset-0">
      {formFields.map((field) => (
        <FormFieldInput
          key={field.id}
          field={field}
          pageRect={pageRect}
        />
      ))}
    </div>
  );
});

const SignButton = memo(({ documentData, filledPdfBlob, setError, setIsSigned, setFilledPdfBlob, setSignedPdfBlob }) => {
  const { fieldValues } = useFormFields();

  const handleSign = async () => {
    try {
      if (!documentData) {
        throw new Error('Document data not yet loaded');
      }
      const formData = new FormData();

      let pdfBlob = filledPdfBlob ;
      if (!pdfBlob) {
        pdfBlob = await generateFilledPDF(documentData, fieldValues, setFilledPdfBlob);;
      }

      // Append the Blob to formData
      formData.append('pdf', pdfBlob, 'document.pdf');
      formData.append('document_id', documentData.id);

      const response = await fetch('http://localhost:8000/sign', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to sign document');
      
      const signedData = await response.json();
      const signedPdfBytes = Uint8Array.from(atob(signedData.signed_pdf), c => c.charCodeAt(0));
      const signedBlob = new Blob([signedPdfBytes], { type: 'application/pdf' });
      setSignedPdfBlob(signedBlob);
      setIsSigned(true);
    } catch (err) {
      console.error('Error signing PDF:', err);
      setError(err.message)
    }
  };

  return (
    <button
      className="mt-4 ml-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      onClick={handleSign}
    >
      Sign Document
    </button>
  );
});

// Save PDF Button component that handles PDF generation
const SavePDFButton = memo(({ documentData, setFilledPdfBlob }) => {
  const { fieldValues } = useFormFields();

  const fillAndSavePDF = async () => {
    try {
      const modifiedPdfBlob = await generateFilledPDF(documentData, fieldValues, setFilledPdfBlob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(modifiedPdfBlob);
      downloadLink.download = 'filled_form.pdf';
      downloadLink.click();
    } catch (error) {
      console.error('Error filling PDF:', error);
    }
  };

  return (
    <button
      className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      onClick={fillAndSavePDF}
    >
      Save Filled PDF
    </button>
  );
});

// PDF Viewer component
const PDFViewer = memo(({ 
  pdfBlob, 
  pageNumber, 
  currentPageFields,
  pageRef,
  pageRect,
  setPageRect,
  onDocumentLoadSuccess,
  isSigned
}) => {
  return (
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
            if (!pageRect && pageRef.current) {
              const rect = pageRef.current.getBoundingClientRect();
              setPageRect(rect);
            }
          }}
        />
        
        {pageRect && !isSigned && (
          <FormFieldsOverlay
            formFields={currentPageFields}
            pageRect={pageRect}
          />
        )}
      </div>
    </Document>
  );
});

// Navigation Controls component
const NavigationControls = memo(({ 
  pageNumber, 
  numPages, 
  onPrevious, 
  onNext 
}) => {
  return (
    <div className="mt-4 flex justify-center gap-4">
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        onClick={onPrevious}
        disabled={pageNumber <= 1}
      >
        Previous
      </button>
      <p>
        Page {pageNumber} of {numPages}
      </p>
      <button
        className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        onClick={onNext}
        disabled={pageNumber >= numPages}
      >
        Next
      </button>
    </div>
  );
});

// Main PDFSigner component
const PDFSigner = ({ setPdfText }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pageRect, setPageRect] = useState(null);
  const [isSigned, setIsSigned] = useState(false);
  const [signedPdfBlob, setSignedPdfBlob] = useState(null);
  const [filledPdfBlob, setFilledPdfBlob] = useState(null);
  const { documentID } = useParams();
  const pageRef = useRef(null);

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(`http://localhost:8000/document?id=${documentID}`);
        if (!response.ok) {
          throw new Error('Failed to fetch document');
        }
        const data = await response.json();
        setDocumentData(data);

        console.log(pdfjsLib.GlobalWorkerOptions.workerSrc)
        const pdfBlob = new Blob([Uint8Array.from(atob(data.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' });
        const arrayBuffer = await pdfBlob.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          let pageText = textContent.items.map(item => item.str).join(' ');
  
          // Fallback to OCR if no text is extracted
          if (!pageText.trim()) {
            // console.log(`No text on page ${i}, attempting OCR`);
            const canvas = document.createElement('canvas');
            const viewport = page.getViewport({ scale: 2 }); // Higher scale for better OCR
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const context = canvas.getContext('2d');
            await page.render({ canvasContext: context, viewport }).promise;
            
            const { data: { text } } = await Tesseract.recognize(canvas, 'eng');
            pageText = text;
            console.log(`Finished OCR on page ${i}`);
          }
          fullText += pageText + '\n';
        }
        setPdfText(fullText.trim())
      } catch (err) {
        console.log(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (documentID) fetchDocument();

  }, [documentID]);

  useEffect(() => {
    const updatePageRect = () => {
      if (pageRef.current) {
        const rect = pageRef.current.getBoundingClientRect();
        setPageRect(prev => {
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

    window.addEventListener('resize', updatePageRect);
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

  const handlePrevious = useCallback(() => {
    setPageNumber(prev => prev - 1);
  }, []);

  const handleNext = useCallback(() => {
    setPageNumber(prev => prev + 1);
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
      <PDFViewer
        pdfBlob={signedPdfBlob || pdfBlob}
        pageNumber={pageNumber}
        currentPageFields={currentPageFields}
        pageRef={pageRef}
        pageRect={pageRect}
        setPageRect={setPageRect}
        onDocumentLoadSuccess={onDocumentLoadSuccess}
        isSigned={isSigned}
      />
      {!isSigned && (
        <>
          <SavePDFButton documentData={documentData} setFilledPdfBlob={setFilledPdfBlob} />
          <SignButton 
            documentData={documentData}
            filledPdfBlob={filledPdfBlob}
            setError={setError}
            setFilledPdfBlob={setFilledPdfBlob}
            setSignedPdfBlob={setSignedPdfBlob}
            setIsSigned={setIsSigned}
          />
        </>
      )}
      <NavigationControls
        pageNumber={pageNumber}
        numPages={numPages}
        onPrevious={handlePrevious}
        onNext={handleNext}
      />
    </div>
  );
};

const PDFSignerWrapper = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [pdfText, setPdfText] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  async function startSession() {
    const { peerConnection: pc, audioElement: audio } = await startWebRTCConnection(setDataChannel, setIsSessionActive);
    peerConnection.current = pc;
    audioElement.current = audio;
  }

  function stopSession() {
    stopWebRTCConnection(peerConnection.current, dataChannel);
    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  function sendClientEventWrapper(message) {
    sendClientEvent(dataChannel, message, setEvents);
  }

  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: message }],
      },
    };
    sendClientEventWrapper(event);
    sendClientEventWrapper({ type: "response.create" });
  }

  useEffect(() => {
    console.log(`This is the content of the PDF document: ${pdfText}`)
    if (dataChannel) {
      dataChannel.addEventListener("message", (e) => {
        setEvents((prev) => [JSON.parse(e.data), ...prev]);
      });
      // Send PDF content as instructions when session opens
      if (isSessionActive && pdfText) {
        const sessionUpdate = {
          type: "session.update",
          session: {
            instructions: `This is the content of the PDF document: ${pdfText}`,
          },
        };
        console.log(`Sent the content of the PDF document: ${pdfText}`)
        sendClientEventWrapper(sessionUpdate);
      }
    }
  }, [dataChannel, isSessionActive, pdfText]);

  return (
    <FormFieldsProvider>
      <div className="flex h-screen">
        <section className="flex-1 overflow-y-auto p-4">
          <PDFSigner setPdfText={setPdfText} />
        </section>
        <section className="w-[300px] flex flex-col border-l border-gray-200">
          <div className="flex-1 overflow-y-auto p-4">
            <ChatPanel events={events} />
          </div>
          <div className="p-4 border-t border-gray-200">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEventWrapper}
              sendTextMessage={sendTextMessage}
              isSessionActive={isSessionActive}
              events={events}
            />
          </div>
        </section>
      </div>
    </FormFieldsProvider>
  );
};

export default PDFSignerWrapper;