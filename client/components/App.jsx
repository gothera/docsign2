import { useEffect, useRef, useState } from "react";;
import EventLog from "./EventLog";
import SessionControls from "./SessionControls";
import ToolPanel from "./ToolPanel";
import DocumentViewer from "./DocumentViewer";

export default function App() {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [events, setEvents] = useState([]);
  const [dataChannel, setDataChannel] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);
  const [filename, setFilename] = useState(null);
  const peerConnection = useRef(null);
  const audioElement = useRef(null);

  async function startSession() {
    const tokenResponse = await fetch("/token");
    const data = await tokenResponse.json();
    const EPHEMERAL_KEY = data.client_secret.value;

    const pc = new RTCPeerConnection();
    
    // Set up to play remote audio from the model
    audioElement.current = document.createElement("audio");
    audioElement.current.autoplay = true;
    pc.ontrack = (e) => (audioElement.current.srcObject = e.streams[0]);

    // Add local audio track for microphone input in the browser
    const ms = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    pc.addTrack(ms.getTracks()[0]);

    // Set up data channel for sending and receiving events
    const dc = pc.createDataChannel("oai-events");
    setDataChannel(dc);

    // Start the session using the Session Description Protocol (SDP)
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

    const answer = {
      type: "answer",
      sdp: await sdpResponse.text(),
    };
    await pc.setRemoteDescription(answer);

    peerConnection.current = pc;
  }

  function stopSession() {
    if (dataChannel) {
      dataChannel.close();
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }

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

  // Send a text message to the model
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

    sendClientEvent(event);
    sendClientEvent({ type: "response.create" });
  }

  function handleDocumentUpload(content) {
    console.log('Document upload handler called with content:', content);
    setDocumentContent(content);
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

  return (
    <>
      {/* <nav className="absolute top-0 left-0 right-0 h-16 flex items-center">
        <div className="flex items-center gap-4 w-full m-4 pb-2 border-0 border-b border-solid border-gray-200">
          <img style={{ width: "24px" }} src={logo} />
          <h1>Document Editor Console</h1>
          <div className="ml-auto flex gap-4">
            <Link to="/" className="text-blue-600 hover:text-blue-800">Home</Link>
            <Link to="/sign" className="text-blue-600 hover:text-blue-800">Sign</Link>
          </div>
        </div>
      </nav> */}
      <main className="absolute top-16 left-0 right-0 bottom-0">
        <section className="absolute top-0 left-0 right-[100px] bottom-0 flex">
          <section className="absolute top-0 left-0 right-0 bottom-32 px-4 overflow-y-auto">
            <DocumentViewer 
              documentContent={documentContent} 
              onDocumentUpload={handleDocumentUpload}
              filename={filename}
              setFilename={setFilename}
            />
            <EventLog events={events} />
          </section>
          <section className="absolute h-32 left-0 right-0 bottom-0 p-4">
            <SessionControls
              startSession={startSession}
              stopSession={stopSession}
              sendClientEvent={sendClientEvent}
              sendTextMessage={sendTextMessage}
              isSessionActive={isSessionActive}
            />
          </section>
        </section>
        <section className="absolute top-0 w-[100px] right-0 bottom-0 p-4 pt-0 overflow-y-auto">
          <ToolPanel
            sendClientEvent={sendClientEvent}
            events={events}
            isSessionActive={isSessionActive}
            filename={filename}
            setFilename={setFilename}
            documentContent={documentContent}
            setDocumentContent={setDocumentContent}
          />
        </section>
      </main>
    </>
  );
}