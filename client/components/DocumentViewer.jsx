import React, { useRef, useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Document, Page, pdfjs } from 'react-pdf';

if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = import.meta.env.VITE_PATH_TO_ROOT + 'public/pdfjs/pdf.worker.min.js'
}


function DocumentViewer({ documentContent, onDocumentUpload, filename, setFilename}) {
  const fileInputRef = useRef(null);
  const canvasRef = useRef();
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const documentRef = useRef(null);

  // PDF specific states
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [boxes, setBoxes] = useState({});  // Boxes stored by page number
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState(null);
  const [currentBox, setCurrentBox] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null); // Track which box's dropdown is active
  const pageRefs = useRef({});

  
  const convertToPdf = async () => {
    if (!documentContent || !documentRef.current) return;
    
    setIsConverting(true);
    try {
      // Dynamically import html2pdf only when needed
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: [10, 10],
        filename: 'document.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      const pdf = await html2pdf()
        .set(opt)
        .from(documentRef.current)
        .outputPdf('blob');
      const url = URL.createObjectURL(pdf);
      setPdfUrl(url);
      setShowPdfPreview(true);
    } catch (error) {
      console.error('Error converting to PDF:', error);
    } finally {
      setIsConverting(false);
    }
  };

  const requestSignature = async () => {

    // Fetch the PDF content from the Object URL
    const response = await fetch(pdfUrl);
    const pdfBlob = await response.blob();

    // Create FormData and append both the file and additional fields
    const formData = new FormData();
    formData.append('file', pdfBlob, 'document.pdf');
    formData.append('document_id', filename);
    formData.append('signer_email', "cosminn01rm@gmail.com");
    formData.append('form_field', JSON.stringify(Object.values(boxes).flat()));
    const resp = await fetch('http://localhost:8000/request-signature', {
      method: 'POST',
      body: formData
    });
    const data = await resp.json();
    console.log("Req sign", data)
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    console.log('PDF loaded successfully');
    setNumPages(numPages);
    // Initialize boxes state for all pages
    const initialBoxes = {};
    for (let i = 1; i <= numPages; i++) {
      initialBoxes[i] = [];
    }
    setBoxes(initialBoxes);
  };

  const onDocumentLoadError = (error) => {
    console.error('Error loading PDF:', error);
    // You might want to show an error message to the user here
  };

  const BOX_TYPES = ['Text', 'Name', 'Email', 'Address', 'Signature'];

  const startDrawing = (e, pageNumber) => {
    if (activeDropdown) return; // Prevent drawing while selecting type
    
    const pageDiv = pageRefs.current[pageNumber];
    if (!pageDiv) return;

    const rect = pageDiv.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setIsDrawing(true);
    setStartPoint({ x, y, pageNumber });
  };

  const draw = (e, pageNumber) => {
    if (!isDrawing || !startPoint || startPoint.pageNumber !== pageNumber) return;

    const pageDiv = pageRefs.current[pageNumber];
    if (!pageDiv) return;

    const rect = pageDiv.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / scale;
    const currentY = (e.clientY - rect.top) / scale;

    const newBox = {
      x: Math.min(currentX, startPoint.x),
      y: Math.min(currentY, startPoint.y),
      width: Math.abs(currentX - startPoint.x),
      height: Math.abs(currentY - startPoint.y),
      pageNumber,
      id: Date.now() // Add unique identifier for each box
    };

    setCurrentBox(newBox);
  };

  const stopDrawing = () => {
    if (isDrawing && currentBox) {
      const pageBoxes = boxes[currentBox.pageNumber] || [];
      setBoxes({
        ...boxes,
        [currentBox.pageNumber]: [...pageBoxes, { ...currentBox, type: null }]
      });
      setActiveDropdown(currentBox.id); // Show dropdown for the new box
    }
    
    setIsDrawing(false);
    setCurrentBox(null);
    setStartPoint(null);
  };

  const handleTypeSelection = (boxId, pageNumber, selectedType) => {
    const pageBoxes = boxes[pageNumber] || [];
    const updatedBoxes = pageBoxes.map(box => {
      if (box.id === boxId) {
        // Create the complete box object with all necessary fields
        return {
          id: box.id,
          pageNumber: box.pageNumber,
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          type: selectedType,
        };
      }
      return box;
    });

    setBoxes({
      ...boxes,
      [pageNumber]: updatedBoxes
    });

    setActiveDropdown(null); // Hide dropdown after selection
    
    // Log the box coordinates with page number and type
    const updatedBox = updatedBoxes.find(box => box.id === boxId);
    console.log('Box updated:', {
      page: pageNumber,
      type: selectedType,
      coordinates: {
        x: updatedBox.x,
        y: updatedBox.y,
        width: updatedBox.width,
        height: updatedBox.height
      }
    });
  };

    // Custom page renderer with annotation overlay
    const renderPage = ({ pageNumber }) => {
      const pageBoxes = boxes[pageNumber] || [];
      const isDrawingOnThisPage = currentBox?.pageNumber === pageNumber;
      
      return (
        <div 
          className="relative"
          ref={el => pageRefs.current[pageNumber] = el}
          onMouseDown={e => startDrawing(e, pageNumber)}
          onMouseMove={e => draw(e, pageNumber)}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        >
          <Page
            pageNumber={pageNumber}
            scale={scale}
            className="shadow-lg"
          />
            <div className="absolute inset-0">
              {/* Render existing boxes */}
              {pageBoxes.map((box) => (
                <div key={box.id} className="relative">
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20"
                    style={{
                      left: box.x * scale,
                      top: box.y * scale,
                      width: box.width * scale,
                      height: box.height * scale
                    }}
                  />
                  {/* Type label if selected */}
                  {box.type && (
                    <div
                      className="absolute bg-blue-500 text-white text-xs px-1 rounded"
                      style={{
                        left: box.x * scale,
                        top: (box.y * scale) - 20
                      }}
                    >
                      {box.type}
                    </div>
                  )}
                  {/* Dropdown for type selection */}
                  {activeDropdown === box.id && (
                    <div
                      className="absolute z-10 bg-white border border-gray-200 rounded shadow-lg"
                      style={{
                        left: (box.x * scale) + (box.width * scale),
                        top: box.y * scale
                      }}
                    >
                      <select
                        className="w-full p-2 focus:outline-none"
                        onChange={(e) => handleTypeSelection(box.id, pageNumber, e.target.value)}
                        value={box.type || ''}
                        autoFocus
                      >
                        <option value="">Select type...</option>
                        {BOX_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
              {/* Render current box being drawn */}
              {isDrawingOnThisPage && currentBox && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20"
                  style={{
                    left: currentBox.x * scale,
                    top: currentBox.y * scale,
                    width: currentBox.width * scale,
                    height: currentBox.height * scale
                  }}
                />
              )}
        </div>
      </div>
      );
    };

  // Cleanup URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      if (file.name.endsWith('.xlsx')) {
        const workbook = XLSX.read(arrayBuffer, {
          cellStyles: true,
          cellFormulas: true,
          cellDates: true,
          cellNF: true,
          sheetStubs: true
        });
        
        const documentData = {
          type: 'spreadsheet',
          sheets: {},
          activeSheet: workbook.SheetNames[0]
        };

        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          documentData.sheets[sheetName] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        });

        onDocumentUpload(documentData);
      } else if (file.name.endsWith('.docx')) {
        // Dynamically import mammoth
        setFilename(file.name)
        console.log("Filename is", file)
        const mammoth = await import('mammoth');
        const options = {
          styleMap: [
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Normal'] => p:fresh",
            "table => table.doc-table",
            "r[style-name='Strong'] => strong:fresh",
            "r[style-name='Emphasis'] => em:fresh",
            "p[style-name='List Paragraph'] => li:fresh"
          ],
          convertImage: mammoth.images.imgElement(function(image) {
            return image.read("base64").then(function(imageBuffer) {
              return {
                src: "data:" + image.contentType + ";base64," + imageBuffer
              };
            });
          })
        };
        
        const result = await mammoth.default.convertToHtml({ arrayBuffer }, options);
        const documentData = {
          type: 'document',
          content: result.value,
          messages: result.messages
        };

        onDocumentUpload(documentData);
      }
    } catch (error) {
      console.error('Error reading file:', error);
    }
  };

  if (!documentContent) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.docx"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Open Document
              </button>
              <p className="mt-4 text-gray-600">Supported formats: .xlsx, .docx</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderDocumentContent = () => {
    if (documentContent.type === 'spreadsheet') {
      return (
        <div className="flex-1 overflow-auto p-6" ref={documentRef}>
          {Object.entries(documentContent.sheets).map(([sheetName, sheetData]) => (
            <div key={sheetName} className="mb-8">
              <div className="bg-gray-100 px-4 py-2 text-sm font-medium border border-gray-200 rounded-t">
                {sheetName}
              </div>
              <div className="overflow-x-auto border border-t-0 border-gray-200 rounded-b">
                <table className="w-full">
                  <tbody>
                    {Array.isArray(sheetData) && sheetData.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-gray-200 last:border-0">
                        {Array.isArray(row) && row.map((cell, cellIndex) => (
                          <td 
                            key={cellIndex}
                            className="border-r border-gray-200 last:border-0 p-2 min-w-[100px]"
                          >
                            {cell?.toString() || ''}
                          </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      );
    } else if (documentContent.type === 'document') {
      return (
        <div className="flex-1 overflow-auto">
          <div className="max-w-[816px] min-h-full mx-auto bg-white shadow-lg">
            <div 
              ref={documentRef}
              className="p-12 min-h-full word-document"
              style={{
                fontFamily: 'Calibri, sans-serif',
                fontSize: '11pt',
                lineHeight: '1.5',
                color: '#333',
              }}
              dangerouslySetInnerHTML={{ __html: documentContent.content }}
            />
          </div>
          <style jsx global>{`
            .word-document {
              counter-reset: h1counter h2counter h3counter;
            }
            
            .word-document h1 {
              font-family: 'Calibri Light', sans-serif;
              font-size: 16pt;
              color: #2F5496;
              font-weight: normal;
              margin-top: 24pt;
              margin-bottom: 6pt;
            }

            .word-document h2 {
              font-family: 'Calibri Light', sans-serif;
              font-size: 13pt;
              color: #2F5496;
              font-weight: normal;
              margin-top: 20pt;
              margin-bottom: 6pt;
            }

            .word-document h3 {
              font-family: 'Calibri Light', sans-serif;
              font-size: 12pt;
              color: #1F3763;
              font-weight: normal;
              margin-top: 16pt;
              margin-bottom: 4pt;
            }

            .word-document p {
              margin: 0 0 8pt 0;
              line-height: 1.5;
            }

            .word-document table.doc-table {
              border-collapse: collapse;
              width: 100%;
              margin: 12pt 0;
            }

            .word-document table.doc-table td,
            .word-document table.doc-table th {
              border: 1px solid #BFBFBF;
              padding: 7pt 9pt;
              vertical-align: top;
              font-size: 11pt;
            }

            .word-document table.doc-table th {
              background-color: #F2F2F2;
              font-weight: bold;
            }

            .word-document ul,
            .word-document ol {
              margin: 0 0 8pt 0;
              padding-left: 40px;
            }

            .word-document li {
              margin-bottom: 4pt;
            }

            .word-document img {
              max-width: 100%;
              height: auto;
              margin: 12pt 0;
            }

            .word-document strong {
              font-weight: bold;
            }

            .word-document em {
              font-style: italic;
            }

            /* Default Word list styles */
            .word-document ul {
              list-style-type: disc;
            }

            .word-document ul ul {
              list-style-type: circle;
            }

            .word-document ul ul ul {
              list-style-type: square;
            }

            .word-document ol {
              list-style-type: decimal;
            }

            .word-document ol ol {
              list-style-type: lower-alpha;
            }

            .word-document ol ol ol {
              list-style-type: lower-roman;
            }
          `}</style>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex h-full bg-white">
      {/* Left panel - Original document view */}
      <div className={`flex flex-col ${showPdfPreview ? 'w-1/2' : 'w-full'} border-r border-gray-200 transition-all duration-300`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Document View</h2>
          <button
            onClick={convertToPdf}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText size={16} />
            CONVERT
          </button>
        </div>
        {renderDocumentContent()}
      </div>

      {/* Right panel - PDF preview */}
      {showPdfPreview && (
        <div className="w-1/2 flex flex-col transition-all duration-300">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">PDF Preview</h2>
            <button onClick={requestSignature} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <FileText size={16} />
              SEND
            </button>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
                  className="px-2 py-1 text-sm bg-gray-100 rounded"
                >
                  -
                </button>
                <span className="text-sm">{Math.round(scale * 100)}%</span>
                <button 
                  onClick={() => setScale(prev => Math.min(2, prev + 0.1))}
                  className="px-2 py-1 text-sm bg-gray-100 rounded"
                >
                  +
                </button>
              </div>
              <button
                onClick={() => setBoxes({})}
                className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                Clear Boxes
              </button>
              <button
                onClick={() => {
                  setShowPdfPreview(false);
                  setPdfUrl(null);
                  setBoxes({});
                }}
                className="px-3 py-1 text-gray-600 hover:text-gray-800"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 bg-gray-100 p-6 overflow-auto">
            {isConverting ? (
              <div className="flex items-center justify-center h-full">
                <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Converting to PDF...</p>
                </div>
              </div>
            ) : pdfUrl ? (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => console.error('Error loading PDF:', error)}
                loading={
                  <div className="flex items-center justify-center p-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                }
                className="flex flex-col items-center gap-4"
              >
                {Array.from(new Array(numPages), (_, index) => (
                  <div key={`page_${index + 1}`} className="cursor-crosshair">
                    {renderPage({ pageNumber: index + 1 })}
                  </div>
                ))}
              </Document>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                  <p className="text-gray-600">Click CONVERT to generate PDF</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentViewer;