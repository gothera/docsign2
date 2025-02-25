import { useEffect, useRef, useState } from "react";;
import ChatPanel from "./ChatPanel";
import SessionControls from "./SessionControls";
import DocumentViewer from "./DocumentViewer";
import Sidebar from './Sidebar';
import { startWebRTCConnection, stopWebRTCConnection, sendClientEvent } from "../utils/webRTC.jsx";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);
  const [filename, setFilename] = useState(null);
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

  // Replace sendTextMessage to use sendClientEventWrapper
  function sendTextMessage(message) {
    const event = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: message,
          },
        ],
      },
    };
    sendClientEventWrapper(event);
    sendClientEventWrapper({ type: "response.create" });
  }

  useEffect(() => {
    if (dataChannel) {
      dataChannel.addEventListener("message", (e) => {
        setEvents((prev) => [JSON.parse(e.data), ...prev]);
      });
    }
  }, [dataChannel]);

  return (
    <>
      <main className="absolute top-2 left-0 right-0 bottom-0 flex">
        <Sidebar 
          setDocumentContent={setDocumentContent} 
          setFilename={setFilename} 
        />
        <section className="flex-1 relative">
          <section className="absolute top-0 left-0 right-[300px] bottom-0 px-4 overflow-y-auto">
            <DocumentViewer 
              documentContent={documentContent} 
              onDocumentUpload={setDocumentContent}
              filename={filename}
              setFilename={setFilename}
            />
          </section>
          <section className="absolute top-0 w-[300px] right-0 bottom-0 p-4 overflow-y-auto">
            <section className="absolute top-0 left-0 right-0 bottom-44 px-4 overflow-y-auto">
              <ChatPanel events={events} />
            </section>
            <section className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              <SessionControls
                startSession={startSession}
                stopSession={stopSession}
                sendClientEvent={sendClientEventWrapper}
                sendTextMessage={sendTextMessage}
                isSessionActive={isSessionActive}
                filename={filename}
                setFilename={setFilename}
                documentContent={documentContent}
                setDocumentContent={setDocumentContent}
                events={events}
              />
            </section>
          </section>
        </section>
      </main>
    </>
  );
}