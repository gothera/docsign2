import { useEffect, useState } from "react";
import { CloudLightning, CloudOff, MessageSquare } from "react-feather";
import Button from "./Button";
import toolsDefinition from '../../toolsDefinition.json';

const sessionUpdate = {
  type: "session.update",
  session: {
    tools: toolsDefinition,
    tool_choice: "auto",
  },
};

function SessionStopped({ startSession }) {
  const [isActivating, setIsActivating] = useState(false);

  function handleStartSession() {
    if (isActivating) return;

    setIsActivating(true);
    startSession();
  }

  return (
    <div className="flex items-center justify-center w-full h-full">
      <Button
        onClick={handleStartSession}
        className={isActivating ? "bg-gray-600" : "bg-red-600"}
        icon={<CloudLightning height={16} />}
      >
        {isActivating ? "starting session..." : "start session"}
      </Button>
    </div>
  );
}

function SessionActive({ stopSession, sendTextMessage, sendClientEvent, isSessionActive, documentContent }) {
  const [message, setMessage] = useState("");
  const [functionAdded, setFunctionAdded] = useState(false);

  useEffect(() => {
    if (isSessionActive && !functionAdded && documentContent) {
      sessionUpdate.session.instructions = "This is the content of a document: " + documentContent.content;
      sendClientEvent(sessionUpdate);
      setFunctionAdded(true);
    }

    if (!isSessionActive) {
      setFunctionAdded(false);
    }
  }, [isSessionActive, documentContent]);

  function handleSendClientEvent() {
    sendTextMessage(message);
    setMessage("");
  }

  return (
    <div className="flex flex-col w-full gap-4">
      <input
        onKeyDown={(e) => {
          if (e.key === "Enter" && message.trim()) {
            handleSendClientEvent();
          }
        }}
        type="text"
        placeholder="send a text message..."
        className="border border-gray-200 rounded-full p-4 w-full"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex gap-4 justify-end">
        <Button
          onClick={() => {
            if (message.trim()) {
              handleSendClientEvent();
            }
          }}
          icon={<MessageSquare height={16} />}
          className="bg-blue-400"
        >
          send text
        </Button>
        <Button onClick={stopSession} icon={<CloudOff height={16} />}>
          disconnect
        </Button>
      </div>
    </div>
  );
}

export default function SessionControls({
  startSession,
  stopSession,
  sendClientEvent,
  sendTextMessage,
  isSessionActive,
  filename,
  setFilename,
  documentContent,
  setDocumentContent,
  events
}) {
  useEffect(() => {
    if (!events || events.length === 0) return;

    const mostRecentEvent = events[0];
    if (mostRecentEvent.type === "response.done" && mostRecentEvent.response?.output) {
      mostRecentEvent.response.output.forEach(async (output) => {
        if (output.type === "function_call" && output.name === "editParagraph") {
          const { newParagraph, oldParagraph } = JSON.parse(output.arguments);
          const fullPath = import.meta.env.VITE_DATA_PATH + filename;
          try {
            const resp = await fetch('http://localhost:8000/function-call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                document_id: fullPath,
                function_name: "editParagraph",
                arguments: { oldParagraph, newParagraph }
              })
            });
            
            const data = await resp.json();
            setFilename(data.outputFileName);
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
              convertImage: mammoth.images.imgElement(image => 
                image.read("base64").then(imageBuffer => ({
                  src: "data:" + image.contentType + ";base64," + imageBuffer
                }))
              )
            };
            const byteCharacters = atob(data.content);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const result = await mammoth.default.convertToHtml({ arrayBuffer: byteArray.buffer }, options);
            setDocumentContent({
              type: 'document',
              content: result.value,
              messages: result.messages
            });
          } catch (error) {
            console.error('Error:', error);
          }
        }
      });
    }
  }, [events]);

  return (
    <div className="flex gap-4 border-t-2 border-gray-200 h-full rounded-md">
      {isSessionActive ? (
        <SessionActive
          stopSession={stopSession}
          sendTextMessage={sendTextMessage}
          sendClientEvent={sendClientEvent}
          isSessionActive={isSessionActive}
          filename={filename}
          setFilename={setFilename}
          documentContent={documentContent}
          setDocumentContent={setDocumentContent}
        />
      ) : (
        <SessionStopped startSession={startSession} />
      )}
    </div>
  );
}