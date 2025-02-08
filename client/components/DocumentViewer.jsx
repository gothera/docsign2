import React, { useRef } from 'react';
import * as XLSX from 'xlsx';
import mammoth from 'mammoth';
import { Bold, Italic, Underline, List, AlignLeft, AlignCenter, AlignRight, Type } from 'lucide-react';

function Toolbar() {
  return (
    <div className="flex items-center gap-2 p-2 bg-gray-100 border-b border-gray-200">
      <div className="flex items-center gap-1 pr-4 border-r border-gray-300">
        <Type className="w-4 h-4" />
        <select className="text-sm px-2 py-1 rounded border border-gray-300">
          <option>Calibri</option>
          <option>Arial</option>
          <option>Times New Roman</option>
        </select>
        <select className="text-sm w-16 px-2 py-1 rounded border border-gray-300">
          <option>11</option>
          <option>12</option>
          <option>14</option>
        </select>
      </div>
      
      <div className="flex items-center gap-1 px-4 border-r border-gray-300">
        <button className="p-1 hover:bg-gray-200 rounded">
          <Bold className="w-4 h-4" />
        </button>
        <button className="p-1 hover:bg-gray-200 rounded">
          <Italic className="w-4 h-4" />
        </button>
        <button className="p-1 hover:bg-gray-200 rounded">
          <Underline className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex items-center gap-1 px-4 border-r border-gray-300">
        <button className="p-1 hover:bg-gray-200 rounded">
          <AlignLeft className="w-4 h-4" />
        </button>
        <button className="p-1 hover:bg-gray-200 rounded">
          <AlignCenter className="w-4 h-4" />
        </button>
        <button className="p-1 hover:bg-gray-200 rounded">
          <AlignRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex items-center gap-1 px-4">
        <button className="p-1 hover:bg-gray-200 rounded">
          <List className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function DocumentViewer({ documentContent, onDocumentUpload }) {
  const fileInputRef = useRef(null);

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
        const result = await mammoth.convertToHtml({ arrayBuffer });
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

  if (documentContent.type === 'spreadsheet') {
    return (
      <div className="flex flex-col h-full bg-white">
        <Toolbar />
        <div className="flex-1 overflow-auto p-6">
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
      </div>
    );
  } else if (documentContent.type === 'document') {
    return (
      <div className="flex flex-col h-full bg-white">
        <Toolbar />
        <div className="flex-1 overflow-auto">
          <div className="max-w-[816px] min-h-full mx-auto bg-white shadow-lg">
            <div 
              className="p-12 min-h-full prose max-w-none"
              style={{
                fontFamily: 'Calibri, sans-serif',
                fontSize: '11pt',
                lineHeight: '1.5',
                color: '#333'
              }}
              dangerouslySetInnerHTML={{ __html: documentContent.content }}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default DocumentViewer;