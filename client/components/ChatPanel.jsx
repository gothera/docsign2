import { ArrowUp, ArrowDown } from "react-feather";
import { useState } from "react";

function ChatMessage({ event, timestamp }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isClient = event.event_id && !event.event_id.startsWith("event_");

  // Handle user messages from conversation.item.create
  if (event.type === "conversation.item.create" && event.item?.role === "user") {
    return (
      <div className="flex flex-col gap-2 p-2 rounded-md bg-blue-50">
        <div className="flex items-center gap-2">
          <ArrowDown className="text-blue-400" />
          <div className="text-sm text-gray-500">
            You: {timestamp}
          </div>
        </div>
        <div className="text-gray-700">{event?.item?.content[0]?.text}</div>
      </div>
    );
  }

  // if (event.type === "response.audio_transcript.done" || event.type === "response.done") {
  if (event.type === "response.done") {
    let textOutput = event?.transcript
    if (event.type === "response.done") {
      const output = event.response.output[0]
      if (output?.type === "message") {
        textOutput = output.content.find(event => event.hasOwnProperty('transcript'))?.transcript
        if (!textOutput) {
          textOutput = output.content.find(event => event.hasOwnProperty('text'))?.text
        }
      }
    }
    if (textOutput) {
      return (
        <div className="flex flex-col gap-2 p-2 rounded-md bg-green-50">
          <div className="flex items-center gap-2">
            <ArrowUp className="text-green-400" />
            <div className="text-sm text-gray-500">
              Chatboot: {timestamp}
            </div>
          </div>
          <div className="text-gray-700">{textOutput}</div>
        </div>
      );
    }
  }

  // Other events (expandable)
  return (
    <div className="flex flex-col gap-2 p-2 rounded-md bg-gray-50">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {isClient ? (
          <ArrowDown className="text-blue-400" />
        ) : (
          <ArrowUp className="text-green-400" />
        )}
        <div className="text-sm text-gray-500">
          {isClient ? "client:" : "server:"} {event.type} | {timestamp}
        </div>
      </div>
      <div
        className={`text-gray-500 bg-gray-200 p-2 rounded-md overflow-x-auto ${isExpanded ? "block" : "hidden"}`}
      >
        <pre className="text-xs">{JSON.stringify(event, null, 2)}</pre>
      </div>
    </div>
  );
}

export default function ChatPanel({ events }) {
  const filteredEvents = events.filter(event => 
    ["response.done", "conversation.item.create"].includes(event.type) &&
    !event.type.includes('delta')
  );
  const messagesToDisplay = filteredEvents.map(event => (
    <ChatMessage
      key={event.event_id}
      event={event}
      timestamp={new Date().toLocaleTimeString()}
    />
  ));

  return (
    <div className="flex flex-col gap-2 overflow-x-auto mb-4">
      <h2 className="text-lg font-bold text-center">Chat</h2>
      {events.length === 0 ? (
        <div className="text-gray-500"></div>
      ) : (
        messagesToDisplay.reverse()
      )}
    </div>
  );
}