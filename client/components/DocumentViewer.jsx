import React, { useRef, useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import * as XLSX from 'xlsx';

function DocumentViewer({ documentContent, onDocumentUpload }) {
  const fileInputRef = useRef(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const documentRef = useRef(null);

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
            <button
              onClick={() => {
                setShowPdfPreview(false);
                setPdfUrl(null);
              }}
              className="px-3 py-1 text-gray-600 hover:text-gray-800"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 bg-gray-100 p-6">
            {isConverting ? (
              <div className="flex items-center justify-center h-full">
                <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Converting to PDF...</p>
                </div>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="w-full h-full rounded-lg shadow-lg bg-white"
                title="PDF Preview"
              />
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