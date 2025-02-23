import { useState, useEffect, useRef, memo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import ChatPanel from './ChatPanel';
import SessionControls from './SessionControls';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.VITE_PATH_TO_ROOT + 'public/pdfjs/pdf.worker.min.js'
}

const FormFieldInput = memo(({ field, pageRect, onValueChange, isSigned }) => {
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
        disabled={isSigned}
        className="w-full h-full px-1 bg-transparent border-none focus:outline-none text-black"
        style={{
          fontSize: '12px',
          lineHeight: `${field.height}px`,
        }}
      />
    </div>
  );
});

const FormFieldsOverlay = memo(({ formFields, pageRect, onFieldValueChange, isSigned }) => {
  return (
    <div className="absolute inset-0">
      {formFields.map((field) => (
        <FormFieldInput
          key={field.id}
          field={field}
          pageRect={pageRect}
          onValueChange={onFieldValueChange}
          isSigned={isSigned}
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
  const [signedPdfBlob, setSignedPdfBlob] = useState(null);
  const [filledPdfBlob, setFilledPdfBlob] = useState(null);
  const [isSigned, setIsSigned] = useState(false);
  const [documentContent, setDocumentContent] = useState(null);
  const [pdfBlob, setPdfBlob] = useState(null);

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
      setFilledPdfBlob(modifiedPdfBlob);
      
      const downloadLink = document.createElement('a');
      downloadLink.href = URL.createObjectURL(modifiedPdfBlob);
      downloadLink.download = 'filled_form.pdf';
      downloadLink.click();
      
    } catch (error) {
      console.error('Error filling PDF:', error);
    }
  };

  const handleSignPDF = async () => {
    try {
      const formData = new FormData();
      const pdfToSign = filledPdfBlob || pdfBlob;  // Use filled PDF if available
      const response = await fetch(typeof pdfToSign === 'string' ? pdfToSign : URL.createObjectURL(pdfToSign));
      const blob = await response.blob();
      formData.append('pdf', blob, 'document.pdf');
      formData.append('document_id', documentID);
  
      const signResponse = await fetch('http://localhost:8000/sign', {
        method: 'POST',
        body: formData,
      });
  
      if (!signResponse.ok) {
        throw new Error('Failed to sign document');
      }
  
      const data = await signResponse.json();
      const signedPdfBytes = Uint8Array.from(atob(data.signed_pdf), c => c.charCodeAt(0));
      const signedBlob = new Blob([signedPdfBytes], { type: 'application/pdf' });
      setSignedPdfBlob(URL.createObjectURL(signedBlob));
      setIsSigned(true);  // Mark document as signed
    } catch (err) {
      console.error('Error signing PDF: ', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const extractPdfContent = async (pdfBlob) => {
    try {
      const response = await fetch(typeof pdfBlob === 'string' ? pdfBlob : URL.createObjectURL(pdfBlob));
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      let textContent = '';
      for (const page of pages) {
        const text = await page.getTextContent();
        textContent += text.items.map(item => item.str).join(' ') + '\n';
      }
      setDocumentContent({ type: 'document', content: textContent });
    } catch (error) {
      console.error('Error extracting PDF content:', error);
    }
  };
  
  useEffect(() => {
    const currentPdf = signedPdfBlob || filledPdfBlob || pdfBlob;
    if (currentPdf) extractPdfContent(currentPdf);
  }, [signedPdfBlob, filledPdfBlob, pdfBlob]);

  // ========= reused stuff from App.jsx should be extracted somehow =================
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  async function startSession() {
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    const pc = new RTCPeerConnection();
    
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    const audioContext = new AudioContext();
    let ms = audioContext.createMediaStreamDestination().stream;
    if (import.meta.env?.VITE_USE_MIC?.toLowerCase?.() === 'true') {
      ms = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    pc.addTrack(ms.getTracks()[0]);

    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const baseUrl = "https://api.openai.com/v1/realtime";
    const model = "gpt-4o-realtime-preview-2024-12-17";
    const sdpResponse = await fetch(`${baseUrl}?model=${model}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${EPHEMERAL_KEY}`,
        "Content-Type": "application/sdp",
      },
    });

    const answer = { type: "answer", sdp: await sdpResponse.text() };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;
  }

  function stopSession() {
    if (dataChannel) dataChannel.close();
    if (peerConnection.current) peerConnection.current.close();

    setIsSessionActive(false);
    setDataChannel(null);
    peerConnection.current = null;
  }

  function sendClientEvent(message) {
    if (dataChannel) {
      message.event_id = message.event_id || crypto.randomUUID();
      dataChannel.send(JSON.stringify(message));
      setEvents((prev) => [message, ...prev]);
    } else {
      console.error("Failed to send message - no data channel available", message);
    }
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
    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  useEffect(() => {
    if (dataChannel) {
      dataChannel.addEventListener("message", (e) => {
        setEvents((prev) => [JSON.parse(e.data), ...prev]);
      });
      dataChannel.addEventListener("open", () => {
        setIsSessionActive(true);
        setEvents([]);
      });
    }
  }, [dataChannel]);
  // ========= end of reused stuff from App.jsx should be extracted somehow =================

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

  setPdfBlob(documentData?.pdf 
    ? URL.createObjectURL(new Blob([Uint8Array.from(atob(documentData.pdf), c => c.charCodeAt(0))], { type: 'application/pdf' }))
    : null
  )

  const currentPageFields = documentData?.form_fields
    ?.filter(field => field.pageNumber === pageNumber) || [];

  if (!pdfBlob) {
    return <div className="flex justify-center items-center h-64">Loading document...</div>;
  }

  return (
  <div className="flex h-screen">
    <div className="flex-1 relative overflow-auto">
      <Document
        file={signedPdfBlob || filledPdfBlob || pdfBlob}
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
              onFieldValueChange={handleFieldValueChange}
              isSigned={isSigned} 
            />
          )}
        </div>
      </Document>
      
      {!isSigned && (  
        <div className="mt-4 flex justify-center gap-4">
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={fillAndSavePDF}
          >
            Save Filled PDF
          </button>
          <button
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={handleSignPDF}
          >
            Sign
          </button>
        </div>
      )}
      
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
    <section className="w-[300px] flex flex-col border-l border-gray-200">
      <div className="flex-1 overflow-y-auto p-4">
        <ChatPanel events={events} />
      </div>
      <div className="p-4 border-t border-gray-200">
        <SessionControls
          startSession={startSession}
          stopSession={stopSession}
          sendClientEvent={sendClientEvent}
          sendTextMessage={sendTextMessage}
          isSessionActive={isSessionActive}
          documentContent={documentContent}
          setDocumentContent={setDocumentContent}
          events={events}
        />
      </div>
    </section>
  </div>
  );
};

export default PDFSigner;