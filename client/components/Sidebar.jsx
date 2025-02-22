import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Sidebar({ setDocumentContent, setFilename }) {
    const [documents, setDocuments] = useState({ sent: [], received: [] });
    const [activeTab, setActiveTab] = useState('received');
    const userEmail = "cosminn01rm@gmail.com";

    const loadNewDocument = (doc) => {
        return async () => {
            try {
                const response = await fetch(`http://localhost:8000/document?id=${doc.id}`);
                const data = await response.json();
                setFilename(doc.filename);
                setDocumentContent({
                    type: 'document',
                    content: data.content,
                    // messages: result.messages
                });
            } catch (error) {
                console.error('Error fetching document:', error);
            }
        };
    }

    const renderDocumentList = (docs, isSentTab = false) => (
    <ul className="space-y-2">
        {docs.map(doc => (
        <li key={doc.id}>
            {isSentTab ? (
            // <button
            //     onClick={loadNewDocument(doc)}
            //     className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded w-full text-left"
            // >
            <Link
                to={`/sign/${doc.id}`}
                target="_blank"
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded"
            >
                <FileText size={16} />
                <span>{doc.name}</span>
                <span className="ml-auto text-sm text-gray-500">{doc.status}</span>
            </Link>
            // </button>
            ) : (
            <Link
                to={`/sign/${doc.id}`}
                target="_blank"
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded"
            >
                <FileText size={16} />
                <span>{doc.name}</span>
                <span className="ml-auto text-sm text-gray-500">{doc.status}</span>
            </Link>
            )}
        </li>
        ))}
    </ul>
    );

    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
        const response = await fetch(`http://localhost:8000/documents?user_email=${userEmail}`);
        const data = await response.json();
        setDocuments(data);
        } catch (error) {
        console.error('Error fetching documents:', error);
        }
    };

    return (
        <div className="w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Documents</h2>
        </div>
        
        <div className="flex border-b border-gray-200">
            <button
            className={`flex-1 p-2 ${activeTab === 'received' ? 'bg-white border-b-2 border-blue-500' : 'bg-gray-100'}`}
            onClick={() => setActiveTab('received')}
            >
            Received
            </button>
            <button
            className={`flex-1 p-2 ${activeTab === 'sent' ? 'bg-white border-b-2 border-blue-500' : 'bg-gray-100'}`}
            onClick={() => setActiveTab('sent')}
            >
            Sent
            </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'received' ? (
            documents.received.length > 0 ? (
                renderDocumentList(documents.received)
            ) : (
                <p className="text-gray-500">No received documents</p>
            )
            ) : (
            documents.sent.length > 0 ? (
                renderDocumentList(documents.sent, true)
            ) : (
                <p className="text-gray-500">No sent documents</p>
            )
            )}
        </div>
        </div>
    );
}